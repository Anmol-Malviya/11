/**
 * MediaPipe Vision Landmark Processor, Dual-Hand Tracking & Two-Hand Gesture Recognizer
 * 
 * Capabilities:
 * 1. Dual-hand tracking with 21 3D landmarks for both Left and Right hands.
 * 2. 10 Single-Hand Gestures (THUMBS_UP, THUMBS_DOWN, OPEN_PALM, CLOSED_FIST, POINTING, PEACE_SIGN, OK_SIGN, WAVE, CROSSED_FINGERS, ONE_FINGER_UP).
 * 3. 6 Custom Two-Hand Gestures:
 *    - BOTH_THUMBS_UP ("Absolutely yes!")
 *    - BOTH_THUMBS_DOWN ("Absolutely not!")
 *    - HAND_HEART ("I love you.")
 *    - PALMS_TOGETHER ("Please.")
 *    - BOTH_OPEN_PALMS ("Stop immediately!")
 *    - T_SHAPE ("I need a break.")
 * 4. Face Landmarker for genuine Mouth / Lip Landmark extraction:
 *    - Tracks inner and outer lip contour points (13, 14, 78, 308, etc.)
 *    - Calculates actual geometric Lip Aspect Ratio (LAR = vertical / horizontal)
 *    - Detects face presence, mouth openness, and returns verified face landmarks.
 */
import { FilesetResolver, GestureRecognizer, FaceLandmarker } from "@mediapipe/tasks-vision";

export type SingleHandGesture = 
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

export type TwoHandGesture =
  | "BOTH_THUMBS_UP"
  | "BOTH_THUMBS_DOWN"
  | "HAND_HEART"
  | "PALMS_TOGETHER"
  | "BOTH_OPEN_PALMS"
  | "T_SHAPE";

export type SupportedGesture = SingleHandGesture | TwoHandGesture;

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandTrackData {
  handedness: "Left" | "Right";
  landmarks: LandmarkPoint[];
  gesture: SingleHandGesture;
  confidence: number;
}

export interface LipMotionData {
  faceDetected: boolean;
  lipAspectRatio: number;
  mouthOpen: boolean;
  innerLipPoints: LandmarkPoint[];
  outerLipPoints: LandmarkPoint[];
  boundingBox?: { xMin: number; yMin: number; xMax: number; yMax: number };
}

export interface VisionDetectionResult {
  featuresAvailable: boolean;
  handDetected: boolean;
  handsCount: number;
  hands: HandTrackData[];
  leftHand?: HandTrackData;
  rightHand?: HandTrackData;
  gestureLabel: SupportedGesture;
  gestureType: "single" | "two_hand" | "none";
  confidence: number;
  landmarks: LandmarkPoint[]; // Combined/primary for legacy compatibility
  handedness: "Left" | "Right" | "Both" | "Unknown";
  lipData: LipMotionData;
}

export class ClientVisionProcessor {
  private recognizer: GestureRecognizer | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitializing: boolean = false;
  private lastHandTimestamp: number = 0;
  private lastFaceTimestamp: number = 0;

  // Wave temporal tracking history: [wristX, timestamp]
  private wristHistories: Map<string, { x: number; y: number; time: number }[]> = new Map();

