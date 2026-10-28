'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { getValidIntents } = require('../../intentClassifier');

// GET /api/admin/v1/intents — รายการ intent ทั้งหมดที่ระบบรองรับ
router.get('/', authenticateToken, requireRole('admin', 'editor', 'viewer'), (req, res) => {
    try {
        const intents = getValidIntents().map((id) => ({ id, name_th: id }));
        return res.json({ status: 'success', intents });
    } catch (err) {
        console.error('[intents] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
