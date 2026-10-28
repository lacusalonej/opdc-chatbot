'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { csrfProtection } = require('./auth');
const Conversation = require('../../models/Conversation');
const AuditLog = require('../../models/AuditLog');

// GET /api/admin/v1/conversations — รายการประวัติการสนทนา
router.get('/', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;

        const [conversations, total] = await Promise.all([
            Conversation.listConversations({ limit, offset }),
            Conversation.countConversations(),
        ]);

        return res.json({
            status: 'success',
            conversations,
            total,
            limit,
            offset,
        });
    } catch (err) {
        console.error('[conversations] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// DELETE /api/admin/v1/conversations/:id — ลบประวัติการสนทนาตามรหัส (PDPA)
router.delete('/:id', authenticateToken, requireRole('admin'), csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Conversation.deleteConversation(id);
        if (!deleted) {
            return res.status(404).json({ error: 'ไม่พบประวัติการสนทนาที่ระบุ' });
        }

        await AuditLog.createAuditLog({
            userId: req.user.id,
            action: 'delete_conversation',
            entityType: 'conversation',
            entityId: id,
            details: `ลบประวัติการสนทนา id=${id}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        }).catch(() => {});

        return res.json({ status: 'success', message: 'ลบประวัติการสนทนาแล้ว' });
    } catch (err) {
        console.error('[conversations DELETE] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
