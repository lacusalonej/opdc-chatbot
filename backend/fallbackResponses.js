/**
 * FallbackResponses สำหรับ Chatbot ก.พ.ร.
 * ให้ข้อความตอบแทนบนภาษาไทยและอังกฤษ
 * สำหรับสถานการณ์: ไม่มีหลักฐาน, หลักฐานไม่เพียงพอ, ข้อมูลขัดแย้ง,
 * เอกสารล้าสมัย, การค้นหาล้มเหลว, ผู้ให้บริการล้มเหลว, ผลลัพธ์ไม่ถูกต้อง
 *
 * ไม่เปิดเผย stack traces, filesystem paths, secrets หรือข้อมูลภายใน
 */

'use strict';

/**
 * ประเภทของสถานการณ์ fallback
 * @typedef {'NO_EVIDENCE'|'INSUFFICIENT_EVIDENCE'|'AMBIGUOUS'|'CONFLICTING_SOURCES'|'OUTDATED_INFO'|'RETRIEVAL_ERROR'|'PROVIDER_ERROR'|'INVALID_OUTPUT'|'OUT_OF_SCOPE'} FallbackReason
 */

/**
 * ข้อความ fallback ภาษาไทย
 */
const thaiResponses = {
  NO_EVIDENCE: `ขออภัยครับ ไม่พบข้อมูลที่เกี่ยวข้องกับคำถามนี้ในระบบของเรา

คุณสามารถติดต่อสอบถามเจ้าหน้าที่ ก.พ.ร. ได้โดยตรงที่:
📞 โทร: 02 356 9999
📧 อีเมล: contact@opdc.go.th
🌐 เว็บไซต์: https://www.opdc.go.th/`,

  INSUFFICIENT_EVIDENCE: `ขออภัยครับ ข้อมูลที่มีอยู่ไม่เพียงพอที่จะตอบคำถามนี้อย่างชัดเจน

เรากำลังพัฒนาให้ข้อมูลครอบคลุมมากขึ้น หากคุณมีรายละเอียดเพิ่มเติม เราจะช่วยค้นหาให้มากขึ้นได้`,

  AMBIGUOUS: `ขอโทษครับ คำถามดูจะไม่ชัดเจนเกินไป คุณสามารถอธิบายให้ชัดเจนขึ้นได้ไหมครับ?`,

  CONFLICTING_SOURCES: `ขออภัยครับ พบข้อมูลขัดแย้งกันระหว่างแหล่งข้อมูล เราไม่สามารถให้ข้อมูลที่เป็นที่ยอมรับอย่างเดียวได้

นี่คือแหล่งข้อมูลที่เราพบ:
{{#each sources}}
- {{this}}
{{/each}}

เราขอแนะนำให้ติดต่อเจ้าหน้าที่เพื่อขอข้อมูลที่ถูกต้องและเป็นปัจจุบันที่สุด`,

  OUTDATED_INFO: `ขออภัยครับ ข้อมูลที่เรามีอาจไม่เป็นปัจจุบันหรือมีการอัปเดตแล้ว

เราขอแนะนำให้ตรวจสอบข้อมูลล่าสุดจากแหล่งที่เป็นทางการ:`,

  RETRIEVAL_ERROR: `ขออภัยครับ เกิดข้อผิดพลาดขณะค้นหาข้อมูลในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง

หากปัญหาpersist ให้ติดต่อสอบถามเจ้าหน้าที่ ก.พ.ร. ได้ที่:
📞 โทร: 02 356 9999
📧 อีเมล: contact@opdc.go.th`,

  PROVIDER_ERROR: `ขออภัยครับ เกิดข้อผิดพลาดในขณะประมวลผลคำขอของคุณ กรุณาลองใหม่อีกครั้งในภายหลัง`,

  INVALID_OUTPUT: `ขออภัยครับ เกิดข้อผิดพลาดข้อมูลในการประมวลผลคำตอบ กรุณาลองใหม่อีกครั้ง`,

  OUT_OF_SCOPE: `สวัสดีครับ! ผมคือ Chatbot ผู้ช่วยของ สำนักงาน ก.พ.ร. (OPDC)

ฉันสามารถช่วยตอบคำถามเกี่ยวกับ:
• ข้อมูลทั่วไปของ ก.พ.ร. และองค์กร
• วิสัยทัศน์ ภารกิจ และยุทธศาสตร์
• บริการและขั้นตอนต่างๆ
• เอกสารและคู่มือ
• กฎหมายและระเบียบ
• ดิจิทัลการปกครอง
• ช่องทางการติดต่อ

คุณมีคำถามอะไรเกี่ยวกับ ก.พ.ร. ไหมครับ?`
};

