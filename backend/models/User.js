'use strict';

const { get, all, run } = require('../database/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}

async function createUser({ username, password, role = 'admin' }) {
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const result = await run(
        `INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
        [username, passwordHash, role, now, now]
    );
    return getUserById(result.id);
}

async function getUserById(id) {
    return get(
        `SELECT id, username, role, is_active, created_at, updated_at, last_login_at FROM users WHERE id = ?`,
        [id]
    );
}

async function getUserByUsername(username) {
    return get(
        `SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at FROM users WHERE username = ?`,
        [username]
    );
}

async function updateLastLogin(userId) {
    const now = new Date().toISOString();
    await run(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [now, now, userId]);
    return getUserById(userId);
}

async function listUsers() {
    return all(
        `SELECT id, username, role, is_active, created_at, updated_at, last_login_at FROM users ORDER BY created_at DESC`
    );
}

async function updateUser(userId, { role, is_active }) {
    const fields = [];
    const params = [];
    if (role !== undefined) {
        fields.push('role = ?');
        params.push(role);
    }
    if (is_active !== undefined) {
        fields.push('is_active = ?');
        params.push(is_active ? 1 : 0);
    }
    if (fields.length === 0) {
        return getUserById(userId);
    }
    fields.push('updated_at = ?');
    params.push(new Date().toISOString(), userId);
    await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return getUserById(userId);
}

async function deleteUser(userId) {
    const { changes } = await run(`DELETE FROM users WHERE id = ?`, [userId]);
    return changes > 0;
}

async function countUsers() {
    const row = await get(`SELECT COUNT(*) AS cnt FROM users`);
    return row ? row.cnt : 0;
}

module.exports = {
    createUser,
    getUserById,
    getUserByUsername,
    updateLastLogin,
    listUsers,
    updateUser,
    deleteUser,
    countUsers,
    hashPassword,
    comparePassword,
};
