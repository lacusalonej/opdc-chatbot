/**
 * RAG Engine สำหรับ Chatbot ก.พ.ร. (OPDC)
 * รองรับภาษาไทย: ตัดคำพื้นฐาน + จับ substring + จับ intent
 *
 * แก้ไข: เพิ่ม metadata (title, sourceUrl, publisher, documentStatus) ให้ chunks
 * เพื่อรองรับ citation validation และตอบสนองตามข้อกำหนดของ Prompt Engine
 *
 * หมายเหตุ: การเปลี่ยนแปลงนี้เป็นการเพิ่ม metadata เท่านั้น — ไม่เปลี่ยน API หรือพฤติกรรม
 */
const fs = require('fs');
const path = require('path');

const KNOWLEDGE_FILE = path.join(__dirname, '..', 'knowledge', 'opdc-knowledge.json');

class RAGEngine {
    constructor(knowledgeFile) {
        this.knowledgeFile = knowledgeFile || KNOWLEDGE_FILE;
        this.data = this._loadKnowledge();
        this.chunks = this._createChunks();
    }

    _loadKnowledge() {
        const raw = fs.readFileSync(this.knowledgeFile, 'utf-8');
        return JSON.parse(raw);
    }

    _createChunks() {
        const chunks = [];
        const org = this.data.organization;
        const baseUrl = 'https://www.opdc.go.th';

        // เพิ่ม metadata ให้ chunks เพื่อรองรับ citations
        chunks.push({
            id: 'org_name',
            category: 'general',
            keywords: ['กพร', 'ก.พ.ร.', 'opdc', 'คืออะไร', 'ชื่อเต็ม', 'สังกัด', 'บทบาท', 'ประวัติ'],
            title: 'ข้อมูลองค์ราศตร์ ก.พ.ร.',
            sourceUrl: baseUrl,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบบราชการ',
            documentStatus: 'published',
            content: `${org.name_th} (${org.name_en}) ชื่อย่อคือ ${org.abbr_th} หรือ ${org.abbr_en} มีหน้าที่พัฒนาและยกระดับระบบราชการไทยตามหลักธรรมาภิบาล ให้คำปรึกษาและข้อเสนอแนะนโยบายแก่คณะรัฐมนตรีและหน่วยงานภาครัฐ`
        });

        chunks.push({
            id: 'org_contact',
            category: 'contact',
            keywords: ['ติดต่อ', 'เบอร์', 'โทร', 'โทรสาร', 'fax', 'email', 'อีเมล', 'ที่อยู่', 'facebook', 'youtube', 'สถานที่', 'แผนที่', 'อยู่ที่ไหน'],
            title: 'ข้อมูลการติดต่อ ก.พ.ร.',
            sourceUrl: `${baseUrl}/contact`,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบบราชการ',
            documentStatus: 'published',
            content: `ช่องทางการติดต่อ ก.พ.ร. (OPDC):\n- ที่อยู่: ${org.address}\n- เบอร์โทรศัพท์: ${org.phone}\n- โทรสาร (Fax): ${org.fax}\n- อีเมล: ${org.email}\n- Facebook: ${org.facebook}\n- YouTube: ${org.youtube}`
        });

        chunks.push({
            id: 'vision',
            category: 'general',
            keywords: ['วิสัยทัศน์', 'vision', 'เป้าหมาย'],
            title: 'วิสัยทัศน์ ก.พ.ร.',
            sourceUrl: `${baseUrl}/about/vision/`,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
            documentStatus: 'published',
            content: `วิสัยทัศน์ ก.พ.ร.: "${this.data.vision.text_th}"`
        });

        chunks.push({
            id: 'mission',
            category: 'general',
            keywords: ['พันฐกิจ', 'mission', 'หน้าที่'],
            title: 'พันฐกิจ ก.พ.ร.',
            sourceUrl: `${baseUrl}/about/vision/`,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
            documentStatus: 'published',
            content: `พันฐกิจ ก.พ.ร.: ${this.data.mission.text_th}`
        });

        for (const issue of this.data.strategic_issues) {
            chunks.push({
                id: `strategic_${issue.id}`,
                category: 'general',
                keywords: ['ยุทธศาสตร์', 'เป้าหมาย', 'กลยุทธ์', issue.title_th],
                title: `ประเด็นยุทธศาสตร์ที่ ${issue.id}`,
                sourceUrl: `${baseUrl}/about/opdc-action-plan/`,
                publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
                documentStatus: 'published',
                content: `ประเด็นยุทธศาสตร์ที่ ${issue.id}: ${issue.title_th} - ${issue.desc_th}`
            });
        }

        for (const comm of this.data.committees) {
            chunks.push({
                id: `committee_${comm.name_th.slice(0, 10)}`,
                category: 'general',
                keywords: ['คณะกรรมการ', 'กรรมการ', comm.name_th],
                title: comm.name_th,
                sourceUrl: `${baseUrl}/about/board/`,
                publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
                documentStatus: 'published',
                content: `${comm.name_th} (${comm.name_en}): ${comm.role_th}`
            });
        }

        for (const service of this.data.services) {
            chunks.push({
                id: `service_${service.name_th.slice(0, 10)}`,
                category: 'service',
                keywords: ['บริการ', 'ขั้นตอน', 'ขอ', 'รางวัล', service.name_th],
                title: service.name_th,
                sourceUrl: baseUrl,
                publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
                documentStatus: 'published',
                content: `${service.name_th}: ${service.desc_th}`
            });
        }

        chunks.push({
            id: 'knowledge_center',
            category: 'search',
            keywords: ['ค้นหา', 'เอกสาร', 'pdf', 'ดาวน์โหลด', 'ระเบียบ', 'กฎหมาย', 'คำวินิจฉัย', 'รายงาน'],
            title: 'ศูนย์ความรู้ ก.พ.ร.',
            sourceUrl: baseUrl,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
            documentStatus: 'published',
            content: `ศูนย์ความรู้ ก.พ.ร. ให้บริการ:\n- กฎหมายและคำวินิจฉัย\n- เอกสารเผยแพร่และรายงานผลการปฏิบัติราชการ\n- ข้อมูล B-READY, PMQA, OGP\nสามารถสืบค้นได้ที่เว็บไซต์หลัก https://www.opdc.go.th/`
        });

        chunks.push({
            id: 'greeting',
            category: 'chat',
            keywords: ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย', 'สบายดีไหม'],
            title: 'การทักทาย',
            sourceUrl: baseUrl,
            publisher: 'สำนิกงานคณะกรรมการพัฒนาระบสารราชการ',
            documentStatus: 'published',
            content: `สวัสดีครับ! ผมคือ Chatbot ผู้ช่วยของสำนิกงาน ก.พ.ร. (OPDC) ยินดีให้บริการข้อมูลทั่วไป การติดต่อ การบริการ และการสืบค้นเอกสารครับ ถามมาได้เลยครับ`
        });

        // แปลง text → content สำหร้บ compatibility กับโค้ดเดิม
        for (const chunk of chunks) {
            if (chunk.text && !chunk.content) {
                chunk.content = chunk.text;
            }
            // รักษา field 'text' ไว้เพื่อ backward compatibility
            chunk.text = chunk.content;
        }

        return chunks;
    }

