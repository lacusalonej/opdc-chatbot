/**
 * Express Backend สำหรับ Chatbot ก.พ.ร.
 * - POST /v1/chat — ส่งคำถามและได้คำตอบ
 * - GET /v1/intents — แสดง intents ที่ recognize ได้
 * - GET /v1/sources — แสดงแหลงข้อมูล
 * - DELETE /v1/session/:id — ทำให้ session หมดอายุ (PDPA)
 *
 * ปรับปรุงเพื่อบูรณาการกับ Prompt Engine:
 * - ใช้ IntentClassifier ใหม่ (14 intents)
 * - ใช้ PromptEngine สำหรับการสร้าง prompt
 * - เพิ่ม fields เลือกได้ (citations, insufficient_evidence) ใน POST /v1/chat
 * - รักษา backward compatibility ของ response schema เดิม
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const RAGEngine = require('./rag');
const { processWithoutLLM } = require('./promptEngine');
const { getValidIntents } = require('./intentClassifier');

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors({
    origin: [
        'https://www.opdc.go.th',
        'https://opdc.go.th',
        'http://localhost:8000',
        'http://localhost:8001',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:8001'
    ],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// เสิร์ฟ static files (หน้าแชท) จากโฟลเดอร์ parent
app.use(express.static(path.join(__dirname, '..')));

// Root route -> เสิร์ฟหน้าแชท
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'chat-test.html'));
});

// ตั้งค่า RAG engine
const engine = new RAGEngine();

// Session store (RAM only — PDPA compliant)
const sessions = new Map();

// Routes

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        chunks_loaded: engine.chunks.length,
        uptime: process.uptime()
    });
});

app.get('/v1/intents', (req, res) => {
    const validIntents = getValidIntents();

    // ทำ backward compatibility: แมป intent IDs เดิม
    const intentMap = {
        'GENERAL_GREETING': { name_th: 'การทักทาย', desc_th: 'ทักทายและสอบถามสถานะ' },
        'ORGANIZATION_INFORMATION': { name_th: 'ข้อมูลองค์กร', desc_th: 'เกี่ยวกับ ก.พ.ร., โครงสร้าง, วิสัยทัศน์, ภารกิจ' },
        'MISSION_AND_RESPONSIBILITIES': { name_th: 'ภารกิจและหน้าที่', desc_th: 'ภารกิจ หน้าที่รับผิดชอบ ยุทธศาสตร์' },
        'PUBLIC_SERVICES': { name_th: 'บริการสาธารณะ', desc_th: 'ขั้นตอนการให้บริการ' },
        'GOVERNMENT_SERVICE_IMPROVEMENT': { name_th: 'ปรับปรุงการบริการราชการ', desc_th: 'นวัตกรรม ดิจิทัล การปรับปรุง' },
        'LAWS_AND_REGULATIONS': { name_th: 'กฎหมายและระเบียบ', desc_th: 'กฎหมาย ระเบียบ กฎระเบียบ' },
        'MANUALS_AND_DOCUMENTS': { name_th: 'คู่มือและเอกสาร', desc_th: 'เอกสาร PDF คู่มือ' },
        'DIGITAL_GOVERNMENT': { name_th: 'ดิจิทัลการปกครอง', desc_th: 'ดิจิทัล ออนไลน์ e-government' },
        'PUBLIC_SECTOR_DEVELOPMENT': { name_th: 'พัฒนาภาครัฐ', desc_th: 'พัฒนาระบบราชการ กลยุทธ์' },
        'CONTACT_AND_SUPPORT': { name_th: 'ช่องทางการติดต่อ', desc_th: 'ที่อยู่ เบอร์ อีเมล Facebook' },
        'DOCUMENT_SEARCH': { name_th: 'ค้นหาเอกสาร', desc_th: 'ค้นหาเอกสาร PDF รายงาน' },
        'FOLLOW_UP_QUESTION': { name_th: 'คำถามต่อ', desc_th: 'ตอบต่อคำถามในประวัติ' },
        'OUT_OF_SCOPE': { name_th: 'นอกขอบเขต', desc_th: 'คำถามไม่เกี่ยวข้องกับ ก.พ.ร.' },
        'INSUFFICIENT_INFORMATION': { name_th: 'ข้อมูลไม่เพียงพอ', desc_th: 'ไม่มีข้อมูลเพียงพอตอบ' }
    };

    const intents = validIntents.map(id => ({
        id: id,
        name_th: intentMap[id] ? intentMap[id].name_th : id,
        description_th: intentMap[id] ? intentMap[id].desc_th : ''
    }));

    res.json({ intents });
});

app.get('/v1/sources', (req, res) => {
    res.json({
        sources: engine.chunks.map(c => c.id),
        total: engine.chunks.length
    });
});

app.post('/v1/chat', async (req, res) => {
    try {
        const { message, session_id } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        // จัดเตรียมประวัติการสนทนา (ถ้ามี)
        const sid = session_id || 'new-' + Date.now();
        const history = sessions.has(sid) ? sessions.get(sid) : [];

        // ค้นหาจาก RAG engine ที่มีอยู่
        const ragResult = engine.answer(message.trim());
        const retrievedDocuments = engine.chunksToRetrievedDocuments(ragResult.matches);

        // ใช้ Prompt Engine สำหรับการประมวลผล (โดยไม่มี LLM ในขณะนี้)
        const promptResult = processWithoutLLM({
            userMessage: message.trim(),
            retrievedDocuments: retrievedDocuments,
            conversationHistory: history.map(h => ({ role: 'user', content: h.user }))
        }, engine);

        // สร้าง response ที่ backward compatible
        const response = {
            answer: promptResult.answer,
            intent: promptResult.intent,
            sources: ragResult.matches.map(m => m.id),
            session_id: sid,
            // เพิ่มเติมเป็น optional fields
            citations: promptResult.citations || [],
            insufficient_evidence: promptResult.insufficient_evidence || false
        };

        // Session-based memory (RAM only — deleted after session ends)
        if (!sessions.has(sid)) {
            sessions.set(sid, []);
        }
        sessions.get(sid).push({ user: message.trim(), bot: response.answer });

        res.json(response);
    } catch (error) {
        console.error('Error in /v1/chat:', error.message);
        const fallbackSid = req.body && req.body.session_id ? req.body.session_id : 'new-' + Date.now();
        res.status(500).json({
            answer: 'ขออภัยครับ เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
            intent: 'INSUFFICIENT_INFORMATION',
            sources: [],
            session_id: fallbackSid,
            error: 'internal_error'
        });
    }
});

app.delete('/v1/session/:id', (req, res) => {
    const { id } = req.params;
    if (sessions.has(id)) {
        sessions.delete(id);
        return res.json({ status: 'deleted', session_id: id });
    }
    return res.json({ status: 'not_found', session_id: id });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
||
||        OPDC Chatbot Backend (with Prompt Engine)                 ||
||
||  Server: http://localhost:${PORT}             ||
||  API:    http://localhost:${PORT}/v1/chat     ||
||  Health: http://localhost:${PORT}/health      ||
||  Chunks: ${engine.chunks.length} loaded                        ||
||
    `);
});
