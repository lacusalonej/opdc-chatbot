# คู่มือ Chat API — ระบบแชทบอท ก.พ.ร. (OPDC)

เอกสารนี้อธิบาย API Endpoint หลักของระบบแชทบอท (rule-based, ไม่ใช้ LLM) สำหรับนักพัฒนาที่ต้องการเชื่อมต่อหรือสร้าง frontend หน้าแชท

---

## สารบัญ

1. [ภาพรวม API](#ภาพรวม-api)
2. [POST /v1/chat — ส่งคำถามและรับคำตอบ](#post-v1chat)
3. [GET /v1/intents — รายการ intent ที่รองรับ](#get-v1intents)
4. [GET /v1/sources — รายการแหล่งข้อมูล](#get-v1sources)
5. [DELETE /v1/session/:id — ลบเซสชัน (PDPA)](#delete-v1session)
6. [GET /health — ตรวจสอบสถานะเซิร์ฟเวอร์](#get-health)
7. [รหัสตอบกลับ (HTTP Status Codes)](#รหัสตอบกลับ)
8. [ตัวอย่างการใช้งาน](#ตัวอย่างการใช้งาน)
9. [หมายเหตุสำคัญ](#หมายเหตุสำคัญ)

---

## ภาพรวม API

เซิร์ฟเวอร์รันบน Express.js พอร์ต **8001** (หรือตามตัวแปร `PORT` ใน `.env`)  
ฐานข้อมูลแชทเก็บใน **RAM เท่านั้น** (สอดคล้องกับ PDPA) ข้อมูลจะสูญหายเมื่อเซิร์ฟเวอร์หยุดทำงาน

| รายการ | รายละเอียด |
|--------|-------------|
| Base URL | `http://localhost:8001` |
| Content-Type | `application/json` |
| Character encoding | UTF-8 (รองรับภาษาไทยเต็มรูปแบบ) |
| Session | เก็บในหน่วยความจำ (RAM) เท่านั้น ไม่ถาวร |

---

## POST /v1/chat — ส่งคำถามและรับคำตอบ

ส่งคำถามจากผู้ใช้และรับคำตอบจากระบบ RAG (rule-based keyword matching)

### Request

```http
POST /v1/chat
Content-Type: application/json

{
  "message": "ก.พ.ร. คืออะไร",
  "session_id": "optional-session-id"
}
```

| ฟิลด์ | ชนิด | ข้อบังคับ | รายละเอียด |
|-------|------|-----------|-------------|
| `message` | string | ✅ ใช่ | ข้อความคำถามจากผู้ใช้ (ไม่เกิน 4,096 ตัวอักษร) |
| `session_id` | string | ❌ ไม่จำเป็น | รหัสเซสชันสำหรับจดจำประวัติการสนทนา ถ้าไม่ระบุระบบจะสร้างใหม่โดยอัตโนมัติ |

### Response (สำเร็จ)

```json
{
  "answer": "สำนักงานคณะกรรมการพัฒนาระบบราชการ (ก.พ.ร. / OPDC) เป็นหน่วยงาน...",
  "intent": "ORGANIZATION_INFORMATION",
  "sources": ["org_name", "org_contact"],
  "session_id": "optional-session-id",
  "citations": [
    {
      "id": "org_name",
      "title": "ข้อมูลองค์กร ก.พ.ร.",
      "sourceUrl": "https://www.opdc.go.th",
      "publisher": "สำนักงานคณะกรรมการพัฒนาระบบราชการ",
      "documentStatus": "published"
    }
  ],
  "insufficient_evidence": false
}
```

| ฟิลด์ | ชนิด | รายละเอียด |
|-------|------|-------------|
| `answer` | string | คำตอบจากระบบ (rule-based RAG) |
| `intent` | string | หมวดหมู่ที่ระบบจำแนกได้ (ดูรายละเอียดในตาราง Intent ด้านล่าง) |
| `sources` | string[] | รหัส chunks ที่ใช้เป็นแหล่งอ้างอิง |
| `session_id` | string | รหัสเซสชันที่ใช้ (ส่งคืนเหมือนที่ส่งไป หรือรหัสใหม่ที่ระบบสร้าง) |
| `citations` | object[] | รายการเอกสารอ้างอิงพร้อม metadata |
| `insufficient_evidence` | boolean | `true` ถ้าระบบไม่พบหลักฐานเพียงพอในการตอบ |

### Response (ผิดพลาด)

```http
HTTP 400 Bad Request
Content-Type: application/json

{
  "error": "message is required"
}
```

```http
HTTP 500 Internal Server Error
Content-Type: application/json

{
  "answer": "ขออภัยครับ เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
  "intent": "INSUFFICIENT_INFORMATION",
  "sources": [],
  "session_id": "new-1234567890",
  "error": "internal_error"
}
```

### ตัวอย่างการใช้งาน

```bash
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"ก.พ.ร. มีวิสัยทัศน์อะไรบ้าง","session_id":"user-123"}'
```

---

## GET /v1/intents — รายการ intent ที่รองรับ

คืนค่ารายการ intent ทั้งหมดที่ระบบสามารถจำแนกได้ (14 หมวดหมู่)

### Request

```http
GET /v1/intents
```

### Response (สำเร็จ)

```json
{
  "intents": [
    {
      "id": "GENERAL_GREETING",
      "name_th": "การทักทาย",
      "description_th": "ทักทายและสอบถามสถานะ"
    },
    {
      "id": "ORGANIZATION_INFORMATION",
      "name_th": "ข้อมูลองค์กร",
      "description_th": "เกี่ยวกับ ก.พ.ร., โครงสร้าง, วิสัยทัศน์, ภารกิจ"
    },
    ...
  ]
}
```

### รายการ Intent ทั้งหมด 14 หมวดหมู่

| Intent | ชื่อภาษาไทย | คำอธิบาย |
|--------|-------------|----------|
| `GENERAL_GREETING` | การทักทาย | ทักทายและสอบถามสถานะ |
| `ORGANIZATION_INFORMATION` | ข้อมูลองค์กร | เกี่ยวกับ ก.พ.ร., โครงสร้าง, วิสัยทัศน์, ภารกิจ |
| `MISSION_AND_RESPONSIBILITIES` | ภารกิจและหน้าที่ | ภารกิจ, หน้าที่รับผิดชอบ, ยุทธศาสตร์ |
| `PUBLIC_SERVICES` | บริการสาธารณะ | ขั้นตอนการให้บริการ |
| `GOVERNMENT_SERVICE_IMPROVEMENT` | ปรับปรุงการบริการราชการ | นวัตกรรม, ดิจิทัล, การปรับปรุง |
| `LAWS_AND_REGULATIONS` | กฎหมายและระเบียบ | กฎหมาย, ระเบียบ, กฎระเบียบ |
| `MANUALS_AND_DOCUMENTS` | คู่มือและเอกสาร | เอกสาร PDF คู่มือ |
| `DIGITAL_GOVERNMENT` | ดิจิทัลการปกครอง | ดิจิทัล, ออนไลน์, e-government |
| `PUBLIC_SECTOR_DEVELOPMENT` | พัฒนาภาครัฐ | พัฒนาระบบราชการ, กลยุทธ์ |
| `CONTACT_AND_SUPPORT` | ช่องทางการติดต่อ | ที่อยู่, เบอร์, อีเมล, Facebook |
| `DOCUMENT_SEARCH` | ค้นหาเอกสาร | ค้นหาเอกสาร PDF รายงาน |
| `FOLLOW_UP_QUESTION` | คำถามต่อ | ตอบต่อคำถามในประวัติ |
| `OUT_OF_SCOPE` | นอกขอบเขต | คำถามไม่เกี่ยวข้องกับ ก.พ.ร. |
| `INSUFFICIENT_INFORMATION` | ข้อมูลไม่เพียงพอ | ไม่มีข้อมูลเพียงพอตอบ |

---

## GET /v1/sources — รายการแหล่งข้อมูล

คืนค่ารายการ chunks ทั้งหมดในฐานความรู้ที่ระบบโหลดอยู่

### Request

```http
GET /v1/sources
```

### Response (สำเร็จ)

```json
{
  "sources": ["org_name", "org_contact", "vision", "mission", "..."],
  "total": 24
}
```

| ฟิลด์ | ชนิด | รายละเอียด |
|-------|------|-------------|
| `sources` | string[] | รายการรหัส chunks ทั้งหมด |
| `total` | number | จำนวน chunks ทั้งหมด |

---

## DELETE /v1/session/:id — ลบเซสชัน (PDPA)

ลบประวัติการสนทนาของเซสชันที่ระบุ ตามสิทธิ์ลบข้อมูล (Right to erasure) ตาม PDPA

### Request

```http
DELETE /v1/session/:id
```

| พารามิเตอร์ | ชนิด | รายละเอียด |
|-------------|------|-------------|
| `id` | string (path) | รหัสเซสชันที่ต้องการลบ |

### Response (สำเร็จ)

```json
{
  "status": "deleted",
  "session_id": "user-123"
}
```

หรือถ้าไม่พบเซสชัน:

```json
{
  "status": "not_found",
  "session_id": "user-123"
}
```

---

## GET /health — ตรวจสอบสถานะเซิร์ฟเวอร์

ตรวจสอบว่าเซิร์ฟเวอร์ทำงานปกติและฐานความรู้โหลดครบถ้วนหรือไม่

### Request

```http
GET /health
```

### Response (สำเร็จ)

```json
{
  "status": "ok",
  "chunks_loaded": 24,
  "uptime": 6172.1
}
```

| ฟิลด์ | ชนิด | รายละเอียด |
|-------|------|-------------|
| `status` | string | `"ok"` เมื่อเซิร์ฟเวอร์ทำงานปกติ |
| `chunks_loaded` | number | จำนวน chunks ที่โหลดจากฐานความรู้แล้ว |
| `uptime` | number | เวลาที่เซิร์ฟเวอร์ทำงานมาแล้ว (วินาที) |

---

## รหัสตอบกลับ (HTTP Status Codes)

| รหัส | ความหมาย | รายละเอียด |
|------|-----------|-------------|
| `200` | OK | คำขอสำเร็จ |
| `400` | Bad Request | คำขอผิดรูปแบบ เช่น ขาด field `message` |
| `404` | Not Found | ไม่พบ endpoint หรือเซสชันที่ระบุ |
| `500` | Internal Server Error | เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ |

---

## ตัวอย่างการใช้งาน (cURL)

### ส่งคำถามภาษาไทย

```bash
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"ก.พ.ร. มีหน้าที่อะไรบ้าง","session_id":"user-abc123"}'
```

### ดูรายการ intent

```bash
curl http://localhost:8001/v1/intents
```

### ดูรายการแหล่งข้อมูล

```bash
curl http://localhost:8001/v1/sources
```

### ลบเซสชัน (PDPA)

```bash
curl -X DELETE http://localhost:8001/v1/session/user-abc123
```

### ตรวจสอบสถานะเซิร์ฟเวอร์

```bash
curl http://localhost:8001/health
```

---

## หมายเหตุสำคัญ

1. **ไม่มี LLM** — ระบบนี้เป็นแบบ rule-based (คีย์เวิร์ด) ไม่ได้ใช้โมเดล AI หรือ LLM ในการตอบ คำตอบขึ้นอยู่กับฐานความรู้ใน `knowledge/opdc-knowledge.json`
2. **เซสชันอยู่ใน RAM** — ประวัติการสนทนาจะสูญหายเมื่อเซิร์ฟเวอร์หยุดทำงาน หรือเรียก `DELETE /v1/session/:id`
3. **ภาษาไทย** — รองรับภาษาไทยเต็มรูปแบบ ตรวจจับภาษาอัตโนมัติ (ไทย/อังกฤษ)
4. **ข้อความยาวสูงสุด** — `message` ต้องไม่เกิน 4,096 ตัวอักษร
5. **เอกสารอ้างอิง** — แต่ละคำตอบแนบ citations ที่อ้างอิงจากฐานความรู้พร้อม title, sourceUrl, publisher
6. **PDPA** — ไม่เก็บข้อมูลส่วนบุคคล ถาวร ข้อมูลแชทอยู่ใน RAM เท่านั้น สามารถลบเซสชันได้ตามสิทธิ์ลบข้อมูล

---

## การแก้ไขล่าสุด

- เพิ่ม `citations` และ `insufficient_evidence` ใน response ของ `/v1/chat`
- เพิ่ม metadata (title, sourceUrl, publisher, documentStatus) ให้ chunks ใน RAG Engine
- รองรับการจัดการ chunks แบบ real-time ผ่าน `addChunks()` และ `removeChunk()`
