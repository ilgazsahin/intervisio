import os
from pathlib import Path
from dotenv import load_dotenv
import openai
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz
import io
from docx import Document
from fastapi import UploadFile, File
from fastapi.responses import JSONResponse
import tempfile

from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import Body
import uuid
from fastapi.staticfiles import StaticFiles

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configure OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    print(f"[DEBUG] OPENAI_API_KEY loaded: {OPENAI_API_KEY[:6]}...{OPENAI_API_KEY[-4:]}")
    openai.api_key = OPENAI_API_KEY
else:
    print("[DEBUG] OPENAI_API_KEY not found in environment!")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Media directory for storing session files
MEDIA_DIR = Path(__file__).parent / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)

def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs)

class CVTextRequest(BaseModel):
    cv_text: str

def generate_questions_from_cv(cv_text: str) -> list:
    if not OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key not set in environment variable OPENAI_API_KEY")

    truncated_cv = (cv_text or "")[:2000]
    prompt = (
        "Based on the following CV, generate exactly 6 interview questions. Return only a JSON array of strings (no numbering, no extra text).\n\n"
        "Categories in order:\n"
        "1) leadership/responsibility\n"
        "2) teamwork\n"
        "3) problem-solving\n"
        "4) communication\n"
        "5) technical (tailored to CV)\n"
        "6) soft skills/adaptability\n\n"
        f"CV:\n{truncated_cv}\n"
    )

    try:
        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.7,
        )
        content = resp["choices"][0]["message"]["content"].strip()

        # Try parse JSON array of strings
        import json, re
        match = re.search(r"\[[\s\S]*\]", content)
        if match:
            try:
                arr = json.loads(match.group(0))
                if isinstance(arr, list):
                    # Ensure strings and trim
                    questions = [str(x).strip() for x in arr if str(x).strip()]
                    # Enforce exactly 6
                    while len(questions) < 6:
                        questions.append("Please elaborate on your experience in this area.")
                    return questions[:6]
            except Exception:
                pass

        # Fallback: split by lines
        lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
        questions = []
        for ln in lines:
            clean = ln.strip("-•. 1234567890")
            if len(clean) > 10:
                questions.append(clean)
        while len(questions) < 6:
            questions.append("Please elaborate on your experience in this area.")
        return questions[:6]

    except Exception as e:
        raise RuntimeError(f"OpenAI API error: {e}")

# Initialize Whisper model once (optional)
print("[INFO] Loading Whisper STT model (base)...")
stt_model = None
try:
    from faster_whisper import WhisperModel
    stt_model = WhisperModel("base", device="cuda" if os.environ.get("CUDA") else "cpu", compute_type="float16" if os.environ.get("CUDA") else "int8")
    print("[INFO] Whisper model loaded")
except ImportError:
    print("[WARNING] faster_whisper not installed. STT will not work. Install with: pip install faster-whisper")
except Exception as e:
    print(f"[ERROR] Whisper load failed: {e}")

# In-memory session store (ephemeral)
SESSIONS: Dict[str, Dict[str, Any]] = {}

@app.post("/start_interview")
def start_interview():
    session_id = str(uuid.uuid4())
    # create session folder
    session_dir = MEDIA_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    SESSIONS[session_id] = {
        "created_at": datetime.utcnow().isoformat(),
        "finished_at": None,
        "answers": {},
        "session_id": session_id
    }
    return {"session_id": session_id}

@app.post("/finish_interview")
def finish_interview(session_id: str = Body(..., embed=True)):
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess["finished_at"] = datetime.utcnow().isoformat()
    return {"ok": True}

@app.get("/list_interviews")
def list_interviews():
    items = [
        {
            "session_id": sid,
            "created_at": d["created_at"],
            "finished_at": d.get("finished_at"),
            "answer_count": len(d.get("answers", {})),
        }
        for sid, d in SESSIONS.items()
    ]
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return {"items": items}

@app.post("/upload_cv")
async def upload_cv(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        text = extract_text_from_pdf(contents)
    elif filename.endswith(".docx"):
        text = extract_text_from_docx(contents)
    else:
        text = "[Unsupported file type]"

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "extracted_text": text
    }

@app.post("/generate_questions")
def generate_questions(request: CVTextRequest):
    cv_text = request.cv_text
    if not cv_text or len(cv_text) < 20:
        raise HTTPException(status_code=400, detail="CV text is too short or missing.")
    try:
        questions = generate_questions_from_cv(cv_text)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe_answer")
async def transcribe_answer(file: UploadFile = File(...), session_id: Optional[str] = None, question_idx: Optional[int] = None):
    if stt_model is None:
        raise HTTPException(status_code=500, detail="STT model not initialized")

    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
            data = await file.read()
            tmp_in.write(data)
            tmp_in_path = tmp_in.name

        # Try to transcribe directly with faster-whisper (it supports webm)
        try:
            segments, info = stt_model.transcribe(tmp_in_path, language="en", vad_filter=True)
        except Exception as stt_error:
            print(f"Direct transcription failed: {stt_error}")
            # Fallback: try to transcribe as bytes
            segments, info = stt_model.transcribe(data, language="en", vad_filter=True)
        transcript_parts = [seg.text.strip() for seg in segments]
        transcript = " ".join(transcript_parts).strip()

        # Persist files under session directory if provided
        audio_url = None
        if session_id and question_idx is not None and session_id in SESSIONS:
            session_dir = MEDIA_DIR / session_id
            session_dir.mkdir(parents=True, exist_ok=True)
            qname = f"q{int(question_idx)}"
            # Save original audio
            final_audio_path = session_dir / f"{qname}.webm"
            with open(final_audio_path, "wb") as fout:
                with open(tmp_in_path, "rb") as fin:
                    fout.write(fin.read())
            # Save transcript
            (session_dir / f"{qname}.txt").write_text(transcript or "", encoding="utf-8")
            audio_url = f"/media/{session_id}/{qname}.webm"
            SESSIONS[session_id].setdefault("answers", {})[int(question_idx)] = {
                "transcript": transcript,
                "audio_url": audio_url,
            }

        try:
            os.remove(tmp_in_path)
        except Exception:
            pass

        return JSONResponse({"transcript": transcript, "audio_url": audio_url})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
