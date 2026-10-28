'use strict';

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'knowledge');
const UPLOADED_FILE = path.join(KNOWLEDGE_DIR, 'uploaded-knowledge.json');

/**
 * จัดการ chunks ที่ผู้ใช้งานอัพโหลดเข้ามาเสริมฐานความรู้
 * เก็บแยกจาก knowledge/opdc-knowledge.json เดิมเพื่อกันลบโดยไม่ตั้งใจ
 */
class KnowledgeManager {
    constructor() {
        this.uploadedChunks = [];
        this._loadUploaded();
    }

    _loadUploaded() {
        try {
            if (fs.existsSync(UPLOADED_FILE)) {
                const data = JSON.parse(fs.readFileSync(UPLOADED_FILE, 'utf-8'));
                this.uploadedChunks = Array.isArray(data.chunks) ? data.chunks : [];
            } else {
                this.uploadedChunks = [];
            }
        } catch (err) {
            console.error('[KnowledgeManager] Failed to load uploaded knowledge:', err.message);
            this.uploadedChunks = [];
        }
    }

    saveUploaded() {
        try {
            fs.writeFileSync(UPLOADED_FILE, JSON.stringify({ chunks: this.uploadedChunks }, null, 2), 'utf-8');
        } catch (err) {
            console.error('[KnowledgeManager] Failed to save uploaded knowledge:', err.message);
            throw err;
        }
    }

    getChunks() {
        return [...this.uploadedChunks];
    }

    addChunks(newChunks) {
        if (!Array.isArray(newChunks) || newChunks.length === 0) {
            return this.uploadedChunks;
        }
        this.uploadedChunks.push(...newChunks);
        this.saveUploaded();
        return this.uploadedChunks;
    }

    removeChunk(chunkId) {
        const before = this.uploadedChunks.length;
        this.uploadedChunks = this.uploadedChunks.filter(c => c.id !== chunkId);
        if (this.uploadedChunks.length < before) {
            this.saveUploaded();
            return true;
        }
        return false;
    }

    clearAll() {
        this.uploadedChunks = [];
        this.saveUploaded();
    }

    /**
     * แยกคำสำคัญจากข้อความ (สำหรับใช้เป็น keywords ใน chunk)
     * แยกด้วย whitespace และเครื่องหมายประโยค กรองคำสั้นกว่า 2 ตัวอักษร
     */
    static extractKeywords(text) {
        if (!text || typeof text !== 'string') return [];
        const tokens = text
            .toLowerCase()
            .split(/[\s,./?!=+()«»""''ก-๙0-9]+/)
            .filter(t => t.length >= 2)
            .filter(t => /^[a-z0-9ก-๙]+$/.test(t));
        return [...new Set(tokens)].slice(0, 20);
    }

    /**
     * แปลงข้อความดิบจากไฟล์เป็น array ของ chunks
     * แยกย่อยด้วยย่อหน้า (double newline) ย่อหน้ายาวจะแยกย่อยอีกครั้ง
     *
     * @param {string} text - ข้อความดิบจากไฟล์
     * @param {string} filename - ชื่อไฟล์ต้นฉบับ
     * @param {number} [chunkSize=500] - จำนวนตัวอักษรสูงสุดต่อ chunk
     * @returns {Array<Object>} รายการ chunks
     */
    static parseTextToChunks(text, filename, chunkSize = 500) {
        if (!text || typeof text !== 'string') return [];

        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const chunks = [];
        let chunkIndex = 0;

        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (trimmed.length === 0) continue;

            if (trimmed.length > chunkSize) {
                // แยกย่อหน้ายาวออกเป็น chunks ย่อย ๆ
                const sentences = trimmed.split(/(?<=[.!?])\s+/);
                let current = '';
                for (const sentence of sentences) {
                    const candidate = current ? current + ' ' + sentence : sentence;
                    if (candidate.length > chunkSize && current.length > 0) {
                        chunks.push(KnowledgeManager._makeChunk(current.trim(), filename, chunkIndex++));
                        current = sentence;
                    } else {
                        current = candidate;
                    }
                }
                if (current.trim().length > 0) {
                    chunks.push(KnowledgeManager._makeChunk(current.trim(), filename, chunkIndex++));
                }
            } else {
                chunks.push(KnowledgeManager._makeChunk(trimmed, filename, chunkIndex++));
            }
        }

        return chunks;
    }

    static _makeChunk(content, filename, index) {
        const keywords = KnowledgeManager.extractKeywords(content);
        const id = `upload_${Date.now()}_${index}`;
        return {
            id,
            category: 'uploaded',
            keywords,
            title: filename,
            sourceUrl: null,
            publisher: 'user_uploaded',
            documentStatus: 'uploaded',
            content,
            text: content,
            uploadedAt: new Date().toISOString(),
            originalFile: filename
        };
    }
}

module.exports = KnowledgeManager;
