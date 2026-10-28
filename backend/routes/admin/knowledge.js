'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { csrfProtection } = require('./auth');
const KnowledgeManager = require('../../utils/knowledgeManager');

const km = new KnowledgeManager();

// ตั้งค่า multer สำหรับอัพโหลดไฟล์ (เก็บในหน่วยความจำ, ไม่บันทึกลงดิสก์)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // จำกัดขนาดไฟล์สูงสุด 10 MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('รองรับเฉพาะไฟล์ PDF, Word (.docx) และข้อความ (.txt) เท่านั้น'), false);
        }
    },
});

// GET /api/admin/v1/knowledge/chunks — รายการชิ้นข้อมูลในฐานความรู้ที่อัพโหลด
router.get('/chunks', authenticateToken, requireRole('admin', 'editor', 'viewer'), (req, res) => {
    try {
        const chunks = km.getChunks();
        return res.json({ status: 'success', chunks, total: chunks.length });
    } catch (err) {
        console.error('[knowledge/chunks] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// POST /api/admin/v1/knowledge/chunks — เพิ่มชิ้นข้อมูลใหม่จากข้อความ
router.post('/chunks', authenticateToken, requireRole('admin', 'editor'), csrfProtection, async (req, res) => {
    try {
        const { content, title } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุเนื้อหา' });
        }

        const chunks = KnowledgeManager.parseTextToChunks(content, title || 'ผู้ใช้ระบุ', 500);
        const allChunks = km.addChunks(chunks);

        return res.json({
            status: 'success',
            message: `เพิ่ม ${chunks.length} ชิ้นข้อมูลเข้าฐานความรู้แล้ว`,
            chunksAdded: chunks.length,
            totalChunks: allChunks.length,
        });
    } catch (err) {
        console.error('[knowledge/chunks POST] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// POST /api/admin/v1/knowledge/upload — อัพโหลดไฟล์ PDF/Word/Text และแปลงเป็น chunks
router.post('/upload', authenticateToken, requireRole('admin', 'editor'), csrfProtection, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาเลือกไฟล์ก่อนอัพโหลด' });
        }

        const { title, sourceUrl } = req.body;
        const file = req.file;

        let text = '';
        let originalFile = file.originalname;

        // แยกข้อความตามชนิดไฟล์
        if (file.mimetype === 'application/pdf') {
            const data = await pdfParse(file.buffer);
            text = data.text || '';
        } else if (file.mimetype === 'text/plain') {
            text = file.buffer.toString('utf-8');
        } else if (file.mimetype.includes('wordprocessingml')) {
            // .docx ต้องการแพ็คเกจ mammoth ซึ่งยังไม่ติดตั้ง
            return res.status(400).json({
                error: 'ไฟล์ Word (.docx) ยังไม่รองรับในขณะนี้ กรุณาแปลงเป็น PDF หรือไฟล์ข้อความ (.txt) ก่อนอัพโหลด หรือติดตั้งแพ็คเกจ mammoth เพิ่มเติม',
            });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'ไม่สามารถอ่านข้อความจากไฟล์ได้ กรุณาตรวจสอบไฟล์แล้วลองใหม่' });
        }

        const chunkTitle = (title || '').trim() || originalFile;
        const chunks = KnowledgeManager.parseTextToChunks(text, chunkTitle, 500);

        // แทรก metadata ที่เกี่ยวข้องกับไฟล์ที่อัพโหลด
        chunks.forEach((c) => {
            if (sourceUrl && sourceUrl.trim()) c.sourceUrl = sourceUrl.trim();
            c.originalFile = originalFile;
            c.documentStatus = 'uploaded';
            c.publisher = 'user_uploaded';
        });

        const allChunks = km.addChunks(chunks);

        return res.json({
            status: 'success',
            message: `อัพโหลดไฟล์ "${originalFile}" สำเร็จ เพิ่ม ${chunks.length} ชิ้นข้อมูลเข้าฐานความรู้`,
            chunksAdded: chunks.length,
            totalChunks: allChunks.length,
        });
    } catch (err) {
        console.error('[knowledge/upload] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ: ' + err.message });
    }
});

// DELETE /api/admin/v1/knowledge/chunks/:id — ลบชิ้นข้อมูลตามรหัส
router.delete('/chunks/:id', authenticateToken, requireRole('admin', 'editor'), csrfProtection, (req, res) => {
    try {
        const { id } = req.params;
        const removed = km.removeChunk(id);
        if (removed) {
            return res.json({ status: 'success', message: `ลบชิ้นข้อมูล ${id} แล้ว` });
        }
        return res.status(404).json({ error: 'ไม่พบชิ้นข้อมูลที่ระบุ' });
    } catch (err) {
        console.error('[knowledge/chunks DELETE] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
