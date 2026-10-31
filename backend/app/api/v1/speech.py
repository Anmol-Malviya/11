from fastapi import APIRouter, HTTPException, Response, status
from app.core.database import memory_db
from app.services.elevenlabs_service import elevenlabs_service
from app.services.consent_service import consent_service
from app.schemas.models import SpeechRequest

router = APIRouter(tags=["Speech Generation"])

@router.post("/speech")
async def generate_speech(payload: SpeechRequest):
    # 1. Require verified confirmation
    confirmation = memory_db.confirmations.get(payload.confirmation_id)
    if not confirmation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "CONFIRMATION_NOT_FOUND", "message": "Confirmation ID not found"}}
        )

    if confirmation.get("status") != "confirmed" or not confirmation.get("confirmed_text"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "ACTION_NOT_CONFIRMED", "message": "Speech generation is blocked for unconfirmed, rejected, or cancelled actions"}}
        )

    confirmed_text = confirmation["confirmed_text"]

    # 2. Enforce Voice Cloning Consent Check (SRC-07 / FR-013)
    target_voice_id = payload.voice_id or "21m00Tcm4TlvDq8ikWAM"
    if payload.voice_mode == "cloned":
        has_consent = consent_service.is_voice_consented(target_voice_id)
        if not has_consent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "CONSENT_REQUIRED", "message": "Voice cloning consent is absent or revoked for this voice ID"}}
            )

    # 3. Generate Speech via ElevenLabs
    try:
        audio_bytes = await elevenlabs_service.generate_speech(
            text=confirmed_text,
            voice_id=target_voice_id
        )
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "X-Confirmation-ID": payload.confirmation_id
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "SPEECH_GENERATION_FAILED", "message": f"TTS synthesis failed: {str(e)}"}}
        )