    classifyIntent(query) {
        const q = query.toLowerCase();

        // 1. ตรวจสอบจาก keywords ของแต่ละ chunk ก่อน (ใช้ category เป็น intent)
        for (const chunk of this.chunks) {
            if (chunk.keywords) {
                for (const kw of chunk.keywords) {
                    if (q.includes(kw.toLowerCase())) {
                        return chunk.category;
                    }
                }
            }
        }

        // 2. ตรวจสอบจาก keyword dictionaries
        const keywords = {
            contact: ['ติดต่อ', 'เบอร์', 'โทร', 'email', 'อีเมล', 'ที่อยู่', 'facebook', 'youtube', 'fax', 'โทรสาร', 'ที่ไหน'],
            chat: ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ขอบคุณ', 'บาย', 'ลาก่อน'],
            service: ['บริการ', 'ขั้นตอน', 'วิธี', 'ขอ', 'สมัคร', 'รางวัล', 'psea', 'ประเมิน'],
            search: ['ค้นหา', 'เอกสาร', 'pdf', 'ดาวน์โหลด', 'ไฟล์', 'รายงาน', 'newsletter', 'b-ready'],
            general: ['คืออะไร', 'กพร', 'ก.พ.ร.', 'opdc', 'วิสัยทัศน์', 'พันฐกิจ', 'ยุทธศาสตร์', 'คณะกรรมการ', 'โครงสร้าง', 'ประวัติ']
        };

        for (const [intent, kws] of Object.entries(keywords)) {
            if (kws.some(kw => q.includes(kw))) {
                return intent;
            }
        }
        return 'general';
    }

