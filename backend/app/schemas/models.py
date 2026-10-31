from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class AccessibilitySettings(BaseModel):
    text_scale: str = Field(default="normal", description="normal, large, extra-large")
    high_contrast: bool = False
    reduced_motion: bool = False

class SessionCreate(BaseModel):
    language: str = Field(default="hi-en", description="'en', 'hi', or 'hi-en'")
    mode: str = Field(default="live_conversation")
    accessibility: AccessibilitySettings = Field(default_factory=AccessibilitySettings)

class SessionUpdate(BaseModel):
    language: Optional[str] = None
    voice_mode: Optional[str] = None
    accessibility: Optional[AccessibilitySettings] = None

class SessionResponse(BaseModel):
    session_id: str
    status: str  # "created", "active", "ended"
    language: str
    created_at: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    accessibility: AccessibilitySettings

# Transcription Schemas
class TranscriptSegment(BaseModel):
    start_ms: int = 0
    end_ms: int = 0
    text: str
    speaker: str = "partner"  # "partner", "patient", "unknown"
    is_final: bool = True
    confidence: Optional[float] = 0.95

class TranscriptionResponse(BaseModel):
    transcript_id: str
    text: str
    language: str
    segments: List[TranscriptSegment]
    status: str

# Visual Landmark & Feature Schemas
class LipMotionFeatures(BaseModel):
    available: bool = False
    lip_aspect_ratio: Optional[float] = None
    mouth_open_detected: bool = False
    values: List[float] = []

class VisualFeaturesPayload(BaseModel):
    session_id: str
    captured_at: str
    frame_window_ms: int = 500
    features: Dict[str, Any]
    processing_location: str = "client"

class VisualFeaturesResponse(BaseModel):
    feature_id: str
    accepted: bool
    received_at: str

# Inference & Candidate Schemas
class CandidateReply(BaseModel):
    candidate_id: str
    text: str
    reason: str
    confidence: float

class InferenceRequest(BaseModel):
    session_id: str
    transcript_ids: Optional[List[str]] = None
    visual_feature_ids: Optional[List[str]] = None
    context_window_seconds: int = 20
    language: Optional[str] = "hi-en"
    raw_transcript_text: Optional[str] = None
    detected_gesture: Optional[str] = None
    lip_active: Optional[bool] = None

class InferenceResponse(BaseModel):
    inference_id: str
    needs_clarification: bool
    candidates: List[CandidateReply]
    signals_used: List[str]
    created_at: str
    unknown_or_missing_signals: List[str] = []

# Confirmation Schemas
class ConfirmationRequest(BaseModel):
    inference_id: str
    candidate_id: Optional[str] = None
    action: str = Field(description="'confirm', 'edit', 'reject', 'cancel'")
    edited_text: Optional[str] = None

class ConfirmationResponse(BaseModel):
    confirmation_id: str
    status: str  # "confirmed", "rejected", "cancelled"
    confirmed_text: Optional[str] = None

# Speech Schemas
class SpeechRequest(BaseModel):
    session_id: str
    confirmation_id: str
    voice_mode: str = "standard"  # "standard", "cloned", "voice_design"
    voice_id: Optional[str] = None
    output_format: str = "mp3"

# Voice & Consent Schemas
class VoiceOption(BaseModel):
    voice_id: str
    label: str
    mode: str  # "standard", "cloned"
    language_support: List[str]

class VoiceConsentCreate(BaseModel):
    voice_id: str
    purpose: str = "Speak user-confirmed conversation replies"
    consent_version: str = "v1"
    scope: str = "voice_cloning_and_generation"
    recording_reference: Optional[str] = None

class VoiceConsentResponse(BaseModel):
    consent_id: str
    status: str  # "active", "revoked"
    voice_id: str
    granted_at: str
    revoked_at: Optional[str] = None

# Quick Phrases Schemas
class QuickPhraseCreate(BaseModel):
    text: str
    category: str = "General"
    language: str = "hi-en"

class QuickPhraseResponse(BaseModel):
    phrase_id: str
    text: str
    category: str
    language: str

# Evaluation Schemas
class EvaluationEventCreate(BaseModel):
    test_run_id: str
    scenario_id: str
    mode: str  # "audio_only", "audio_plus_gesture", "audio_plus_gesture_plus_lip"
    wer: Optional[float] = None
    intent_top1: Optional[float] = None
    intent_top3: Optional[float] = None
    latency_ms: Dict[str, float] = {}  # e.g. {"p50": 1200, "p95": 1780}
    confirmation_actions: int = 1

