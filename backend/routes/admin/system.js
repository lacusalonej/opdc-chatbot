'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const { csrfProtection } = require('./auth');
const Config = require('../../models/Config');
const AuditLog = require('../../models/AuditLog');

// GET /api/admin/v1/system/health — ตรวจสอบสถานะระบบหลังบ้าน
router.get('/health', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        return res.json({
            status: 'success',
            health: {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            },
        });
    } catch (err) {
        console.error('[system/health] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// GET /api/admin/v1/system/audit-logs — รายงานบันทึกการดำเนินการ
router.get('/audit-logs', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;

        const [logs, total] = await Promise.all([
            AuditLog.listAuditLogs({ limit, offset }),
            AuditLog.countAuditLogs(),
        ]);

        return res.json({
            status: 'success',
            logs,
            total,
            limit,
            offset,
        });
    } catch (err) {
        console.error('[system/audit-logs] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// GET /api/admin/v1/system/config — รายการคอนฟิกทั้งหมดของระบบ
router.get('/config', authenticateToken, requireRole('admin', 'editor', 'viewer'), async (req, res) => {
    try {
        const configs = await Config.listConfigs();
        return res.json({ status: 'success', configs });
    } catch (err) {
        console.error('[system/config] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// PUT /api/admin/v1/system/config/:key — อัปเดตคอนฟิกรายตัว (เฉพาะแอดมิน)
router.put('/config/:key', authenticateToken, requireRole('admin'), csrfProtection, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        if (value === undefined || value === null) {
            return res.status(400).json({ error: 'กรุณาระบุค่า' });
        }

        await Config.setConfig(key, String(value), description || '', req.user.id);

        await AuditLog.createAuditLog({
            userId: req.user.id,
            action: 'update_system_config',
            entityType: 'system_config',
            entityId: key,
            details: `อัปเดตคอนฟิก ${key}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        }).catch(() => {});

        return res.json({ status: 'success', message: 'อัปเดตการตั้งค่าระบบแล้ว' });
    } catch (err) {
        console.error('[system/config PUT] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

module.exports = router;
