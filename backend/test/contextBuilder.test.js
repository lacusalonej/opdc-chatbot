/**
 * ทดสอบ ContextBuilder
 * ครอบคลุม: การสร้าง context จากเอกสาร, การจัดการ metadata ขาด,
 * การตรวจจับเอกสารล้าสมัย/ขัดแย้ง, การจำกัดขนาด context
 */

'use strict';

const assert = require('assert');
const {
    buildContext,
    buildCitation,
    buildConversationHistory,
    isOutdated,
    hasCitableMetadata,
    MAX_CONTEXT_LENGTH,
    MAX_DOCUMENTS
} = require('../contextBuilder');

// เอกสารทดสอบที่มี metadata ครบ
const fullMetadataDoc = {
    documentId: 'doc_full',
    content: 'เนื้อหาเต็ม',
    title: 'เอกสารเต็ม',
    sourceUrl: 'https://www.opdc.go.th/test',
    publisher: 'OPDC',
    publishedDate: '2024-01-01',
    effectiveDate: '2024-01-01',
    updatedAt: '2024-12-31',
    documentStatus: 'published',
    pageNumber: 5,
    sectionTitle: 'บทที่ 1',
    retrievalScore: 0.95
};

// เอกสารที่มี metadata บางส่วนขาด
const partialMetadataDoc = {
    documentId: 'doc_partial',
    content: 'เนื้อหาบางส่วน',
    title: 'เอกสารบางส่วน',
    sourceUrl: 'https://www.opdc.go.th/partial',
    // ไม่มี publisher, dates, status, page, section
    retrievalScore: 0.85
};

// เอกสารล้าสมัย (superseded)
const outdatedDoc = {
    documentId: 'doc_outdated',
    content: 'ข้อมูลเดิม',
    title: 'เอกสารล้าสมัย',
    sourceUrl: 'https://www.opdc.go.th/old',
    documentStatus: 'superseded',
    publishedDate: '2020-01-01'
};

// เอกสารที่มี content เป็น 'text' แทน 'content' (retro compatibility)
const textBasedDoc = {
    id: 'doc_text',
    text: 'เนื้อหาจาก text field',
    title: 'เอกสารจาก text'
};