/**
 * ข้อความ fallback ภาษาอังกฤษ
 */
const englishResponses = {
  NO_EVIDENCE: `I'm sorry, but I couldn't find any relevant information to answer your question in our system.

You can contact the OPDC staff directly:
📞 Phone: 02 356 9999
📧 Email: contact@opdc.go.th
🌐 Website: https://www.opdc.go.th/`,

  INSUFFICIENT_EVIDENCE: `I'm sorry, but the available information is insufficient to answer your question clearly.

We're continuously improving our knowledge base. If you could provide more details, we'll try to assist you further.`,

  AMBIGUOUS: `I'm sorry, but your question seems a bit unclear. Could you please rephrase or provide more details?`,

  CONFLICTING_SOURCES: `I'm sorry, but we found conflicting information from our sources and cannot provide a single definitive answer.

Here are the sources we found:
{{#each sources}}
- {{this}}
{{/each}}

We recommend contacting the relevant officials for the most accurate and up-to-date information.`,

  OUTDATED_INFO: `I'm sorry, but the information we have may not be up-to-date.

We recommend verifying the latest information from official sources:`,

  RETRIEVAL_ERROR: `I'm sorry, but we encountered an error while searching for information. Please try again later.

If the problem persists, you can contact OPDC staff:
📞 Phone: 02 356 9999
📧 Email: contact@opdc.go.th`,

  PROVIDER_ERROR: `I'm sorry, but we encountered an error while processing your request. Please try again later.`,

  INVALID_OUTPUT: `I'm sorry, but we encountered an error while generating the answer. Please try again later.`,

  OUT_OF_SCOPE: `Hello! I'm the OPDC chatbot assistant.

I can help you with questions about:
• OPDC organization information and structure
• Vision, mission, and strategic issues
• Public services and procedures
• Official manuals and documents
• Laws and regulations
• Digital government initiatives
• Contact information

How can I help you today?`
};

/**
 * รายชื่อเหตุผลที่รองรับ
 */
const VALID_REASONS = [
  'NO_EVIDENCE',
  'INSUFFICIENT_EVIDENCE',
  'AMBIGUOUS',
  'CONFLICTING_SOURCES',
  'OUTDATED_INFO',
  'RETRIEVAL_ERROR',
  'PROVIDER_ERROR',
  'INVALID_OUTPUT',
  'OUT_OF_SCOPE'
];

/**
 * ฟังก์ชันง่าย ๆ สำหรับทำ template (เพียงแค่ {{this}} replacement)
 * @param {string} template - สตริง template
 * @param {Object} data - ข้อมูลสำหรับแทนที่ (เช่น {sources: [...]})
 * @returns {string}
 */
function simpleTemplate(template, data) {
  if (!data) return template;

  // จัดการ {{#each sources}}...{{/each}}
  if (template.includes('{{#each sources}}')) {
    const pattern = /\{\{#each sources\}\}([\s\S]*?)\{\{\/each\}\}/;
    const match = template.match(pattern);
    if (match && data.sources && Array.isArray(data.sources)) {
      const itemTemplate = match[1].trim();
      const items = data.sources.map(s => itemTemplate.replace('{{this}}', s));
      return template.replace(pattern, items.join('\n'));
    }
  }

  return template;
}

/**
 * ฟังก์ชันหลักเพื่อขอ fallback response
 *
 * @param {FallbackReason} reason - เหตุผลสำหรับ fallback
 * @param {'th'|'en'} language - ภาษา (th หรือ en)
 * @param {Object} [data] - ข้อมูลเพิ่มเติมสำหรับ template (เชชั่น sources)
 * @returns {string} ข้อความ fallback ในภาษาที่ระบุ
 */
function getFallback(reason, language = 'th', data) {
  // ตรวจสอบ reason
  if (!VALID_REASONS.includes(reason)) {
    reason = 'INSUFFICIENT_EVIDENCE';
  }

  // ตรวจสอบ language
  if (language !== 'th' && language !== 'en') {
    language = 'th';
  }

  const responses = language === 'th' ? thaiResponses : englishResponses;
  const template = responses[reason] || responses.INSUFFICIENT_EVIDENCE;

  return simpleTemplate(template, data);
}

/**
 * ฟังก์ชันตรวจสอบว่าเหตุผลเป็น valid หรือไม่
 * @param {string} reason
 * @returns {boolean}
 */
function isValidReason(reason) {
  return VALID_REASONS.includes(reason);
}

module.exports = {
  getFallback,
  isValidReason,
  VALID_REASONS,
  // Export สำหรับการทดสอบ
  thaiResponses,
  englishResponses
};
