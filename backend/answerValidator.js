/**
 * AnswerValidator สำหรับ Chatbot ก.พ.ร.
 *
 * ตรวจสอบโครงสร้างและความสอดคล้องของคำตอบ
 * ทำหน้าที่เป็น layer ความปลอดภัยสุดท้ายก่อนส่งตอบกลับ
 *
 * การตรวจสอบ:
 * - ตอบไม่เป็นค่าว่าง
 * - ตรวจสอบ schema (มี fields ที่จำเป็น)
 * - ตรวจสอบ citations อ้างอิงถึงเอกสารที่ให้มา
 * - ตรวจสอบว่าไม่มีการปลอมข้อมูล
 * - ตั้ง insufficient_evidence flag เมื่อเหมาะสม
 *
 * จำกัด: การตรวจสอบอัตโนมัติไม่สามารถตรวจสอบ factual correctness ได้ทั้งหมด
 */

'use strict';

const { validateCitations, checkCitationRequirements } = require('./citationValidator');
const { getFallback } = require('./fallbackResponses');

/**
 * ตรวจสอบว่า answer เป็น string ที่ไม่เป็น null/undefined/ว่าง
 *
 * @param {*} answer
 * @returns {boolean}
 */
function isNonEmptyAnswer(answer) {
  return typeof answer === 'string' && answer.trim().length > 0;
}

/**
 * ตรวจสอบว่า intent เป็นค่าที่รองรับ
 *
 * @param {string} intent
 * @returns {boolean}
 */
function isValidIntent(intent) {
  const validIntents = [
    'GENERAL_GREETING',
    'ORGANIZATION_INFORMATION',
    'MISSION_AND_RESPONSIBILITIES',
    'PUBLIC_SERVICES',
    'GOVERNMENT_SERVICE_IMPROVEMENT',
    'LAWS_AND_REGULATIONS',
    'MANUALS_AND_DOCUMENTS',
    'DIGITAL_GOVERNMENT',
    'PUBLIC_SECTOR_DEVELOPMENT',
    'CONTACT_AND_SUPPORT',
    'DOCUMENT_SEARCH',
    'FOLLOW_UP_QUESTION',
    'OUT_OF_SCOPE',
    'INSUFFICIENT_INFORMATION'
  ];
  return validIntents.includes(intent);
}

/**
 * ตรวจสอบว่ามีข้อความที่น่าสงสัยว่าปลอมข้อมูลหรือไม่
 * ใช้ heuristic เบื้องต้น
 *
 * @param {string} answer
 * @returns {boolean}
 */
function detectPotentialFabrication(answer) {
  if (!isNonEmptyAnswer(answer)) return false;

  const redFlags = [
    /ตามที่ฉันทราบ/i,
    /ตามข้อมูลล่าสุด/i,
    /ข้อมูลเป็นทางการ/i,
    /ยืนยันว่า/i,
    /ได้รับการยืนยัน/i,
    /เราตรวจสอบแล้ว/i,
    /แหล่งข้อมูลเป็นทางการ/i,
    /อ้างอิงถึงเอกสารที่จริง/i,
    /ตามเอกสารที่ได้มา/i,
    /ระบบได้ตรวจสอบ/i
  ];

  for (const flag of redFlags) {
    if (flag.test(answer)) {
      return true;
    }
  }

  return false;
}

/**
 * ตรวจสอบว่ามีการอ้างอิงถึงแหล่งข้อมูลที่ไม่ได่มาจาก retrieval หรือไม่
 *
 * @param {string} answer
 * @param {Array} citations
 * @returns {boolean}
 */
function hasUnverifiedSourceReferences(answer, citations) {
  if (!isNonEmptyAnswer(answer)) return false;
  if (!citations || citations.length === 0) return false;

  // ตรวจสอบว่ามี URL ใน answer ที่ไม่อยู่ใน citations
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const answerUrls = answer.match(urlPattern) || [];
  const citationUrls = citations
    .filter(c => c && c.url)
    .map(c => c.url);

  for (const url of answerUrls) {
    if (!citationUrls.includes(url)) {
      // เป็น URL ที่ไม่ได้มาจาก citations
      return true;
    }
  }

  return false;
}

/**
 * ตรวจสอบว่าตอบกับคำถามที่เป็นการทักทายหรือไม่
 *
 * @param {string} intent
 * @returns {boolean}
 */
function isGreetingIntent(intent) {
  return intent === 'GENERAL_GREETING';
}

/**
 * ตรวจสอบว่าตอบกับคำถามที่อยู่นอกขอบเขตหรือไม่
 *
 * @param {string} intent
 * @returns {boolean}
 */
function isOutOfScopeIntent(intent) {
  return intent === 'OUT_OF_SCOPE';
}

/**
 * ประเภทข้อผิดพลาดในการตรวจสอบ
 */
const VALIDATION_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * ผลลัพธ์ของการตรวจสอบ
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - ผ่านการตรวจสอบหรือไม่
 * @property {string} answer - คำตอบที่ผ่านการตรวจสอบแล้ว (อาจเป็น fallback)
 * @property {string} intent - intent ที่ตรวจสอบแล้ว
 * @property {Array} citations - citations ที่ตรวจสอบแล้ว
 * @property {boolean} insufficientEvidence - มีข้อมูลไม่เพียงพอหรือไม่
 * @property {Array} warnings - คำเตือน
 * @property {Array} errors - ข้อผิดพลาก
 * @property {string|null} fallbackReason - เหตุผลสำหรับ fallback (ถ้ามี)
 * @property {string} language - ภาษาของคำตอบ
 */

