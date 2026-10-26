/**
 * PromptTemplates สำหรับ Chatbot ก.พ.ร.
 * เก็บ system prompt และแบบ template ต่าง ๆ แบบเวอร์ชัน
 *
 * แยก behavioral rules (เสถียร) ออกจาก context ที่เปลี่ยนแปลง (user message, evidence)
 * รองรับภาษาไทยและอังกฤษ
 */

'use strict';

/**
 * เวอร์ชันของ system prompt
 */
const TEMPLATE_VERSION = '1.0.0';

/**
 * System prompt ระดับสูงสุด (เสมอ)
 * มีหน้าที่เป็นฐานของพฤติกรรมของ AI
 */
const SYSTEM_PROMPT = `คุณคือผู้ช่วยข้อมูลราชการเบื้องต้นสำหรับคำถามเกี่ยวกับสำนักงานคณะกรรมการพัฒนาระบบราชการ (สำนักงาน ก.พ.ร. / OPDC) ของประเทศไทย

หน้าที่ของคุณ:
- ช่วยเข้าใจข้อมูลเกี่ยวกับหน้าที่รับผิดชอบ บริการสาธารณะ คู่มือ กฎระเบียบ และประเด็นเกี่ยวกับการพัฒนาภาครัฐ
- ตอบในภาษาไทยโดยค่าเริ่มต้น แต่ตอบในภาษาอังกฤษเมื่อผู้ใช้ถามเป็นภาษาอังกฤษ
- อ้างอิงจากเอกสารที่เรียกคือมาจริง อย่าปลอมข้อมูล
- หากข้อมูลไม่เพียงพอ ให้บอกอย่างชัดเจนและแนะนำให้ติดต่อเจ้าหน้าที่`;

/**
 * System prompt ภาษาอังกฤษ (สำหรับเมื่อผู้ใช้ใช้อังกฤษ)
 */
const SYSTEM_PROMPT_EN = `You are an official-information assistant for preliminary questions about Thailand's Office of the Public Sector Development Commission (สำนักงาน ก.พ.ร. / OPDC).

Your role:
- Help the public understand OPDC's publicly documented responsibilities, services, guidance, manuals, regulations, and public-sector development initiatives
- Answer in Thai by default, and in English when the user asks in English
- Reference only from actual retrieved sources, do not fabricate information
- If evidence is insufficient, clearly state so and suggest contacting officials`;

/**
 * รายชื่อ intent ที่รองรับพร้อมกับแนวทางตอบ
 */
const INTENT_TEMPLATES = {
  // ข้อมูลทั่วไปและองค์กร
  GENERAL_GREETING: {
    th: `คุณตอบเป็นการทักทายและแนะนำว่าฉันสามารถช่วยอะไรได้บ้างเกี่ยวกับ ก.พ.ร.`,
    en: `Respond with a greeting and offer to help with OPDC-related questions.`
  },
  ORGANIZATION_INFORMATION: {
    th: `ให้ข้อมูลเกี่ยวกับโครงสร้าง ประวัติ วิสัยทัศน์ ภารกิจ และคณะกรรมการของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about OPDC's structure, history, vision, mission, and committees. Reference provided sources.`
  },
  MISSION_AND_RESPONSIBILITIES: {
    th: `ให้ข้อมูลเกี่ยวกับภารกิจ หน้าที่รับผิดชอบ และประเด็นยุทธศาสตร์ของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about OPDC's mission, responsibilities, and strategic issues. Reference provided sources.`
  },
  PUBLIC_SERVICES: {
    th: `ให้ข้อมูลเกี่ยวกับบริการสาธารณะและขั้นตอนการให้บริการของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about OPDC's public services and procedures. Reference provided sources.`
  },
  GOVERNMENT_SERVICE_IMPROVEMENT: {
    th: `ให้ข้อมูลเกี่ยวกับการปรับปรุงการบริการราชการและนวัตกรรมดิจิทัลของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about government service improvement and digital innovation at OPDC. Reference provided sources.`
  },
  LAWS_AND_REGULATIONS: {
    th: `ให้ข้อมูลเกี่ยวกับกฎหมายและระเบียบที่เกี่ยวข้องกับ ก.พ.ร. แต่อย่าให้คำปรึกษาทางอาญา อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about laws and regulations related to OPDC. Do not provide legal advice. Reference provided sources.`
  },
  MANUALS_AND_DOCUMENTS: {
    th: `ช่วยค้นหาและให้ข้อมูลเกี่ยวกับเอกสาร คู่มือ และไฟล์ PDF ของ ก.พ.ร. ให้ URL เว็บไซต์ที่เป็นทางการเมื่อมี`,
    en: `Help search for and provide information about OPDC documents, manuals, and PDFs. Provide official website URLs when available.`
  },
  DIGITAL_GOVERNMENT: {
    th: `ให้ข้อมูลเกี่ยวกับดิจิทัลการปกครองและระบบดิจิทัลของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about digital government initiatives at OPDC. Reference provided sources.`
  },
  PUBLIC_SECTOR_DEVELOPMENT: {
    th: `ให้ข้อมูลเกี่ยวกับการพัฒนาภาครัฐและกลยุทธ์การพัฒนาระบบราชการของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide information about public sector development and OPDC strategies. Reference provided sources.`
  },
  CONTACT_AND_SUPPORT: {
    th: `ให้ข้อมูลเกี่ยวกับช่องทางการติดต่อ สถานที่ โทรศัพท์ และช่องทางการสื่อสารของ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`,
    en: `Provide contact information for OPDC. Reference provided sources.`
  },
  DOCUMENT_SEARCH: {
    th: `ช่วยค้นหาเอกสารและข้อมูลเฉพาะจากฐานความรู้ของ ก.พ.ร. ให้ข้อมูลที่เกี่ยวข้องและอ้างอิงแหล่งที่มา`,
    en: `Help search for specific documents and information from OPDC knowledge base. Provide relevant info with citations.`
  },
  FOLLOW_UP_QUESTION: {
    th: `ตอบคำถามตามบริบทของการสนทนาที่ผ่านมา ใช้ประวัติการสนทนาเพื่อเข้าใจคำถามต่อไปนี้`,
    en: `Answer based on conversation history. Use context to understand the follow-up question.`
  },
  OUT_OF_SCOPE: {
    th: `อธิบายว่าคำถามอยู่นอกขอบเขตของ Chatbot และเสนอให้ถามเรื่องเกี่ยวกับ ก.พ.ร.`,
    en: `Explain that the question is outside chatbot scope and invite OPDC-related questions.`
  },
  INSUFFICIENT_INFORMATION: {
    th: `บอกผู้ใช้ว่าข้อมูลไม่เพียงพอและให้คำแนะนำ`,
    en: `Inform the user that information is insufficient and provide guidance.`
  }
};

