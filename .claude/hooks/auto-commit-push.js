#!/usr/bin/env node
/**
 * อัปโหลดขึ้น GitHub อัตโนมัติ (เฉพาะไฟล์ที่ Claude Code เป็นผู้แก้ไข)
 * ---------------------------------------------------------------
 * เรียกใช้อัตโนมัติจาก .claude/settings.json ทุกครั้งที่มีการแก้ไขไฟล์
 *
 * ขอบเขต (ผู้ใช้อนุมัติไว้แล้ว):
 *   - บันทึกเฉพาะไฟล์ที่ Claude Code เพิ่งแก้ไข ไม่แตะไฟล์อื่นของผู้ใช้
 *   - ไฟล์ที่อยู่ใน .gitignore จะถูกข้าม
 *   - ไฟล์ที่อยู่นอกคลัง Git จะถูกข้าม
 *
 * ขั้นตอน:
 *   1. อ่านพาธไฟล์ที่เพิ่งถูกแก้ไขจากข้อมูลที่ Claude Code ส่งมา
 *   2. ตรวจว่าอยู่ในคลัง Git และไม่ถูก .gitignore กัน
 *   3. เก็บไฟล์นั้นเข้า staging (เฉพาะไฟล์นี้ไฟล์เดียว)
 *   4. สร้างข้อความบันทึกอัตโนมัติ
 *   5. บันทึก (commit)
 *   6. ส่งขึ้น GitHub (push) ลองใหม่ได้ 2 ครั้ง
 *
 * หลักการสำคัญ: ออกด้วยรหัส 0 เสมอ เพื่อไม่ให้รบกวนการทำงานของผู้ใช้
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAX_PUSH_RETRIES = 2;
const PUSH_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------- ตัวช่วยเรียก Git

function git(args, opts = {}) {
    return execFileSync('git', args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: opts.timeout || 30000,
        env: Object.assign({}, process.env, {
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: 'echo'
        })
    });
}

/** เรียก Git โดยไม่ทำให้โปรแกรมล้ม — คืนค่า {ok, out} */
function gitTry(args, opts = {}) {
    try {
        return { ok: true, out: git(args, opts) };
    } catch (err) {
        return { ok: false, out: (err.stdout || '') + (err.stderr || ''), err };
    }
}

