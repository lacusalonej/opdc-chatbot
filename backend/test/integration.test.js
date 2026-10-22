/**
 * PHASE D - Stage 3: Integration Test (API Contract)
 * ทดสอบสัญญา API ของ OPDC Chatbot backend ผ่าน HTTP จริง
 * ไม่แก้ไข production code ใด ๆ (diagnostic mode)
 */

'use strict';

const BASE = process.env.BASE_URL || 'http://localhost:8100';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
    try {
        const detail = fn();
        passed++;
        console.log(`  PASS  ${name}${detail ? ' :: ' + detail : ''}`);
    } catch (err) {
        failed++;
        failures.push({ name, error: err.message });
        console.log(`  FAIL  ${name} :: ${err.message}`);
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function json(path, opts = {}) {
    const res = await fetch(BASE + path, opts);
    let body = null;
    const text = await res.text();
    try { body = JSON.parse(text); } catch (e) { body = { __raw: text }; }
    return { status: res.status, body, headers: res.headers, raw: text };
}

(async function run() {
    console.log('=== Stage 3: Integration / API Contract Test ===');
    console.log('BASE = ' + BASE + '\n');

    // ---------- I1: GET / ----------
    await (async () => {
        const r = await json('/');
        check('I1 GET / ตอบ 200 พร้อมข้อมูลบริการ', () => {
            assert(r.status === 200, `status = ${r.status}`);
            assert(r.body && (r.body.service || r.body.name || r.body.version), 'ไม่มี field ระบุบริการ');
            return JSON.stringify(r.body).slice(0, 120);
        });
    })();

    // ---------- I2: GET /health ----------
    await (async () => {
        const r = await json('/health');
        check('I2 GET /health ตอบ 200 + status/chunks_loaded/uptime', () => {
            assert(r.status === 200, `status = ${r.status}`);
            assert(r.body.status, 'ไม่มี status');
            assert(typeof r.body.chunks_loaded === 'number', 'ไม่มี chunks_loaded');
            assert(typeof r.body.uptime === 'number', 'ไม่มี uptime');
            return `chunks_loaded=${r.body.chunks_loaded} uptime=${r.body.uptime}`;
        });
    })();

    // ---------- I3: GET /v1/intents ----------
    await (async () => {
        const r = await json('/v1/intents');
        check('I3 GET /v1/intents คืน 14 intent', () => {
            assert(r.status === 200, `status = ${r.status}`);
            const keys = Object.keys(r.body.intents || r.body);
            assert(keys.length === 14, `ได้ ${keys.length} intent (คาดหวัง 14): ${keys.join(',')}`);
            return keys.length + ' intents';
        });
    })();

    // ---------- I4: GET /v1/sources ----------
    await (async () => {
        const r = await json('/v1/sources');
        check('I4 GET /v1/sources คืนรายการ source', () => {
            assert(r.status === 200, `status = ${r.status}`);
            const s = r.body.sources || [];
            assert(Array.isArray(s) && s.length > 0, 'sources ว่าง');
            assert(typeof r.body.total === 'number', 'ไม่มี total');
            return `total=${r.body.total}`;
        });
    })();

    // ---------- I5: POST /v1/chat ข้อความปกติ -> contract เต็ม ----------
    let sid = null;
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ก.พ.ร. คืออะไร' })
        });
        check('I5 POST /v1/chat คืน answer/intent/sources/session_id (+citations, insufficient_evidence)', () => {
            assert(r.status === 200, `status = ${r.status} body=${r.raw.slice(0, 200)}`);
            for (const k of ['answer', 'intent', 'sources', 'session_id']) {
                assert(k in r.body, `ไม่มี field "${k}" ใน response`);
            }
            assert(typeof r.body.answer === 'string' && r.body.answer.length > 0, 'answer ว่าง');
            assert(Array.isArray(r.body.sources), 'sources ไม่ใช่ array');
            assert(typeof r.body.session_id === 'string' && r.body.session_id.length > 0, 'session_id ไม่ถูกต้อง');
            assert('citations' in r.body, 'ไม่มี citations (optional field)');
            assert('insufficient_evidence' in r.body, 'ไม่มี insufficient_evidence (optional field)');
            sid = r.body.session_id;
            return `intent=${r.body.intent} sources=${r.body.sources.length} citations=${(r.body.citations || []).length} sid=${sid}`;
        });
    })();

    // ---------- I6: session continuity ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'แล้วมีหน้าที่อะไรบ้าง', session_id: sid })
        });
        check('I6 POST /v1/chat ใช้ session_id เดิมต่อเนื่อง', () => {
            assert(r.status === 200, `status = ${r.status}`);
            assert(r.body.session_id === sid, `session_id เปลี่ยน: ${r.body.session_id} != ${sid}`);
            return `session_id stable = ${r.body.session_id}`;
        });
    })();

    // ---------- I7: message ว่าง -> 400 ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '   ' })
        });
        check('I7 POST /v1/chat message ว่าง -> 400 + error', () => {
            assert(r.status === 400, `status = ${r.status} (คาดหวัง 400)`);
            assert(r.body.error, 'ไม่มี field error');
            return `error="${r.body.error}"`;
        });
    })();

    // ---------- I8: ไม่มี message field เลย -> 400 ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foo: 'bar' })
        });
        check('I8 POST /v1/chat ไม่มี field message -> 400', () => {
            assert(r.status === 400, `status = ${r.status} (คาดหวัง 400)`);
            return `error="${r.body.error}"`;
        });
    })();

    // ---------- I9: body ที่ไม่ใช่ JSON -> 400 (ไม่ควร 500) ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json-at-all'
        });
        check('I9 POST /v1/chat body ไม่ใช่ JSON -> 400 ไม่ใช่ 500', () => {
            assert(r.status === 400, `status = ${r.status} (คาดหวัง 400)`);
            return `error="${r.body.error}"`;
        });
    })();

    // ---------- I10: message ไม่ใช่ string (number) ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 12345 })
        });
        check('I10 POST /v1/chat message เป็น number -> ไม่ crash (200/400)', () => {
            assert(r.status === 200 || r.status === 400, `status = ${r.status}`);
            assert(r.status !== 500, 'server crash (500)');
            return `status=${r.status}`;
        });
    })();

    // ---------- I11: message เป็น object ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { evil: true } })
        });
        check('I11 POST /v1/chat message เป็น object -> ไม่ crash', () => {
            assert(r.status !== 500, 'server crash (500)');
            return `status=${r.status}`;
        });
    })();

    // ---------- I12: message ยาวมาก (ขนาดข้อมูล) ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ทดสอบระบบ'.repeat(5000) })
        });
        check('I12 POST /v1/chat message ยาว ~55k ตัวอักษร -> ไม่ crash', () => {
            assert(r.status !== 500, 'server crash (500)');
            return `status=${r.status} len=${r.body.answer ? r.body.answer.length : 0}`;
        });
    })();

    // ---------- I13: DELETE /v1/session/:id ----------
    await (async () => {
        const r = await json('/v1/session/' + encodeURIComponent(sid), { method: 'DELETE' });
        check('I13 DELETE /v1/session/:id -> 200', () => {
            assert(r.status === 200, `status = ${r.status}`);
            return JSON.stringify(r.body).slice(0, 120);
        });
    })();

    // ---------- I14: หลังลบ session -> history ถูกล้าง ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ทดสอบหลังลบ session', session_id: sid })
        });
        check('I14 หลัง DELETE session แล้วยัง POST ได้ (ไม่ 500)', () => {
            assert(r.status === 200, `status = ${r.status}`);
            return `status=${r.status} intent=${r.body.intent}`;
        });
    })();

    // ---------- I15: route ที่ไม่มีอยู่ -> 404 ----------
    await (async () => {
        const r = await json('/v1/nonexistent');
        check('I15 GET route ที่ไม่มีอยู่ -> 404', () => {
            assert(r.status === 404, `status = ${r.status}`);
            return `status=${r.status}`;
        });
    })();

    // ---------- I16: ไม่ leak stack trace ใน response ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "'; DROP TABLE sessions; --" })
        });
        check('I16 SQL-injection string ไม่ทำให้ 500 และไม่ leak stack trace', () => {
            assert(r.status !== 500, 'server crash (500)');
            const s = JSON.stringify(r.body);
            assert(!/\bat\s+\w+.*:\d+:\d+/.test(s), 'พบ stack trace ใน response');
            assert(!s.includes('node_modules'), 'พบ path node_modules ใน response');
            return `status=${r.status}`;
        });
    })();

    // ---------- I17: CORS preflight จาก origin ที่อนุญาต ----------
    await (async () => {
        const res = await fetch(BASE + '/v1/chat', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://opdc.go.th',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        check('I17 CORS preflight จาก origin ที่อนุญาต (opdc.go.th) -> ไม่ถูกบล็อก', () => {
            assert(res.status < 400, `status = ${res.status}`);
            const acao = res.headers.get('access-control-allow-origin');
            return `acao=${acao}`;
        });
    })();

    // ---------- I18: CORS จาก origin ที่ไม่อนุญาต ----------
    await (async () => {
        const res = await fetch(BASE + '/v1/chat', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example.com',
                'Access-Control-Request-Method': 'POST'
            }
        });
        const acao = res.headers.get('access-control-allow-origin');
        check('I18 CORS จาก origin แปลกปลอม -> ไม่มี Access-Control-Allow-Origin', () => {
            assert(acao === null, `acao ถูกส่งกลับ = ${acao}`);
            return 'acao=null (ถูกต้อง)';
        });
    })();

    // ---------- I19: method ไม่รองรับ ----------
    await (async () => {
        const r = await json('/v1/chat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        check('I19 PUT /v1/chat -> 404/405 (ไม่ 500)', () => {
            assert(r.status === 404 || r.status === 405, `status = ${r.status}`);
            return `status=${r.status}`;
        });
    })();

    // ---------- I20: ตรวจว่า answer ไม่มี URL นอกระบบ OPDC ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'เว็บไซต์ของกพรอยู่ที่ไหน' })
        });
        check('I20 answer ไม่อ้าง URL นอกเหนือจาก citations', () => {
            const urls = (r.body.answer || '').match(/https?:\/\/[^\s"<>)]+/g) || [];
            const cited = new Set((r.body.citations || []).map(c => c.url).filter(Boolean));
            const rogue = urls.filter(u => ![...cited].some(c => u.startsWith(c) || c.startsWith(u)));
            assert(rogue.length === 0, `พบ URL ที่ไม่มีใน citations: ${rogue.join(', ')}`);
            return `urls=${urls.length} citations=${cited.size}`;
        });
    })();

    // ---------- I21: insufficient_evidence ต้องเป็น boolean ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'อากาศวันนี้หน้าที่สถานีอากาศเป็นอย่างไร' })
        });
        check('I21 insufficient_evidence เป็น boolean ทุกกรณี', () => {
            assert(typeof r.body.insufficient_evidence === 'boolean',
                `insufficient_evidence type = ${typeof r.body.insufficient_evidence}`);
            return `insufficient_evidence=${r.body.insufficient_evidence} intent=${r.body.intent}`;
        });
    })();

    // ---------- I22: ไม่มี field เกิน (contract ควรคงที่) ----------
    await (async () => {
        const r = await json('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'บริการของกพรมีอะไรบ้าง' })
        });
        const allowed = new Set(['answer', 'intent', 'sources', 'session_id', 'citations', 'insufficient_evidence']);
        const extra = Object.keys(r.body).filter(k => !allowed.has(k));
        check('I22 response ไม่มี field เกินจาก contract', () => {
            assert(extra.length === 0, `พบ field เกิน: ${extra.join(', ')}`);
            return Object.keys(r.body).join(',');
        });
    })();

    console.log(`\n--- Stage 3 Summary ---`);
    console.log(`passed=${passed} failed=${failed}`);
    if (failures.length) {
        console.log('\nFAILED CASES:');
        failures.forEach(f => console.log(` - ${f.name} :: ${f.error}`));
    }
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => {
    console.error('FATAL', e);
    process.exit(2);
});
