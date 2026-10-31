"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, RefreshCw, AlertCircle, Eye, Smartphone, QrCode } from "lucide-react";
import { gestureApi, GesturePrediction } from "@/lib/gestureApi";
import { visionProcessor, SupportedGesture, LandmarkPoint } from "@/lib/vision";
import { PhoneCameraModal } from "@/components/PhoneCameraModal";

interface LiveGestureWebcamProps {
  onGestureRecognized: (pred: {
    gesture: SupportedGesture;
    confidence: number;
    mapped_phrase: string;
    handedness: string;
  }) => void;
  confidenceThreshold?: number;
  phraseMapping?: Record<string, { message: string; meaning: string }>;
}

export function LiveGestureWebcam({
  onGestureRecognized,
  confidenceThreshold = 0.60,
  phraseMapping
}: LiveGestureWebcamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraSource, setCameraSource] = useState<"laptop" | "phone">("laptop");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState<boolean>(true);

  // Stable states
  const [activeGesture, setActiveGesture] = useState<SupportedGesture>("NO_GESTURE");
  const [activeConfidence, setActiveConfidence] = useState<number>(0);
  const [handedness, setHandedness] = useState<string>("Unknown");
  const [handPresent, setHandPresent] = useState<boolean>(false);

  // Phone remote camera pairing
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [pairingToken, setPairingToken] = useState<string>("");
  const [remoteFrameSrc, setRemoteFrameSrc] = useState<string | null>(null);

  // Temporal smoothing & trigger state (sliding window of 6 frames)
  const historyRef = useRef<{ gesture: SupportedGesture; confidence: number; timestamp: number }[]>([]);
  const lastTriggeredGestureRef = useRef<SupportedGesture>("NO_GESTURE");
  const streamRef = useRef<MediaStream | null>(null);

  // MediaPipe hand skeleton connections (21 landmarks)
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [5, 9], [9, 10], [10, 11], [11, 12], // Middle
    [9, 13], [13, 14], [14, 15], [15, 16], // Ring
    [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [0, 17] // Palm base
  ];

  // Initialize MediaPipe Recognizer on mount
  useEffect(() => {
    let isCancelled = false;
    async function loadModel() {
      setModelLoading(true);
      await visionProcessor.initializeRecognizer();
      if (!isCancelled) setModelLoading(false);
    }
    loadModel();
    return () => { isCancelled = true; };
  }, []);

  // Generate pairing token for remote camera
  useEffect(() => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPairingToken(token);
    fetch(`/api/remote-camera/session/${token}/register?role=laptop`, { method: "POST" }).catch(() => {});
  }, []);

  // Poll for phone frames if using phone camera
  useEffect(() => {
    if (!pairingToken) return;
    let isPolling = true;
    const pollInterval = setInterval(async () => {
      if (!isPolling) return;
      try {
        const res = await fetch(`/api/remote-camera/session/${pairingToken}/poll`);
        if (res.ok) {
          const data = await res.json();
          if (data.phone_connected) {
            setIsPhoneConnected(true);
            setCameraSource("phone");
            stopLaptopCamera();
            if (data.image) setRemoteFrameSrc(data.image);
          } else {
            setIsPhoneConnected(false);
          }
        }
      } catch {}
    }, 250);

    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [pairingToken]);

  // Start laptop webcam
  const startLaptopCamera = async () => {
    setCameraError(null);
    setCameraSource("laptop");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam access is not supported by this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Click below or scan QR to use your phone camera instead!");
      } else {
        setCameraError(err.message || "Failed to start camera preview.");
      }
      setIsCameraActive(false);
    }
  };

  // Stop laptop webcam
  const stopLaptopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    clearOverlay();
  };

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Draw hand skeleton landmark overlay
  const drawLandmarks = (landmarks: LandmarkPoint[], width: number, height: number) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Flip horizontally to match mirrored user webcam
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);

    // Green hand skeleton glow effect
    ctx.shadowColor = "rgba(34, 197, 94, 0.35)";
    ctx.shadowBlur = 8;

    // Draw connection lines with primary green
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#22C55E"; // Green #22C55E
    ctx.lineCap = "round";

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Reset shadow for joints
    ctx.shadowBlur = 0;

    // Draw landmark joints with green palette
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i];
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, i % 4 === 0 ? 5 : 3.5, 0, 2 * Math.PI);
      // Fingertips: vibrant primary green, intermediate knuckles: deep secondary green
      ctx.fillStyle = i === 4 || i === 8 || i === 12 || i === 16 || i === 20 
        ? "#22C55E" 
        : "#16A34A";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#052e16"; // Dark emerald border for crisp contrast
      ctx.stroke();
    }

    ctx.restore();
  };

  // Continuous frame processing loop
  useEffect(() => {
    if (!isCameraActive || modelLoading) return;

    let isRunning = true;
    let animId: number;

    const processFrame = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0) {
        const now = performance.now();
        const result = visionProcessor.detectForVideo(video, now);

        setHandPresent(result.handDetected);
        setHandedness(result.handedness);

        if (result.handDetected && result.landmarks.length > 0) {
          drawLandmarks(result.landmarks, video.videoWidth, video.videoHeight);
        } else {
          clearOverlay();
        }

        // Temporal smoothing across last 6 frames (~200ms)
        const currentGesture = result.gestureLabel;
        const currentConf = result.confidence;

        historyRef.current.push({
          gesture: currentGesture,
          confidence: currentConf,
          timestamp: now
        });
        if (historyRef.current.length > 6) {
          historyRef.current.shift();
        }

        // Count occurrences
        const counts: Record<string, number> = {};
        let totalConf = 0;
        historyRef.current.forEach(item => {
          counts[item.gesture] = (counts[item.gesture] || 0) + 1;
          totalConf += item.confidence;
        });

        let highestGesture: SupportedGesture = "NO_GESTURE";
        let maxCount = 0;
        Object.entries(counts).forEach(([g, cnt]) => {
          if (cnt > maxCount) {
            maxCount = cnt;
            highestGesture = g as SupportedGesture;
          }
        });

        const avgConfidence = totalConf / historyRef.current.length;
        setActiveGesture(highestGesture);
        setActiveConfidence(avgConfidence);

        // Reset triggered gesture if hand disappeared or reverted to NO_GESTURE
        if (!result.handDetected || highestGesture === "NO_GESTURE") {
          lastTriggeredGestureRef.current = "NO_GESTURE";
        }

        // Stability trigger:
        // Must appear in at least 4 of 6 frames with confidence >= threshold
        // Prevent duplicate trigger for continuous static hold
        if (
          highestGesture !== "NO_GESTURE" &&
          maxCount >= 4 &&
          avgConfidence >= confidenceThreshold &&
          highestGesture !== lastTriggeredGestureRef.current
        ) {
          lastTriggeredGestureRef.current = highestGesture;

          const phrase = phraseMapping?.[highestGesture]?.message || "";
          onGestureRecognized({
            gesture: highestGesture,
            confidence: avgConfidence,
            mapped_phrase: phrase,
            handedness: result.handedness
          });
        }
      }

      animId = requestAnimationFrame(processFrame);
    };

    animId = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      clearOverlay();
    };
  }, [isCameraActive, modelLoading, confidenceThreshold, phraseMapping, onGestureRecognized]);

  return (
    <div className="flex flex-col rounded-3xl bg-slate-900 border border-slate-800 text-white p-4 shadow-xl relative overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className={`w-3 h-3 rounded-full ${
            (cameraSource === "laptop" && isCameraActive) || (cameraSource === "phone" && isPhoneConnected)
              ? "bg-emerald-500 animate-pulse" 
              : "bg-rose-500"
          }`} />
          <span className="text-sm font-semibold tracking-wide">
            {cameraSource === "phone" && isPhoneConnected
              ? "Phone Camera (Token Active)"
              : isCameraActive
              ? "Laptop Webcam Feed"
              : "Camera Standby"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {modelLoading ? "Loading MediaPipe..." : "MediaPipe Active"}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            title="Scan QR to pair phone camera with token"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isPhoneConnected ? `Phone Paired (${pairingToken}) ✓` : "Use Phone Camera (Token QR)"}</span>
          </button>

          {!isCameraActive ? (
            <button
              onClick={startLaptopCamera}
              disabled={modelLoading}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Webcam</span>
            </button>
          ) : (
            <button
              onClick={stopLaptopCamera}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center space-x-1.5"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Stop Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video & Landmark Overlay Viewport */}
      <div className="relative mt-3 aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
        {/* Laptop Video */}
        {cameraSource === "laptop" && (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${isCameraActive ? "block" : "hidden"}`}
          />
        )}

        {/* Phone Remote Camera Frame */}
        {cameraSource === "phone" && isPhoneConnected && remoteFrameSrc && (
          <img
            src={remoteFrameSrc}
            alt="Remote Phone Camera Feed"
            className="w-full h-full object-contain"
          />
        )}

        {/* Transparent Canvas for Hand Landmark Visualization */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Inactive Standby Screen */}
        {!isCameraActive && !(cameraSource === "phone" && isPhoneConnected) && (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Webcam Inactive</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Click &ldquo;Start Webcam&rdquo; above to recognize all 10 hand gestures in real time with MediaPipe landmarks.
              </p>
            </div>
            <button
              onClick={startLaptopCamera}
              disabled={modelLoading}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {modelLoading ? "Loading MediaPipe..." : "Enable Camera Now"}
            </button>
          </div>
        )}

        {/* Camera Permission Denied Error */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm text-rose-300 font-semibold">{cameraError}</p>
            <button
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition flex items-center space-x-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Phone QR</span>
            </button>
          </div>
        )}

        {/* Real-Time Gesture HUD Overlay */}
        {isCameraActive && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className={`backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center space-x-3 text-xs shadow-lg transition-colors border ${
              handPresent 
                ? "bg-slate-950/90 border-emerald-500/40" 
                : "bg-slate-900/90 border-slate-700/80"
            }`}>
              <div>
                <span className={`block text-[10px] uppercase font-mono ${handPresent ? "text-emerald-400 font-semibold" : "text-slate-400"}`}>
                  {handPresent ? `${handedness} Hand` : "Hand Detector"}
                </span>
                <span className={`font-bold text-sm ${handPresent && activeGesture !== "NO_GESTURE" ? "text-emerald-300" : "text-white"}`}>
                  {handPresent && activeGesture !== "NO_GESTURE" ? activeGesture.replace("_", " ") : (handPresent ? "DETECTING..." : "NO_GESTURE")}
                </span>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Confidence</span>
                <span className={`font-mono font-bold ${
                  !handPresent 
                    ? "text-slate-500" 
                    : activeConfidence >= confidenceThreshold 
                      ? "text-emerald-400" 
                      : "text-amber-400"
                }`}>
                  {handPresent ? `${(activeConfidence * 100).toFixed(1)}%` : "0.0%"}
                </span>
              </div>
            </div>

            <div className={`backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] flex items-center space-x-2 border transition-colors ${
              handPresent 
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300" 
                : "bg-slate-900/90 border-slate-700/80 text-slate-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${handPresent ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              <span>{handPresent ? "Hand Tracked" : "No Hand in Frame"}</span>
            </div>
          </div>
        )}
      </div>

      {/* 10 Supported Gesture Legend Pills */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5 text-xs">
        {[
          "THUMBS_UP",
          "THUMBS_DOWN",
          "OPEN_PALM",
          "CLOSED_FIST",
          "POINTING",
          "PEACE_SIGN",
          "OK_SIGN",
          "WAVE",
          "CROSSED_FINGERS",
          "ONE_FINGER_UP"
        ].map((label) => {
          const isCurrent = handPresent && activeGesture === label;
          return (
            <span
              key={label}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase transition-all ${
                isCurrent
                  ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400 font-bold"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {label.replace("_", " ")}
            </span>
          );
        })}
      </div>

      {/* Phone Camera QR Code Modal */}
      <PhoneCameraModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        pairingToken={pairingToken}
        isPhoneConnected={isPhoneConnected}
      />
    </div>
  );
}
