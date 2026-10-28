'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { csrfProtection } = require('./auth');
const KnowledgeManager = require('../../utils/knowledgeManager');

const km = new KnowledgeManager();

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
