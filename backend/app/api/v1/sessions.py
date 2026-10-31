from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from app.core.database import memory_db
from app.core.security import generate_opaque_id, verify_session_token
from app.schemas.models import SessionCreate, SessionUpdate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, token: str = Depends(verify_session_token)):
    session_id = generate_opaque_id("sess")
    now = datetime.now(timezone.utc).isoformat()
    session_data = {
        "session_id": session_id,
        "owner_id": token,
        "status": "active",
        "language": payload.language,
        "accessibility": payload.accessibility.model_dump(),
        "created_at": now,
        "started_at": now,
        "ended_at": None
    }
    memory_db.sessions[session_id] = session_data
    return SessionResponse(**session_data)

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, token: str = Depends(verify_session_token)):
    session = memory_db.sessions.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Session not found"}}
        )
    return SessionResponse(**session)

@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, payload: SessionUpdate, token: str = Depends(verify_session_token)):
    session = memory_db.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    if payload.language:
        if payload.language not in ["en", "hi", "hi-en"]:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported language code")
        session["language"] = payload.language
    if payload.accessibility:
        session["accessibility"] = payload.accessibility.model_dump()
        
    return SessionResponse(**session)

@router.post("/{session_id}/end")
async def end_session(session_id: str, token: str = Depends(verify_session_token)):
    session = memory_db.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    session["status"] = "ended"
    session["ended_at"] = datetime.now(timezone.utc).isoformat()
    return {"status": "ended", "ended_at": session["ended_at"]}

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, token: str = Depends(verify_session_token)):
    if session_id in memory_db.sessions:
        del memory_db.sessions[session_id]
    return None

