"""
RAG Engine สำหรับ Chatbot ก.พ.ร.
- ดึงข้อมูลจาก knowledge/opdc-knowledge.json
- จำแนกคำถามเป็นหมวดหมู่อย่างง่ายด้วย keyword matching
- ค้นหาข้อมูลที่เกี่ยวข้อง และตอบคำถามภาษาไทย
"""
import json
import re
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_FILE = BASE_DIR / "knowledge" / "opdc-knowledge.json"


class RAGEngine:
    def __init__(self, knowledge_file: Optional[str] = None):
        self.knowledge_file = knowledge_file or str(KNOWLEDGE_FILE)
        self.data = self._load_knowledge()
        self.chunks = self._create_chunks()

    def _load_knowledge(self) -> dict:
        with open(self.knowledge_file, encoding="utf-8") as f:
            return json.load(f)

    def _create_chunks(self) -> list:
        """แปลงฐานความรู้เป็น chunks ที่มี keyword matching"""
        chunks = []
        org = self.data["organization"]

        chunks.append({
            "id": "org_name",
            "category": "general",
            "keywords": ["กพร", "ก.พ.ร.", "opdc", "คืออะไร", "ชื่อเต็ม", "สังกัด", "บทบาท", "ประวัติ", "สำนักงาน"],
            "text": f"{org['name_th']} ({org['name_en']}) ย่อว่า {org['abbr_th']} (OPDC) เป็นหน่วยราชการสังกัดกระทรวงพลังงาน ทำหน้าที่พัฒนาการพัฒนาระบบราชการและให้คำปรึกษาดานระบบราชการแก่ภาคราชการ"
        })

        chunks.append({
            "id": "org_contact",
            "category": "contact",
            "keywords": ["ติดต่อ", "เบอร์", "โทร", "โทรสาร", "fax", "email", "อีเมล", "ที่อยู่", "facebook", "youtube", "สถานที่", "แผนที่", "ที่ไหน"],
            "text": f"ที่ตั้ง: {org['address']}\nเบอร์โทร: {org['phone']}\nโทรสาร: {org['fax']}\nอีเมล: {org['email']}\nFacebook: {org['facebook']}\nYouTube: {org['youtube']}"
        })

        chunks.append({
            "id": "vision",
            "category": "general",
            "keywords": ["วิสัยทัศน์", "vision", "เป้าหมาย"],
            "text": f"วิสัยทัศน์: {self.data['vision']['text_th']}"
        })

        chunks.append({
            "id": "mission",
            "category": "general",
            "keywords": ["พันธกิจ", "mission", "หน้าที่"],
            "text": f"พันธกิจ: {self.data['mission']['text_th']}"
        })

        for issue in self.data["strategic_issues"]:
            chunks.append({
                "id": f"strategic_{issue['id']}",
                "category": "general",
                "keywords": ["ยุทธศาสตร์", "เป้าหมาย", "กลยุทธ์", issue['title_th']],
                "text": f"ประเด็นยุทธศาสตร์ที่ {issue['id']}: {issue['title_th']} - {issue['desc_th']}"
            })

        for comm in self.data["committees"]:
            chunks.append({
                "id": f"committee_{comm['name_th'].split(' ')[0]}",
                "category": "general",
                "keywords": ["คณะกรรมการ", "กรรมการ", comm['name_th']],
                "text": f"{comm['name_th']}: {comm['role_th']}"
            })

        for service in self.data["services"]:
            chunks.append({
                "id": f"service_{service['name_th'].split(' ')[0]}",
                "category": "service",
                "keywords": ["บริการ", "ขั้นตอน", "ขอ", "รางวัล", service['name_th']],
                "text": f"{service['name_th']}: {service['desc_th']}"
            })

        # Knowledge center chunk
        kc = self.data["knowledge_center"]
        chunks.append({
            "id": "knowledge_center",
            "category": "search",
            "keywords": ["ค้นหา", "เอกสาร", "pdf", "ดาวน์โหลด", "ระเบียบ", "กฎหมาย", "คำวินิจฉัย", "รายงาน", "ข่าว", "FAQ", "คำถามที่พบบ่อย"],
            "text": f"{kc['description_th']} ส่วน:\n" + "\n".join(f"- {s}" for s in kc["sections"]) + "\nสามารถสืบค้นได้ที่ https://www.opdc.go.th/"
        })

        # Greeting chunk
        chunks.append({
            "id": "greeting",
            "category": "chat",
            "keywords": ["สวัสดี", "หวัดดี", "hello", "hi", "ทักทาย", "สบู่ดีไหม", "ขอบคุณ", "บ๊าย"],
            "text": f"สวัสดีครับ! ผมคือ Chatbot ผู้ช่วยของสำนักงาน ก.พ.ร. (OPDC) ยินดีให้บริการข้อมูลทั่วไป การติดต่อ การบริการ และการสืบค้นเอกสารครับ ถามมาได้เลยครับ"
        })

        return chunks

    def classify_intent(self, query: str) -> str:
        """จำแนกคำถามเบื้องตัวด้วย keyword matching"""
        q = query.lower()
        keywords = {
            "contact": ["ติดต่อ", "เบอร์", "โทร", "email", "ที่อยู่", "facebook", "youtube",
                       "ที่อยู่ที่", "ติดต่อเจ้าหน้าที่", "ฝ่าย", "กอง"],
            "general": ["เกี่ยวกับ", "คืออะไร", "มีอะไรบ้าง", "โครงสร้าง", "คณะกรรมการ", "วิสัยทัศน์",
                       "พันธกิจ", "ยุทธศาสตร์", "ประวัติ", "ผู้บริหาร", "กพร", "opdc"],
            "service": ["บริการ", "ขั้นตอน", "วิธี", "วิธีทำ", "สมัคร", "ขอ", "ขอรับบริการ",
                       "เอกสาร", "แบบฟอร์ม", "กฎหมาย", "ระเบียบ"],
            "search": ["ค้นหา", "ค้นหาเอกสาร", "pdf", "ดาวน์โหลด", "ดาวน์โหลดเอกสาร", "ไฟล์",
                      "รายงาน", "newsletter", "b-ready"],
            "chat": ["สวัสดี", "สบู่ดีไหม", "ขอบคุณ", "ไม่เป็นไร", "อ่า", "นะ", "ครับ", "ค่ะ"],
        }

        # 1. ตรวจสอบจาก keywords ของแต่ละ chunk ก่อน
        for chunk in self.chunks:
            if chunk.get("keywords"):
                for kw in chunk["keywords"]:
                    if kw.lower() in q:
                        # ใช้ category ของ chunk เป็น intent
                        return chunk["category"]

        # 2. ตรวจสอบจาก keyword dictionaries
        for intent, kws in keywords.items():
            if any(k in q for k in kws):
                return intent
        return "general"

    def search_chunks(self, query: str, top_k: int = 3) -> list:
        """ค้นหา chunks ที่เกี่ยวข้องด้วย keyword matching"""
        q = query.lower()
        scores = []
        for chunk in self.chunks:
            text = chunk["text"].lower()
            score = 0

            # 1. ตรวจว่า query ทั้งประโยค หรือส่วนหนึ่ง มีอยู่ใน text ไหม
            if q in text:
                score += 10

            # 2. ตรวจ keywords ของ chunk
            if chunk.get("keywords"):
                for kw in chunk["keywords"]:
                    kw_lower = kw.lower()
                    if q in kw_lower or kw_lower in q:
                        score += 5
                    # ตรวจคำนี้มากขึ้น
                    for token in q.split():
                        if len(token) >= 2 and token in kw_lower:
                            score += 3

            # 3. ตรวจคำเดี่ยวๆ ที่ผู้ใช้พิมพ์
            tokens = q.split()
            for token in tokens:
                if len(token) >= 2 and token in text:
                    score += 2

            if score > 0:
                scores.append((score, chunk))

        scores.sort(reverse=True)
        return [c[1] for c in scores[:top_k]]

    def answer(self, query: str) -> dict:
        intent = self.classify_intent(query)
        matches = self.search_chunks(query)

        # Fallback logic (เหมือนกับ JS version)
        # ถ้า intent เป็น chat แต่ไม่เจอ match ให้ดึง greeting chunk
        if intent == "chat" and len(matches) == 0:
            greeting = next((c for c in self.chunks if c["id"] == "greeting"), None)
            if greeting:
                matches = [greeting]

        # ถ้า intent เป็น contact แต่ไม่เจอ match ให้ดึง contact chunk
        if intent == "contact" and len(matches) == 0:
            contact = next((c for c in self.chunks if c["id"] == "org_contact"), None)
            if contact:
                matches = [contact]

        return {"intent": intent, "matches": matches, "query": query}

    def extract_answer(self, query: str, intent: str) -> str:
        """สรุปคำตอบจาก chunks ที่ค้นหาได้"""
        matches = self.search_chunks(query)

        if not matches:
            return "ขออภัยครับ ฉันยังไม่พบข้อมูลที่ตรงกับคำถามนี้\n\nคุณสามารถติดต่อเราได้ที่:\n📞 โทร: 02 356 9999\n📧 อีเมล: contact@opdc.go.th\n🌐 เว็บไซต์: https://www.opdc.go.th/"

        texts = [m["text"] for m in matches]
        answer = "\n\n".join(texts)

        if intent == "contact" and "02 356 9999" not in answer:
            answer += "\n\n📞 โทร: 02 356 9999 | Fax: 02 356 9910"
        elif intent == "service":
            answer += "\n\n📋 หากต้องการขอใช้บริการ สามารถติดต่อผ่านช่องทางต่างๆ ได้ที่หน้า 'ติดต่อ ก.พ.ร.'"

        return answer


def main():
    engine = RAGEngine()
    print("=== Chatbot ก.พ.ร. (Demo Mode) ===")
    print("พิมพ์ 'quit' เพื่อออก\n")
    while True:
        query = input("ผู้ใช้: ").strip()
        if query.lower() in ("quit", "ออก", "bye", "ลา"):
            break
        result = engine.answer(query)
        answer = engine.extract_answer(query, result["intent"])
        print(f"\nคำตอบ ({result['intent']}): {answer}\n")


if __name__ == "__main__":
    main()
