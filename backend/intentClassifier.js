/**
 * IntentClassifier สำหรับ Chatbot ก.พ.ร.
 *
 * ใช้ approach แบบ deterministic/keyword-based เพื่อ classification
 * ไม่ใช้ LLM เสริม (ยังไม่มี integration)
 *
 * รองรับ 14 หมวดหมู่ตามข้อกำหนด:
 * - GENERAL_GREETING
 * - ORGANIZATION_INFORMATION
 * - MISSION_AND_RESPONSIBILITIES
 * - PUBLIC_SERVICES
 * - GOVERNMENT_SERVICE_IMPROVEMENT
 * - LAWS_AND_REGULATIONS
 * - MANUALS_AND_DOCUMENTS
 * - DIGITAL_GOVERNMENT
 * - PUBLIC_SECTOR_DEVELOPMENT
 * - CONTACT_AND_SUPPORT
 * - DOCUMENT_SEARCH
 * - FOLLOW_UP_QUESTION
 * - OUT_OF_SCOPE
 * - INSUFFICIENT_INFORMATION
 */

'use strict';

/**
 * รายชื่อ intent ทั้งหมดที่รองรับ (allowlist)
 */
const VALID_INTENTS = [
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

/**
 * พจนานุกรีย์และ keyword สำหรับแต่ละ intent
 * เรียงลำดับจากเฉพาะไปยังทั่วไป (เฉพาะจะถูกตรวจสอบก่อน)
 */
const INTENT_KEYWORDS = {
  GENERAL_GREETING: [
    'สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย', 'สบายดีไหม',
    'ดี', 'ไงบ้าง', 'หวัด', 'หัวข้อ', 'ใช้ไหม', 'เช่า', 'กับ', 'เป็นไง'
  ],

  ORGANIZATION_INFORMATION: [
    'เป็นอะไร', 'คืออะไร', 'โครงสร้าง', 'ประวัติ', 'วิสัยทัศน์', 'vision',
    'องค์ราศตรร', 'มีอะไรบ้าง', 'กพร', 'ก.พ.ร.', 'opdc', 'คณะกรรมการ',
    'คณะผู้บริหาร', 'executive', 'board', 'committee', 'มูลนิธิ', 'สมาชิก'
  ],

  MISSION_AND_RESPONSIBILITIES: [
    'พันฐกิจ', 'mission', 'หน้าที่', 'รับผิดชอบ', 'ยุทธศาสตร์', 'strategic',
    'กลยุทธ์', 'ประธานาธิบดี', 'รัฐมนตรี', 'คณะรัฐมนตรี', 'cabinet',
    'หน้าที่รับผิดชอบ', 'วิชาการ', 'ปรึกษา', 'advice', 'policy', 'นโยบาย'
  ],

  PUBLIC_SERVICES: [
    'บริการ', 'ขั้นตอน', 'วิธี', 'ขอ', 'สมัคร', 'รางวัล', 'psea',
    'ประเมิน', 'service', 'procedure', 'step', 'how to', 'apply',
    'รับบริการ', 'ใช้บริการ', 'ขั้นตอนการ', 'process'
  ],

  GOVERNMENT_SERVICE_IMPROVEMENT: [
    'ปรับปรุง', 'นวัตกรรม', 'ดิจิทัล', 'digital', 'innovation',
    'ปรับปรุงการบริการ', 'service improvement', 'improve',
    'ระบบราชการ', 'government system', 'public service',
    'ราชการดิจิทัล', 'e-government', 'อิเมลีเล็กทรอนิกส์'
  ],

  LAWS_AND_REGULATIONS: [
    'กฎหมาย', 'กฎรห�', 'ระเบียบ', 'พ.ร.บ.', 'q&a', 'q&amp;a',
    'ข้อบังคับ', ' закон', 'law', 'regulation', 'legal',
    'pdpa', 'ปกคค', 'คุ้มครองข้อมูล', 'ข้อมูลส่วนบุคคล'
  ],

  MANUALS_AND_DOCUMENTS: [
    'เอกสาร', 'pdf', 'คู่มือ', 'manual', 'document', 'ไฟล์',
    'ดาวน์โหลด', 'download', 'รายงาน', 'report', 'newsletter',
    'b-ready', 'bready', 'แนวทาง', 'guideline', 'instruction',
    'รายละเอียด', 'spec', 'specification'
  ],

  DOCUMENT_SEARCH: [
    'ค้นหา', 'search', 'หา', 'มีบริการ', 'มีเอกสาร', 'มีข้อมูล',
    'มีอะไร', 'สอบถาม', 'สืบค้น', 'lookup', 'find',
    'มีอยู่ไหม', 'มีไหม', 'อยู่ที่ไหน'
  ],

  CONTACT_AND_SUPPORT: [
    'ติดต่อ', 'โทร', 'telephone', 'เบอร์', 'phone', 'อีเมล',
    'email', 'ที่อยู่', 'address', 'facebook', 'youtube',
    'fax', 'โทรสาร', 'สถานที่', 'แผนที่', 'อยู่ที่ไหน',
    'contact', 'support', 'help'
  ],

  DIGITAL_GOVERNMENT: [
    'ดิจิทัล', 'digital', 'อิเมลีเล็กทรอนิกส์', 'อิเมล',
    'online', 'ออนไลน์', 'ระบบอิเมลี', 'digital government',
    'gov digital', 'thailand digital', 'ดิจิทัลการเจริญ'
  ],

  PUBLIC_SECTOR_DEVELOPMENT: [
    'พัฒนา', 'พัฒนาระบบ', 'ราชการ', 'public sector',
    'พัฒนาภาครัฐ', 'development', 'ประเทศไทย', 'government',
    'รัฐ', 'ราชการไทย', 'พัฒนาการ'
  ],

  FOLLOW_UP_QUESTION: [
    'ต่อไป', 'ดังกล่าว', 'นั้น', 'เรื่องนั้น', 'เก่งไหม',
    'เพิ่มเติม', 'อธิบายเพิ่ม', 'ละเอียด', 'อย่างเข้าใจ',
    'ต่อ', 'ต่อไปไหน', 'ต่อไปซึ่ง'
  ],

  OUT_OF_SCOPE: [
    'ทำนาย', 'ดูดวง', 'หวย', 'หวัง', 'เดิมพัน', 'บันเทิง',
    'บิน', 'เที่ยวบิน', 'อากาศ', 'อากาศ', 'ภาษาอะไร',
    'สุขภาพ', 'แพ้', 'ยา', 'ความสัมพันธ์', 'ชีวิต',
    'เงิน', 'ทอง', 'หุ้น', 'ลงทุน', 'ธุรกิจ',
    'เล่นเกม', 'เพลง', 'ภาพยะ', 'หนัง'
  ]
};

/**
 * คำนวณคะแนนสำหรับ intent โดยใช้ keyword matching
 *
 * @param {string} query - คำถามผู้ใช้ (ต่ำ่ำ)
 * @param {string[]} keywords - รายการคำหนาที่
 * @returns {number} คะแนน (0 ถ้าไม่มี match)
 */
function scoreIntent(query, keywords) {
  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (query.includes(kwLower)) {
      // คำหนาที่ที่ยากหรือเจาะจงได้คะแนนสูงกว่า
      const tokenLength = kwLower.replace(/[.\s]/g, '').length;
      score += tokenLength > 0 ? Math.min(10, tokenLength) : 5;
    }
  }
  return score;
}

