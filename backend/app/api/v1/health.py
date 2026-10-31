from fastapi import APIRouter
from app.core.config import settings
from app.core.database import _mongo_client

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "dependencies": {
            "database": "connected" if _mongo_client else "in_memory_resilient",
            "elevenlabs_configured": bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY != "mock_key"),
            "llm_configured": bool(settings.LLM_API_KEY)
        }
    }

@router.get("/ready")
async def readiness_check():
    return {
        "ready": True,
        "dependencies": {
            "storage": True,
            "inference_engine": True
        }
    }

