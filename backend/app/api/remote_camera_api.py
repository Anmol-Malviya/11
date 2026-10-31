import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
import logging

logger = logging.getLogger("ps16.remote_stream")
router = APIRouter(tags=["Remote Camera Token Store"])

# In-memory store for remote frames & pairing tokens
# { token: { "laptop_active": True, "phone_active": True, "last_frame": b64, "prediction": dict, "updated_at": float } }
token_sessions: Dict[str, Dict[str, Any]] = {}

class FrameUploadRequest(BaseModel):
    image: str
    prediction: Optional[Dict[str, Any]] = None

@router.post("/api/remote-camera/session/{token}/register")
async def register_session(token: str, role: str = Query("laptop")):
    now = time.time()
    if token not in token_sessions:
        token_sessions[token] = {
            "created_at": now,
            "laptop_active": False,
            "phone_active": False,
            "last_frame": None,
            "prediction": None,
            "updated_at": now
        }
    
    if role == "laptop":
        token_sessions[token]["laptop_active"] = True
    elif role == "phone":
        token_sessions[token]["phone_active"] = True
    
    token_sessions[token]["updated_at"] = now
    return {"status": "ok", "token": token, "role": role}

@router.post("/api/remote-camera/session/{token}/frame")
async def post_frame(token: str, body: FrameUploadRequest):
    if token not in token_sessions:
        token_sessions[token] = {
            "created_at": time.time(),
            "laptop_active": False,
            "phone_active": True,
            "last_frame": None,
            "prediction": None,
            "updated_at": time.time()
        }
    
    token_sessions[token]["last_frame"] = body.image
    token_sessions[token]["prediction"] = body.prediction
    token_sessions[token]["phone_active"] = True
    token_sessions[token]["updated_at"] = time.time()
    return {"status": "received"}

@router.get("/api/remote-camera/session/{token}/poll")
async def poll_frame(token: str):
    sess = token_sessions.get(token)
    if not sess:
        return {
            "phone_connected": False,
            "image": None,
            "prediction": None
        }

    now = time.time()
    # If phone posted within last 6 seconds, consider phone connected
    phone_alive = sess.get("phone_active", False) and (now - sess.get("updated_at", 0) < 6.0)

    return {
        "phone_connected": phone_alive,
        "image": sess.get("last_frame"),
        "prediction": sess.get("prediction")
    }
