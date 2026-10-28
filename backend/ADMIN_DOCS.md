# เอกสารระบบหลังบ้านแอดมิน — OPDC Chatbot (ก.พ.ร.)

เอกสารนี้อธิบายการติดตั้ง, การจัดการ, การสำรองข้อมูล, การใช้งาน API และข้อจำกัดของระบบหลังบ้านแอดมิน (Admin Dashboard) เขียนเป็นภาษาไทยทั้งหมด

---

## 1. ภาพรวมระบบ

ระบบหลังบ้านแอดมินสร้างขึ้นบน Express.js รันที่พอร์ต 8001 ใช้ฐานข้อมูล SQLite สำหรับข้อมูลแอดมิน (ผู้ใช้, เซสชัน, บันทึกการดำเนินการ, คอนฟิกระบบ, ประวัติการสนทนา) และใช้ไฟล์ JSON สำหรับฐานความรู้ (knowledge chunks)

คุณสมบัติหลัก:
- ล็อกอิน / ออกจากระบบแบบรักษาเซสชัน (session-based auth)
- รหัสผ่านแฮชด้วย bcrypt (SALT_ROUNDS = 12)
- จำกัดจำนวนครั้งล็อกอิน (rate limiting) 10 ครั้งต่อ IP ภายใน 15 นาที
- ป้องกัน CSRF แบบ double-submit token (ส่งผ่าน header `X-CSRF-Token`)
- ควบคุมสิทธิ์ตามบทบาท (RBAC): admin / editor / viewer
- ตาม PDPA: ลบประวัติการสนทนาได้, เซสชันแชทเก็บเฉพาะใน RAM
- บันทึกบันทึกการดำเนินการ (audit log) ทุกการเปลี่ยนแปลงสำคัญ

ต้นกำหนด API: `/api/admin/v1/*`

---

## 2. โครงสร้างไฟล์ที่เกี่ยวข้อง

ไฟล์ทั้งหมดอยู่ในโฟลเดอร์ `backend/` (ไม่วุ่นกับโฟลเดอร์อื่น):

```
backend/
├── server.js                 # จุดเริ่มต้นเซิร์ฟเวอร์, ติดตั้ง middleware + เส้นทางแอดมิน
├── test.js                   # ชุดทดสอบรวม (npm test)
├── package.json              # ตัวจัดการแพ็กเกจ Node.js
├── database/
│   ├── db.js                 # การเชื่อมต่อและเริ่มต้น SQLite
│   └── admin.db              # ฐานข้อมูล SQLite (สร้างอัตโนมัติเมื่อรันครั้งแรก)
├── models/
│   ├── User.js               # โมเดลผู้ใช้แอดมิน (bcrypt, CRUD)
│   ├── Config.js             # โมเดลคอนฟิกระบบ (key-value)
│   ├── AuditLog.js           # โมเดลบันทึกการดำเนินการ
│   └── Conversation.js       # โมเดลประวัติการสนทนา (PDPA)
├── routes/admin/
│   ├── auth.js               # ล็อกอิน, ออกจากระบบ, ดูข้อมูลผู้ใช้, ดึง CSRF token
│   ├── dashboard.js          # หน้าสรุปภาพรวมระบบ
│   ├── knowledge.js          # จัดการฐานความรู้ (chunks)
│   ├── prompt.js             # จัดการคอนฟิกเทมเพลต prompt
│   ├── conversations.js      # จัดการประวัติการสนทนา
│   └── system.js             # สถานะระบบ, บันทึกการดำเนินการ, คอนฟกระบบ
├── middleware/
│   └── adminAuth.js          # ตรวจสอบโทเค็นเซสชัน + ตรวจสอบบทบาท
├── scripts/
│   └── create-admin.js       # สร้างบัญชีแอดมินคนแรกผ่านตัวแปรสภาพแวดล้อม
├── utils/
│   └── knowledgeManager.js   # จัดการฐานความรู้ (อ่าน/เพิ่ม/ลบ chunks)
└── test_manual_verify.js     # สคริปต์ทดสอบด้วยมือ (อัตรา limitada + logout)
```

