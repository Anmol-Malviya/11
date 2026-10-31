from typing import List
from fastapi import APIRouter
from app.services.elevenlabs_service import elevenlabs_service
from app.schemas.models import VoiceOption

router = APIRouter(tags=["Voices"])

@router.get("/voices", response_model=List[VoiceOption])
async def list_available_voices():
    voices = elevenlabs_service.list_voices()
    return [VoiceOption(**v) for v in voices]

