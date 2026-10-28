'use strict';

const { get, all, run } = require('../database/db');

async function getConfig(key) {
    return get(`SELECT * FROM system_config WHERE key = ?`, [key]);
}

async function setConfig(key, value, description, updatedBy) {
    const now = new Date().toISOString();
    const existing = await getConfig(key);
    if (existing) {
        await run(
            `UPDATE system_config SET value = ?, description = ?, updated_at = ?, updated_by = ? WHERE key = ?`,
            [value, description, now, updatedBy, key]
        );
    } else {
        await run(
            `INSERT INTO system_config (key, value, description, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)`,
            [key, value, description, now, updatedBy]
        );
    }
    return getConfig(key);
}

async function listConfigs() {
    return all(`SELECT key, value, description, updated_at, updated_by FROM system_config ORDER BY key`);
}

async function deleteConfig(key) {
    const { changes } = await run(`DELETE FROM system_config WHERE key = ?`, [key]);
    return changes > 0;
}

module.exports = {
    getConfig,
    setConfig,
    listConfigs,
    deleteConfig,
};
