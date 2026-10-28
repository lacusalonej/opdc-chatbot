'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { csrfProtection } = require('./auth');
const Config = require('../../models/Config');
const AuditLog = require('../../models/AuditLog');

const PROMPT_CONFIG_KEY = 'prompt_template_version';

// GET /api/admin/v1/prompt/config — ดูเวอร์ชันเทมเพลต prompt ปัจจุบัน
router.get('/config', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        const config = await Config.getConfig(PROMPT_CONFIG_KEY);
        return res.json({
            status: 'success',
            config: config
                ? { key: config.key, value: config.value, description: config.description }
                : { key: PROMPT_CONFIG_KEY, value: '1.0.0', description: 'เวอร์ชันเริ่มต้น' },
        });
    } catch (err) {
        console.error('[prompt/config] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// PUT /api/admin/v1/prompt/config — อัปเดตเวอร์ชันเทมเพลต prompt (เฉพาะแอดมิน)
router.put('/config', authenticateToken, requireRole('admin'), csrfProtection, async (req, res) => {
    try {
        const { value, description } = req.body;
        if (value === undefined || value === null) {
            return res.status(400).json({ error: 'กรุณาระบุค่าเวอร์ชัน' });
        }

        await Config.setConfig(
            PROMPT_CONFIG_KEY,
            String(value),
            description || 'เวอร์ชันเทมเพลต prompt',
            req.user.id
        );

        await AuditLog.createAuditLog({
            userId: req.user.id,
            action: 'update_prompt_config',
            entityType: 'system_config',
            entityId: PROMPT_CONFIG_KEY,
            details: `อัปเดตเวอร์ชัน prompt template เป็น ${value}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        }).catch(() => {});

        return res.json({ status: 'success', message: 'อัปเดตการตั้งค่า prompt แล้ว' });
    } catch (err) {
        console.error('[prompt/config PUT] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
