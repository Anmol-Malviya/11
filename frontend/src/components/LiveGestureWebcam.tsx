"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, RefreshCw, AlertCircle, Eye } from "lucide-react";
import { gestureApi, GesturePrediction } from "@/lib/gestureApi";

interface LiveGestureWebcamProps {
  onGestureRecognized: (pred: GesturePrediction) => void;
  confidenceThreshold?: number;
  phraseMapping?: Record<string, string>;
}

export function LiveGestureWebcam({
  onGestureRecognized,
  confidenceThreshold = 0.60,
  phraseMapping
}: LiveGestureWebcamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentPrediction, setCurrentPrediction] = useState<GesturePrediction | null>(null);
  const [stableGesture, setStableGesture] = useState<string>("blank");
  const [stableConfidence, setStableConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);

  // Temporal smoothing queue (last 5 detections)
  const historyRef = useRef<{ gesture: string; confidence: number; timestamp: number }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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
        setCameraError("Camera permission denied. Please allow camera access in browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No webcam found on this device.");
      } else {
        setCameraError(err.message || "Failed to start camera preview.");
      }
      setIsCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setFps(0);
  };

  // Capture single frame and run inference
  const captureAndPredict = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw flipped mirror view or standard
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL("image/jpeg", 0.7);

    setIsProcessing(true);
    try {
      const pred = await gestureApi.predictGesture(base64Data, confidenceThreshold);
      
      // Override phrase if custom mapping provided
      if (phraseMapping && phraseMapping[pred.predicted_gesture]) {
        pred.mapped_phrase = phraseMapping[pred.predicted_gesture];
      }

      setCurrentPrediction(pred);

      // Temporal smoothing (majority voting over 4 consecutive frames)
      const now = Date.now();
      historyRef.current.push({
        gesture: pred.predicted_gesture,
        confidence: pred.confidence,
        timestamp: now
      });
      if (historyRef.current.length > 5) {
        historyRef.current.shift();
      }

      // Count occurrences in window
      const counts: Record<string, number> = {};
      let totalConf = 0;
      historyRef.current.forEach((item) => {
        counts[item.gesture] = (counts[item.gesture] || 0) + 1;
        totalConf += item.confidence;
      });

      let highestGesture = pred.predicted_gesture;
      let maxCount = 0;
      Object.entries(counts).forEach(([g, count]) => {
        if (count > maxCount) {
          maxCount = count;
          highestGesture = g;
        }
      });

      const avgConfidence = totalConf / historyRef.current.length;
      setStableGesture(highestGesture);
      setStableConfidence(avgConfidence);

      // Notify parent when gesture is reliable and not blank
      if (pred.is_reliable || (avgConfidence >= confidenceThreshold && highestGesture !== "blank")) {
        onGestureRecognized({
          ...pred,
          predicted_gesture: highestGesture,
          confidence: avgConfidence,
          mapped_phrase: (phraseMapping && phraseMapping[highestGesture]) || pred.mapped_phrase
        });
      }
    } catch (e) {
      console.error("Frame inference error:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [confidenceThreshold, isProcessing, onGestureRecognized, phraseMapping]);

  // Continuous loop with throttle (~4-5 FPS to save network & CPU)
  useEffect(() => {
    let intervalId: any = null;
    if (isCameraActive) {
      intervalId = setInterval(() => {
        captureAndPredict();
      }, 250); // 4 times per second
    } else {
      if (intervalId) clearInterval(intervalId);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive, captureAndPredict]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="flex flex-col rounded-3xl bg-slate-900 border border-slate-800 text-white p-4 shadow-xl relative overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className={`w-3 h-3 rounded-full ${isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span className="text-sm font-semibold tracking-wide">
            {isCameraActive ? "Live Gesture Feed" : "Camera Standby"}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            CNN (100x120 Grayscale)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Camera</span>
            </button>
          ) : (
            <>
              <button
                onClick={captureAndPredict}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-medium flex items-center space-x-1 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                <span>Capture Now</span>
              </button>
              <button
                onClick={stopCamera}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative aspect-video w-full rounded-2xl bg-black/60 overflow-hidden mt-3 flex items-center justify-center border border-slate-800/80">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${!isCameraActive ? "hidden" : "block"}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Hand Overlay Target Guide Box */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-emerald-400/70 rounded-2xl flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono bg-black/50 px-1.5 py-0.5 rounded self-start">
                Hand ROI (100x120)
              </span>
              <span className="text-[10px] text-emerald-400/80 text-center font-sans">
                Position gesture inside target
              </span>
            </div>
          </div>
        )}

        {/* Camera Idle or Permission Denied Message */}
        {!isCameraActive && !cameraError && (
          <div className="text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Eye className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-300 font-medium">Camera is currently paused.</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Click &quot;Start Camera&quot; to allow browser webcam access and begin recognizing hand gestures in real-time.
            </p>
          </div>
        )}

        {cameraError && (
          <div className="text-center p-6 space-y-3 bg-rose-950/40 rounded-2xl border border-rose-800/50 max-w-md m-4">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-semibold text-rose-200">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-xl text-xs font-semibold text-white"
            >
              Retry Camera Permission
            </button>
          </div>
        )}

        {/* Real-time gesture badge overlay */}
        {isCameraActive && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-xl flex items-center space-x-3 text-xs shadow-lg">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Detected Gesture</span>
                <span className="font-bold text-white text-sm capitalize">
                  {stableGesture !== "blank" ? stableGesture : "Waiting for gesture..."}
                </span>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Confidence</span>
                <span className={`font-mono font-bold ${stableConfidence >= confidenceThreshold ? "text-emerald-400" : "text-amber-400"}`}>
                  {(stableConfidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {isProcessing && (
              <div className="bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 px-2.5 py-1 rounded-lg text-[11px] flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Analyzing frame...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Class Legend Pills */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5 text-xs">
        {["ok", "thumbsup", "thumbsdown", "fist", "five", "blank"].map((label) => {
          const isCurrent = stableGesture === label;
          return (
            <span
              key={label}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                isCurrent
                  ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