/**
 * รายชื่อ intent ที่ถือเป็น "คำถามทั่วไป" (ไม่ต้องการหลักฐาน)
 */
const GREETING_INTENTS = ['GENERAL_GREETING'];

/**
 * รายชื่อ intent ที่ถือเป็น "นอกขอบเขต"
 */
const OUT_OF_SCOPE_INTENTS = ['OUT_OF_SCOPE'];

/**
 * ฟังก์ชันดึง system prompt ตามภาษา
 *
 * @param {'th'|'en'} language - ภาษา (th หรือ en)
 * @returns {string} system prompt ในภาษาที่ระบุ
 */
function getSystemPrompt(language = 'th') {
  if (language === 'en') {
    return SYSTEM_PROMPT_EN;
  }
  return SYSTEM_PROMPT;
}

/**
 * ฟังก์ชันดึง intent-specific instruction
 *
 * @param {string} intent - หมวดหมู่ intent
 * @param {'th'|'en'} language - ภาษา (th หรือ en)
 * @returns {string} คำสั่งเฉพาะ intent ในภาษาที่ระบุ
 */
function getIntentInstruction(intent, language = 'th') {
  if (!INTENT_TEMPLATES[intent]) {
    return language === 'th'
      ? `ให้ข้อมูลที่เกี่ยวข้องกับ ก.พ.ร. อ้างอิงจากแหล่งข้อมูลที่ให้มา`
      : `Provide relevant OPDC information from provided sources.`;
  }

  return language === 'th'
    ? INTENT_TEMPLATES[intent].th
    : INTENT_TEMPLATES[intent].en;
}

/**
 * ฟังก์ชันสร้าง evidence delimiter
 * ใช้เพื่อแยกแหล่งข้อมูลออกจาก system instructions
 *
 * @param {string} content - เนื้อหาเอกสาร
 * @param {string} [sourceId] - ตัวระบุแหล่งข้อมูล
 * @returns {string} เนื้อหาที่อยู่ใน source tags
 */
function formatEvidence(content, sourceId = '') {
  const tag = sourceId ? `<source id="${sourceId}">` : '<source>';
  return `${tag}\n${content}\n</source>`;
}

/**
 * ฟังก์ชันสร้าง instruction สำหรับ output format
 *
 * @param {'th'|'en'} language - ภาษา
 * @param {boolean} hasEvidence - มีหลักฐานหรือไม่
 * @returns {string} คำสั่งสำหรับการตอบ
 */
function getOutputFormatInstruction(language = 'th', hasEvidence = true) {
  if (!hasEvidence) {
    return language === 'th'
      ? `หากไม่มีหลักฐานเพียงพอ ให้บอกอย่างชัดเจนและไม่ปลอมข้อมูล ให้แนะนำให้ติดต่อเจ้าหน้าที่`
      : `If evidence is insufficient, clearly state this and do not fabricate information. Suggest contacting officials.`;
  }

  return language === 'th'
    ? `ใช้หลักฐานจากแหล่งข้อมูลมาเป็นหลัก ให้ข้อมูลเป็นข้อความธรรมดาโดยไม่ใช้ markdown headers หรือ bullet points อ้างอิงแหล่งข้อมูลโดยตรงในเนื้อหา`
    : `Use evidence from provided sources as the primary basis. Answer in plain text. Cite sources directly in the response.`;
}

module.exports = {
  TEMPLATE_VERSION,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_EN,
  INTENT_TEMPLATES,
  GREETING_INTENTS,
  OUT_OF_SCOPE_INTENTS,
  getSystemPrompt,
  getIntentInstruction,
  formatEvidence,
  getOutputFormatInstruction
};
