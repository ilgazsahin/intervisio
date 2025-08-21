# Intervisio Backend

AI-powered interview coaching platform backend built with FastAPI.

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will start on `http://localhost:8000`

## API Endpoints

- `POST /upload_cv` - Upload and extract text from CV files (PDF/DOCX)
- `POST /generate_questions` - Generate interview questions from CV text
- `POST /transcribe_answer` - Transcribe audio answers to text
- `POST /start_interview` - Start a new interview session
- `POST /finish_interview` - Finish an interview session
- `GET /list_interviews` - List all interview sessions
- `GET /media/{session_id}/{filename}` - Access recorded audio files

## Features

- **CV Text Extraction**: Supports PDF and DOCX files
- **AI Question Generation**: Uses OpenAI API to generate personalized questions
- **Speech-to-Text**: Transcribes audio answers using faster-whisper
- **Session Management**: Tracks interview sessions and answers
- **File Storage**: Saves audio recordings and transcripts

## Dependencies

- **FastAPI**: Modern web framework for building APIs
- **OpenAI**: AI question generation
- **faster-whisper**: Speech-to-text transcription
- **PyMuPDF**: PDF text extraction
- **python-docx**: DOCX text extraction

## Notes

- Audio files are stored in `.webm` format
- Transcripts are saved as `.txt` files
- All files are organized by session ID
- No external ffmpeg installation required 