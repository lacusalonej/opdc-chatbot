'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { authenticateToken, requireRole } = require('../../middleware/adminAuth');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

// จำกัดจำนวนครั้งในการพยายามล็อกอิน เพื่อป้องกันการเดารหัสผ่าน (brute force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 10, // สูงสุด 10 ครั้งต่อ IP
    message: { error: 'พยายามล็อกอินบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
    standardHeaders: true,
    legacyHeaders: false,
});

function generateCsrfToken(req) {
    const token = crypto.randomBytes(32).toString('hex');
    req.session.csrfToken = token;
    return token;
}

// ตรวจสอบ CSRF token สำหรับการเปลี่ยนแปลงสถานะ (POST/PUT/DELETE)
function csrfProtection(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    const token = req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: 'CSRF token ไม่ถูกต้อง' });
    }
    next();
}

// POST /api/admin/v1/auth/login — ล็อกอินเข้าสู่ระบบแอดมิน
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน' });
        }

        const user = await User.getUserByUsername(username);
        if (!user || !user.is_active) {
            // ข้อความทั่วไป ไม่เปิดเผยว่ามีผู้ใช้นี้หรือไม่
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const valid = await User.comparePassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Regenerate session เพื่อป้องกัน session fixation
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
            }
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            req.session.csrfToken = generateCsrfToken(req);

            User.updateLastLogin(user.id).catch(() => {});

            AuditLog.createAuditLog({
                userId: user.id,
                action: 'login',
                entityType: 'user',
                entityId: String(user.id),
                details: 'ผู้ใช้ล็อกอินเข้าสู่ระบบแอดมิน',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            }).catch(() => {});

            return res.json({
                status: 'success',
                message: 'ล็อกอินสำเร็จ',
                user: { id: user.id, username: user.username, role: user.role },
                csrfToken: req.session.csrfToken,
            });
        });
    } catch (err) {
        console.error('[auth/login] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// POST /api/admin/v1/auth/logout — ออกจากระบบและยกเลิกเซสชันฝั่งเซิร์ฟเวอร์
router.post('/logout', authenticateToken, csrfProtection, async (req, res) => {
    try {
        const userId = req.session.userId;
        if (userId) {
            AuditLog.createAuditLog({
                userId,
                action: 'logout',
                entityType: 'user',
                entityId: String(userId),
                details: 'ผู้ใช้ออกจากระบบแอดมิน',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            }).catch(() => {});
        }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
            }
            res.clearCookie('session_id');
            return res.json({ status: 'success', message: 'ออกจากระบบแล้ว' });
        });
    } catch (err) {
        console.error('[auth/logout] Error:', err.message);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

// GET /api/admin/v1/auth/me — ข้อมูลผู้ใช้ที่ล็อกอินอยู่
router.get('/me', authenticateToken, (req, res) => {
    return res.json({
        status: 'success',
        user: { id: req.user.id, username: req.user.username, role: req.user.role },
    });
});

// GET /api/admin/v1/auth/csrf-token — ดึง CSRF token สำหรับการร้องขอครั้งถัดไป
router.get('/csrf-token', authenticateToken, (req, res) => {
    const token = generateCsrfToken(req);
    return res.json({ status: 'success', csrfToken: token });
});

module.exports = router;
module.exports.csrfProtection = csrfProtection;
