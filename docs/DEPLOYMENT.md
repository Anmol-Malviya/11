# PS16 - Deployment Guide

## 1. Architecture Overview
- **Frontend**: Next.js 14+ (App Router) deployed on Vercel or Node.js hosting with HTTPS.
- **Backend**: FastAPI (Python 3.14) deployed on Render / Railway / Cloud Run with persistent environment variables.
- **Database**: MongoDB Atlas cloud cluster with IP allowlisting and least-privilege credentials.

---

## 2. Environment Variables

### 2.1 Backend (`backend/.env`)
```bash
PS16_APP_ENV=production
PS16_DEBUG=false
PS16_ALLOWED_ORIGINS=https://ps16-assistant.vercel.app,http://localhost:3000
PS16_SESSION_TOKEN_SECRET=your-32-character-secret-key-production
PS16_MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/ps16_assistive_ai?retryWrites=true&w=majority
PS16_MONGODB_DATABASE=ps16_assistive_ai
PS16_USE_MOCK_DB=false
PS16_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
PS16_LLM_API_KEY=your_gemini_or_llm_api_key_here
```

### 2.2 Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_BASE_URL=https://ps16-backend.onrender.com/api/v1
```

---

## 3. Local Development Commands

### Backend
```bash
cd backend
python -m venv venv
# On Windows
venv\Scripts\activate
# On Linux/macOS
source venv/bin/activate
pip install -r requirements.txt
python -m pytest tests -v
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Browser opens at http://localhost:3000
```

