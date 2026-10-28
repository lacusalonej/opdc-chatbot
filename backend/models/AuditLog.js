'use strict';

const { get, all, run } = require('../database/db');

async function createAuditLog({ userId, action, entityType, entityId, details, ipAddress, userAgent }) {
    const result = await run(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId, details, ipAddress, userAgent, new Date().toISOString()]
    );
    return getAuditLogById(result.id);
}

async function getAuditLogById(id) {
    return get(`SELECT * FROM audit_logs WHERE id = ?`, [id]);
}

async function listAuditLogs({ limit = 100, offset = 0 } = {}) {
    return all(
        `SELECT al.*, u.username FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );
}

async function countAuditLogs() {
    const row = await get(`SELECT COUNT(*) AS cnt FROM audit_logs`);
    return row ? row.cnt : 0;
}

module.exports = {
    createAuditLog,
    getAuditLogById,
    listAuditLogs,
    countAuditLogs,
};
