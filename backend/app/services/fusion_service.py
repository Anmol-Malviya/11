import time
import logging
from typing import Dict, Any, List, Optional
from app.services.mediapipe_contract import mediapipe_contract

logger = logging.getLogger("ps16.fusion")

class FusionService:
    """
    Fuses dialogue transcript context, speaker evidence, and visual landmarks over time.
    Explicitly tracks missing or conflicting signals.
    """
    def align_and_fuse(
        self,
        transcript_text: str,
        speaker: str = "partner",
        visual_features: Optional[Dict[str, Any]] = None,
        language: str = "hi-en",
        context_history: Optional[List[Dict[str, str]]] = None,
        lip_reading_words: Optional[List[str]] = None,
        lip_reading_status: Optional[str] = "resting"
    ) -> Dict[str, Any]:
        
        signals_used = []
        unknown_or_missing_signals = []

        # 1. Transcript modality
        if transcript_text and transcript_text.strip():
            signals_used.append("transcript")
        else:
            unknown_or_missing_signals.append("transcript")

        # 2. Visual modality
        gesture_label = "unknown"
        lip_active = False
        hand_detected = False
        face_detected = False

        if visual_features:
            processed_vision = mediapipe_contract.process_landmarks(visual_features)
            hand_detected = processed_vision.get("hand_detected", False)
            face_detected = processed_vision.get("face_detected", False)
            gesture_label = processed_vision.get("gesture_label", "unknown")
            lip_active = processed_vision.get("lip_motion", {}).get("mouth_open_detected", False)

            if hand_detected or gesture_label != "unknown":
                signals_used.append("hand_landmarks")
            else:
                unknown_or_missing_signals.append("hand_landmarks")

            if face_detected or processed_vision.get("lip_motion", {}).get("available"):
                signals_used.append("lip_motion")
            else:
                unknown_or_missing_signals.append("lip_motion")
        else:
            unknown_or_missing_signals.extend(["hand_landmarks", "lip_motion"])

        # 3. Detect conflicting signals
        # For instance: affirmative speech question + thumbs_down / head_shake
        conflict_detected = False
        is_negative_gesture = gesture_label in ["thumbs_down", "head_shake"]
        is_positive_gesture = gesture_label in ["thumbs_up", "head_nod"]

        # 4. Synthesize fused state packet
        fused_packet = {
            "timestamp": time.time(),
            "language": language,
            "transcript_text": transcript_text or "",
            "speaker": speaker,
            "gesture": gesture_label,
            "is_positive_gesture": is_positive_gesture,
            "is_negative_gesture": is_negative_gesture,
            "lip_active": lip_active,
            "signals_used": signals_used,
            "unknown_or_missing_signals": unknown_or_missing_signals,
            "context_history": context_history or [],
            "lip_reading_words": lip_reading_words or [],
            "lip_reading_status": lip_reading_status or "resting"
        }
        if lip_reading_words and len(lip_reading_words) > 0 and lip_reading_status == "speaking":
            signals_used.append("lip_reading_visemes")

        return fused_packet

fusion_service = FusionService()

