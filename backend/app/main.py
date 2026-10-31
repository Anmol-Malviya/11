from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db, close_db
from app.api.gestures_api import router as gestures_router
from app.api.v1 import (
    health,
    sessions,
    transcriptions,
    visual_features,
    inference,
    confirmations,
    speech,
    voices,
    voice_consents,
    preferences,
    quick_phrases,
    evaluations,
    websocket
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multimodal Live Conversation Assistant for People with Speech Impairments (PS16)",
    lifespan=lifespan
)

# CORS setup
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standardized Global Error Envelope
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred. Raw errors are sanitized for security."}}
    )

# Include Routers under /api and /api/v1
app.include_router(gestures_router, prefix="/api")
app.include_router(health.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(transcriptions.router, prefix="/api/v1")
app.include_router(visual_features.router, prefix="/api/v1")
app.include_router(inference.router, prefix="/api/v1")
app.include_router(confirmations.router, prefix="/api/v1")
app.include_router(speech.router, prefix="/api/v1")
app.include_router(voices.router, prefix="/api/v1")
app.include_router(voice_consents.router, prefix="/api/v1")
app.include_router(preferences.router, prefix="/api/v1")
app.include_router(quick_phrases.router, prefix="/api/v1")
app.include_router(evaluations.router, prefix="/api/v1")
app.include_router(websocket.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

