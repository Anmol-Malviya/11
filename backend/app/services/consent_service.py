from datetime import datetime, timezone
import logging
from typing import Dict, Any, Optional
from app.core.database import memory_db

logger = logging.getLogger("ps16.consent")

class ConsentService:
    """
    Enforces explicit consent controls for voice cloning.
    Revocation immediately invalidates voice usage.
    """
    
    def create_consent(self, owner_id: str, voice_id: str, purpose: str, scope: str) -> Dict[str, Any]:
        consent_id = f"vc_{len(memory_db.voice_consents) + 1:03d}"
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "consent_id": consent_id,
            "owner_id": owner_id,
            "voice_id": voice_id,
            "purpose": purpose,
            "scope": scope,
            "status": "active",
            "granted_at": now,
            "revoked_at": None
        }
        memory_db.voice_consents[consent_id] = record
        logger.info(f"Recorded active consent {consent_id} for voice {voice_id}")
        return record

    def revoke_consent(self, consent_id: str) -> bool:
        if consent_id in memory_db.voice_consents:
            memory_db.voice_consents[consent_id]["status"] = "revoked"
            memory_db.voice_consents[consent_id]["revoked_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Revoked consent {consent_id}")
            return True
        return False

    def is_voice_consented(self, voice_id: str, owner_id: Optional[str] = None) -> bool:
        """
        Standard approved system voices do not require explicit cloning consent.
        Custom cloned voices strictly require an active, non-revoked consent record.
        """
        # Check if it is a standard built-in voice
        if voice_id in ["21m00Tcm4TlvDq8ikWAM", "AZnzlk1XvdvUeBnXmlld", "standard_default"]:
            return True
            
        # Check active consent record
        for consent in memory_db.voice_consents.values():
            if consent["voice_id"] == voice_id and consent["status"] == "active":
                return True
        return False

consent_service = ConsentService()

