# # Intervisio

Intervisio is an AI-powered video interview SaaS platform. It analyzes a user’s CV to generate personalized interview questions, asks them via voice, and evaluates the user’s video-recorded responses to provide feedback and scores. The platform is designed to help job seekers practice and improve their interview skills.

## Features
- CV upload and automatic text extraction (PDF/DOCX)
- AI-powered question generation (Turkish & English)
- Modern Next.js frontend
- Gemini (Google Generative AI) backend integration

---

## Project Structure

```
intervisio/
  backend/      # FastAPI backend (Gemini integration)
  frontend/     # Next.js frontend (React)
```

---

## Setup Instructions

### 1. Clone the Repository
```sh
git clone <repo-url>
cd intervisio
```

### 2. Backend Setup (FastAPI + Gemini)

#### a. Install Python dependencies
```sh
cd backend
pip install -r requirements.txt
```

#### b. Create a `.env` file in the `backend/` directory:
```
GEMINI_API_KEY=your-gemini-api-key-here
```
- Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) or your Google Cloud Console.


#### d. Run the backend server
```sh
uvicorn main:app --reload
```
- The backend will be available at `http://localhost:8000`

---

### 3. Frontend Setup (Next.js)

#### a. Install Node.js dependencies
```sh
cd ../frontend
npm install
```

#### b. Run the frontend
```sh
npm run dev
```
- The frontend will be available at `http://localhost:3000`

---

## Usage
1. Go to `http://localhost:3000/upload` in your browser.
2. Upload your CV (PDF or DOCX).
3. The app will extract text, generate questions using Gemini, and display them.

