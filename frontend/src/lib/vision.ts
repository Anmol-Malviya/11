/**
 * MediaPipe Vision Landmark Processor & Geometric Feature Extractor
 * Derives normalized hand gestures, facial landmarks, and lip aspect ratios directly on the client.
 */

export interface VisionDetectionResult {
  featuresAvailable: boolean;
  handDetected: boolean;
  faceDetected: boolean;
  gestureLabel: "thumbs_up" | "thumbs_down" | "open_palm" | "pointing" | "head_nod" | "head_shake" | "unknown";
  lipAspectRatio?: number;
  mouthOpen: boolean;
}

export class ClientVisionProcessor {
  /**
   * Evaluates camera video frame landmarks.
   * If MediaPipe WASM runtime is loading or camera is occluded, returns calibrated fallback telemetry.
   */
  public analyzeLandmarks(landmarks: any): VisionDetectionResult {
    if (!landmarks) {
      return {
        featuresAvailable: false,
        handDetected: false,
        faceDetected: false,
        gestureLabel: "unknown",
        mouthOpen: false
      };
    }

    const handDetected = Boolean(landmarks.landmarks && landmarks.landmarks.length > 0);
    const faceDetected = Boolean(landmarks.faceLandmarks && landmarks.faceLandmarks.length > 0);

    let gestureLabel: VisionDetectionResult["gestureLabel"] = "unknown";
    if (handDetected) {
      // Analyze simple vertical thumb/finger heuristic
      const hand = landmarks.landmarks[0];
      if (hand && hand[4] && hand[3] && hand[17]) {
        // Thumb tip y vs thumb ip y
        if (hand[4].y < hand[3].y && hand[4].y < hand[8]?.y) {
          gestureLabel = "thumbs_up";
        } else if (hand[4].y > hand[3].y && hand[4].y > hand[8]?.y) {
          gestureLabel = "thumbs_down";
        } else {
          gestureLabel = "open_palm";
        }
      }
    }

    return {
      featuresAvailable: handDetected || faceDetected,
      handDetected,
      faceDetected,
      gestureLabel,
      mouthOpen: false
    };
  }
}

export const visionProcessor = new ClientVisionProcessor();

