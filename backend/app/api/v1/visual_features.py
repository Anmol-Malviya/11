from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, status
from app.core.database import memory_db
from app.schemas.models import VisualFeaturesPayload, VisualFeaturesResponse

router = APIRouter(tags=["Visual Features"])

@router.post("/visual-features", response_model=VisualFeaturesResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_visual_features(payload: VisualFeaturesPayload):
    feature_id = f"vf_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # Store normalized compact features
    memory_db.visual_features[feature_id] = {
        "feature_id": feature_id,
        "session_id": payload.session_id,
        "captured_at": payload.captured_at,
        "features": payload.features,
        "received_at": now
    }
    
    return VisualFeaturesResponse(
        feature_id=feature_id,
        accepted=True,
        received_at=now
    )

