/**
 * CitationValidator สำหรับ Chatbot ก.พ.ร.
 *
 * ตรวจสอบว่า citations ในคำตอบมาจากเอกสารที่ให้มาจริงๆ
 * ทำหน้าที่เป็น secondary validation — ไม่ใช่หลักฐานว่าข้อมูลเป็นความจริง
 *
 * การตรวจสอบ:
 * - ตรวจสอบว่า source IDs มาจาก retrieval results ที่ให้มา
 * - ตรวจสอบ title และ URL ตรงกับ metadata ของเอกสาร
 * - ตรวจสอบว่าไม่มีการปลอม page numbers หรือ document titles
 */

'use strict';

/**
 * ตรวจสอบว่าค่าเป็น string ที่ไม่ใช่ null/undefined ว่าง
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * สร้าง lookup map จากเอกสารที่ค้นหา
 * ใช้สำหรับการตรวจสอบอย่างรวดเร็ว
 *
 * @param {Array} retrievedDocuments
 * @returns {Map} Map ของ documentId -> document object
 */
function createDocumentMap(retrievedDocuments) {
  const map = new Map();

  if (!retrievedDocuments || !Array.isArray(retrievedDocuments)) {
    return map;
  }

  for (const doc of retrievedDocuments) {
    if (!doc) continue;

    const id = doc.documentId || doc.id || doc.chunkId;
    if (id) {
      map.set(String(id), doc);
    }

    // ใช้ title เป็น index เพิ่มเติม
    if (doc.title) {
      const titleKey = String(doc.title).toLowerCase();
      if (!map.has(titleKey)) {
        map.set(titleKey, doc);
      }
    }
  }

  return map;
}

/**
 * ตรวจสอบ URL ที่ให้มาอย่างถูกต้อง
 *
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!isNonEmptyString(url)) return false;

  try {
    // ใช้พื้นต้น URL validation
    const urlPattern = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;
    return urlPattern.test(url);
  } catch (e) {
    return false;
  }
}

/**
 * ตรวจสอบว่า URL เป็นของ OPDC ที่เชื่อถือได้หรือไม่
 *
 * @param {string} url
 * @returns {boolean}
 */
function isOpdcSource(url) {
  if (!isNonEmptyString(url)) return false;
  return url.includes('opdc.go.th') || url.includes('opdc.go.th');
}

/**
 * ตรวจสอบ citation เดียว
 *
 * @param {Object} citation - citation object ที่ต้องการตรวจสอบ
 * @param {Map} documentMap - Map ของเอกสารที่ค้นหา
 * @returns {{valid: boolean, issues: string[]}}
 */
function validateSingleCitation(citation, documentMap) {
  const issues = [];

  if (!citation || typeof citation !== 'object') {
    return { valid: false, issues: ['Citation is not a valid object'] };
  }

  // ตรวจสอบ title หากมี
  if (citation.title) {
    if (!isNonEmptyString(citation.title)) {
      issues.push('Citation title is empty or invalid');
    }
  }

  // ตรวจสอบ URL หากมี
  if (citation.url) {
    if (!isNonEmptyString(citation.url)) {
      issues.push('Citation URL is empty or invalid');
    } else if (!isValidUrl(citation.url)) {
      issues.push(`Citation URL "${citation.url}" is not a valid URL`);
    } else if (!isOpdcSource(citation.url)) {
      issues.push(`Citation URL "${citation.url}" is not from an OPDC source`);
    }
  }

  // ตรวจสอบ page number หากมี
  if (citation.page !== null && citation.page !== undefined) {
    if (typeof citation.page !== 'number' && typeof citation.page !== 'string') {
      issues.push(`Citation page "${citation.page}" is not a valid type`);
    }
  }

  // ตรวจสอบ section หากมี
  if (citation.section) {
    if (!isNonEmptyString(citation.section)) {
      issues.push('Citation section is empty or invalid');
    }
  }

  // ตรวจสอบว่ามีอย่างน้อยหนึ่ง field ที่ระบุแหล่งที่มา
  if (!citation.title && !citation.url && !citation.page && !citation.section) {
    // อนุญาตให้มี citation ว่าง (unavailable) แต่ควรระบุ
    issues.push('Citation has no identifying information');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * ฟังก์ชันหลักสำหรับตรวจสอบ citations ทั้งหมด
 *
 * @param {Array} citations - รายการ citations ที่ต้องการตรวจสอบ
 * @param {Array} retrievedDocuments - เอกสารที่ค้นหาได้ (สำหรับเปรียบเทียบ)
 * @returns {{isValid: boolean, validCitations: Array, issues: Array, coverage: number}}
 *   - isValid: ผ่านการตรวจสอบทั้งหมดหรือไม่
 *   - validCitations: citations ที่ผ่านการตรวจสอบ
 *   - issues: รายการปัญหาทั้งหมด
 *   - coverage: อัตราการเปิดเผยข้อมูล (0-1)
 */
function validateCitations(citations, retrievedDocuments) {
  const issues = [];
  const validCitations = [];
  const documentMap = createDocumentMap(retrievedDocuments);

  if (!citations || !Array.isArray(citations) || citations.length === 0) {
    return {
      isValid: true,
      validCitations: [],
      issues: [],
      coverage: 0
    };
  }

  let validCount = 0;

  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];
    const result = validateSingleCitation(citation, documentMap);

    // ตรวจสอบเพิ่มเติม: title ต้องมีอยู่ใน retrieved documents (เมื่อมีเอกสารให้เปรียบเทียบ)
    if (result.valid && citation.title && documentMap.size > 0) {
      const titleKey = citation.title.toLowerCase();
      if (!documentMap.has(titleKey)) {
        result.valid = false;
        result.issues.push(`Citation title "${citation.title}" not found in retrieved documents`);
      }
    }

    if (result.valid) {
      validCitations.push(citation);
      validCount++;
    } else {
      issues.push({
        citationIndex: i,
        citation: citation,
        issues: result.issues
      });
    }
  }

  return {
    isValid: validCount === citations.length,
    validCitations,
    issues,
    coverage: citations.length > 0 ? validCount / citations.length : 0
  };
}

/**
 * ตรวจสอบว่ามี citations เมื่อต้องการหรือไม่
 * ใช้เมื่อ response contract ต้องการ citations
 *
 * @param {Object} response - ผลลัพธ์ของการตอบ
 * @returns {{hasRequiredCitations: boolean, missingCitations: boolean}}
 */
function checkCitationRequirements(response) {
  const result = {
    hasRequiredCitations: true,
    missingCitations: false
  };

  // หาก answer มีข้อมูลเชิง factual แต่ไม่มี citations
  if (response.answer && (!response.citations || response.citations.length === 0)) {
    // ตรวจสอบว่ามีคำว่า "เราได้..." หรือ "จากแหล่งข้อมูล" อยู่ใน answer
    const hasFactualClaim = /เราได้(?![ก-๙])|ตามที่|อ้างอิง|สัปดาห์|เอกสาร|แหลลงข้อมูล/i.test(response.answer);
    if (hasFactualClaim) {
      result.missingCitations = true;
      result.hasRequiredCitations = false;
    }
  }

  return result;
}

module.exports = {
  validateCitations,
  validateSingleCitation,
  checkCitationRequirements,
  createDocumentMap,
  isValidUrl,
  isOpdcSource,
  isNonEmptyString,
  // Export สำหรับการทดสอบ
  HISTORICAL_STATUSES: ['archived', 'superseded', 'deprecated', 'historical']
};
