'use strict';

const { get } = require('../database/db');

/**
 * Middleware ตรวจสอบเซสชันผู้ใช้ที่ล็อกอินแล้ว
 * ต้องมี req.session.userId (จาก express-session) และผู้ใช้ต้องยังใช้งานได้ในฐานข้อมูล
 */
async function authenticateToken(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' });
        }

        const user = await get(
            `SELECT id, username, role, is_active FROM users WHERE id = ?`,
            [req.session.userId]
        );

        if (!user) {
            return res.status(401).json({ error: 'เซสชันไม่ถูกต้อง กรุณาล็อกอินใหม่' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'บัญชีผู้ใช้ถูกระงับการใช้งาน' });
        }

        req.user = { id: user.id, username: user.username, role: user.role };
        next();
    } catch (err) {
        console.error('[authenticateToken] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
}

/**
 * Middleware ตรวจสอบบทบาทของผู้ใช้
 * @param  {...string} allowedRoles - บทบาทที่อนุญาต เช่น 'admin', 'editor', 'viewer'
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };
