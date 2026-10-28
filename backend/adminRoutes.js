'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAdminKey } = require('./middleware/auth');
const KnowledgeManager = require('./utils/knowledgeManager');

/**
 * สร้าง router สำหรับ endpoint แอดมินอัพโหลดไฟล์
 *
 * @param {Object} engine - RAGEngine instance ที่ทำงานอยู่
 * @param {KnowledgeManager} km - KnowledgeManager instance
 * @returns {Express.Router}
 */
function createAdminRoutes(engine, km) {
    const router = require('express').Router();

    // โฟลเดอร์เก็บไฟล์ที่อัพโหลด
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_');
            cb(null, `${Date.now()}_${safeName}`);
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (['.txt', '.pdf'].includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error('รองรับเฉพาะไฟล์ .txt และ .pdf เท่านั้น'), false);
            }
        }
    });

    /**
     * POST /v1/admin/upload
     * อัพโหลดไฟล์ -> แยกข้อความ -> สร้าง chunks -> เพิ่มเข้าฐานความรู้
     */
    router.post('/upload', requireAdminKey, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัพโหลด' });
            }

            const filePath = req.file.path;
            const originalName = req.file.originalname;
            const ext = path.extname(originalName).toLowerCase();

            let text = '';

            if (ext === '.txt') {
                text = fs.readFileSync(filePath, 'utf-8');
            } else if (ext === '.pdf') {
                const pdfParse = require('pdf-parse');
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                text = pdfData.text || '';
            }

            if (!text || text.trim().length === 0) {
                try { fs.unlinkSync(filePath); } catch (_) {}
                return res.status(400).json({ error: 'แยกข้อความจากไฟล์ไม่ได้ หรือไฟล์ว่างเปล่า' });
            }

            const chunks = KnowledgeManager.parseTextToChunks(text, originalName);
            const allChunks = km.addChunks(chunks);

            // เพิ่ม chunks เข้า RAG engine ทันที (ไม่ต้องรีสตาร์ทเซิร์ฟเวอร์)
            if (engine && typeof engine.addChunks === 'function') {
                engine.addChunks(chunks);
            }

            res.json({
                status: 'success',
                file: originalName,
                chunksAdded: chunks.length,
                totalUploadedChunks: km.getChunks().length,
                message: `อัพโหลดไฟล์ "${originalName}" สำเร็จ เพิ่ม ${chunks.length} ชิ้นข้อมูลเข้าฐานความรู้แล้ว`
            });
        } catch (err) {
            console.error('[AdminUpload] Error:', err);
            res.status(500).json({ error: err.message || 'อัพโหลดไม่สำเร็จ' });
        }
    });

    /**
     * GET /v1/admin/files
     * ดูรายการไฟล์ที่อัพโหลดแล้วและจำนวน chunks
     */
    router.get('/files', requireAdminKey, (req, res) => {
        const chunks = km.getChunks();
        const files = {};
        chunks.forEach(c => {
            if (!files[c.originalFile]) {
                files[c.originalFile] = {
                    filename: c.originalFile,
                    uploadedAt: c.uploadedAt,
                    chunkCount: 0,
                    chunkIds: []
                };
            }
            files[c.originalFile].chunkCount++;
            files[c.originalFile].chunkIds.push(c.id);
        });
        res.json({
            status: 'success',
            files: Object.values(files),
            totalChunks: chunks.length
        });
    });

    /**
     * DELETE /v1/admin/files/:chunkId
     * ลบ chunk เดียวออกจากฐานความรู้ที่อัพโหลด
     */
    router.delete('/files/:chunkId', requireAdminKey, (req, res) => {
        const { chunkId } = req.params;
        const removed = km.removeChunk(chunkId);

        // ลบออกจาก engine.chunks ด้วย
        if (engine && typeof engine.removeChunk === 'function') {
            engine.removeChunk(chunkId);
        }

        if (removed) {
            res.json({ status: 'success', message: `ลบชิ้นข้อมูล ${chunkId} แล้ว` });
        } else {
            res.status(404).json({ error: 'ไม่พบชิ้นข้อมูลที่ระบุ' });
        }
    });

    /**
     * POST /v1/admin/reload
     * โหลดฐานความรู้ที่อัพโหลดใหม่จากไฟล์
     */
    router.post('/reload', requireAdminKey, (req, res) => {
        km._loadUploaded();
        res.json({
            status: 'success',
            message: 'โหลดฐานความรู้ที่อัพโหลดใหม่แล้ว',
            totalUploadedChunks: km.getChunks().length
        });
    });

    return router;
}

module.exports = createAdminRoutes;