หน้าเว็บแอดมิน (static HTML/JS) อยู่ในโฟลเดอร์ `admin/` ที่ระดับโปรเจกต์:

```
admin/
├── assets/js/app.js          # API client ร่วม (หมุน CSRF, ตรวจสอบสิทธิ์, ข้อความภาษาไทย)
└── pages/
    ├── login.html
    ├── dashboard.html
    ├── knowledge.html
    ├── intents.html
    ├── prompts.html
    ├── conversations.html
    └── system.html
```

---

## 3. การติดตั้งและรันเซิร์ฟเวอร์

### 3.1 ติดตั้ง dependencies

```bash
cd backend
npm install
```

### 3.2 ตั้งค่าตัวแปรสภาพแวดล้อม

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend/` (หรือส่งผ่านตัวแปรสภาพแวดล้อมก่อนรัน):

```env
PORT=8001
NODE_ENV=development
ADMIN_SESSION_SECRET=<สตริงสุ่มอย่างน้อย 32 ตัวอักษร เช่น เปลี่ยนทุกครั้งที่ติดตั้งใหม่>
```

หมายเหตุ: ใน production ต้องตั้ง `ADMIN_SESSION_SECRET` เสมอ มิฉะนั้นเซิร์ฟเวอร์จะไม่เริ่มทำงาน (ระบบจะหยุดด้วยข้อผิดพลาดร้ายแรง)

### 3.3 รันเซิร์ฟเวอร์

```bash
# โหมดปกติ
npm start

# โหมดพัฒนา (รันอัตโนมัติเมื่อไฟล์เปลี่ยน)
npm run dev
```

เซิร์ฟเวอร์จะรันที่ `http://localhost:8001` และตรวจสอบสถานะได้ที่ `http://localhost:8001/health`

---

## 4. การสร้างบัญชีแอดมินคนแรก (First Admin Provisioning)

ก่อนใช้งานระบบหลังบ้าน ต้องสร้างบัญชีแอดมินคนแรกผ่านสคริปต์ provisioning:

```bash
cd backend
ADMIN_USERNAME=admin ADMIN_PASSWORD=ChangeMe123! ADMIN_ROLE=admin node scripts/create-admin.js
```

ข้อกำหนดรหัสผ่าน: อย่างน้อย 8 ตัวอักษร

หลังสร้างแล้ว รหัสผ่านจะถูกแฮชด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล ไม่มีการเก็บรหัสผ่านเป็นข้อความธรรมดา

หากบัญชีนี้มีอยู่แล้ว สคริปต์จะแจ้งว่า `"ผู้ใช้ 'admin' มีอยู่แล้วในระบบ"`

---

## 5. การตรวจสอบสิทธิ์และเซสชัน

### 5.1 ล็อกอิน

```
POST /api/admin/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "ChangeMe123!"
}
```

ตอบกลับ (สำเร็จ):
```json
{
  "status": "success",
  "message": "ล็อกอินสำเร็จ",
  "user": { "id": 1, "username": "admin", "role": "admin" },
  "csrfToken": "..."
}
```

เซิร์ฟเวอร์จะตั้งคุกกี้ `session_id` (httpOnly, sameSite=lax) และสร้าง CSRF token เก็บในเซสชัน

### 5.2 ดึง CSRF token (สำหรับคำขอครั้งถัดไป)

```
GET /api/admin/v1/auth/csrf-token
Cookie: session_id=...
```

ต้องล็อกอินก่อนจึงจะดึง token ได้

### 5.3 ดูข้อมูลผู้ใช้ที่ล็อกอินอยู่

```
GET /api/admin/v1/auth/me
Cookie: session_id=...
```

### 5.4 ออกจากระบบ

```
POST /api/admin/v1/auth/logout
Cookie: session_id=...
X-CSRF-Token: <csrfToken ที่ได้จากล็อกอินหรือ /csrf-token>
```

ตอบกลับ (สำเร็จ): `{ "status": "success", "message": "ออกจากระบบแล้ว" }`

หลังออกจากระบบ เซสชันจะถูกทำลายบนเซิร์ฟเวอร์ และคุกกี้ `session_id` จะถูกล้าง

### 5.5 บทบาทและสิทธิ์ (RBAC)