    searchChunks(query, topK = 3) {
        const q = query.toLowerCase();
        const scored = [];

        for (const chunk of this.chunks) {
            let score = 0;
            const textLower = chunk.text.toLowerCase();

            // 1. ตรวจว่า query ทั้งประโยค หรือส่วนหนึ่ง มีอยู่ใน text ไหม
            if (textLower.includes(q)) {
                score += 10;
            }

            // 2. ตรวจ keywords ของ chunk
            if (chunk.keywords) {
                for (const kw of chunk.keywords) {
                    const kwLower = kw.toLowerCase();
                    if (q.includes(kwLower) || kwLower.includes(q)) {
                        score += 5;
                    }
                    // เช็กแยกตาม token ด้วย (เช่น "ก.พ.ร." ถูกแบ่งเป็น "ก", "พ", "ร" → ไม่เข้า)
                    // แต่ "กพร" หรือ "opdc" จะเข้า
                    const kwTokens = kwLower.split(/[\s.]+/).filter(t => t.length >= 2);
                    for (const kwt of kwTokens) {
                        if (q.includes(kwt)) {
                            score += 3;
                        }
                    }
                }
            }

            // 3. ตรวจคำเดี่ยวๆ ที่ผู้ใช้พิมพ์
            const tokens = q.split(/[\s,./?!=+-]+/).filter(t => t.length >= 2);
            for (const token of tokens) {
                if (textLower.includes(token)) {
                    score += 2;
                }
            }

            if (score > 0) {
                scored.push({ score, chunk });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map(s => s.chunk);
    }

    answer(query) {
        const intent = this.classifyIntent(query);
        let matches = this.searchChunks(query);

        // ถ้า intent เป็น chat แต่ไม่เจอ match ให้ดึง greeting chunk
        if (intent === 'chat' && matches.length === 0) {
            const greeting = this.chunks.find(c => c.id === 'greeting');
            if (greeting) matches = [greeting];
        }

        // ถ้า intent เป็น contact แต่ไม่เจอ match ให้ดึง contact chunk
        if (intent === 'contact' && matches.length === 0) {
            const contact = this.chunks.find(c => c.id === 'org_contact');
            if (contact) matches = [contact];
        }

        return { intent, matches, query };
    }

    extractAnswer(query, intent) {
        const { matches } = this.answer(query);

        if (!matches || matches.length === 0) {
            return 'ขออภัยครับ ยังไม่พบข้อมูลที่ตรงกับคำถามนี้โดยตรง\n\nท่านสามารถติดต่อสอบถามเจ้าหน้าที่ ก.พ.ร. ได้โดยตรงที่:\n📞 โทร: 02 356 9999\n📧 อีเมล: contact@opdc.go.th\n🌐 เว็บไซต์: https://www.opdc.go.th/';
        }

        const texts = matches.map(m => m.text);
        let answer = texts.join('\n\n');

        if (intent === 'contact' && !answer.includes('02 356 9999')) {
            answer += '\n\n📞 โทร: 02 356 9999 | Fax: 02 356 9910';
        }

        return answer;
    }

    /**
     * แปลง chunks เป็น RetrievedDocument format ที่ PromptEngine ต้องการ
     * เพิ่ม metadata ที่มีอยู่ (title, sourceUrl, publisher, documentStatus)
     *
     * @param {Array} chunks - ผลลัพธ์จาก searchChunks()
     * @returns {Array<Object>} retrievedDocuments ในรูปแบบที่ ContextBuilder ต้องการ
     */
    chunksToRetrievedDocuments(chunks) {
        if (!chunks || !Array.isArray(chunks)) {
            return [];
        }

        return chunks.map(chunk => ({
            documentId: chunk.id,
            content: chunk.text || chunk.content,
            title: chunk.title || null,
            sourceUrl: chunk.sourceUrl || null,
            publisher: chunk.publisher || null,
            publishedDate: null,
            effectiveDate: null,
            updatedAt: null,
            documentStatus: chunk.documentStatus || 'published',
            pageNumber: null,
            sectionTitle: null,
            retrievalScore: null
        }));
    }
}

module.exports = RAGEngine;
