'use strict';

const { get, all, run } = require('../database/db');

async function createConversation({ sessionId, userMessage, botResponse, intent, sources }) {
    const result = await run(
        `INSERT INTO conversations (session_id, user_message, bot_response, intent, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, userMessage, botResponse, intent, sources, new Date().toISOString()]
    );
    return getConversationById(result.id);
}

async function getConversationById(id) {
    return get(`SELECT * FROM conversations WHERE id = ?`, [id]);
}

async function listConversations({ limit = 100, offset = 0 } = {}) {
    return all(
        `SELECT * FROM conversations ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );
}

async function countConversations() {
    const row = await get(`SELECT COUNT(*) AS cnt FROM conversations`);
    return row ? row.cnt : 0;
}

async function deleteConversation(id) {
    const { changes } = await run(`DELETE FROM conversations WHERE id = ?`, [id]);
    return changes > 0;
}

module.exports = {
    createConversation,
    getConversationById,
    listConversations,
    countConversations,
    deleteConversation,
};