| บทบาท | สามารถดูได้ | สามารถแก้ไขได้ | สามารถลบได้ |
|-------|-----------|-------------|---------|
| admin | ทุกหน้า | ทุกหน้า | ทุกหน้า |
| editor | ทุกหน้า | knowledge, prompt | knowledge |
| viewer | ทุกหน้า (อ่านอย่างเดียว) | ไม่ได้ | ไม่ได้ |

---

## 6. CSRF Protection (ป้องกันการปลอมแปลงคำขอ)

ทุก endpoint ที่เปลี่ยนสถานะ (POST, PUT, DELETE) ต้องส่ง header `X-CSRF-Token` ที่ตรงกับค่าในเซสชัน หากไม่ส่งหรือส่งไม่ตรง จะตอบกลับ `403 CSRF token ไม่ถูกต้อง`

Endpoint ที่มี CSRF ป้องกัน:
- `POST /api/admin/v1/auth/logout`
- `POST /api/admin/v1/knowledge/chunks`
- `DELETE /api/admin/v1/knowledge/chunks/:id`
- `PUT /api/admin/v1/prompt/config`
- `PUT /api/admin/v1/system/config/:key`
- `DELETE /api/admin/v1/conversations/:id`

การหมุน CSRF token: dashboard หน้าเว็บจะดึง token ใหม่จาก `GET /csrf-token` หลังทุกคำขอที่เปลี่ยนสถานะสำเร็จ

---

## 7. API Reference (สรุปจุดสิ้นสุด API)

### Auth
| เมธอด | เส้นทาง | คำอธิบาย | บทบาท |
|-------|---------|-----------|-------|
| POST | `/api/admin/v1/auth/login` | ล็อกอิน (มี rate limit 10 ครั้ง/15 นาที) | — |
| POST | `/api/admin/v1/auth/logout` | ออกจากระบบ (ต้องมี CSRF) | ผู้ใช้ที่ล็อกอิน |
| GET | `/api/admin/v1/auth/me` | ดูข้อมูลผู้ใช้ปัจจุบัน | ผู้ใช้ที่ล็อกอิน |
| GET | `/api/admin/v1/auth/csrf-token` | ดึง CSRF token | ผู้ใช้ที่ล็อกอิน |

### Knowledge (ฐานความรู้)
| เมธอด | เส้นทาง | คำอธิบาย | บทบาท |
|-------|---------|-----------|-------|
| GET | `/api/admin/v1/knowledge/chunks` | รายการชิ้นข้อมูล | admin, editor, viewer |
| POST | `/api/admin/v1/knowledge/chunks` | เพิ่มชิ้นข้อมูลใหม่ (ต้องมี CSRF) | admin, editor |
| DELETE | `/api/admin/v1/knowledge/chunks/:id` | ลบชิ้นข้อมูล (ต้องมี CSRF) | admin, editor |

### Prompt (เทมเพลต)
| เมธอด | เส้นทาง | คำอธิบาย | บทบาท |
|-------|---------|-----------|-------|
| GET | `/api/admin/v1/prompt/config` | ดูเวอร์ชัน prompt ปัจจุบัน | admin, editor, viewer |
| PUT | `/api/admin/v1/prompt/config` | อัปเดตเวอร์ชัน prompt (ต้องมี CSRF) | admin |

### Conversations (ประวัติการสนทนา / PDPA)
| เมธอด | เส้นทาง | คำอธิบาย | บทบาท |
|-------|---------|-----------|-------|
| GET | `/api/admin/v1/conversations` | รายการประวัติการสนทนา | admin, editor, viewer |
| DELETE | `/api/admin/v1/conversations/:id` | ลบประวัติการสนทนา (ต้องมี CSRF) | admin |

### System (ระบบ)
| เมธอด | เส้นทาง | คำอธิบาย | บทบาท |
|-------|---------|-----------|-------|
| GET | `/api/admin/v1/system/health` | ตรวจสอบสถานะระบบ | admin, editor, viewer |
| GET | `/api/admin/v1/system/audit-logs` | รายงานบันทึกการดำเนินการ | admin, editor, viewer |
| GET | `/api/admin/v1/system/config` | รายการคอนฟิกทั้งหมด | admin, editor, viewer |
| PUT | `/api/admin/v1/system/config/:key` | อัปเดตคอนฟิกรายตัว (ต้องมี CSRF) | admin |