/**
 * ฟังก์ชันหลักสำหรับการตรวจสอบคำตอบ
 *
 * @param {Object} params
 * @param {string} params.answer - คำตอบจาก LLM หรือ RAG
 * @param {string} params.intent - Intent ที่ classification แล้ว
 * @param {Array} params.citations - Citations ที่อ้างอิง
 * @param {Array} params.retrievedDocuments - เอกสารที่ค้นหาได้
 * @param {Object} params.contextInfo - ข้อมูลบริบท (มี evidence หรือไม่,มี conflicts หรือไม่ ฯลฯ)
 * @param {'th'|'en'} [params.language='th'] - ภาษา
 * @returns {ValidationResult}
 */
function validateAnswer({
  answer,
  intent,
  citations = [],
  retrievedDocuments = [],
  contextInfo = {},
  language = 'th'
}) {
  const result = {
    isValid: true,
    answer: answer || '',
    intent: intent || 'INSUFFICIENT_INFORMATION',
    citations: citations || [],
    insufficientEvidence: false,
    warnings: [],
    errors: [],
    fallbackReason: null,
    language: language
  };

  // 1. ตรวจสอบ answer ไม่เป็นค่าว่าง
  if (!isNonEmptyAnswer(answer)) {
    result.isValid = false;
    result.errors.push('Answer is empty or not a string');
    result.fallbackReason = 'INVALID_OUTPUT';
    result.answer = getFallback('NO_EVIDENCE', language);
    return result;
  }

  // 2. ตรวจสอบ intent เป็นค่าที่รองรับ
  if (!isValidIntent(intent)) {
    result.warnings.push(`Invalid intent "${intent}", defaulting to INSUFFICIENT_INFORMATION`);
    result.intent = 'INSUFFICIENT_INFORMATION';
  }

  // 3. ตรวจสอบจาก contextInfo
  const hasEvidence = contextInfo.hasEvidence || false;
  const hasConflicts = contextInfo.hasConflicts || false;
  const hasOutdated = contextInfo.hasOutdated || false;

  // 4. ตรวจสอบ citations
  const citationValidation = validateCitations(citations, retrievedDocuments);

  if (!citationValidation.isValid) {
    result.warnings.push('Some citations failed validation');
    citationValidation.issues.forEach(issue => {
      result.warnings.push(`Citation ${issue.citationIndex}: ${issue.issues.join(', ')}`);
    });
  }

  // 5. ตรวจสอบความสอดคล้องของ citations กับการอ้างอิงใน answer
  const hasUnverifiedRefs = hasUnverifiedSourceReferences(answer, citations);
  if (hasUnverifiedRefs) {
    result.warnings.push('Answer contains source references not backed by citations');
  }

  // 6. ตรวจสอบการปลอมข้อมูลเบื้องต้น
  const hasFabrication = detectPotentialFabrication(answer);
  if (hasFabrication) {
    result.warnings.push('Potential fabrication detected in answer');
    result.insufficientEvidence = true;
  }

  // 7. ตัดสินใจ insufficient evidence
  if (!hasEvidence && !isGreetingIntent(intent) && !isOutOfScopeIntent(intent)) {
    result.insufficientEvidence = true;
  }

  if (hasConflicts) {
    result.insufficientEvidence = true;
    result.warnings.push('Conflicting sources detected');
  }

  if (hasOutdated) {
    result.warnings.push('Potentially outdated documents included');
  }

  // 8. ตรวจสอบ requirements ของ citations
  const citationRequirements = checkCitationRequirements({
    answer,
    intent,
    citations,
    insufficientEvidence: result.insufficientEvidence
  });

  if (!citationRequirements.hasRequiredCitations) {
    result.insufficientEvidence = true;
  }

  // 9. ถ้ามีข้อผิดพลากร้าย ให้ใช้ fallback
  if (!result.isValid) {
    result.fallbackReason = 'INVALID_OUTPUT';
    result.answer = getFallback('NO_EVIDENCE', language);
  }

  return result;
}

module.exports = {
  validateAnswer,
  isNonEmptyAnswer,
  isValidIntent,
  detectPotentialFabrication,
  hasUnverifiedSourceReferences,
  isGreetingIntent,
  isOutOfScopeIntent,
  VALIDATION_LEVELS,
  // Export สำหรับการทดสอบ
  VALID_INTENTS: [
    'GENERAL_GREETING',
    'ORGANIZATION_INFORMATION',
    'MISSION_AND_RESPONSIBILITIES',
    'PUBLIC_SERVICES',
    'GOVERNMENT_SERVICE_IMPROVEMENT',
    'LAWS_AND_REGULATIONS',
    'MANUALS_AND_DOCUMENTS',
    'DIGITAL_GOVERNMENT',
    'PUBLIC_SECTOR_DEVELOPMENT',
    'CONTACT_AND_SUPPORT',
    'DOCUMENT_SEARCH',
    'FOLLOW_UP_QUESTION',
    'OUT_OF_SCOPE',
    'INSUFFICIENT_INFORMATION'
  ]
};