/**
 * ตรวจสอบว่าเป็นการถามต่อ (follow-up) หรือไม่
 * ใช้ heuristic ง่าย: คำถามสั้น ๆ ที่มีคำย่อยอ้างอิงถึงสิ่งที่พูดไปแล้ว
 *
 * @param {string} query - คำถามผู้ใช้
 * @param {Array} history - ประวัติการสนทนา
 * @returns {boolean}
 */
function isFollowUpQuestion(query, history) {
  if (!history || history.length < 2) return false;

  const shortQuery = query.trim().split(/[\s]+/).length <= 4;
  const hasPronoun = /^(นั้น|นี้|มัน|เรา|คุณ|ต่อ|ต่อไป|เพิ่ม|ละเอียด|อธิบาย|อย่าง|เช่น|เช่นกับ|เหตุผล|ทำไม|อย่างไร)$/i.test(query.trim());

  return shortQuery || hasPronoun;
}

/**
 * ฟังก์ชันหลักสำหรับการ classification intent
 *
 * @param {string} userMessage - ข้อความผู้ใช้
 * @param {Array<{role: string, content: string}>} [conversationHistory] - ประวัติการสนทนา
 * @param {string} [detectedLanguage='th'] - ภาษาที่ตรวจจับได้
 * @returns {string} intent ที่ classification แล้ว (หนึ่งใน VALID_INTENTS)
 *
 * @example
 * classifyIntent('สวัสดีครับ');  // 'GENERAL_GREETING'
 * classifyIntent('ก.พ.ร. มีวิสัยทัศน์อะไร');  // 'ORGANIZATION_INFORMATION'
 */