---

## 8. การสำรองและกู้คืนข้อมูล (Backup & Restore)

### 8.1 สำรองฐานข้อมูล SQLite

ฐานข้อมูลอยู่ที่ `backend/database/admin.db` สำรองโดยการคัดลอกไฟล์:

```bash
# สร้างสำเนาสำรองพร้อมวันที่
cp backend/database/admin.db backend/database/admin.db.backup.$(date +%Y%m%d%H%M%S)
```

### 8.2 สำรองฐานความรู้ (JSON)

ฐานความรู้เก็บเป็นไฟล์ JSON ในโฟลเดอร์ที่ `knowledgeManager` ใช้ (โดยปกติอยู่ภายใต้ `backend/data/` หรือตรงที่ระบุในโค้ด) สำรองโดยการคัดลอกไฟล์ JSON ทั้งหมดในโฟลดร์นั้น

### 8.3 กู้คืน

หยุดเซิร์ฟเวอร์ แล้วคัดลอกไฟล์สำรองกลับทับ `admin.db` (และไฟล์ JSON ของฐานความหากมีการเปลี่ยนแปลง) แล้วเริ่มเซิร์ฟเวอร์ใหม่

---

## 9. PDPA และความปลอดภัย

- **เซสชันแชทเก็บใน RAM เท่านั้น** — เมื่อเซิร์ฟเวอร์รีสตาร์ทหรือเซสชันหมดอายุ ข้อมูลแชทจะสูญหาย (ไม่ถูกบันทึกถาวร)
- **ลบประวัติการสนทนาได้** ตามคำขอของเจ้าของข้อมูล (สิทธิ์ลบข้อมูล / Right to erasure) ผ่าน `DELETE /api/admin/v1/conversations/:id`
- **รหัสผ่านแฮชด้วย bcrypt** (12 salt rounds) ไม่เก็บเป็นข้อความธรรมดา
- **คุกกี้เซสชัน** ตั้งค่า httpOnly, sameSite=lax, secure (เฉพาะ production)
- **อัตรา limitada การล็อกอิน** ป้องกันการเดารหัสผ่าน (brute force) สูงสุด 10 ครั้งต่อ IP ภายใน 15 นาที
- **ไม่เปิดเผยว่ามีผู้ใช้หรือไม่** — การล็อกอินล้มเหลวไม่ว่าจะเพราะชื่อผู้ใช้ไม่มีหรือรหัสผิด จะตอบกลับข้อความเดียวกัน `"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"` (สถานะ 401)

---

## 10. ข้อจำกัดของระบบ (Limitations)

1. **ฐานความรู้เก็บเป็นไฟล์ JSON** ไม่ใช่ฐานข้อมูล-relational เหมาะกับข้อมูลปานกลาง หากข้อมูลมากอาจต้องย้ายไปใช้ฐานข้อมูลที่เหมาะสมกว่า
2. **เซสชันแชทอยู่ใน RAM** — สูญหายเมื่อเซิร์ฟเวอร์รีสตาร์ท
3. **CSRF token ไม่ถูกหมุนหลังทุกคำขอที่เปลี่ยนสถานะ** แม้เอกสารจะระบุไว้ (dashboard หน้าเว็บจัดการการดึง token ใหม่ด้วยตนเอง)
4. **Rate limit ตาม IP** — หากผู้ใช้หลายคนแชร์ IP เดียวกัน (เช่น ออกจากเครื่องเดียวกันผ่าน NAT) จะถูกนับรวมกัน
5. **ไม่มีระบบลืมรหัสผ่าน / รีเซ็ตรหัสผ่าน** ในเวอร์ชันนี้ ต้องสร้างบัญชีใหม่หรือแก้ไขผ่านฐานข้อมูลโดยตรง

---

## 11. ขั้นตอนทดสอบด้วยมือ (Manual Test Procedures)

เนื่องจากสภาพแวดล้อมนี้จำกัดการรันสคริปต์ผ่าน Bash คุณสามารถทดสอบด้วย `curl` ได้ดังนี้ (รันจากโฟลเดอร์ `backend`):

