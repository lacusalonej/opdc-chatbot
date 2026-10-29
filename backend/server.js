/**
 * Express Backend สำหรับ Chatbot ก.พ.ร.
 * - POST /v1/chat — ส่งคำถามและได้คำตอบ
 * - GET /v1/intents — แสดง intents ที่ recognize ได้
 * - GET /v1/sources — แสดงแหล่งข้อมูล
 * - DELETE /v1/session/:id — ทำให้ session หมดอายุ (PDPA)
 * - POST /api/admin/v1/* — ระบบหลังบ้านแอดมิน (ตรวจสอบสิทธิ์, RBAC)
 */
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const crypto = require('crypto');
const path = require('path');
const RAGEngine = require('./rag');
const { processWithoutLLM } = require('./promptEngine');
const { getValidIntents } = require('./intentClassifier');
const createAdminRoutes = require('./adminRoutes');
const KnowledgeManager = require('./utils/knowledgeManager');

// ระบบหลังบ้านใหม่ (ฐานข้อมูล SQLite + เส้นทาง API แอดมิน)
const { initialize: initDb, close: closeDb } = require('./database/db');
const adminAuthRoutes = require('./routes/admin/auth');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminKnowledgeRoutes = require('./routes/admin/knowledge');
const adminIntentsRoutes = require('./routes/admin/intents');
const adminPromptRoutes = require('./routes/admin/prompt');
const adminConversationsRoutes = require('./routes/admin/conversations');
const adminSystemRoutes = require('./routes/admin/system');

const app = express();
const PORT = process.env.PORT || 8001;

// ปิดการเปิดเผย X-Powered-By header (security)
app.disable('x-powered-by');

// ตรวจสอบ secret สำหรับเข้ารหัสเซสชัน (ห้ามใช้ค่า default ที่ hardcode ไว้ใน production)
const sessionSecret = process.env.ADMIN_SESSION_SECRET
    || (process.env.NODE_ENV === 'production' ? undefined : crypto.randomBytes(32).toString('hex'));
if (!sessionSecret) {
    console.error('[FATAL] ADMIN_SESSION_SECRET ต้องถูกตั้งค่าในตัวแปรสภาพแวดล้อมเมื่อรันใน production');
    process.exit(1);
}

// ระบบเก็บ session: ใช้ Redis ใน production (เมื่อมี REDIS_URL) / MemoryStore ใน development
let sessionStore = undefined;
if (process.env.REDIS_URL) {
    const redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch((err) => {
        console.error('[Redis] เชื่อมต่อไม่สำเร็จ:', err.message);
    });
    sessionStore = new RedisStore({ client: redisClient });
}

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key', 'X-CSRF-Token'],
    credentials: true,
}));
app.use(express.json());
app.use(session({
    name: 'session_id',
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 ชั่วโมง
    },
}));

// ปิดเส้นทางภายในก่อน static middleware เพื่อไม่ให้ static จับก่อน
app.get('/admin', (_, res) => {
    res.status(403).json({ error: 'Forbidden: admin access required' });
});

// เสิร์ฟ static files (หน้าแชทและหน้าแอดมิน) จากโฟลเดอร์ parent
app.use(express.static(path.join(__dirname, '..')));

// Root route -> คืนข้อมูลบริการเป็น JSON
app.get('/', (req, res) => {
    res.json({
        name: 'OPDC Chatbot Backend',
        version: '1.0.0',
        service: 'chatbot-api',
        status: 'ok',
        endpoints: ['/v1/chat', '/v1/intents', '/v1/sources', '/health']
    });
});

// ตั้งค่า RAG engine
const engine = new RAGEngine();

// ระบบจัดการความรู้ที่ผู้ใช้งานอัพโหลดเพิ่มเติม
const km = new KnowledgeManager();

// โหลด chunks ที่อัพโหลดไว้ก่อนหน้าเข้าสู่ engine (ไม่ต้องรีสตาร์ทเซิร์ฟเวอร์)
const uploadedChunks = km.getChunks();
if (uploadedChunks.length > 0) {
    engine.addChunks(uploadedChunks);
}

// Session store สำหรับแชท (RAM only — PDPA compliant)
const chatSessions = new Map();

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

        if (typeof message !== 'string') {
            return res.status(400).json({ error: 'message must be a string' });
        }
        if (!message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        // จัดเตรียมประวัติการสนทนา (ถ้ามี)
        const sid = session_id || 'new-' + Date.now();
        const history = chatSessions.has(sid) ? chatSessions.get(sid) : [];

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
        if (!chatSessions.has(sid)) {
            chatSessions.set(sid, []);
        }
        chatSessions.get(sid).push({ user: message.trim(), bot: response.answer });

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
    if (chatSessions.has(id)) {
        chatSessions.delete(id);
        return res.json({ status: 'deleted', session_id: id });
    }
    return res.json({ status: 'not_found', session_id: id });
});

// ระบบอัพโหลดไฟล์และจัดการฐานความรู้ (แอดมินเดิม)
app.use('/v1/admin', createAdminRoutes(engine, km));

// ============ ระบบหลังบ้านใหม่: /api/admin/v1 ============
app.use('/api/admin/v1/auth', adminAuthRoutes);
app.use('/api/admin/v1/dashboard', adminDashboardRoutes);
app.use('/api/admin/v1/knowledge', adminKnowledgeRoutes);
app.use('/api/admin/v1/intents', adminIntentsRoutes);
app.use('/api/admin/v1/prompt', adminPromptRoutes);
app.use('/api/admin/v1/conversations', adminConversationsRoutes);
app.use('/api/admin/v1/system', adminSystemRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Body parser และ errors อื่น ๆ อาจมี status code ที่เฉพาะเจาะจง
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message || 'Error' });
});

// Start server (หลังจากฐานข้อมูลพร้อมแล้ว)
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`
||
||        OPDC Chatbot Backend (with Admin Dashboard)                 ||
||
||  Server: http://localhost:${PORT}             ||
||  API:    http://localhost:${PORT}/v1/chat     ||
||  Health: http://localhost:${PORT}/health      ||
||  Chunks: ${engine.chunks.length} loaded                        ||
||
        `);
    });
}).catch((err) => {
    console.error('[FATAL] Failed to initialize database:', err.message);
    process.exit(1);
});

// ปิดฐานข้อมูลอย่างปลอดภัยเมื่อเซิร์ฟเวอร์หยุดทำงาน
process.on('SIGTERM', () => closeDb().catch(() => {}));
process.on('SIGINT', () => closeDb().catch(() => {}));
