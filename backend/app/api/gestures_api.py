import time
import base64
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Request, status
from app.schemas.gestures_and_conversations import (
    HealthResponse,
    GesturesResponse,
    GesturePredictRequest,
    GesturePredictResponse,
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    PaginatedMessagesResponse
)
from app.services.gesture_model import get_gesture_model
from app.services.gesture_preprocessor import decode_image_from_bytes_or_base64, preprocess_frame_for_gesture
from app.services.conversation_service import ConversationService
from app.core.database import get_db

router = APIRouter(tags=["Gestures & Conversations"])

# 1. GET /api/health
@router.get("/health", response_model=HealthResponse)
async def get_health():
    model = get_gesture_model()
    db = get_db()
    db_connected = False
    if db is not None:
        try:
            await db.command("ping")
            db_connected = True
        except Exception:
            db_connected = False

    return HealthResponse(
        status="healthy",
        app_name="Multimodal Live Conversation Assistant (AI Manthan 2.0)",
        version="2.0.0",
        model_loaded=(model.model is not None or model.backend_type in ["keras", "onnx", "mock"]),
        model_backend=model.backend_type,
        database_connected=db_connected,
        classes_count=len(model.classes)
    )

# 2. GET /api/gestures
@router.get("/gestures", response_model=GesturesResponse)
async def get_supported_gestures():
    model = get_gesture_model()
    return GesturesResponse(
        classes=model.classes,
        default_phrases=model.default_phrases,
        input_shape=[100, 120, 1],
        color_mode="grayscale"
    )

# 3. POST /api/gesture/predict (accepts JSON body or multipart form file)
@router.post("/gesture/predict", response_model=GesturePredictResponse)
async def predict_gesture(
    request: Request,
    threshold: Optional[float] = Query(0.60, ge=0.0, le=1.0)
):
    start_time = time.time()
    image_bytes = None
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if file_obj is not None:
            image_bytes = await file_obj.read()
        thresh_param = form.get("threshold")
        if thresh_param is not None:
            try:
                threshold = float(thresh_param)
            except ValueError:
                pass
    else:
        try:
            body = await request.json()
            if isinstance(body, dict):
                b64_val = body.get("image_base64")
                if b64_val:
                    image_bytes = b64_val.encode("utf-8")
                if "confidence_threshold" in body and body["confidence_threshold"] is not None:
                    threshold = float(body["confidence_threshold"])
        except Exception:
            pass

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Missing image data. Provide 'image_base64' in JSON body or 'file' in multipart form."
        )

    if len(image_bytes) > 7 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Payload too large. Maximum frame size is 5MB.")

    # Decode and Preprocess using notebook specifications
    try:
        raw_image = decode_image_from_bytes_or_base64(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image decoding failed: {str(e)}")

    processed_tensor = preprocess_frame_for_gesture(raw_image)

    # Model inference
    model = get_gesture_model()
    pred_label, confidence, probs = model.predict(processed_tensor)
    mapped_phrase = model.get_phrase_for_gesture(pred_label)

    is_reliable = confidence >= threshold and pred_label != "blank"
    elapsed_ms = (time.time() - start_time) * 1000.0

    return GesturePredictResponse(
        predicted_gesture=pred_label,
        confidence=round(confidence, 4),
        mapped_phrase=mapped_phrase if is_reliable else "",
        is_reliable=is_reliable,
        probabilities={k: round(v, 4) for k, v in probs.items()},
        processing_time_ms=round(elapsed_ms, 2)
    )

# 4. POST /api/conversations
@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(conv_in: ConversationCreate):
    conv = await ConversationService.create_conversation(
        title=conv_in.title or "New Conversation",
        partner_name=conv_in.partner_name or "Partner"
    )
    return ConversationResponse(**conv)

# 5. GET /api/conversations
@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations():
    convs = await ConversationService.list_conversations()
    return [ConversationResponse(**c) for c in convs]

# 6. GET /api/conversations/{conversation_id}/messages
@router.get("/conversations/{conversation_id}/messages", response_model=PaginatedMessagesResponse)
async def get_conversation_messages(
    conversation_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    conv = await ConversationService.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    result = await ConversationService.get_messages(conversation_id, page=page, page_size=page_size)
    return PaginatedMessagesResponse(
        conversation_id=result["conversation_id"],
        total_messages=result["total_messages"],
        page=result["page"],
        page_size=result["page_size"],
        messages=[MessageResponse(**m) for m in result["messages"]]
    )

# 7. POST /api/conversations/{conversation_id}/messages
@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def post_conversation_message(
    conversation_id: str,
    msg_in: MessageCreate
):
    conv = await ConversationService.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    msg = await ConversationService.add_message(
        conv_id=conversation_id,
        text=msg_in.text,
        speaker=msg_in.speaker,
        modality=msg_in.modality,
        gesture_label=msg_in.gesture_label,
        confidence=msg_in.confidence
    )
    return MessageResponse(**msg)

# 8. DELETE /api/conversations/{conversation_id}
@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(conversation_id: str):
    conv = await ConversationService.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    deleted = await ConversationService.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete conversation.")
    return {"message": "Conversation and associated messages deleted successfully."}