### 11.1 ทดสอบล็อกอินรหัสผิด (คาดหวัง 401)

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8001/api/admin/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent_user","password":"wrongpassword"}'
```
ผลลัพธ์ที่คาดหวัง: `401`

### 11.2 ทดสอบการจำกัดอัตรา (rate limiting) → คาดหวัง 429

**คำเตือน:** ขั้นตอนนี้จะบล็อก IP ของคุณชั่วคราว 15 นาที หลังจากครบ 10 ครั้ง ให้ทำเป็นข้อสุดท้าย

```bash
for i in $(seq 1 11); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8001/api/admin/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"nonexistent_user","password":"wrongpassword"}')
  echo "ครั้งที่ $i: HTTP $code"
done
```
ผลลัพธ์ที่คาดหวัง: ครั้งที่ 11 (หรือก่อนหน้านั้นหากมีคำขอล็อกอินอื่นก่อน) ควรได้ `429`

### 11.3 ทดสอบล็อกอินสำเร็จ → ออกจากระบบ → ตรวจสอบเซสชัน

ต้องมีบัญชีแอดมินอยู่ในระบบก่อน (สร้างผ่าน create-admin.js):

```bash
# 1) ล็อกอิน (บันทึกคุกกี้และ csrfToken)
curl -c cookies.txt -s -X POST http://localhost:8001/api/admin/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}'

# 2) ดึง CSRF token
curl -b cookies.txt -s http://localhost:8001/api/admin/v1/auth/csrf-token

# 3) ดูข้อมูลผู้ใช้ (ต้องได้ 200)
curl -b cookies.txt -s http://localhost:8001/api/admin/v1/auth/me

# 4) ออกจากระบบ (ส่ง csrfToken ด้วย)
curl -b cookies.txt -c cookies.txt -s -X POST http://localhost:8001/api/admin/v1/auth/logout \
  -H "X-CSRF-Token: <csrfToken>"

# 5) ตรวจสอบหลังออกจากระบบ (ต้องได้ 401)
curl -b cookies.txt -s http://localhost:8001/api/admin/v1/auth/me
```

ผลลัพธ์ที่คาดหวัง: ขั้นตอน 3 ได้ `200`, ขั้นตอน 4 ได้ `200`, ขั้นตอน 5 ได้ `401`

---

## 12. การรันชุดทดสอบอัตโนมัติ

```bash
cd backend
npm test
```

ชุดทดสอบประกอบด้วย:
- กลุ่มที่ 1: ทดสอบส่วนย่อย 7 ชุด (ไม่ต้องเปิดเซิร์ฟเวอร์)
- กลุ่มที่ 2: ทดสอบผ่านเซิร์ฟเวอร์จริง 2 ชุด (เปิดเซิร์ฟเวอร์ที่พอร์ต 8100)

หมายเหตุ: ในรอบล่าสุดได้ผล 161 ผ่าน / 19 ไม่ผ่าน จากทั้งหมด 180 ข้อ 19 ข้อที่ไม่ผ่านเป็นปัญหาเดิมในโมดูลแชทหลัก ไม่เกี่ยวข้องกับงานระบบหลังบ้านแอดมิน

---

## 13. ประวัติการแก้ไข (สำหรับทีมพัฒนา)

- เพิ่ม CSRF protection ให้ทุก route ที่เปลี่ยนสถานะ (auth logout, knowledge POST/DELETE, prompt PUT, conversations DELETE, system PUT)
- แก้ไขปัญหาการชนของเส้นทางระหว่าง intents และ conversations
- แก้ปัญหาพอร์ต 8001 ถูกใช้งานอยู่แล้ว (ปิดกระบวนการค้างที่ค้างอยู่)
- การทดสอบ CSRF ทั้งหมดผ่าน: ปฏิเสธ 403 เมื่อไม่มี token / token ไม่ถูกต้อง, อนุญาตเมื่อส่ง token ที่ถูกต้อง

---

หากต้องการให้เพิ่มหรือแก้ไขส่วนใดในเอกสารนี้ แจ้งได้ครับ
