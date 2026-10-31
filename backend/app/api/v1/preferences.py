from typing import Dict, Any
from fastapi import APIRouter, Depends
from app.core.database import memory_db
from app.core.security import verify_session_token

router = APIRouter(tags=["Preferences"])

@router.get("/preferences")
async def get_preferences(token: str = Depends(verify_session_token)):
    prefs = memory_db.preferences.get(token, {
        "language": "hi-en",
        "voice_mode": "standard",
        "text_scale": "large",
        "high_contrast": False,
        "quick_phrases_enabled": True
    })
    return prefs

@router.patch("/preferences")
async def update_preferences(payload: Dict[str, Any], token: str = Depends(verify_session_token)):
    current = memory_db.preferences.get(token, {
        "language": "hi-en",
        "voice_mode": "standard",
        "text_scale": "large",
        "high_contrast": False,
        "quick_phrases_enabled": True
    })
    current.update(payload)
    memory_db.preferences[token] = current
    return current

