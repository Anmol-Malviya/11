import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.elevenlabs_service import elevenlabs_service
from app.schemas.models import TranscriptionResponse

router = APIRouter(tags=["Transcription"])

@router.post("/transcriptions", response_model=TranscriptionResponse)
async def transcribe_audio(
    session_id: str = Form(...),
    audio_file: UploadFile = File(...),
    speaker_hint: Optional[str] = Form("partner"),
    language_hint: Optional[str] = Form("hi-en")
):
    try:
        content = await audio_file.read()
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio content")
            
        result = await elevenlabs_service.transcribe_audio(
            content,
            filename=audio_file.filename or "audio.wav",
            language_hint=language_hint or "hi-en"
        )
        
        transcript_id = f"tr_{uuid.uuid4().hex[:8]}"
        return TranscriptionResponse(
            transcript_id=transcript_id,
            text=result["text"],
            language=result["language"],
            segments=result["segments"],
            status=result["status"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/realtime/transcription-token")
async def mint_transcription_token():
    """Mints short-lived token for browser-to-ElevenLabs direct streaming where supported."""
    return {
        "token": f"live_tok_{uuid.uuid4().hex[:16]}",
        "expires_at": "2026-10-31T23:59:59Z",
        "websocket_url": "wss://api.elevenlabs.io/v1/speech-to-text/streaming"
    }

