'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const AuditLog = require('../../models/AuditLog');

// GET /api/admin/v1/dashboard/stats — สถิติภาพรวมสำหรับหน้าหลัก
router.get('/stats', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        const [userCount, conversationCount, auditCount] = await Promise.all([
            User.countUsers(),
            Conversation.countConversations(),
            AuditLog.countAuditLogs(),
        ]);

        return res.json({
            status: 'success',
            stats: {
                users: userCount,
                conversations: conversationCount,
                auditLogs: auditCount,
            },
        });
    } catch (err) {
        console.error('[dashboard/stats] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
