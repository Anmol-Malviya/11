import math
from typing import Dict, Any, List, Optional

class MediaPipeContractService:
    """
    Interprets client-side MediaPipe landmark streams.
    Does NOT claim landmark detection alone proves emotion or complete sign language.
    Produces calibrated geometric features, flags occlusions, and classifies validated gestures.
    """
    
    SUPPORTED_GESTURES = {
        "thumbs_up": "Affirmative agreement / approval",
        "thumbs_down": "Negative / disapproval",
        "open_palm": "Stop / wait / need assistance",
        "pointing": "Directional reference / selection",
        "head_nod": "Affirmative head movement",
        "head_shake": "Negative head movement",
        "unknown": "Unclassified or natural resting pose"
    }

    def process_landmarks(self, landmarks_dict: Dict[str, Any]) -> Dict[str, Any]:
        hand_landmarks = landmarks_dict.get("hand_landmarks", [])
        face_landmarks = landmarks_dict.get("face_landmarks", [])
        lip_features = landmarks_dict.get("lip_motion_features", {})
        client_gesture = landmarks_dict.get("gesture_label", "unknown")

        features_available = bool(hand_landmarks or face_landmarks or lip_features.get("available"))
        
        # Calculate lip aspect ratio if face landmarks available
        # MediaPipe lip landmarks typically: 13 (upper lip inner), 14 (lower lip inner), 78 (left corner), 308 (right corner)
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

        # Validate or map gesture
        validated_gesture = client_gesture if client_gesture in self.SUPPORTED_GESTURES else "unknown"

        return {
            "features_available": features_available,
            "hand_detected": bool(hand_landmarks),
            "face_detected": bool(face_landmarks),
            "gesture_label": validated_gesture,
            "gesture_description": self.SUPPORTED_GESTURES.get(validated_gesture, "Unknown"),
            "lip_motion": {
                "available": lip_aspect_ratio is not None,
                "lip_aspect_ratio": lip_aspect_ratio,
                "mouth_open_detected": mouth_open
            }
        }

mediapipe_contract = MediaPipeContractService()