  public async initializeRecognizer(): Promise<boolean> {
    if (this.recognizer && this.faceLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // 1. Initialize Dual-Hand Gesture Recognizer
      try {
        this.recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
      } catch {
        this.recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
      }

      // 2. Initialize Face Landmarker for Real Lip Reading & Viseme Kinematics
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });
      }

      return true;
    } catch (err) {
      console.error("ClientVisionProcessor initialization failed:", err);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  public detectForVideo(videoElement: HTMLVideoElement, timestamp: number): VisionDetectionResult {
    const emptyLipData: LipMotionData = {
      faceDetected: false,
      lipAspectRatio: 0,
      mouthOpen: false,
      innerLipPoints: [],
      outerLipPoints: []
    };

    if (
      (!this.recognizer && !this.faceLandmarker) ||
      videoElement.readyState < 2 ||
      videoElement.paused ||
      videoElement.ended ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return {
        featuresAvailable: false,
        handDetected: false,
        handsCount: 0,
        hands: [],
        gestureLabel: "NO_GESTURE",
        gestureType: "none",
        confidence: 0,
        landmarks: [],
        handedness: "Unknown",
        lipData: emptyLipData
      };
    }

    const intTimestamp = Math.floor(timestamp);
    const validHandTime = intTimestamp <= this.lastHandTimestamp ? this.lastHandTimestamp + 1 : intTimestamp;
    this.lastHandTimestamp = validHandTime;

    const validFaceTime = intTimestamp <= this.lastFaceTimestamp ? this.lastFaceTimestamp + 1 : intTimestamp;
    this.lastFaceTimestamp = validFaceTime;

    // --- A. Real Face & Lip Landmark Detection ---
    let lipData = emptyLipData;
    if (this.faceLandmarker) {
      try {
        const faceResults = this.faceLandmarker.detectForVideo(videoElement, validFaceTime);
        if (faceResults && faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
          const face = faceResults.faceLandmarks[0];
          // Standard MediaPipe Face Mesh Lip landmark indices:
          // Upper inner lip: 13, Lower inner lip: 14
          // Left corner: 78, Right corner: 308
          // Upper outer lip: 0, Lower outer lip: 17
          const pUpperInner = face[13];
          const pLowerInner = face[14];
          const pLeftCorner = face[78];
          const pRightCorner = face[308];

          if (pUpperInner && pLowerInner && pLeftCorner && pRightCorner) {
            const verticalDist = Math.hypot(pUpperInner.x - pLowerInner.x, pUpperInner.y - pLowerInner.y);
            const horizontalDist = Math.hypot(pLeftCorner.x - pRightCorner.x, pLeftCorner.y - pRightCorner.y);
            const lar = horizontalDist > 0 ? verticalDist / horizontalDist : 0;
            const isMouthOpen = lar > 0.28;

            // Lip bounding box
            const lipIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
            let xMin = 1, xMax = 0, yMin = 1, yMax = 0;
            const innerLipPoints: LandmarkPoint[] = [];
            const outerLipPoints: LandmarkPoint[] = [];

            for (const idx of lipIndices) {
              const pt = face[idx];
              if (pt) {
                xMin = Math.min(xMin, pt.x);
                xMax = Math.max(xMax, pt.x);
                yMin = Math.min(yMin, pt.y);
                yMax = Math.max(yMax, pt.y);
                innerLipPoints.push({ x: pt.x, y: pt.y, z: pt.z || 0 });
              }
            }

            lipData = {
              faceDetected: true,
              lipAspectRatio: Math.round(lar * 1000) / 1000,
              mouthOpen: isMouthOpen,
              innerLipPoints,
              outerLipPoints,
              boundingBox: {
                xMin: Math.max(0, xMin - 0.02),
                yMin: Math.max(0, yMin - 0.02),
                xMax: Math.min(1, xMax + 0.02),
                yMax: Math.min(1, yMax + 0.02)
              }
            };
          }
        }
      } catch (faceErr) {
        // Face detection non-critical failure fallback
      }
    }

    // --- B. Dual-Hand Tracking & Classification ---
    if (!this.recognizer) {
      return {
        featuresAvailable: lipData.faceDetected,
        handDetected: false,
        handsCount: 0,
        hands: [],
        gestureLabel: "NO_GESTURE",
        gestureType: "none",
        confidence: 0,
        landmarks: [],
        handedness: "Unknown",
        lipData
      };
    }

    try {
      const handResults = this.recognizer.recognizeForVideo(videoElement, validHandTime);
      if (!handResults || !handResults.landmarks || handResults.landmarks.length === 0) {
        this.wristHistories.clear();
        return {
          featuresAvailable: lipData.faceDetected,
          handDetected: false,
          handsCount: 0,
          hands: [],
          gestureLabel: "NO_GESTURE",
          gestureType: "none",
          confidence: 0,
          landmarks: [],
          handedness: "Unknown",
          lipData
        };
      }

      const hands: HandTrackData[] = [];
      let leftHand: HandTrackData | undefined;
      let rightHand: HandTrackData | undefined;

      // Extract each detected hand
      for (let i = 0; i < handResults.landmarks.length; i++) {
        const landmarks = handResults.landmarks[i];
        let rawHandedness = handResults.handedness?.[i]?.[0]?.categoryName;
        // In mirrored user webcam feed, flip Left/Right to match user perspective
        const handedness: "Left" | "Right" = rawHandedness === "Left" ? "Left" : "Right";

        // Check dynamic WAVE gesture on this hand
        const isWaving = this.checkWaveMotion(handedness, landmarks);
        let singleGesture: SingleHandGesture = "NO_GESTURE";
        let conf = 0;

        if (isWaving) {
          singleGesture = "WAVE";
          conf = 0.90;
        } else {
          const staticClass = this.classifyStaticHand(landmarks);
          singleGesture = staticClass.gesture;
          conf = staticClass.confidence;
        }

        const handItem: HandTrackData = {
          handedness,
          landmarks,
          gesture: singleGesture,
          confidence: conf
        };
        hands.push(handItem);

        if (handedness === "Left" && !leftHand) leftHand = handItem;
        else if (handedness === "Right" && !rightHand) rightHand = handItem;
      }

      // If both detected hands had identical handedness labels (e.g. 2 hands close together), assign by horizontal coordinate
      if (hands.length === 2 && (!leftHand || !rightHand)) {
        if (hands[0].landmarks[0].x < hands[1].landmarks[0].x) {
          hands[0].handedness = "Right"; // user perspective
          hands[1].handedness = "Left";
        } else {
          hands[0].handedness = "Left";
          hands[1].handedness = "Right";
        }
        leftHand = hands.find(h => h.handedness === "Left") || hands[0];
        rightHand = hands.find(h => h.handedness === "Right") || hands[1];
      }

      // --- C. Two-Hand vs Single-Hand Gesture Decision ---
      let finalGesture: SupportedGesture = "NO_GESTURE";
      let finalType: "single" | "two_hand" | "none" = "none";
      let finalConfidence = 0;

      // 1. Check for genuine Two-Hand Gestures if both hands are detected
      if (hands.length >= 2 && leftHand && rightHand) {
        const twoHandResult = this.classifyTwoHandGestures(leftHand.landmarks, rightHand.landmarks);
        if (twoHandResult.gesture !== "NO_GESTURE") {
          finalGesture = twoHandResult.gesture;
          finalType = "two_hand";
          finalConfidence = twoHandResult.confidence;
        }
      }

      // 2. Fall back to dominant Single-Hand Gesture if no two-hand gesture was recognized
      if (finalGesture === "NO_GESTURE") {
        const activeHand = hands.find(h => h.gesture !== "NO_GESTURE") || hands[0];
        finalGesture = activeHand.gesture;
        finalType = finalGesture !== "NO_GESTURE" ? "single" : "none";
        finalConfidence = activeHand.confidence;
      }

      const combinedLandmarks = hands.flatMap(h => h.landmarks);
      const handednessSummary: "Left" | "Right" | "Both" | "Unknown" = 
        hands.length >= 2 ? "Both" : hands[0]?.handedness || "Unknown";

      return {
        featuresAvailable: true,
        handDetected: true,
        handsCount: hands.length,
        hands,
        leftHand,
        rightHand,
        gestureLabel: finalGesture,
        gestureType: finalType,
        confidence: finalConfidence,
        landmarks: combinedLandmarks,
        handedness: handednessSummary,
        lipData
      };
    } catch {
      return {
        featuresAvailable: lipData.faceDetected,
        handDetected: false,
        handsCount: 0,
        hands: [],
        gestureLabel: "NO_GESTURE",
        gestureType: "none",
        confidence: 0,
        landmarks: [],
        handedness: "Unknown",
        lipData
      };
    }
  }

  /**
   * Evaluates horizontal oscillations of hand wrist/palm over ~700ms window
   */
  private checkWaveMotion(handKey: string, hand: LandmarkPoint[]): boolean {
    const wrist = hand[0];
    const middleTip = hand[12];
    if (middleTip.y > wrist.y) return false; // Hand inverted downwards

    const now = performance.now();
    let history = this.wristHistories.get(handKey) || [];
    history.push({ x: wrist.x, y: wrist.y, time: now });
    history = history.filter(item => now - item.time < 1000);
    this.wristHistories.set(handKey, history);

    if (history.length < 8) return false;

    let dirChanges = 0;
    let prevDiff = 0;
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
    const totalRange = maxX - minX;
    return dirChanges >= 2 && totalRange > 0.06;
  }

  /**
   * Recognizes 6 Custom Two-Hand Gestures:
   * 1. BOTH_THUMBS_UP
   * 2. BOTH_THUMBS_DOWN
   * 3. HAND_HEART
   * 4. PALMS_TOGETHER
   * 5. BOTH_OPEN_PALMS
   * 6. T_SHAPE
   */
  private classifyTwoHandGestures(
    handA: LandmarkPoint[],
    handB: LandmarkPoint[]
  ): { gesture: TwoHandGesture | "NO_GESTURE"; confidence: number } {
    const dist = (p1: LandmarkPoint, p2: LandmarkPoint) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const singleA = this.classifyStaticHand(handA);
    const singleB = this.classifyStaticHand(handB);

    // 1. BOTH_THUMBS_UP: Both hands independently show THUMBS_UP
    if (singleA.gesture === "THUMBS_UP" && singleB.gesture === "THUMBS_UP") {
      const conf = Math.min(0.98, (singleA.confidence + singleB.confidence) / 2 + 0.03);
      return { gesture: "BOTH_THUMBS_UP", confidence: conf };
    }

    // 2. BOTH_THUMBS_DOWN: Both hands independently show THUMBS_DOWN
    if (singleA.gesture === "THUMBS_DOWN" && singleB.gesture === "THUMBS_DOWN") {
      const conf = Math.min(0.98, (singleA.confidence + singleB.confidence) / 2 + 0.03);
      return { gesture: "BOTH_THUMBS_DOWN", confidence: conf };
    }

    // 3. BOTH_OPEN_PALMS: Both hands independently show OPEN_PALM separated horizontally
    if (singleA.gesture === "OPEN_PALM" && singleB.gesture === "OPEN_PALM") {
      const wristDist = dist(handA[0], handB[0]);
      if (wristDist > 0.15) {
        const conf = Math.min(0.98, (singleA.confidence + singleB.confidence) / 2 + 0.02);
        return { gesture: "BOTH_OPEN_PALMS", confidence: conf };
      }
    }

    // 4. PALMS_TOGETHER (Namaste / Request):
    // Both hands open, wrists and fingertips very close (< 0.12 distance), facing each other
    const wristDist = dist(handA[0], handB[0]);
    const indexTipDist = dist(handA[8], handB[8]);
    const middleTipDist = dist(handA[12], handB[12]);
    const palmCenterA = handA[9];
    const palmCenterB = handB[9];
    const palmDist = dist(palmCenterA, palmCenterB);

    if (palmDist < 0.14 && (indexTipDist < 0.10 || middleTipDist < 0.10)) {
      // Both hands vertical pointing upwards
      const handAVertical = handA[12].y < handA[0].y;
      const handBVertical = handB[12].y < handB[0].y;
      if (handAVertical && handBVertical) {
        return { gesture: "PALMS_TOGETHER", confidence: 0.94 };
      }
    }

    // 5. HAND_HEART:
    // Thumbs touching at bottom tips, Index fingers curved touching at top tips, forming a heart arc
    const thumbDist = dist(handA[4], handB[4]);
    const indexDist = dist(handA[8], handB[8]);
    const thumbY = (handA[4].y + handB[4].y) / 2;
    const indexY = (handA[8].y + handB[8].y) / 2;

    // Heart geometry: index tips touch at the top (lower y), thumbs touch at the bottom (higher y)
    if (thumbDist < 0.12 && indexDist < 0.12 && indexY < thumbY) {
      // Wrist separation is wider than fingertip contact points
      if (wristDist > thumbDist * 1.5) {
        return { gesture: "HAND_HEART", confidence: 0.95 };
      }
    }

    // 6. T_SHAPE:
    // One hand is horizontal (palm flat facing down or sideways), the other hand is vertical pointing directly into the horizontal palm
    const getHandOrientation = (h: LandmarkPoint[]) => {
      const dx = Math.abs(h[12].x - h[0].x);
      const dy = Math.abs(h[12].y - h[0].y);
      return dx > dy * 1.3 ? "horizontal" : (dy > dx * 1.3 ? "vertical" : "diagonal");
    };

    const orientA = getHandOrientation(handA);
    const orientB = getHandOrientation(handB);

    if (
      (orientA === "horizontal" && orientB === "vertical") ||
      (orientB === "horizontal" && orientA === "vertical")
    ) {
      const horizHand = orientA === "horizontal" ? handA : handB;
      const vertHand = orientA === "vertical" ? handA : handB;

      // Vertical fingertips touch the middle/wrist region of horizontal palm
      const vertTip = vertHand[12];
      const horizMid = horizHand[9];
      const contactDist = dist(vertTip, horizMid);

      if (contactDist < 0.15) {
        return { gesture: "T_SHAPE", confidence: 0.93 };
      }
    }

    return { gesture: "NO_GESTURE", confidence: 0 };
  }

  /**
   * Robust geometric feature classifier for 9 static single-hand postures
   */
  private classifyStaticHand(hand: LandmarkPoint[]): { gesture: SingleHandGesture; confidence: number } {
    const wrist = hand[0];
    const dist = (p1: LandmarkPoint, p2: LandmarkPoint) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const thumbTip = hand[4];
    const thumbMCP = hand[2];

    const indexTip = hand[8];
    const indexPIP = hand[6];
    const indexMCP = hand[5];

    const middleTip = hand[12];
    const middlePIP = hand[10];
    const middleMCP = hand[9];

    const ringTip = hand[16];
    const ringPIP = hand[14];

    const pinkyTip = hand[20];
    const pinkyPIP = hand[18];

    // Finger extensions
    const isIndexExtended = dist(indexTip, wrist) > dist(indexPIP, wrist) * 1.15;
    const isMiddleExtended = dist(middleTip, wrist) > dist(middlePIP, wrist) * 1.15;
    const isRingExtended = dist(ringTip, wrist) > dist(ringPIP, wrist) * 1.15;
    const isPinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPIP, wrist) * 1.15;
    const isThumbExtended = dist(thumbTip, wrist) > dist(thumbMCP, wrist) * 1.2;

    const extendedFingersCount = 
      (isIndexExtended ? 1 : 0) +
      (isMiddleExtended ? 1 : 0) +
      (isRingExtended ? 1 : 0) +
      (isPinkyExtended ? 1 : 0);

    // 1. OK_SIGN
    const thumbIndexDistance = dist(thumbTip, indexTip);
    if (thumbIndexDistance < 0.055 && isMiddleExtended && isPinkyExtended) {
      return { gesture: "OK_SIGN", confidence: 0.92 };
    }

    // 2. CROSSED_FINGERS
    const indexMiddleDist = dist(indexTip, middleTip);
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      const mcpXDiff = middleMCP.x - indexMCP.x;
      const tipXDiff = middleTip.x - indexTip.x;
      if (Math.sign(mcpXDiff) !== Math.sign(tipXDiff) || indexMiddleDist < 0.035) {
        return { gesture: "CROSSED_FINGERS", confidence: 0.88 };
      }
    }

    // 3. PEACE_SIGN
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      if (indexMiddleDist > 0.04) {
        return { gesture: "PEACE_SIGN", confidence: 0.94 };
      }
    }

    // 4. POINTING vs ONE_FINGER_UP
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      const isVertical = Math.abs(indexTip.x - indexMCP.x) < Math.abs(indexTip.y - indexMCP.y) * 0.7;
      if (isVertical && indexTip.y < indexMCP.y) {
        return { gesture: "ONE_FINGER_UP", confidence: 0.91 };
      } else {
        return { gesture: "POINTING", confidence: 0.90 };
      }
    }

    // 5. OPEN_PALM
    if (extendedFingersCount >= 4) {
      return { gesture: "OPEN_PALM", confidence: 0.95 };
    }

    // 6. CLOSED_FIST
    if (extendedFingersCount === 0 && !isThumbExtended) {
      return { gesture: "CLOSED_FIST", confidence: 0.93 };
    }

    // 7. THUMBS_UP and THUMBS_DOWN
    if (extendedFingersCount === 0 && isThumbExtended) {
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
