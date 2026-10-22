/**
 * ทดสอป์ AnswerValidator
 * ครอบคลุม: การตรวจสอบโครงสร้าง output, การตรวจจับข้อมูลเทียม,
 * การจัดการ citations ที่ขาด, การตั้ง insufficientEvidence
 */

'use strict';

const assert = require('assert');
const {
    validateAnswer,
    isNonEmptyAnswer,
    isValidIntent,
    detectPotentialFabrication,
    hasUnverifiedSourceReferences
} = require('../answerValidator');

const mockDocs = [
    { documentId: 'doc_1', title: 'เอกสารทดสอบ', sourceUrl: 'https://www.opdc.go.th/test' }
];

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== ทดสอบ AnswerValidator ===\n');

    // ทดสอบ 1: การตรวจสอบ answer ที่เป็นค่าว่าง
    try {
        const result = validateAnswer({
            answer: '',
            intent: 'ORGANIZATION_INFORMATION',
            citations: [],
            retrievedDocuments: mockDocs,
            contextInfo: { hasEvidence: true }
        });

        assert.strictEqual(result.isValid, false, 'answer ว่างควรไม่ Valid');
        assert.ok(result.fallbackReason, 'ควรมีเหตุผลสำหรับ fallback');
        console.log(`  ✅ Answer ว่าง -> ไม่ valid`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Answer ว่าง: ${err.message}`);
        failed++;
    }

    // ทดสอบ 2: การตรวจสอบ intent ที่ไม่ถูกต้อง
    try {
        const result = validateAnswer({
            answer: 'นี่คือคำตอบ',
            intent: 'INVALID_INTENT',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: true }
        });

        assert.strictEqual(result.intent, 'INSUFFICIENT_INFORMATION', 'ควรแก้ไข intent เป็น default');
        console.log(`  ✅ Intent ไม่ถูกต้อง -> แก้ไขเป็น default`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Intent ไม่ถูกต้อง: ${err.message}`);
        failed++;
    }

    // ทดสอบ 3: การตรวจจับการปลอมข้อมูล (fabrication detection)
    try {
        const answer1 = 'ตามที่เราตรวจสอบแล้ว ข้อมูลนี้เป็นทางการและยืนยันว่าเป็นความจริง';
        const result1 = detectPotentialFabrication(answer1);
        assert.strictEqual(result1, true, 'ควรตรวจจับการปลอมข้อมูล');

        const answer2 = 'นี่คือข้อมูลที่เรามีมาจากแหล่งข้อมูล';
        const result2 = detectPotentialFabrication(answer2);
        assert.strictEqual(result2, false, 'ไม่ควรตรวจจับเป็นการปลอมข้อมูล');
        console.log(`  ✅ Fabrication detection ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Fabrication detection: ${err.message}`);
        failed++;
    }

    // ทดสอบ 4: ตรวจจับ URL ที่ไม่ได้มาจาก citations
    try {
        const answer = 'ข้อมูลเพิ่มเติมที่ https://www.fake-url.com/info';
        const citations = [];
        const result = hasUnverifiedSourceReferences(answer, citations);
        assert.strictEqual(result, true, 'ควรตรวจจับ URL ที่ไม่มีอยู่ใน citations');

        const answer2 = 'ข้อมูลเพิ่มเติมที่ https://www.opdc.go.th/test';
        const citations2 = [{ url: 'https://www.opdc.go.th/test' }];
        const result2 = hasUnverifiedSourceReferences(answer2, citations2);
        assert.strictEqual(result2, false, 'ไม่ควรตรวจจับ URL ที่อยู่ใน citations');
        console.log(`  ✅ ตรวจจับ URL ที่ไม่ได้มาจาก citations ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ตรวจจับ URL: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 5: ตั้ง insufficientEvidence เมื่อไม่มีหลักฐาน
    try {
        const result = validateAnswer({
            answer: 'นี่คือคำตอบ',
            intent: 'ORGANIZATION_INFORMATION',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: false }
        });

        assert.strictEqual(result.insufficientEvidence, true, 'ควรมี insufficientEvidence=true เมื่อไม่มีหลักฐาน');
        assert.ok(result.warnings, 'ควรมี warnings');
        console.log(`  ✅ ตั้ง insufficientEvidence เมื่อไม่มีหลักฐาน`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ตั้ง insufficientEvidence: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 6: ไม่ตั้ง insufficientEvidence สำหรับ GENERAL_GREETING
    try {
        const result = validateAnswer({
            answer: 'สวัสดีครับ',
            intent: 'GENERAL_GREETING',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: false }
        });

        assert.strictEqual(result.insufficientEvidence, false, 'ไม่ควรมี insufficientEvidence สำหรับ greeting');
        console.log(`  ✅ ไม่ตั้ง insufficientEvidence สำหรับ greeting`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ไม่ตั้ง insufficientEvidence สำหรับ greeting: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 7: ไม่ตั้ง insufficientEvidence สำหรับ OUT_OF_SCOPE
    try {
        const result = validateAnswer({
            answer: 'นี่คือขอบเขตการช่วยเหลือ',
            intent: 'OUT_OF_SCOPE',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: false }
        });

        assert.strictEqual(result.insufficientEvidence, false, 'ไม่ควรมี insufficientEvidence สำหรับ out_of_scope');
        console.log(`  ✅ ไม่ตั้ง insufficientEvidence สำหรับ out_of_scope`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ไม่ตั้ง insufficientEvidence สำหรับ out_of_scope: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 8: การตรวจสอบ citations ที่มี issues
    try {
        const result = validateAnswer({
            answer: 'นี่คือคำตอบ',
            intent: 'ORGANIZATION_INFORMATION',
            citations: [{ title: 'เอกสารไม่มีอยู่' }],
            retrievedDocuments: mockDocs,
            contextInfo: { hasEvidence: true }
        });

        assert.ok(result.warnings.some(w => w.includes('validation')), 'ควรมี warning เกี่ยวกับ citations');
        console.log(`  ✅ ตรวจสอบ citations ที่มี issues`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ตรวจสอบ citations ที่มี issues: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 9: การตรวจสอบข้อมูลขัดแย้ง
    try {
        const result = validateAnswer({
            answer: 'นี่คือคำตอบ',
            intent: 'ORGANIZATION_INFORMATION',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: true, hasConflicts: true }
        });

        assert.strictEqual(result.insufficientEvidence, true, 'ควรมี insufficientEvidence เมื่อมีข้อมูลขัดแย้ง');
        console.log(`  ✅ ตรวจจับข้อมูลขัดแย้ง`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ตรวจจับข้อมูลขัดแย้ง: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 10: isNonEmptyAnswer
    try {
        assert.strictEqual(isNonEmptyAnswer(''), false);
        assert.strictEqual(isNonEmptyAnswer('  '), false);
        assert.strictEqual(isNonEmptyAnswer('มีเนื้อหา'), true);
        assert.strictEqual(isNonEmptyAnswer(null), false);
        assert.strictEqual(isNonEmptyAnswer(123), false);
        console.log(`  ✅ isNonEmptyAnswer ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ isNonEmptyAnswer: ${err.message}`);
        failed++;
    }

    // ทดสอป์ 11: เอกสารล้าสมัย
    try {
        const result = validateAnswer({
            answer: 'นี่คือคำตอบ',
            intent: 'ORGANIZATION_INFORMATION',
            citations: [],
            retrievedDocuments: [],
            contextInfo: { hasEvidence: true, hasOutdated: true }
        });

        assert.ok(result.warnings.some(w => w.includes('outdated')), 'ควรมี warning เกี่ยวกับเอกสารล้าสมัย');
        console.log(`  ✅ ตรวจจับเอกสารล้าสมัย`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ตรวจจับเอกสารล้าสมัย: ${err.message}`);
        failed++;
    }

    console.log(`\n=== สรุป ===`);
    console.log(`ผ่าน: ${passed}, ล้มเหลว: ${failed}`);
    console.log(`ผลลัพธ์: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);

    return { passed, failed };
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
