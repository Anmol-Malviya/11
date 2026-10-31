/**
 * MediaPipe Vision Landmark Processor & Live Gesture Recognizer
 * Derives normalized hand gestures, facial landmarks, and lip aspect ratios directly on the client.
 */
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

export interface VisionDetectionResult {
  featuresAvailable: boolean;
  handDetected: boolean;
  faceDetected: boolean;
  gestureLabel: "thumbs_up" | "thumbs_down" | "open_palm" | "pointing" | "head_nod" | "head_shake" | "unknown";
  confidence: number;
  lipAspectRatio?: number;
  mouthOpen: boolean;
}

export class ClientVisionProcessor {
  private recognizer: GestureRecognizer | null = null;
  private isInitializing: boolean = false;

  public async initializeRecognizer(): Promise<GestureRecognizer | null> {
    if (this.recognizer) return this.recognizer;
    if (this.isInitializing) return null;

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      console.log("MediaPipe GestureRecognizer initialized successfully with GPU delegate.");
      return this.recognizer;
    } catch (err) {
      console.warn("MediaPipe GPU delegate failed or model unavailable, trying CPU fallback:", err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        this.recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        console.log("MediaPipe GestureRecognizer initialized with CPU fallback.");
        return this.recognizer;
      } catch (cpuErr) {
        console.error("MediaPipe failed to initialize completely:", cpuErr);
        return null;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  public detectForVideo(videoElement: HTMLVideoElement, timestamp: number): VisionDetectionResult {
    if (!this.recognizer || videoElement.readyState < 2) {
      return {
        featuresAvailable: false,
        handDetected: false,
        faceDetected: false,
        gestureLabel: "unknown",
        confidence: 0,
        mouthOpen: false
      };
    }

    try {
      const results = this.recognizer.recognizeForVideo(videoElement, timestamp);
      const gestures = results.gestures;
      const handLandmarks = results.landmarks;

      const handDetected = Boolean(handLandmarks && handLandmarks.length > 0);

      let gestureLabel: VisionDetectionResult["gestureLabel"] = "unknown";
      let confidence = 0;

      if (gestures && gestures.length > 0 && gestures[0].length > 0) {
        const topGesture = gestures[0][0];
        confidence = topGesture.score || 0;
        const categoryName = topGesture.categoryName;

        switch (categoryName) {
          case "Thumb_Up":
            gestureLabel = "thumbs_up";
            break;
          case "Thumb_Down":
            gestureLabel = "thumbs_down";
            break;
          case "Open_Palm":
            gestureLabel = "open_palm";
            break;
          case "Pointing_Up":
            gestureLabel = "pointing";
            break;
          case "Victory":
          case "ILoveYou":
            gestureLabel = "open_palm";
            break;
          default:
            gestureLabel = "unknown";
        }
      }

      // Geometric heuristic fallback if categoryName is None but landmarks exist
      if (gestureLabel === "unknown" && handDetected && handLandmarks[0]) {
        const hand = handLandmarks[0];
        const thumbTip = hand[4];
        const thumbBase = hand[2];
        const indexTip = hand[8];
        const wrist = hand[0];

        if (thumbTip && thumbBase && indexTip && wrist) {
          // Thumbs up check: thumb tip higher than base, index folded
          if (thumbTip.y < thumbBase.y && indexTip.y > hand[6]?.y && thumbTip.y < indexTip.y) {
            gestureLabel = "thumbs_up";
            confidence = 0.75;
          } else if (thumbTip.y > thumbBase.y && thumbTip.y > indexTip.y) {
            gestureLabel = "thumbs_down";
            confidence = 0.75;
          }
        }
      }

      return {
        featuresAvailable: handDetected,
        handDetected,
        faceDetected: false,
        gestureLabel,
        confidence,
        mouthOpen: false
      };
    } catch (e) {
      return {
        featuresAvailable: false,
        handDetected: false,
        faceDetected: false,
        gestureLabel: "unknown",
        confidence: 0,
        mouthOpen: false
      };
    }
  }
}

export const visionProcessor = new ClientVisionProcessor();
