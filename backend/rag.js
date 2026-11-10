/**
 * RAG Engine สำหรับ Chatbot สำนักงานปลัดกระทรวงการคลัง (MOF/OPS)
 * รองรับภาษาไทย: ตัดคำพื้นฐาน + จับ substring + จับ intent
 *
 * ข้อมูลดึงมาจาก https://km.mof.go.th/ (สำนักงานปลัดกระทรวงการคลัง)
 *
 * แก้ไข: เพิ่ม metadata (title, sourceUrl, publisher, documentStatus) ให้ chunks
 * เพื่อรองรับ citation validation และตอบสนองตามข้อกำหนดของ Prompt Engine
 *
 * หมายเหตุ: การเปลี่ยนแปลงนี้เป็นการเพิ่ม metadata เท่านั้น — ไม่เปลี่ยน API หรือพฤติกรรม
 */
const fs = require('fs');
const path = require('path');

const KNOWLEDGE_FILE = path.join(__dirname, '..', 'knowledge', 'mof-knowledge.json');

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
        const baseUrl = 'https://km.mof.go.th/';

        // เพิ่ม metadata ให้ chunks เพื่อรองรับ citations
        chunks.push({
            id: 'knowledge_center',
            category: 'search',
            keywords: ['ศูนย์ความรู้', 'ค้นหา', 'เอกสาร', 'pdf', 'ดาวน์โหลด', 'ระเบียบ', 'กฎหมาย', 'คำวินิจฉัย', 'รายงาน', 'คลังความรู้', 'ตู้สาระ'],
            title: 'ศูนย์ความรู้ สำนักงานปลัดกระทรวงการคลัง',
            sourceUrl: baseUrl,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `ศูนย์ความรู้ สำนักงานปลัดกระทรวงการคลัง ให้บริการ:\n- คลังความรู้ (Knowledge Bank)\n- ตู้สาระ (Information Cabinet)\n- ข้อมูล KM (KM Information)\n- เอกสารและคู่มือปฏิบัติงาน\n- กฎหมายและระเบียบ ข้อบังคับ\n- คำวินิจฉัยและรายงานผล\n- ข่าวสารและอินโฟกราฟิก\n- วิดีโอสารคดีความรู้\nสามารถสืบค้นได้ที่เว็บไซต์หลัก https://km.mof.go.th/`
        });

        chunks.push({
            id: 'org_name',
            category: 'general',
            keywords: ['สปก', 'สำนักงานปลัดกระทรวงการคลัง', 'mof', 'กระทรวงการคลัง', 'คืออะไร', 'ชื่อเต็ม', 'สังกัด', 'บทบาท', 'ประวัติ', 'องค์กร'],
            title: 'ข้อมูลองค์กร สำนักงานปลัดกระทรวงการคลัง',
            sourceUrl: baseUrl,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `${org.name_th} (${org.name_en}) ชื่อย่อคือ ${org.abbr_th} หรือ ${org.abbr_en} ดำเนินการโดย ${org.operator} มีหน้าที่บริหารจัดการด้านการคลัง การงบประมาณ และระบบบริหารจัดการภาครัฐ เพื่อสนับสนุนการพัฒนาประเทศอย่างยั่งยืน`
        });

        chunks.push({
            id: 'org_contact',
            category: 'contact',
            keywords: ['ติดต่อ', 'เบอร์', 'โทร', 'โทรสาร', 'fax', 'email', 'อีเมล', 'ที่อยู่', 'สายด่วน', '1689', 'สถานที่', 'แผนที่', 'อยู่ที่ไหน', 'พระรามที่ 6', 'พญาไท'],
            title: 'ข้อมูลการติดต่อ สำนักงานปลัดกระทรวงการคลัง',
            sourceUrl: `${baseUrl}contact-us/`,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `ช่องทางการติดต่อ สำนักงานปลัดกระทรวงการคลัง:\n- ที่อยู่: ${org.address}\n- เบอร์โทรศัพท์: ${org.phone}\n- โทรสาร (Fax): ${org.fax}\n- อีเมล: ${org.email}\n- สายด่วน: ${org.hotline}`
        });

        chunks.push({
            id: 'vision',
            category: 'general',
            keywords: ['วิสัยทัศน์', 'vision', 'เป้าหมาย'],
            title: 'วิสัยทัศน์ สำนักงานปลัดกระทรวงการคลัง',
            sourceUrl: `${baseUrl}about/vision/`,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `วิสัยทัศน์ สำนักงานปลัดกระทรวงการคลัง: "${this.data.vision.text_th}"`
        });

        chunks.push({
            id: 'mission',
            category: 'general',
            keywords: ['ภารกิจ', 'mission', 'หน้าที่'],
            title: 'ภารกิจ สำนักงานปลัดกระทรวงการคลัง',
            sourceUrl: `${baseUrl}about/vision/`,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `ภารกิจ สำนักงานปลัดกระทรวงการคลัง: ${this.data.mission.text_th}`
        });

        for (const issue of this.data.strategic_issues) {
            chunks.push({
                id: `strategic_${issue.id}`,
                category: 'general',
                keywords: ['ยุทธศาสตร์', 'เป้าหมาย', 'กลยุทธ์', 'หมวดหมู่ความรู้', issue.title_th],
                title: `ประเด็นความรู้ที่ ${issue.id}: ${issue.title_th}`,
                sourceUrl: `${baseUrl}document-type/knowledge/`,
                publisher: 'สำนักงานปลัดกระทรวงการคลัง',
                documentStatus: 'published',
                content: `ประเด็นความรู้ที่ ${issue.id}: ${issue.title_th} - ${issue.desc_th}`
            });
        }

        for (const comm of this.data.committees) {
            chunks.push({
                id: `committee_${comm.name_th.slice(0, 10)}`,
                category: 'general',
                keywords: ['คณะทำงาน', 'คณะกรรมการ', 'กรรมการ', 'KM Team', comm.name_th],
                title: comm.name_th,
                sourceUrl: `${baseUrl}contact-us/`,
                publisher: 'สำนักงานปลัดกระทรวงการคลัง',
                documentStatus: 'published',
                content: `${comm.name_th} (${comm.name_en}): ${comm.role_th}`
            });
        }

        for (const service of this.data.services) {
            chunks.push({
                id: `service_${service.name_th.slice(0, 10)}`,
                category: 'service',
                keywords: ['บริการ', 'ขั้นตอน', 'ขอ', 'คลังความรู้', 'ตู้สาระ', service.name_th],
                title: service.name_th,
                sourceUrl: baseUrl,
                publisher: 'สำนักงานปลัดกระทรวงการคลัง',
                documentStatus: 'published',
                content: `${service.name_th}: ${service.desc_th}`
            });
        }

        for (const event of this.data.events) {
            chunks.push({
                id: `event_${event.name_th.slice(0, 8)}`,
                category: 'document',
                keywords: ['เอกสาร', 'คู่มือ', 'รายงาน', event.name_th],
                title: event.name_th,
                sourceUrl: `${baseUrl}document-type/knowledge/`,
                publisher: 'สำนักงานปลัดกระทรวงการคลัง',
                documentStatus: 'published',
                content: `เอกสาร: ${event.name_th} (วันที่ ${event.date_th}) - ${event.desc_th}`
            });
        }

        chunks.push({
            id: 'greeting',
            category: 'chat',
            keywords: ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย', 'สบายดีไหม'],
            title: 'การทักทาย',
            sourceUrl: baseUrl,
            publisher: 'สำนักงานปลัดกระทรวงการคลัง',
            documentStatus: 'published',
            content: `สวัสดีครับ! ผมคือ Chatbot ผู้ช่วยของสำนักงานปลัดกระทรวงการคลัง (MOF/OPS) ยินดีให้บริการข้อมูลทั่วไป การติดต่อ การบริการ และการสืบค้นเอกสารความรู้ครับ ถามมาได้เลยครับ`
        });

        // แปลง text → content สำหรับ compatibility กับโค้ดเดิม
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
            contact: ['ติดต่อ', 'เบอร์', 'โทร', 'email', 'อีเมล', 'ที่อยู่', 'สายด่วน', '1689', 'fax', 'โทรสาร', 'ที่ไหน', 'พระรามที่ 6', 'พญาไท'],
            chat: ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ขอบคุณ', 'บาย', 'ลาก่อน'],
            service: ['บริการ', 'ขั้นตอน', 'วิธี', 'ขอ', 'สมัคร', 'คลังความรู้', 'ตู้สาระ'],
            search: ['ค้นหา', 'เอกสาร', 'pdf', 'ดาวน์โหลด', 'ไฟล์', 'รายงาน', 'คู่มือ', 'ระเบียบ'],
            general: ['คืออะไร', 'สปก', 'สำนักงานปลัดกระทรวงการคลัง', 'mof', 'กระทรวงการคลัง', 'วิสัยทัศน์', 'ภารกิจ', 'ยุทธศาสตร์', 'คณะทำงาน', 'โครงสร้าง', 'ประวัติ']
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
            return 'ขออภัยครับ ยังไม่พบข้อมูลที่ตรงกับคำถามนี้โดยตรง\n\nท่านสามารถติดต่อสอบถามเจ้าหน้าที่สำนักงานปลัดกระทรวงการคลัง ได้โดยตรงที่:\n📞 โทร: 02-126-5800, 02-273-9408\n📧 อีเมล: saraban@mof.go.th\n📞 สายด่วน: 1689\n🌐 เว็บไซต์: https://km.mof.go.th/';
        }

        const texts = matches.map(m => m.text);
        let answer = texts.join('\n\n');

        if (intent === 'contact' && !answer.includes('02-126-5800')) {
            answer += '\n\n📞 โทร: 02-126-5800, 02-273-9408 | Fax: 02-273-9408 | สายด่วน: 1689';
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

    /**
     * เพิ่ม chunks ใหม่เข้าไปในฐานความรู้แบบ real-time (ไม่ต้องรีสตาร์ทเซิร์ฟเวอร์)
     * ใช้หลังจากอัพโหลดไฟล์และแยกข้อความเป็น chunks แล้ว
     *
     * @param {Array<Object>} newChunks - รายการ chunks ใหม่
     * @returns {Array<Object>} chunks ทั้งหมดใน engine หลังจากเพิ่มแล้ว
     */
    addChunks(newChunks) {
        if (!Array.isArray(newChunks) || newChunks.length === 0) {
            return this.chunks;
        }

        // จัดการฟิลด์ให้เข้ากับรูปแบบเดิม (text <-> content)
        for (const chunk of newChunks) {
            if (chunk.text && !chunk.content) {
                chunk.content = chunk.text;
            }
            chunk.text = chunk.content;
        }

        this.chunks.push(...newChunks);
        return this.chunks;
    }

    /**
     * ลบ chunk ออกจาก engine ตาม id
     *
     * @param {string} chunkId - รหัส chunk ที่ต้องการลบ
     * @returns {boolean} true ถ้าลบสำเร็จ, false ถ้าไม่พบ
     */
    removeChunk(chunkId) {
        const before = this.chunks.length;
        this.chunks = this.chunks.filter(c => c.id !== chunkId);
        return this.chunks.length < before;
    }
}

module.exports = RAGEngine;
