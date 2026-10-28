'use strict';

/**
 * Middleware ยืนยันตัวตนสำหรับ endpoint แอดมินอัพโหลดไฟล์
 * ตรวจสอบ header X-Admin-Key หรือ query param admin_key
 */
const ADMIN_KEY = process.env.ADMIN_UPLOAD_KEY || 'opdc-admin-2026';

function requireAdminKey(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.admin_key;
    if (key === ADMIN_KEY) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized: admin key required' });
}

module.exports = { requireAdminKey, ADMIN_KEY };
