import uuid
import hmac
import hashlib
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import settings

def generate_opaque_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def verify_session_token(x_session_token: Optional[str] = Header(None)) -> str:
    """Validate opaque session token or return default session id for demo"""
    if not x_session_token:
        # In prototype/demo mode, generate or accept a transient demo token
        return "sess_demo_default"
    if len(x_session_token) < 4:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Session token is invalid or malformed"}}
        )
    return x_session_token

