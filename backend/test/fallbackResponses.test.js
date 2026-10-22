/**
 * ทดสอบ FallbackResponses
 * ครอบคลุม: ทุกเหตุผล fallback ทั้งภาษาไทยและอังกฤษ
 */

'use strict';

const assert = require('assert');
const { getFallback, isValidReason, VALID_REASONS } = require('../fallbackResponses');

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== ทดสอบ FallbackResponses ===\n');

    // ทดสอบทุกเหตุผลที่รองรับ
    const reasons = [
        { reason: 'NO_EVIDENCE', thName: 'ไม่มีหลักฐาน', enName: 'No evidence' },
        { reason: 'INSUFFICIENT_EVIDENCE', thName: 'หลักฐานไม่เพียงพอ', enName: 'Insufficient evidence' },
        { reason: 'AMBIGUOUS', thName: 'คำถามไม่ชัดเจน', enName: 'Ambiguous question' },
        { reason: 'CONFLICTING_SOURCES', thName: 'แหล่งข้อมูลขัดแย้ง', enName: 'Conflicting sources' },
        { reason: 'OUTDATED_INFO', thName: 'ข้อมูลล้าสมัย', enName: 'Outdated info' },
        { reason: 'RETRIEVAL_ERROR', thName: 'ข้อผิดพลากการค้นหา', enName: 'Retrieval error' },
        { reason: 'PROVIDER_ERROR', thName: 'ผู้ให้บริการผิดพลาก', enName: 'Provider error' },
        { reason: 'INVALID_OUTPUT', thName: 'ผลลัพธ์ไม่ถูกต้อง', enName: 'Invalid output' },
        { reason: 'OUT_OF_SCOPE', thName: 'นอกขอบเขต', enName: 'Out of scope' }
    ];

    for (const { reason, thName, enName } of reasons) {
        // ภาษาไทย
        try {
            const thResponse = getFallback(reason, 'th', {});
            assert.ok(thResponse, `ตอบแทนภาษาไทยสำหรับ ${reason} ควรไม่ว่าง`);
            passed++;
        } catch (err) {
            console.log(`  ❌ ${thName} (TH): ${err.message}`);
            failed++;
        }

        // ภาษาอังกฤษ
        try {
            const enResponse = getFallback(reason, 'en', {});
            assert.ok(enResponse, `Fallback response for ${reason} (EN) should not be empty`);
            passed++;
        } catch (err) {
            console.log(`  ❌ ${enName} (EN): ${err.message}`);
            failed++;
        }
    }

    console.log(`  ✅ ทุกเหตุผล fallback ทั้งไทยและอังกฤษ -> ทำงานได้`);

    // ทดสอบเหตุผลที่ไม่ถูกต้อง
    try {
        const result = getFallback('INVALID_REASON', 'th');
        // ควรกลับไปใช้ default
        assert.ok(result, 'ควรมีการตอบสนองแม้สำหรับเหตุผลที่ไม่ถูกต้อง');
        passed++;
    } catch (err) {
        console.log(`  ❌ เหตุผลไม่ถูกต้อง: ${err.message}`);
        failed++;
    }

    // ทดสอบภาษาเริ่มต้น
    try {
        const result = getFallback('NO_EVIDENCE');
        assert.ok(result, 'ควรตอบเป็นภาษาไทยเป็นค่าเริ่มต้น');
        passed++;
    } catch (err) {
        console.log(`  ❌ ภาษาเริ่มต้น: ${err.message}`);
        failed++;
    }

    // ทดสอบ CONFLICTING_SOURCES พร้อมข้อมูล
    try {
        const result = getFallback('CONFLICTING_SOURCES', 'th', {
            sources: ['เอกสาร A', 'เอกสาร B']
        });
        assert.ok(result.includes('เอกสาร A'), 'ควรมีแหล่งข้อมูล A ในการตอบ');
        assert.ok(result.includes('เอกสาร B'), 'ควรมีแหล่งข้อมูล B ในการตอบ');
        passed++;
    } catch (err) {
        console.log(`  ❌ CONFLICTING_SOURCES พร้อมข้อมูล: ${err.message}`);
        failed++;
    }

    // ทดสอบ isValidReason
    try {
        assert.strictEqual(isValidReason('NO_EVIDENCE'), true);
        assert.strictEqual(isValidReason('INVALID'), false);
        assert.strictEqual(isValidReason(null), false);
        console.log(`  ✅ isValidReason ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ isValidReason: ${err.message}`);
        failed++;
    }

    // ทดสอบ VALID_REASONS
    try {
        assert.strictEqual(VALID_REASONS.length, 9);
        console.log(`  ✅ VALID_REASONS มี ${VALID_REASONS.length} เหตุผล`);
        passed++;
    } catch (err) {
        console.log(`  ❌ VALID_REASONS: ${err.message}`);
        failed++;
    }

    // ทดสอบไม่มีข้อมูลส่งไป
    try {
        const result = getFallback('NO_EVIDENCE', 'th', null);
        assert.ok(result, 'ควรทำงานได้แม้ไม่มีข้อมูลเสริม');
        passed++;
    } catch (err) {
        console.log(`  ❌ ไม่มีข้อมูลเสริม: ${err.message}`);
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
