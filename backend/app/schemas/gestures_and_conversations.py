from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Health Schema
class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    model_loaded: bool
    model_backend: str
    database_connected: bool
    classes_count: int

# Gestures Schema
class GesturesResponse(BaseModel):
    classes: List[str]
    default_phrases: Dict[str, str]
    input_shape: List[int]
    color_mode: str

# Gesture Prediction Schemas
class GesturePredictRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded JPEG or PNG image")
    confidence_threshold: Optional[float] = Field(0.60, ge=0.0, le=1.0, description="Minimum confidence threshold")

class GesturePredictResponse(BaseModel):
    predicted_gesture: str
    confidence: float
    mapped_phrase: str
    is_reliable: bool
    probabilities: Dict[str, float]
    processing_time_ms: float

# Message & Conversation Schemas
class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    speaker: str = Field("user", description="'user' (speech impaired user) or 'partner' (conversation partner)")
    modality: str = Field("gesture", description="'gesture', 'speech_to_text', 'typed', or 'quick_phrase'")
    gesture_label: Optional[str] = None
    confidence: Optional[float] = None

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    text: str
    speaker: str
    modality: str
    gesture_label: Optional[str] = None
    confidence: Optional[float] = None
    created_at: str

class ConversationCreate(BaseModel):
    title: Optional[str] = Field("New Conversation", max_length=100)
    partner_name: Optional[str] = Field("Partner", max_length=100)

class ConversationResponse(BaseModel):
    id: str
    title: str
    partner_name: str
    created_at: str
    message_count: int = 0

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []

class PaginatedMessagesResponse(BaseModel):
    conversation_id: str
    total_messages: int
    page: int
    page_size: int
    messages: List[MessageResponse]

