from fastapi import APIRouter, status
from app.services.metrics_service import metrics_service
from app.schemas.models import EvaluationEventCreate

router = APIRouter(tags=["Evaluation Telemetry"])

@router.post("/evaluations/events", status_code=status.HTTP_202_ACCEPTED)
async def record_evaluation_event(payload: EvaluationEventCreate):
    event = metrics_service.record_event(payload.model_dump())
    return {"event_id": f"ev_{payload.test_run_id}", "accepted": True}

@router.get("/evaluations/metrics")
async def get_evaluation_metrics():
    return metrics_service.compute_summary()

