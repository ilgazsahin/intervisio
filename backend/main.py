import os
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz
import io
from docx import Document

# Load .env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing in .env")
genai.configure(api_key=api_key)

# List available models (for debugging)
for m in genai.list_models():
    print("[DEBUG] Gemini model available:", m.name)


# FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class CVTextRequest(BaseModel):
    cv_text: str

# CV Text Extractors
def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)

def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs)

# Gemini Question Generator
def generate_questions_from_cv(cv_text: str) -> list:
    model = genai.GenerativeModel('models/gemini-1.5-flash-latest')
    prompt = (
        "Aşağıdaki CV'ye göre 5 Türkçe mülakat sorusu ve 1 İngilizce soru üret. "
        "Sadece soruları madde madde olarak döndür.\n\n"
        f"CV:\n{cv_text}\n\nSorular:"
    )
    response = model.generate_content(prompt)
    content = response.text.strip()
    return [line.strip('-•. 1234567890') for line in content.split('\n') if line.strip()]

# Upload Route
@app.post("/upload_cv")
async def upload_cv(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        text = extract_text_from_pdf(contents)
    elif filename.endswith(".docx"):
        text = extract_text_from_docx(contents)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "extracted_text": text
    }

# Generate Questions Route
@app.post("/generate_questions")
def generate_questions(request: CVTextRequest):
    if not request.cv_text or len(request.cv_text) < 20:
        raise HTTPException(status_code=400, detail="CV text is too short or missing.")
    try:
        questions = generate_questions_from_cv(request.cv_text)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
