#!/usr/bin/env node
/**
 * ตัวรันชุดทดสอบรวม สำหรับ OPDC Chatbot (ช่วง D)
 * ---------------------------------------------------------------
 * เรียกด้วย:  npm test
 *
 * รันทั้งหมด 2 กลุ่ม:
 *   กลุ่มที่ 1 - ทดสอบส่วนย่อย (7 ชุด)  ไม่ต้องเปิดเซิร์ฟเวอร์
 *   กลุ่มที่ 2 - ทดสอบผ่านเซิร์ฟเวอร์จริง (2 ชุด)  ตัวรันจะเปิดเซิร์ฟเวอร์ให้เอง
 *
 * ผลลัพธ์สุดท้ายจะสรุปรวมเป็นตารางเดียว และรหัสจบการทำงานจะเป็น
 *   0 = ผ่านทั้งหมด
 *   1 = มีข้อที่ไม่ผ่าน
 *   2 = เกิดข้อผิดพลาดร้ายแรง (เช่น เปิดเซิร์ฟเวอร์ไม่ได้)
 *
 * หมายเหตุ: ไฟล์นี้เป็น "เครื่องมือตรวจสอบ" เท่านั้น ไม่ได้แตะโค้ดระบบส่วนไหน
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND = __dirname;
const TEST_DIR = path.join(BACKEND, 'test');
const TEST_PORT = process.env.TEST_PORT || '8100';
const BASE_URL = 'http://localhost:' + TEST_PORT;

// ---------------------------------------------------------------- รายชื่อชุดทดสอบ

// กลุ่มที่ 1: ทดสอบส่วนย่อย (ทำงานในตัวโปรแกรมเดียว ไม่ต้องเปิดเซิร์ฟเวอร์)
const UNIT_SUITES = [
    { file: 'answerValidator.test.js', label: 'ตรวจคำตอบ (answerValidator)' },
    { file: 'citationValidator.test.js', label: 'ตรวจแหล่งอ้างอิง (citationValidator)' },
    { file: 'contextBuilder.test.js', label: 'สร้างบริบท (contextBuilder)' },
    { file: 'fallbackResponses.test.js', label: 'คำตอบสำรอง (fallbackResponses)' },
    { file: 'intentClassifier.test.js', label: 'จำแนกความตั้งใจ (intentClassifier)' },
    { file: 'promptEngine.test.js', label: 'สร้างคำสั่ง (promptEngine)' },
    { file: 'security.test.js', label: 'ความปลอดภัย (security)' }
];

// กลุ่มที่ 2: ทดสอบผ่านเซิร์ฟเวอร์จริง (ต้องเปิดเซิร์ฟเวอร์ก่อน)
const SERVER_SUITES = [
    { file: 'integration.test.js', label: 'เชื่อมต่อจริง + สัญญา API (integration)' },
    { file: 'quality-security.test.js', label: 'คุณภาพคำตอบ + ความปลอดภัย (quality-security)' }
];

// ---------------------------------------------------------------- เครื่องมือช่วย

function line(char = '=', width = 70) {
    return char.repeat(width);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** รันชุดทดสอบที่ต้องเปิดเซิร์ฟเวอร์ แล้วคืนค่าผลลัพธ์ที่อ่านได้จาก stdout */
function runServerSuite(suite) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [path.join(TEST_DIR, suite.file)], {
            cwd: BACKEND,
            env: Object.assign({}, process.env, { BASE_URL: BASE_URL, PORT: TEST_PORT }),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let out = '';
        child.stdout.on('data', d => { out += d.toString(); });
        child.stderr.on('data', d => { out += d.toString(); });

        const timer = setTimeout(() => {
            child.kill();
            resolve({ file: suite.file, label: suite.label, passed: 0, failed: 1, timedOut: true, output: out });
        }, 120000);

        child.on('error', err => {
            clearTimeout(timer);
            resolve({ file: suite.file, label: suite.label, passed: 0, failed: 1, output: out + '\n' + err.message });
        });

        child.on('close', code => {
            clearTimeout(timer);
            const summary = parseSummary(out);
            resolve({
                file: suite.file,
                label: suite.label,
                passed: summary ? summary.passed : countOf(out, 'PASS'),
                failed: summary ? summary.failed : countOf(out, 'FAIL'),
                exitCode: code,
                output: out
            });
        });
    });
}

