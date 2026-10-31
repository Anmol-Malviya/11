from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, HTTPException, status
from app.core.database import memory_db
from app.services.fusion_service import fusion_service
from app.services.intent_service import intent_service
from app.schemas.models import InferenceRequest, InferenceResponse

router = APIRouter(tags=["Inference & Multimodal Fusion"])

@router.post("/inference", response_model=InferenceResponse)
async def run_multimodal_inference(payload: InferenceRequest):
    inference_id = f"inf_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Retrieve transcript text if provided via ID or raw
    transcript_text = payload.raw_transcript_text or ""
    if not transcript_text and payload.transcript_ids:
        # Check in memory transcriptions
        for tid in payload.transcript_ids:
            if tid in memory_db.transcriptions:
                transcript_text = memory_db.transcriptions[tid].get("text", "")
                break
                
    # 2. Retrieve visual features if provided
    visual_features = {}
    if payload.detected_gesture:
        visual_features["gesture_label"] = payload.detected_gesture
    if payload.lip_active is not None:
        visual_features["lip_motion_features"] = {
            "available": True,
            "mouth_open_detected": payload.lip_active,
            "lip_aspect_ratio": 0.42 if payload.lip_active else 0.20
        }
    if payload.visual_feature_ids:
        for vid in payload.visual_feature_ids:
            if vid in memory_db.visual_features:
                visual_features.update(memory_db.visual_features[vid].get("features", {}))
                break

    # 3. Fuse multimodal streams
    fused_state = fusion_service.align_and_fuse(
        transcript_text=transcript_text,
        visual_features=visual_features,
        language=payload.language or "hi-en"
    )

    # 4. Rank intent candidates via LLM/rules
    result = await intent_service.rank_candidates(
        fused_state=fused_state,
        language=payload.language or "hi-en"
    )

    response_data = {
        "inference_id": inference_id,
        "needs_clarification": result["needs_clarification"],
        "candidates": result["candidates"],
        "signals_used": result["signals_used"],
        "unknown_or_missing_signals": fused_state["unknown_or_missing_signals"],
        "created_at": now
    }

    # Store for session retrieval
    memory_db.inferences[inference_id] = response_data
    return InferenceResponse(**response_data)

@router.get("/inference/{inference_id}", response_model=InferenceResponse)
async def get_inference(inference_id: str):
    res = memory_db.inferences.get(inference_id)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inference result not found")
    return InferenceResponse(**res)

