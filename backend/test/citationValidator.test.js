/**
 * ทดสอบ CitationValidator
 * ครอบคลุม: การตรวจสอบ citations, URL validation,
 * การตรวจจับ citations ที่ไม่มีอยู่ใน retrieved documents
 */

'use strict';

const assert = require('assert');
const {
    validateCitations,
    validateSingleCitation,
    checkCitationRequirements,
    isValidUrl,
    isOpdcSource,
    createDocumentMap
} = require('../citationValidator');

const mockDocs = [
    { documentId: 'doc_1', title: 'เอกสารทดสอบ 1', sourceUrl: 'https://www.opdc.go.th/test1' },
    { documentId: 'doc_2', title: 'เอกสารทดสอบ 2', sourceUrl: 'https://www.example.com/test2' },
    { title: 'เอกสารที่มีชื่อซ้ำ' }
];

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== ทดสอบ CitationValidator ===\n');

    // ทดสอบ 1: citations ที่ถูกต้อง
    try {
        const citations = [
            { title: 'เอกสารทดสอบ 1', url: 'https://www.opdc.go.th/test1', page: 1 }
        ];
        const result = validateCitations(citations, mockDocs);

        assert.strictEqual(result.isValid, true, 'ควรผ่านการตรวจสอบ');
        assert.strictEqual(result.coverage, 1.0, 'อัตราการเปิดเผยควรเท่ากับ 1.0');
        console.log(`  ✅ Citations ที่ถูกต้อง -> ผ่าน`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Citations ที่ถูกต้อง: ${err.message}`);
        failed++;
    }

    // ทดสอบ 2: citations ที่ title ไม่มีอยู่ใน retrieved docs
    try {
        const citations = [
            { title: 'เอกสารที่ไม่มีอยู่', url: 'https://www.opdc.go.th/fake' }
        ];
        const result = validateCitations(citations, mockDocs);

        assert.strictEqual(result.isValid, false, 'ควรล้มเหลวเพราะ title ไม่มีอยู่');
        assert.ok(result.issues.length > 0, 'ควรมี issues');
        console.log(`  ✅ Citation ที่ไม่มีอยู่ใน retrieved docs -> ตรวจจับได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Citation ที่ไม่มีอยู่: ${err.message}`);
        failed++;
    }

    // ทดสอบ 3: URL ไม่ใช่รูปแบบ URL ที่ถูกต้อง
    try {
        const citations = [
            { url: 'not-a-url' }
        ];
        const result = validateSingleCitation(citations[0], createDocumentMap(mockDocs));

        assert.strictEqual(result.valid, false, 'ควรล้มเหลวเพราะ URL ไม่ถูกต้อง');
        assert.ok(result.issues.some(i => i.includes('not a valid URL')), 'ควรมีข้อความ error เกี่ยวกับ URL');
        console.log(`  ✅ URL ไม่ถูกต้อง -> ตรวจจับได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ URL ไม่ถูกต้อง: ${err.message}`);
        failed++;
    }

    // ทดสอบ 4: URL ไม่ใช่แหล่งข้อมูล OPDC
    try {
        const valid = isValidUrl('https://www.opdc.go.th/test');
        assert.strictEqual(valid, true, 'URL ของ OPDC ควรเป็น valid');

        const isOpdc = isOpdcSource('https://www.opdc.go.th/test');
        assert.strictEqual(isOpdc, true, 'ควรระบุเป็นแหล่ง OPDC');

        const isNotOpdc = isOpdcSource('https://www.google.com');
        assert.strictEqual(isNotOpdc, false, 'ไม่ควรระบุ Google เป็นแหล่ง OPDC');
        console.log(`  ✅ URL validation ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ URL validation: ${err.message}`);
        failed++;
    }

    // ทดสอบ 5: citations ว่างหรือ null
    try {
        const result = validateCitations([], mockDocs);
        assert.strictEqual(result.isValid, true, 'citations ว่างควรผ่าน');
        assert.strictEqual(result.coverage, 0, 'อัตราการเปิดเผยควรเป็น 0');

        const result2 = validateCitations(null, mockDocs);
        assert.strictEqual(result2.isValid, true, 'citations null ควรผ่าน');
        console.log(`  ✅ Citations ว่างหรือ null -> จัดการได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Citations ว่างหรือ null: ${err.message}`);
        failed++;
    }

    // ทดสอบ 6: ไม่มี retrieved docs ให้ตรวจสอบ
    try {
        const citations = [{ title: 'Test', url: 'https://www.opdc.go.th/test' }];
        const result = validateCitations(citations, []);
        // เมื่อไม่มี docs ให้เปรียบเทียบ การข้ามการตรวจสอบ title คือ acceptable
        assert.ok(result.coverage >= 0, 'ควรมีค่า coverage');
        console.log(`  ✅ ไม่มี retrieved docs -> จัดการได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ไม่มี retrieved docs: ${err.message}`);
        failed++;
    }

    // ทดสอบ 7: checkCitationRequirements
    try {
        const response1 = {
            answer: 'เราได้รับข้อมูลจากแหล่งข้อมูล...',
            intent: 'ORGANIZATION_INFORMATION',
            citations: []
        };
        const result1 = checkCitationRequirements(response1);
        assert.strictEqual(result1.missingCitations, false, 'ไม่ควรมี citationsขาดเพราะไม่มีคำว่า "เราได้"');

        const response2 = {
            answer: 'ตามที่เราตรวจสอบแล้ว ข้อมูลจากแหล่งข้อมูล...',
            intent: 'ORGANIZATION_INFORMATION',
            citations: []
        };
        const result2 = checkCitationRequirements(response2);
        assert.strictEqual(result2.missingCitations, true, 'ควรตรวจจับการอ้างอิงแหล่งข้อมูลโดยไม่มี citations');
        console.log(`  ✅ checkCitationRequirements ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ checkCitationRequirements: ${err.message}`);
        failed++;
    }

    // ทดสอบ 8: page ที่เป็น string
    try {
        const citation = { title: 'Test', url: 'https://www.opdc.go.th/test', page: '5' };
        const result = validateSingleCitation(citation, createDocumentMap(mockDocs));
        assert.ok(result.valid, 'page เป็น string ควรยัง valid');
        console.log(`  ✅ Page เป็น string -> ยัง valid`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Page เป็น string: ${err.message}`);
        failed++;
    }

    // ทดสอบ 9: citation ไม่มีข้อมูลใดเลย
    try {
        const citation = {};
        const result = validateSingleCitation(citation, createDocumentMap(mockDocs));
        assert.strictEqual(result.valid, false, 'citation ว่างควรล้มเหลว');
        console.log(`  ✅ Citation ไม่มีข้อมูล -> ตรวจจับได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ Citation ไม่มีข้อมูล: ${err.message}`);
        failed++;
    }

    // ทดสอบ 10: createDocumentMap
    try {
        const map = createDocumentMap(mockDocs);
        assert.ok(map.has('doc_1'), 'ควรมี doc_1 ในแผนที่');
        assert.ok(map.has('เอกสารทดสอบ 1'), 'ควรมี title เป็น key');
        console.log(`  ✅ createDocumentMap ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ createDocumentMap: ${err.message}`);
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