/**
 * นับจำนวนบรรทัดที่ขึ้นต้นด้วยคำหน้าที่กำหนด
 * ข้ามหัวข้อ "FAILED CASES:" ที่ขึ้นต้นด้วย FAIL เหมือนกัน ไม่ให้ถูกนับเป็นข้อที่ไม่ผ่าน
 */
function countOf(text, marker) {
    return text.split('\n')
        .filter(l => {
            const t = l.trim();
            if (!t.startsWith(marker)) return false;
            if (marker === 'FAIL' && t.startsWith('FAILED CASES')) return false;
            return true;
        }).length;
}

/**
 * อ่านตัวเลขสรุปจากผลลัพธ์ของชุดทดสอบ
 * รองรับ 2 แบบ:  "ผ่าน: 17, ล้มเหลว: 5"  และ  "passed=17 failed=5"
 */
function parseSummary(text) {
    const thai = text.match(/ผ่าน:\s*(\d+)\s*,\s*ล้มเหลว:\s*(\d+)/);
    if (thai) return { passed: Number(thai[1]), failed: Number(thai[2]) };

    const eng = text.match(/passed=\s*(\d+)\s*failed=\s*(\d+)/);
    if (eng) return { passed: Number(eng[1]), failed: Number(eng[2]) };

    return null;
}

// ---------------------------------------------------------------- เปิด / ปิดเซิร์ฟเวอร์

async function waitForServer(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(BASE_URL + '/health');
            if (res.ok) return true;
        } catch (e) { /* ยังไม่พร้อม รอต่อ */ }
        await sleep(400);
    }
    return false;
}

