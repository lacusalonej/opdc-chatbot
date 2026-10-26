/**
 * ทดสอบ IntentClassifier
 * ครอบคลุมทุกหมวดหมู่ที่รองรับ (14 intents)
 */

'use strict';

const assert = require('assert');
const { classifyIntent, isValidIntent, getValidIntents } = require('../intentClassifier');

// ทดสอบ 14 intent หลัก
const intentTests = [
    {
        name: 'GENERAL_GREETING',
        message: 'สวัสดีครับ',
        expected: 'GENERAL_GREETING'
    },
    {
        name: 'ORGANIZATION_INFORMATION',
        message: 'ก.พ.ร. คืออะไร',
        expected: 'ORGANIZATION_INFORMATION'
    },
    {
        name: 'ORGANIZATION_INFORMATION (วิสัยทัศน์)',
        message: 'มีวิสัยทัศน์อะไรบ้าง',
        expected: 'ORGANIZATION_INFORMATION'
    },
    {
        name: 'MISSION_AND_RESPONSIBILITIES',
        message: 'ภารกิจของ ก.พ.ร. มีอะไร',
        expected: 'MISSION_AND_RESPONSIBILITIES'
    },
    {
        name: 'PUBLIC_SERVICES',
        message: 'มีบริการอะไรบ้าง',
        expected: 'PUBLIC_SERVICES'
    },
    {
        name: 'GOVERNMENT_SERVICE_IMPROVEMENT',
        message: 'มีนวัตกรรมดิจิทัลไหม',
        expected: 'GOVERNMENT_SERVICE_IMPROVEMENT'
    },
    {
        name: 'LAWS_AND_REGULATIONS',
        message: 'มีกฎหมายเกี่ยวกับ PDPA ไหม',
        expected: 'LAWS_AND_REGULATIONS'
    },
    {
        name: 'MANUALS_AND_DOCUMENTS',
        message: 'มีเอกสาร PDF ไหมให้ดาวน์โหลด',
        expected: 'MANUALS_AND_DOCUMENTS'
    },
    {
        name: 'DIGITAL_GOVERNMENT',
        message: 'มีระบบดิจิทัลอะไรบ้าง',
        expected: 'DIGITAL_GOVERNMENT'
    },
    {
        name: 'PUBLIC_SECTOR_DEVELOPMENT',
        message: 'พัฒนาภาครัฐทำอย่างไร',
        expected: 'PUBLIC_SECTOR_DEVELOPMENT'
    },
    {
        name: 'CONTACT_AND_SUPPORT',
        message: 'ติดต่อ ก.พ.ร. ได้ที่ไหน',
        expected: 'CONTACT_AND_SUPPORT'
    },
    {
        name: 'DOCUMENT_SEARCH',
        message: 'ค้นหาเอกสาร B-READY',
        expected: 'DOCUMENT_SEARCH'
    },
    {
        name: 'OUT_OF_SCOPE',
        message: 'ทำนายลางอนาคตฉันเป็นอย่างไร',
        expected: 'OUT_OF_SCOPE'
    },
    {
        name: 'INSUFFICIENT_INFORMATION',
        message: 'x9k2j3',
        expected: 'INSUFFICIENT_INFORMATION'
    },
    {
        name: 'FOLLOW_UP_QUESTION (สั้น+pronoun)',
        message: 'เรื่องนั้นเป็นยังไงบ้าง',
        expected: 'FOLLOW_UP_QUESTION'
    }
];

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== ทดสอบ IntentClassifier ===\n');

    // ทดสอบ 14 intent หลัก
    for (const test of intentTests) {
        try {
            // เติมประวัติการสนทนาสำหรับ FOLLOW_UP_QUESTION
            const history = test.expected === 'FOLLOW_UP_QUESTION'
                ? [{ role: 'user', content: 'ก.พ.ร. มีหน้าที่อะไร' }, { role: 'assistant', content: 'มีหลายหน้าที่' }]
                : [];

            const result = classifyIntent(test.message, history, 'th');
            assert.strictEqual(result, test.expected,
                `Expected: ${test.expected}, Got: ${result}, Message: "${test.message}"`);
            console.log(`  ✅ ${test.name}: "${test.message}" -> ${result}`);
            passed++;
        } catch (err) {
            console.log(`  ❌ ${test.name}: ${err.message}`);
            failed++;
        }
    }

    // ทดสอบภาษาอังกฤษ
    try {
        const result = classifyIntent('What is OPDC?', [], 'en');
        assert.strictEqual(result, 'ORGANIZATION_INFORMATION');
        console.log(`  ✅ English classification: "What is OPDC?" -> ${result}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ English classification: ${err.message}`);
        failed++;
    }

    // ทดสอบค่าว่าง
    try {
        const result = classifyIntent('');
        assert.strictEqual(result, 'INSUFFICIENT_INFORMATION');
        console.log(`  ✅ Empty message: "" -> ${result}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Empty message: ${err.message}`);
        failed++;
    }

    try {
        const result = classifyIntent(null);
        assert.strictEqual(result, 'INSUFFICIENT_INFORMATION');
        console.log(`  ✅ Null message: null -> ${result}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Null message: ${err.message}`);
        failed++;
    }

    try {
        const result = classifyIntent('   ');
        assert.strictEqual(result, 'INSUFFICIENT_INFORMATION');
        console.log(`  ✅ Whitespace message: "   " -> ${result}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Whitespace message: ${err.message}`);
        failed++;
    }

    // ทดสอบ isValidIntent
    try {
        assert.strictEqual(isValidIntent('GENERAL_GREETING'), true);
        assert.strictEqual(isValidIntent('INVALID_INTENT'), false);
        assert.strictEqual(isValidIntent(null), false);
        console.log(`  ✅ isValidIntent validation works`);
        passed++;
    } catch (err) {
        console.log(`  ❌ isValidIntent validation: ${err.message}`);
        failed++;
    }

    // ทดสอบ getValidIntents
    try {
        const intents = getValidIntents();
        assert.strictEqual(intents.length, 14);
        console.log(`  ✅ getValidIntents returns ${intents.length} intents`);
        passed++;
    } catch (err) {
        console.log(`  ❌ getValidIntents: ${err.message}`);
        failed++;
    }

    console.log(`\n=== สรุป ===`);
    console.log(`ผ่าน: ${passed}, ล้มเหลว: ${failed}`);
    console.log(`ผลลัพธ์: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);

    return { passed, failed };
}

// รันเฉพาะเมื่อเรียกโดยตรง
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
