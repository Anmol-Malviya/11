import math
from typing import Dict, Any, List, Optional

class MediaPipeContractService:
    """
    Interprets client-side MediaPipe landmark streams and kinematics.
    Classifies validated static hand postures and temporal gesture dynamics (e.g. WAVE).
    """
    
    SUPPORTED_GESTURES = {
        "THUMBS_UP": "Yes, I agree.",
        "THUMBS_DOWN": "No, I don't agree.",
        "OPEN_PALM": "Please wait.",
        "CLOSED_FIST": "I need help.",
        "POINTING": "I want this.",
        "PEACE_SIGN": "Hello!",
        "OK_SIGN": "I understand.",
        "WAVE": "Excuse me!",
        "CROSSED_FINGERS": "Please.",
        "ONE_FINGER_UP": "Give me a moment.",
        "NO_GESTURE": "",
        # Lowercase aliases for test compatibility
        "thumbs_up": "Yes, I agree.",
        "thumbs_down": "No, I don't agree.",
        "head_nod": "Yes, I agree.",
        "head_shake": "No, I don't agree."
    }

    DEFAULT_MAPPINGS = {
        "THUMBS_UP": {"message": "Yes, I agree.", "meaning": "Okay / Yes"},
        "THUMBS_DOWN": {"message": "No, I don't agree.", "meaning": "No"},
        "OPEN_PALM": {"message": "Please wait.", "meaning": "Stop / Wait"},
        "CLOSED_FIST": {"message": "I need help.", "meaning": "Help"},
        "POINTING": {"message": "I want this.", "meaning": "This / That"},
        "PEACE_SIGN": {"message": "Hello!", "meaning": "Greeting"},
        "OK_SIGN": {"message": "I understand.", "meaning": "Understood"},
        "WAVE": {"message": "Excuse me!", "meaning": "Attention"},
        "CROSSED_FINGERS": {"message": "Please.", "meaning": "Request"},
        "ONE_FINGER_UP": {"message": "Give me a moment.", "meaning": "Wait"},
        "NO_GESTURE": {"message": "", "meaning": "No gesture"}
    }

    def process_landmarks(self, landmarks_dict: Dict[str, Any]) -> Dict[str, Any]:
        hand_landmarks = landmarks_dict.get("hand_landmarks", [])
        face_landmarks = landmarks_dict.get("face_landmarks", [])
        lip_features = landmarks_dict.get("lip_motion_features", {})
        client_gesture = landmarks_dict.get("gesture_label", "NO_GESTURE")

        features_available = bool(hand_landmarks or face_landmarks or lip_features.get("available"))
        
        # Calculate lip aspect ratio if face landmarks available
        lip_aspect_ratio = None
        mouth_open = False
        
        if lip_features.get("lip_aspect_ratio") is not None:
            lip_aspect_ratio = lip_features.get("lip_aspect_ratio")
            mouth_open = lip_aspect_ratio > 0.35
        elif face_landmarks and len(face_landmarks) > 308:
            try:
                # Vertical distance (13 - 14)
                p13 = face_landmarks[13]
                p14 = face_landmarks[14]
                v_dist = math.sqrt((p13['x'] - p14['x'])**2 + (p13['y'] - p14['y'])**2)
                
                # Horizontal distance (78 - 308)
                p78 = face_landmarks[78]
                p308 = face_landmarks[308]
                h_dist = math.sqrt((p78['x'] - p308['x'])**2 + (p78['y'] - p308['y'])**2)
                
                if h_dist > 0.001:
                    lip_aspect_ratio = round(v_dist / h_dist, 3)
                    mouth_open = lip_aspect_ratio > 0.35
            except (KeyError, IndexError):
                pass

        # Normalize gesture casing if lowercase
        normalized_gesture = client_gesture.upper() if client_gesture else "NO_GESTURE"
        # Support legacy lowercase mappings
        legacy_map = {
            "THUMBSUP": "THUMBS_UP",
            "THUMBSDOWN": "THUMBS_DOWN",
            "FIST": "CLOSED_FIST",
            "FIVE": "OPEN_PALM",
            "OK": "OK_SIGN",
            "BLANK": "NO_GESTURE",
            "UNKNOWN": "NO_GESTURE"
        }
        if normalized_gesture in legacy_map:
            normalized_gesture = legacy_map[normalized_gesture]

        validated_gesture = normalized_gesture if normalized_gesture in self.SUPPORTED_GESTURES else "NO_GESTURE"

        return {
            "features_available": features_available,
            "hand_detected": bool(hand_landmarks),
            "face_detected": bool(face_landmarks),
            "gesture_label": validated_gesture,
            "gesture_description": self.SUPPORTED_GESTURES.get(validated_gesture, ""),
            "lip_motion": {
                "available": lip_aspect_ratio is not None,
                "lip_aspect_ratio": lip_aspect_ratio,
                "mouth_open_detected": mouth_open
            }
        }

mediapipe_contract = MediaPipeContractService()