function startServer() {
    return spawn(process.execPath, [path.join(BACKEND, 'server.js')], {
        cwd: BACKEND,
        env: Object.assign({}, process.env, { PORT: TEST_PORT }),
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

// ---------------------------------------------------------------- ขั้นตอนหลัก

async function main() {
    const started = Date.now();
    const results = [];

    console.log(line());
    console.log(' ชุดทดสอบรวม OPDC Chatbot (ช่วง D)');
    console.log(line());
    console.log('');

    // ---------------- กลุ่มที่ 1: ทดสอบส่วนย่อย ----------------
    console.log(line('-'));
    console.log(' กลุ่มที่ 1: ทดสอบส่วนย่อย (ไม่ต้องเปิดเซิร์ฟเวอร์)');
    console.log(line('-'));

    for (const suite of UNIT_SUITES) {
        const filePath = path.join(TEST_DIR, suite.file);
        if (!fs.existsSync(filePath)) {
            results.push({ label: suite.label, file: suite.file, passed: 0, failed: 1, missing: true });
            console.log(`  [ขาดไฟล์] ${suite.label}`);
            continue;
        }
        try {
            const mod = require(filePath);
            const r = mod.runTests();
            results.push({ label: suite.label, file: suite.file, passed: r.passed, failed: r.failed });
            console.log(`  ${r.failed === 0 ? 'ผ่าน' : 'มีข้อไม่ผ่าน'}  ${suite.label}  (ผ่าน ${r.passed} / ไม่ผ่าน ${r.failed})`);
        } catch (err) {
            results.push({ label: suite.label, file: suite.file, passed: 0, failed: 1, error: err.message });
            console.log(`  [ผิดพลาด] ${suite.label} :: ${err.message}`);
        }
    }

    console.log('');
    console.log(line('-'));
    console.log(' กลุ่มที่ 2: ทดสอบผ่านเซิร์ฟเวอร์จริง');
    console.log(line('-'));

    // ---------------- กลุ่มที่ 2: ทดสอบผ่านเซิร์ฟเวอร์จริง ----------------
    let server = null;
    let serverUp = false;

    // ถ้ามีเซิร์ฟเวอร์เปิดอยู่ที่พอร์ตนี้อยู่แล้ว ให้ใช้ตัวนั้นเลย ไม่ต้องเปิดซ้ำ
    if (await waitForServer(800)) {
        serverUp = true;
        console.log(`  พบเซิร์ฟเวอร์ที่ ${BASE_URL} ทำงานอยู่แล้ว ใช้ตัวนี้ทดสอบ`);
    } else {
        console.log(`  กำลังเปิดเซิร์ฟเวอร์ที่ ${BASE_URL} ...`);
        server = startServer();
        serverUp = await waitForServer(20000);
        if (!serverUp) {
            console.log('  [ผิดพลาด] เปิดเซิร์ฟเวอร์ไม่สำเร็จ');
        }
    }

    if (!serverUp) {
        for (const suite of SERVER_SUITES) {
            results.push({ label: suite.label, file: suite.file, passed: 0, failed: 1, noServer: true });
        }
    } else {
        for (const suite of SERVER_SUITES) {
            const r = await runServerSuite(suite);
            results.push({
                label: suite.label,
                file: suite.file,
                passed: r.passed,
                failed: r.failed,
                exitCode: r.exitCode,
                timedOut: r.timedOut
            });
            const mark = r.failed === 0 ? 'ผ่าน' : 'มีข้อไม่ผ่าน';
            console.log(`  ${mark}  ${suite.label}  (ผ่าน ${r.passed} / ไม่ผ่าน ${r.failed})`);
        }
    }

    // ---------------- ปิดเซิร์ฟเวอร์ ----------------
    if (server) {
        server.kill();
        await sleep(300);
        console.log('');
        console.log('  ปิดเซิร์ฟเวอร์ทดสอบเรียบร้อยแล้ว');
    }

    // ---------------- สรุปรวม ----------------
    const totalPassed = results.reduce((s, r) => s + (r.passed || 0), 0);
    const totalFailed = results.reduce((s, r) => s + (r.failed || 0), 0);
    const total = totalPassed + totalFailed;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    console.log('');
    console.log(line('='));
    console.log(' สรุปรวม');
    console.log(line('='));
    console.log('');
    console.log('  ชุดทดสอบ                                   ผ่าน    ไม่ผ่าน');
    console.log('  ' + line('-', 66));
    for (const r of results) {
        const name = r.label.length > 42 ? r.label.slice(0, 41) + '…' : r.label;
        console.log('  ' + name.padEnd(42) + '  ' + String(r.passed).padStart(4) + '    ' + String(r.failed).padStart(6));
    }
    console.log('  ' + line('-', 66));
    console.log('  ' + 'รวม'.padEnd(42) + '  ' + String(totalPassed).padStart(4) + '    ' + String(totalFailed).padStart(6));
    console.log('');
    console.log(`  ผ่านทั้งหมด ${totalPassed} จาก ${total} ข้อ (${total ? ((totalPassed / total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`  ใช้เวลา ${seconds} วินาที`);
    console.log('');

    if (totalFailed === 0 && total > 0) {
        console.log('  ผลลัพธ์: ผ่านทั้งหมด (PASS)');
    } else if (total === 0) {
        console.log('  ผลลัพธ์: ไม่มีข้อทดสอบให้รัน');
    } else {
        console.log(`  ผลลัพธ์: มีข้อที่ไม่ผ่าน ${totalFailed} ข้อ (FAIL)`);
        console.log('  ดูรายละเอียดว่าข้อไหนไม่ผ่านได้ที่ PHASE-D-REPORT.md');
    }
    console.log('');

    if (total === 0) process.exit(2);
    process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch(err => {
    console.error('');
    console.error('  เกิดข้อผิดพลาดร้ายแรงระหว่างรันชุดทดสอบ:', err && err.message);
    console.error(err && err.stack);
    process.exit(2);
});
