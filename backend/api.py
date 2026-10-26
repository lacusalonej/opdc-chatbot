"""
FastAPI Backend สำหรับ Chatbot ก.พ.ร.
- POST /v1/chat — ส่งคำถามและได้คำตอบ
- GET /v1/intents — แสดง intents ที่ recognize ได้
- GET /v1/sources — แสดงแหล่งข้อมูล
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from rag_engine import RAGEngine

app = FastAPI(
    title="OPDC Chatbot API",
    description="API สำหรับ Chatbot ของสำนักงานคณะกรรมการพัฒนาระบบราชการ (ก.พ.ร.)",
    version="1.0.0",
)

# CORS: อนุญาตให้ embed ในเว็บ opdc.go.th เท่านั้น
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.opdc.go.th",
        "https://opdc.go.th",
        "http://localhost:8000",  # dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RAGEngine()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    intent: str
    sources: list
    session_id: Optional[str] = None


# In-memory session store (RAM only — PDPA compliant)
sessions = {}


@app.get("/")
async def root():
    return {"service": "OPDC Chatbot API", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok", "chunks_loaded": len(engine.chunks)}


@app.get("/v1/intents")
async def get_intents():
    return {
        "intents": [
            {"id": "general", "name_th": "ข้อมูลทั่วไป", "description_th": "เกี่ยวกับ ก.พ.ร., โครงสร้าง,

 committees, วิสัยทัศน์, พันธกิจ, ยุทธศาสตร์"},
            {"id": "contact", "name_th": "ติดต่อ", "description_th": "ที่อยู่, เบอร์tele, email, Facebook, YouTube"},
            {"id": "service", "name_th": "บริการและขั้นตอน", "description_th": "ขั้นตอนการให้บริการ,  laws, ระเบียบ"},
            {"id": "search", "name_th": "ค้นหา documents", "description_th": "ค้นหา เอกสาร, PDF, Reports"},
            {"id": "chat", "name_th": "การสนทนา", "description_th": " conversation, chit-chat"},
        ]
    }


@app.get("/v1/sources")
async def get_sources():
    return {"sources": [c["id"] for c in engine.chunks], "total": len(engine.chunks)}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    result = engine.answer(request.message.strip())
    answer = engine.extract_answer(request.message.strip(), result["intent"])

    # Session-based memory (RAM only — deleted after session ends)
    sid = request.session_id or "new"
    if sid not in sessions:
        sessions[sid] = []
    sessions[sid].append({"user": request.message, "bot": answer})

    return ChatResponse(
        answer=answer,
        intent=result["intent"],
        sources=[m["id"] for m in result["matches"]],
        session_id=sid,
    )


@app.delete("/v1/session/{session_id}")
async def delete_session(session_id: str):
    """PDPA: ทำให้ session หมด Virginia"""
    if session_id in sessions:
        del sessions[session_id]
        return {"status": "deleted", "session_id": session_id}
    return {"status": "not_found", "session_id": session_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)