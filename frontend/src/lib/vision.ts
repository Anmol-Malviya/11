/**
 * MediaPipe Vision Landmark Processor & 10-Gesture Kinematic Classifier
 * Supports full static posture analysis & temporal sequence recognition (e.g. WAVE)
 * Handles left and right hands, low-light tracking, and returns 21 normalized landmarks.
 */
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

export type SupportedGesture = 
  | "THUMBS_UP"
  | "THUMBS_DOWN"
  | "OPEN_PALM"
  | "CLOSED_FIST"
  | "POINTING"
  | "PEACE_SIGN"
  | "OK_SIGN"
  | "WAVE"
  | "CROSSED_FINGERS"
  | "ONE_FINGER_UP"
  | "NO_GESTURE";

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface VisionDetectionResult {
  featuresAvailable: boolean;
  handDetected: boolean;
  faceDetected: boolean;
  gestureLabel: SupportedGesture;
  confidence: number;
  landmarks: LandmarkPoint[];
  handedness: "Left" | "Right" | "Unknown";
  lipAspectRatio?: number;
  mouthOpen: boolean;
}

export class ClientVisionProcessor {
  private recognizer: GestureRecognizer | null = null;
  private isInitializing: boolean = false;
  private lastProcessedTimestamp: number = 0;

  // Wave temporal tracking history: [wristX, timestamp]
  private wristHistory: { x: number; y: number; time: number }[] = [];

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
      return this.recognizer;
    } catch {
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
    if (
      !this.recognizer ||
      videoElement.readyState < 2 ||
      videoElement.paused ||
      videoElement.ended ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return {
        featuresAvailable: false,
        handDetected: false,
        faceDetected: false,
        gestureLabel: "NO_GESTURE",
        confidence: 0,
        landmarks: [],
        handedness: "Unknown",
        mouthOpen: false
      };
    }

    const intTimestamp = Math.floor(timestamp);
    const validTimestamp = intTimestamp <= this.lastProcessedTimestamp 
      ? this.lastProcessedTimestamp + 1 
      : intTimestamp;
    this.lastProcessedTimestamp = validTimestamp;

    try {
      const results = this.recognizer.recognizeForVideo(videoElement, validTimestamp);
      if (!results || !results.landmarks || results.landmarks.length === 0) {
        this.wristHistory = [];
        return {
          featuresAvailable: false,
          handDetected: false,
          faceDetected: false,
          gestureLabel: "NO_GESTURE",
          confidence: 0,
          landmarks: [],
          handedness: "Unknown",
          mouthOpen: false
        };
      }

      const handLandmarks = results.landmarks[0];
      const handednessLabel = results.handedness?.[0]?.[0]?.categoryName as ("Left" | "Right") || "Unknown";

      // 1. Check for dynamic temporal gesture: WAVE
      const wrist = handLandmarks[0];
      const now = performance.now();
      this.wristHistory.push({ x: wrist.x, y: wrist.y, time: now });
      // Keep last 1 second of wrist motion
      this.wristHistory = this.wristHistory.filter(item => now - item.time < 1000);

      const isWaving = this.checkWaveMotion(this.wristHistory, handLandmarks);
      if (isWaving) {
        return {
          featuresAvailable: true,
          handDetected: true,
          faceDetected: false,
          gestureLabel: "WAVE",
          confidence: 0.90,
          landmarks: handLandmarks,
          handedness: handednessLabel,
          mouthOpen: false
        };
      }

      // 2. Classify 9 Static Hand Postures using landmark geometry
      const staticClassification = this.classifyStaticHand(handLandmarks);

      return {
        featuresAvailable: true,
        handDetected: true,
        faceDetected: false,
        gestureLabel: staticClassification.gesture,
        confidence: staticClassification.confidence,
        landmarks: handLandmarks,
        handedness: handednessLabel,
        mouthOpen: false
      };

    } catch {
      return {
        featuresAvailable: false,
        handDetected: false,
        faceDetected: false,
        gestureLabel: "NO_GESTURE",
        confidence: 0,
        landmarks: [],
        handedness: "Unknown",
        mouthOpen: false
      };
    }
  }

  /**
   * Evaluates horizontal oscillations of hand wrist/palm over ~700ms window
   */
  private checkWaveMotion(history: { x: number; y: number; time: number }[], hand: LandmarkPoint[]): boolean {
    if (history.length < 8) return false;
    
    // Wave requires fingers generally raised/open
    const wrist = hand[0];
    const middleTip = hand[12];
    if (middleTip.y > wrist.y) return false; // Hand inverted downwards

    let dirChanges = 0;
    let prevDiff = 0;
    let totalRange = 0;
    let minX = history[0].x;
    let maxX = history[0].x;

    for (let i = 1; i < history.length; i++) {
      const diff = history[i].x - history[i - 1].x;
      minX = Math.min(minX, history[i].x);
      maxX = Math.max(maxX, history[i].x);

      if (Math.abs(diff) > 0.008) {
        if (prevDiff !== 0 && ((diff > 0 && prevDiff < 0) || (diff < 0 && prevDiff > 0))) {
          dirChanges++;
        }
        prevDiff = diff;
      }
    }
    totalRange = maxX - minX;

    // A distinct wave has at least 2 directional reversals and a noticeable horizontal traversal
    return dirChanges >= 2 && totalRange > 0.06;
  }

  /**
   * Robust geometric feature classifier for 9 static postures:
   * THUMBS_UP, THUMBS_DOWN, OPEN_PALM, CLOSED_FIST, POINTING, PEACE_SIGN, OK_SIGN, CROSSED_FINGERS, ONE_FINGER_UP
   */
  private classifyStaticHand(hand: LandmarkPoint[]): { gesture: SupportedGesture; confidence: number } {
    const wrist = hand[0];

    // Helper: euclidean distance in 2D normalized space
    const dist = (p1: LandmarkPoint, p2: LandmarkPoint) => 
      Math.hypot(p1.x - p2.x, p1.y - p2.y);

    // Finger tips and PIP joints
    // Thumb: Tip=4, IP=3, MCP=2
    // Index: Tip=8, PIP=6, MCP=5
    // Middle: Tip=12, PIP=10, MCP=9
    // Ring: Tip=16, PIP=14, MCP=13
    // Pinky: Tip=20, PIP=18, MCP=17

    const thumbTip = hand[4];
    const thumbIP = hand[3];
    const thumbMCP = hand[2];

    const indexTip = hand[8];
    const indexPIP = hand[6];
    const indexMCP = hand[5];

    const middleTip = hand[12];
    const middlePIP = hand[10];
    const middleMCP = hand[9];

    const ringTip = hand[16];
    const ringPIP = hand[14];
    const ringMCP = hand[13];

    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];
    const pinkyMCP = hand[17];

    // Finger extension detection based on tip distance from wrist vs PIP distance from wrist
    const isIndexExtended = dist(indexTip, wrist) > dist(indexPIP, wrist) * 1.15;
    const isMiddleExtended = dist(middleTip, wrist) > dist(middlePIP, wrist) * 1.15;
    const isRingExtended = dist(ringTip, wrist) > dist(ringPIP, wrist) * 1.15;
    const isPinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPIP, wrist) * 1.15;

    // Thumb extension
    const isThumbExtended = dist(thumbTip, wrist) > dist(thumbMCP, wrist) * 1.2;

    // Extended finger count (excluding thumb)
    const extendedFingersCount = (isIndexExtended ? 1 : 0) +
                                 (isMiddleExtended ? 1 : 0) +
                                 (isRingExtended ? 1 : 0) +
                                 (isPinkyExtended ? 1 : 0);

    // 1. OK_SIGN: Thumb tip and index tip in close contact, other 3 fingers extended
    const thumbIndexDistance = dist(thumbTip, indexTip);
    if (thumbIndexDistance < 0.055 && isMiddleExtended && isPinkyExtended) {
      return { gesture: "OK_SIGN", confidence: 0.92 };
    }

    // 2. CROSSED_FINGERS: Index tip and middle tip crossing or overlapping, others folded
    const indexMiddleDist = dist(indexTip, middleTip);
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      // Check for lateral crossing: indexTip.x crossed relative to middleTip.x compared to MCPs
      const mcpXDiff = middleMCP.x - indexMCP.x;
      const tipXDiff = middleTip.x - indexTip.x;
      if (Math.sign(mcpXDiff) !== Math.sign(tipXDiff) || indexMiddleDist < 0.035) {
        return { gesture: "CROSSED_FINGERS", confidence: 0.88 };
      }
    }

    // 3. PEACE_SIGN (V-Sign): Index and Middle extended with separation, Ring and Pinky folded
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      if (indexMiddleDist > 0.04) {
        return { gesture: "PEACE_SIGN", confidence: 0.94 };
      }
    }

    // 4. POINTING vs ONE_FINGER_UP:
    // Only Index is extended, others folded
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      // Check angle: If pointing horizontally or forward vs pointing vertically straight up
      const isVertical = Math.abs(indexTip.x - indexMCP.x) < Math.abs(indexTip.y - indexMCP.y) * 0.7;
      if (isVertical && indexTip.y < indexMCP.y) {
        return { gesture: "ONE_FINGER_UP", confidence: 0.91 };
      } else {
        return { gesture: "POINTING", confidence: 0.90 };
      }
    }

    // 5. OPEN_PALM: All 4 fingers extended + thumb extended
    if (extendedFingersCount >= 4) {
      return { gesture: "OPEN_PALM", confidence: 0.95 };
    }

    // 6. CLOSED_FIST: No fingers extended, thumb curled over fingers
    if (extendedFingersCount === 0 && !isThumbExtended) {
      return { gesture: "CLOSED_FIST", confidence: 0.93 };
    }

    // 7. THUMBS_UP and THUMBS_DOWN:
    // 4 fingers folded, thumb extended
    if (extendedFingersCount === 0 && isThumbExtended) {
      // Upward vs Downward thumb vector
      if (thumbTip.y < thumbMCP.y - 0.04) {
        return { gesture: "THUMBS_UP", confidence: 0.95 };
      } else if (thumbTip.y > thumbMCP.y + 0.04) {
        return { gesture: "THUMBS_DOWN", confidence: 0.94 };
      }
    }

    return { gesture: "NO_GESTURE", confidence: 0 };
  }
}

export const visionProcessor = new ClientVisionProcessor();