function log(msg) {
    try { process.stderr.write('[auto-push] ' + msg + '\n'); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- หาไฟล์ที่ถูกแก้

/**
 * ดึงพาธไฟล์ที่เพิ่งถูกแก้ไขออกจากข้อมูลที่ Claude Code ส่งมา
 * รองรับ Write, Edit, MultiEdit และ NotebookEdit
 */
function extractEditedFile(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const toolInput = payload.tool_input || payload.toolInput || null;
    if (!toolInput) return null;

    const candidates = [
        toolInput.file_path,
        toolInput.filePath,
        toolInput.notebook_path,
        toolInput.notebookPath
    ];

    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
}

// ---------------------------------------------------------------- เริ่มทำงาน

function main() {
    // 0) อ่านข้อมูลจาก Claude Code
    let payload = {};
    try {
        const raw = fs.readFileSync(0, 'utf8');
        if (raw && raw.trim()) payload = JSON.parse(raw);
        else { log('ไม่ได้รับข้อมูลไฟล์ที่แก้ไข - ข้ามรอบนี้'); return; }
    } catch (e) {
        log('อ่านข้อมูลไฟล์ที่แก้ไขไม่สำเร็จ - ข้ามรอบนี้');
        return;
    }

    // 1) ต้องอยู่ในคลัง Git จริง
    const inside = gitTry(['rev-parse', '--is-inside-work-tree']);
    if (!inside.ok || inside.out.trim() !== 'true') return;

    // 2) ต้องรู้ว่าไฟล์ไหนถูกแก้
    const edited = extractEditedFile(payload);
    if (!edited) { log('ไม่ทราบว่าแก้ไขไฟล์ใด - ข้ามรอบนี้'); return; }

    const absPath = path.resolve(edited);

    // 2a) ไฟล์ต้องอยู่ภายในคลังนี้
    const rel = path.relative(REPO_ROOT, absPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;

    // 2b) ต้องมีไฟล์นั้นอยู่จริง
    if (!fs.existsSync(absPath)) return;

    const gitDir = path.join(REPO_ROOT, '.git');

    // 2c) ถ้ามีอะไรค้างอยู่ (เช่น merge ที่ทำค้างไว้) ให้ข้ามรอบนี้
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD')) ||
        fs.existsSync(path.join(gitDir, 'REBASE_HEAD')) ||
        fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'))) {
        log('ข้ามไป - มีการดำเนินการ git ค้างอยู่');
        return;
    }
    if (fs.existsSync(path.join(gitDir, 'index.lock'))) {
        log('ข้ามไป - กำลังบันทึกอยู่');
        return;
    }

    // 2d) ไฟล์ที่อยู่ใน .gitignore -> ข้าม
    // check-ignore คืนรหัส 0 = ถูกกันไว้, คืนรหัส 1 = ไม่ถูกกันไว้
    const ignored = gitTry(['check-ignore', '-q', '--', rel]);
    if (ignored.ok) {
        log('ข้ามไป - ไฟล์ถูก .gitignore กันไว้: ' + rel);
        return;
    }

    // 3) เก็บเฉพาะไฟล์นี้เข้า staging
    const add = gitTry(['add', '--', rel]);
    if (!add.ok) {
        log('เก็บไฟล์ไม่สำเร็จ: ' + add.out.slice(0, 200));
        return;
    }

    // 4) ตรวจว่าไฟล์นี้มีการเปลี่ยนแปลงจริงไหม
    // diff --quiet คืนรหัส 0 = ไม่มีอะไรต่าง
    const staged = gitTry(['diff', '--cached', '--quiet', '--', rel]);
    if (staged.ok) { log('ไฟล์ไม่มีการเปลี่ยนแปลง - ไม่ต้องบันทึก: ' + rel); return; }

    // 5) สร้างข้อความบันทึก
    const message = buildMessage(rel);

    // เขียนข้อความลงไฟล์ชั่วคราว เพื่อเลี่ยงปัญหาอักขระพิเศษและภาษาไทยในบรรทัดคำสั่ง
    const msgFile = path.join(gitDir, 'AUTO_COMMIT_MSG.txt');
    try {
        fs.writeFileSync(msgFile, message, 'utf8');
    } catch (e) {
        log('เขียนไฟล์ข้อความไม่สำเร็จ');
        return;
    }

    // 6) บันทึก (จำกัดเฉพาะไฟล์นี้ ไม่ดึงงานที่ค้างของผู้ใช้มาด้วย)
    const commit = gitTry(['commit', '-q', '-F', msgFile, '--', rel]);
    try { fs.unlinkSync(msgFile); } catch (e) { /* ignore */ }
    if (!commit.ok) {
        log('บันทึกไม่สำเร็จ: ' + commit.out.slice(0, 300));
        return;
    }

    const sha = gitTry(['rev-parse', '--short', 'HEAD']).out.trim();

    // 7) ส่งขึ้น GitHub (ลองใหม่ได้ 2 ครั้ง)
    for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
        const push = gitTry(['push'], { timeout: PUSH_TIMEOUT_MS });
        if (push.ok) {
            log('อัปโหลดสำเร็จ (' + sha + ') ' + rel);
            return;
        }
        if (attempt < MAX_PUSH_RETRIES) {
            log('ส่งไม่สำเร็จ ลองใหม่ (' + attempt + '/' + MAX_PUSH_RETRIES + ')');
        } else {
            log('ส่งขึ้น GitHub ไม่สำเร็จ (บันทึกในเครื่องแล้ว): ' + push.out.slice(0, 200));
        }
    }
}

/** สร้างข้อความบันทึกอัตโนมัติสำหรับไฟล์ที่แก้ไข */
function buildMessage(rel) {
    const statusOut = gitTry(['diff', '--cached', '--name-status', '--', rel]).out.trim();
    const statusChar = statusOut ? statusOut.charAt(0) : 'M';
    const mark = statusChar === 'A' ? 'เพิ่มใหม่' : (statusChar === 'D' ? 'ลบ' : 'แก้ไข');

    const stat = gitTry(['diff', '--cached', '--shortstat', '--', rel]).out.trim();

    const lines = [];
    lines.push('อัปเดตไฟล์ ' + path.basename(rel));
    lines.push('');
    if (stat) lines.push(stat);
    lines.push('');
    lines.push('- [' + mark + '] ' + rel);
    lines.push('');
    lines.push('บันทึกอัตโนมัติโดย Claude Code');
    lines.push('');
    lines.push('Co-Authored-By: Claude Code <noreply@anthropic.com>');

    return lines.join('\n') + '\n';
}

try {
    main();
} catch (err) {
    try { log('เกิดข้อผิดพลาดที่ไม่คาดคิด: ' + (err && err.message)); } catch (e) { /* ignore */ }
}
process.exit(0);
