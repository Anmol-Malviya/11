import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from app.core.database import memory_db
from app.core.security import verify_session_token
from app.schemas.models import QuickPhraseCreate, QuickPhraseResponse

router = APIRouter(tags=["Quick Phrases"])

# Pre-populate default helpful phrases if empty
DEFAULT_PHRASES = [
    {"phrase_id": "qp_1", "text": "Yes, please.", "category": "General", "language": "en"},
    {"phrase_id": "qp_2", "text": "No, thank you.", "category": "General", "language": "en"},
    {"phrase_id": "qp_3", "text": "Haan, bilkul.", "category": "General", "language": "hi-en"},
    {"phrase_id": "qp_4", "text": "Mujhe paani chahiye.", "category": "Needs", "language": "hi-en"},
    {"phrase_id": "qp_5", "text": "Please give me a moment.", "category": "Assistance", "language": "en"},
    {"phrase_id": "qp_6", "text": "I am feeling comfortable.", "category": "Status", "language": "en"}
]

@router.get("/quick-phrases", response_model=List[QuickPhraseResponse])
async def list_quick_phrases(token: str = Depends(verify_session_token)):
    if not memory_db.user_phrases:
        for p in DEFAULT_PHRASES:
            memory_db.user_phrases[p["phrase_id"]] = p
    return [QuickPhraseResponse(**p) for p in memory_db.user_phrases.values()]

@router.post("/quick-phrases", response_model=QuickPhraseResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_phrase(payload: QuickPhraseCreate, token: str = Depends(verify_session_token)):
    phrase_id = f"qp_{uuid.uuid4().hex[:6]}"
    phrase = {
        "phrase_id": phrase_id,
        "text": payload.text,
        "category": payload.category,
        "language": payload.language
    }
    memory_db.user_phrases[phrase_id] = phrase
    return QuickPhraseResponse(**phrase)

@router.delete("/quick-phrases/{phrase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quick_phrase(phrase_id: str, token: str = Depends(verify_session_token)):
    if phrase_id in memory_db.user_phrases:
        del memory_db.user_phrases[phrase_id]
    return None

