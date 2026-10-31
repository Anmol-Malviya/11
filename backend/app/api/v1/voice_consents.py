from fastapi import APIRouter, HTTPException, Depends, status
from app.services.consent_service import consent_service
from app.core.security import verify_session_token
from app.schemas.models import VoiceConsentCreate, VoiceConsentResponse

router = APIRouter(tags=["Voice Consent"])

@router.post("/voice-consents", response_model=VoiceConsentResponse, status_code=status.HTTP_201_CREATED)
async def create_voice_consent(payload: VoiceConsentCreate, token: str = Depends(verify_session_token)):
    record = consent_service.create_consent(
        owner_id=token,
        voice_id=payload.voice_id,
        purpose=payload.purpose,
        scope=payload.scope
    )
    return VoiceConsentResponse(
        consent_id=record["consent_id"],
        status=record["status"],
        voice_id=record["voice_id"],
        granted_at=record["granted_at"],
        revoked_at=record["revoked_at"]
    )

@router.delete("/voice-consents/{consent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_voice_consent(consent_id: str, token: str = Depends(verify_session_token)):
    success = consent_service.revoke_consent(consent_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consent record not found")
    return None