function classifyIntent(userMessage, conversationHistory, detectedLanguage = 'th') {
  // ตรวจสอบอินพุตพื้นฐาน
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return 'INSUFFICIENT_INFORMATION';
  }

  const query = userMessage.toLowerCase().trim();

  // ตรวจสอบว่าเป็นการถามต่อหรือไม่ (ใช้ประวัติการสนทนา)
  if (conversationHistory && isFollowUpQuestion(query, conversationHistory)) {
    return 'FOLLOW_UP_QUESTION';
  }

  // คำนวณคะแนนสำหรับทุก intent
  const scores = {};
  for (const intent of VALID_INTENTS) {
    if (intent === 'FOLLOW_UP_QUESTION' || intent === 'INSUFFICIENT_INFORMATION' || intent === 'OUT_OF_SCOPE') {
      continue; // จัดการพิเศษ
    }
    scores[intent] = scoreIntent(query, INTENT_KEYWORDS[intent] || []);
  }

  // หา intent ที่ได้คะแนนสูงที่สุด
  let bestIntent = null;
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  // หากมีคะแนนสูงพอถือได้ว่ามี match
  if (maxScore >= 5) {
    return bestIntent;
  }

  // ตรวจสอบ OUT_OF_SCOPE
  const outOfScopeScore = scoreIntent(query, INTENT_KEYWORDS.OUT_OF_SCOPE || []);
  if (outOfScopeScore >= 5) {
    return 'OUT_OF_SCOPE';
  }

  // หากไม่มี match ชัดเจน
  // ใช้คำถามยาวหรือซับซ้อน = INSUFFICIENT_INFORMATION
  // ใช้คำถามสั้นและไม่มีคำหนาที่ชัด = GENERAL_GREETING หรือ OUT_OF_SCOPE
  const tokenCount = query.split(/[\s]+/).filter(t => t.length > 0).length;

  if (tokenCount <= 2 && (query.includes('ใช่') || query.includes('ไหม') || query.includes('หรือ'))) {
    return 'GENERAL_GREETING';
  }

  return 'INSUFFICIENT_INFORMATION';
}

/**
 * ตรวจสอบว่าค่า intent เป็น valid หรือไม่
 *
 * @param {string} intent
 * @returns {boolean}
 */
function isValidIntent(intent) {
  return VALID_INTENTS.includes(intent);
}

/**
 * คืนค่า list ของ intent ทั้งหมดที่รองรับ
 *
 * @returns {string[]}
 */
function getValidIntents() {
  return [...VALID_INTENTS];
}

module.exports = {
  classifyIntent,
  isValidIntent,
  getValidIntents,
  VALID_INTENTS,
  // Export สำหรับการทดสอบ
  INTENT_KEYWORDS,
  scoreIntent,
  isFollowUpQuestion
};