// เอกสารที่มี string แทน object
const stringDoc = 'เป็นเพียงข้อความ';

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== ทดสอบ ContextBuilder ===\n');

    // ทดสอบ 1: สร้าง context จากเอกสารที่มี metadata ครบ
    try {
        const result = buildContext([fullMetadataDoc]);

        assert.ok(result.context, 'ควรมี context');
        assert.ok(result.context.includes('เอกสารเต็ม'), 'ควรมีหัวข้อเอกสาร');
        assert.ok(result.context.includes('https://www.opdc.go.th/test'), 'ควรมี URL');
        assert.ok(result.context.includes('หน้า 5'), 'ควรมีเลขหน้า');
        assert.ok(result.context.includes('บทที่ 1'), 'ควรมี section');
        assert.strictEqual(result.hasEvidence, true, 'ควรมี evidence');

        console.log(`  ✅ เอกสารมี metadata ครบ -> context สมบูรณ์`);
        passed++;
    } catch (err) {
        console.log(`  ❌ เอกสารมี metadata ครบ: ${err.message}`);
        failed++;
    }

    // ทดสอบ 2: เอกสารที่มี metadata บางส่วนขาด
    try {
        const result = buildContext([partialMetadataDoc]);

        assert.ok(result.context, 'ควรมี context แม้ metadata บางส่วนขาด');
        assert.ok(result.context.includes('เอกสารบางส่วน'), 'ควรมีหัวข้อ');
        assert.ok(result.context.includes('https://www.opdc.go.th/partial'), 'ควรมี URL');

        // ตรวจสอบ citations
        assert.strictEqual(result.citations.length, 1);
        assert.strictEqual(result.citations[0].title, 'เอกสารบางส่วน');
        assert.strictEqual(result.citations[0].url, 'https://www.opdc.go.th/partial');
        assert.strictEqual(result.citations[0].page, null, 'page ควรเป็น null เพราะไม่มี');
        assert.strictEqual(result.citations[0].section, null, 'section ควรเป็น null เพราะไม่มี');

        console.log(`  ✅ เอกสารมี metadata บางส่วนขาด -> ไม่มี error`);
        passed++;
    } catch (err) {
        console.log(`  ❌ เอกสารมี metadata บางส่วนขาด: ${err.message}`);
        failed++;
    }

    // ทดสอบ 3: ไม่มีเอกสาร
    try {
        const result = buildContext([]);

        assert.strictEqual(result.context, '', 'context ควรว่าง');
        assert.strictEqual(result.hasEvidence, false, 'ควรมี hasEvidence=false');
        assert.strictEqual(result.citations.length, 0, 'ควรมี citations ว่าง');

        console.log(`  ✅ ไม่มีเอกสาร -> context ว่าง`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ไม่มีเอกสาร: ${err.message}`);
        failed++;
    }

    // ทดสอบ 4: null หรือ undefined
    try {
        const result = buildContext(null);

        assert.strictEqual(result.context, '', 'context ควรว่าง');
        assert.strictEqual(result.hasEvidence, false, 'ควรมี hasEvidence=false');

        console.log(`  ✅ null input -> ไม่มี error`);
        passed++;
    } catch (err) {
        console.log(`  ❌ null input: ${err.message}`);
        failed++;
    }

    // ทดสอบ 5: เอกสารที่มี text field (retro compatibility)
    try {
        const result = buildContext([textBasedDoc]);

        assert.ok(result.context.includes('เนื้อหาจาก text field'), 'ควรใช้ text field');
        console.log(`  ✅ เอกสารมี text field -> ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ เอกสารมี text field: ${err.message}`);
        failed++;
    }

    // ทดสอบ 6: เอกสารประเภท string
    try {
        const result = buildContext([stringDoc]);

        assert.ok(result.context.includes('เป็นเพียงข้อความ'), 'ควรใช้ string เป็น content');
        console.log(`  ✅ เอกสารเป็น string -> ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ เอกสารเป็น string: ${err.message}`);
        failed++;
    }

    // ทดสอบ 7: จัดการเอกสารล้าสมัย
    try {
        const result = buildContext([outdatedDoc], { filterOutdated: true });

        assert.strictEqual(result.hasOutdated, true, 'ควรตรวจจับเอกสารล้าสมัย');
        assert.ok(result.skipped.length > 0, 'ควรมีเอกสารที่ถูกข้าม');

        console.log(`  ✅ จัดการเอกสารล้าสมัย -> ตรวจจับได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ จัดการเอกสารล้าสมัย: ${err.message}`);
        failed++;
    }

    // ทดสอบ 8: จำกัดจำนวนเอกสาร
    try {
        const docs = Array.from({ length: 10 }, (_, i) => ({
            documentId: `doc_${i}`,
            content: `เนื้อหา ${i}`,
            title: `เอกสาร ${i}`
        }));

        const result = buildContext(docs, { maxDocuments: 3 });

        assert.ok(result.context, 'ควรมี context');
        console.log(`  ✅ จำกัดจำนวนเอกสาร -> ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ จำกัดจำนวนเอกสาร: ${err.message}`);
        failed++;
    }

    // ทดสอบ 9: buildCitation
    try {
        const citation = buildCitation(fullMetadataDoc);

        assert.strictEqual(citation.title, 'เอกสารเต็ม');
        assert.strictEqual(citation.url, 'https://www.opdc.go.th/test');
        assert.strictEqual(citation.page, 5);
        assert.strictEqual(citation.section, 'บทที่ 1');

        console.log(`  ✅ buildCitation ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ buildCitation: ${err.message}`);
        failed++;
    }

    // ทดสอบ 10: isOutdated
    try {
        assert.strictEqual(isOutdated(outdatedDoc), true, 'เอกสาร superseded ควรเป็น outdated');
        assert.strictEqual(isOutdated(fullMetadataDoc), false, 'เอกสาร published ไม่ใช่ outdated');
        console.log(`  ✅ isOutdated ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ isOutdated: ${err.message}`);
        failed++;
    }

    // ทดสอบ 11: hasCitableMetadata
    try {
        assert.strictEqual(hasCitableMetadata(fullMetadataDoc), true);
        assert.strictEqual(hasCitableMetadata({}), false);
        console.log(`  ✅ hasCitableMetadata ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ hasCitableMetadata: ${err.message}`);
        failed++;
    }

    // ทดสอบ 12: buildConversationHistory
    try {
        const history = [
            { role: 'user', content: 'สวัสดี' },
            { role: 'assistant', content: 'สวัสดีครับ' },
            { role: 'user', content: 'ก.พ.ร. คืออะไร' }
        ];

        const result = buildConversationHistory(history);

        assert.ok(result.includes('ผู้ใช้: สวัสดี'), 'ควรมี user message');
        assert.ok(result.includes('ผู้ช่วย: สวัสดีครับ'), 'ควรมี assistant message');
        console.log(`  ✅ buildConversationHistory ทำงานได้`);
        passed++;
    } catch (err) {
        console.log(`  ❌ buildConversationHistory: ${err.message}`);
        failed++;
    }

    // ทดสอบ 13: ข้อมูลที่ไม่มี content
    try {
        const result = buildContext([{ documentId: 'no_content', title: 'ไม่มีเนื้อหา' }]);
        assert.ok(result.skipped.length > 0, 'ควรมีเอกสารที่ถูกข้ามเพราะไม่มี content');
        console.log(`  ✅ เอกสารไม่มี content -> ถูกข้าม`);
        passed++;
    } catch (err) {
        console.log(`  ❌ เอกสารไม่มี content: ${err.message}`);
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
