import uuid
from fastapi import APIRouter, HTTPException, status
from app.core.database import memory_db
from app.schemas.models import ConfirmationRequest, ConfirmationResponse

router = APIRouter(tags=["Confirmation Gate"])

@router.post("/sessions/{session_id}/confirmations", response_model=ConfirmationResponse)
async def handle_confirmation(session_id: str, payload: ConfirmationRequest):
    confirmation_id = f"conf_{uuid.uuid4().hex[:8]}"
    
    # Verify inference object exists
    inference = memory_db.inferences.get(payload.inference_id)
    if not inference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Inference candidate reference not found"}}
        )

    # Determine confirmed text based on action
    confirmed_text = None
    if payload.action == "confirm":
        # Match candidate ID
        if payload.edited_text and payload.edited_text.strip():
            confirmed_text = payload.edited_text.strip()
        else:
            for cand in inference.get("candidates", []):
                cand_dict = cand if isinstance(cand, dict) else cand.model_dump()
                if cand_dict.get("candidate_id") == payload.candidate_id:
                    confirmed_text = cand_dict.get("text")
                    break
        if not confirmed_text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected candidate text not found")
        status_code = "confirmed"

    elif payload.action == "edit":
        if not payload.edited_text or not payload.edited_text.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Edited text cannot be empty")
        confirmed_text = payload.edited_text.strip()
        status_code = "confirmed"

    elif payload.action in ["reject", "cancel"]:
        status_code = "cancelled"
        confirmed_text = None

    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid action '{payload.action}'")

    record = {
        "confirmation_id": confirmation_id,
        "session_id": session_id,
        "inference_id": payload.inference_id,
        "status": status_code,
        "confirmed_text": confirmed_text
    }
    memory_db.confirmations[confirmation_id] = record

    return ConfirmationResponse(
        confirmation_id=confirmation_id,
        status=status_code,
        confirmed_text=confirmed_text
    )

