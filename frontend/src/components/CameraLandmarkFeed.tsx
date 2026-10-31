"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, AlertCircle, Eye, Activity, Sparkles } from "lucide-react";
import { visionProcessor, VisionDetectionResult, SupportedGesture } from "@/lib/vision";
import { gestureApi, LipReadingResponse } from "@/lib/gestureApi";

interface Props {
  onGestureDetected?: (gesture: string, confidence: number) => void;
  onLipActivityDetected?: (active: boolean) => void;
  onLipReadingPredicted?: (result: LipReadingResponse) => void;
}

export function CameraLandmarkFeed({
  onGestureDetected,
  onLipActivityDetected,
  onLipReadingPredicted,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState<SupportedGesture>("NO_GESTURE");
  const [confidence, setConfidence] = useState(0);
  const [handInFrame, setHandInFrame] = useState(false);
  const [leftHandTracked, setLeftHandTracked] = useState(false);
  const [rightHandTracked, setRightHandTracked] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

  // Real Lip kinematics state & temporal buffer from MediaPipe FaceLandmarker
  const [isLipTrackingEnabled, setIsLipTrackingEnabled] = useState(true);
  const [lipStatus, setLipStatus] = useState<string>("resting");
  const [currentLAR, setCurrentLAR] = useState<number>(0.16);
  const [lipConfidence, setLipConfidence] = useState<number>(0);
  const [predictedWords, setPredictedWords] = useState<string[]>([]);
  const [suggestedPhrases, setSuggestedPhrases] = useState<string[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);

  // Sliding window of Lip Aspect Ratios (LAR) across 20 frames (~1 sec)
  const larSequenceRef = useRef<number[]>([]);
  const lastLipAnalysisRef = useRef<number>(0);

  // Initialize Camera
  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let isCancelled = false;

    async function initCamera() {
      try {
        setCameraError(null);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isCancelled && videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setStreamActive(true);
          };
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.warn("Camera access failed or denied:", err);
          setCameraError("Camera unavailable. Please grant webcam permissions.");
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Initialize MediaPipe Models
  useEffect(() => {
    let isCancelled = false;
    async function loadModel() {
      setModelLoading(true);
      await visionProcessor.initializeRecognizer();
      if (!isCancelled) {
        setModelLoading(false);
      }
    }
    loadModel();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Send real temporal LAR sequence to backend lip-reading service
  const triggerLipAnalysis = useCallback(async (sequence: number[]) => {
    try {
      const res = await gestureApi.predictLipReading(sequence);
      setLipStatus(res.status);
      setLipConfidence(res.confidence);
      setPredictedWords(res.predicted_words);
      setSuggestedPhrases(res.suggested_phrases);
      if (onLipReadingPredicted) {
        onLipReadingPredicted(res);
      }
    } catch (e) {
      console.warn("Lip reading prediction notice:", e);
    }
  }, [onLipReadingPredicted]);

  // Live Detection Loop using requestAnimationFrame
  useEffect(() => {
    if (!streamActive || modelLoading) return;

    let isRunning = true;
    let lastExecution = 0;
    const THROTTLE_INTERVAL_MS = 66; // ~15 FPS

    const processFrame = () => {
      if (!isRunning) return;

      const now = performance.now();
      if (now - lastExecution >= THROTTLE_INTERVAL_MS) {
        lastExecution = now;
        const video = videoRef.current;
        if (
          video &&
          video.readyState >= 2 &&
          !video.paused &&
          !video.ended &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          const result: VisionDetectionResult = visionProcessor.detectForVideo(video, now);

          setHandInFrame(result.handDetected);
          setLeftHandTracked(!!result.leftHand);
          setRightHandTracked(!!result.rightHand);

          const detected = result.gestureLabel;
          const conf = result.confidence;

          if (detected !== currentGesture || Math.abs(conf - confidence) > 0.1) {
            setCurrentGesture(detected);
            setConfidence(conf);
            if (onGestureDetected && detected !== "NO_GESTURE") {
              onGestureDetected(detected, conf);
            }
          }

          // Authentic Lip Landmark & Aspect Ratio Extraction from MediaPipe FaceLandmarker
          if (isLipTrackingEnabled) {
            const hasFace = result.lipData.faceDetected;
            setFaceDetected(hasFace);

            if (hasFace && result.lipData.lipAspectRatio > 0) {
              const realLar = result.lipData.lipAspectRatio;
              setCurrentLAR(realLar);

              larSequenceRef.current.push(realLar);
              if (larSequenceRef.current.length > 20) {
                larSequenceRef.current.shift();
              }

              // Periodically analyze temporal window every 700ms
              if (now - lastLipAnalysisRef.current > 700 && larSequenceRef.current.length >= 8) {
                lastLipAnalysisRef.current = now;
                triggerLipAnalysis([...larSequenceRef.current]);
              }

              if (onLipActivityDetected) {
                onLipActivityDetected(result.lipData.mouthOpen);
              }
            } else if (!hasFace) {
              // Face not detected in frame
              setLipStatus("face_not_detected");
              setLipConfidence(0);
              larSequenceRef.current = [];
              if (onLipActivityDetected) {
                onLipActivityDetected(false);
              }
            }
          }
        }
      }

      requestAnimationFrame(processFrame);
    };

    const animId = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, [streamActive, modelLoading, currentGesture, confidence, isLipTrackingEnabled, onGestureDetected, onLipActivityDetected, triggerLipAnalysis]);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs flex flex-col space-y-3 p-3 bg-white">
      {/* Header bar */}
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
          <Eye className="w-3.5 h-3.5 text-blue-600" />
          <span>Multimodal Non-Verbal Feed</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px]">
          <button
            onClick={() => setIsLipTrackingEnabled(!isLipTrackingEnabled)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
              isLipTrackingEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
            }`}
          >
            {isLipTrackingEnabled ? "Lip Tracking ON" : "Lip Tracking OFF"}
          </button>
          <span
            className={`w-2 h-2 rounded-full ${
              streamActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
            }`}
          />
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            streamActive ? "opacity-100" : "opacity-0"
          }`}
        />

        {!streamActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2 bg-slate-900 text-slate-300">
            <Camera className="w-8 h-8 text-slate-500 animate-bounce" />
            <p className="text-xs font-medium">Starting camera...</p>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2 bg-slate-900 text-rose-300">
            <AlertCircle className="w-7 h-7 text-rose-500" />
            <p className="text-xs max-w-xs">{cameraError}</p>
          </div>
        )}

        {/* Real-time Visual Badges Overlay */}
        {streamActive && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-md ${
                currentGesture !== "NO_GESTURE"
                  ? "bg-emerald-600/90 text-white"
                  : "bg-black/60 text-slate-300 border border-slate-700/60"
              }`}
            >
              {currentGesture !== "NO_GESTURE" ? `Gesture: ${currentGesture.replace(/_/g, " ")}` : "Gesture: None"}
            </span>

            {isLipTrackingEnabled && (
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs backdrop-blur-md flex items-center space-x-1.5 ${
                  lipStatus === "speaking"
                    ? "bg-emerald-600/90 text-white animate-pulse"
                    : lipStatus === "unclear_input"
                    ? "bg-amber-600/90 text-white"
                    : lipStatus === "face_not_detected"
                    ? "bg-rose-600/90 text-white"
                    : "bg-black/60 text-slate-300 border border-slate-700/60"
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>
                  {lipStatus === "face_not_detected" 
                    ? "FACE NOT DETECTED" 
                    : `Lip: ${lipStatus.toUpperCase()} (LAR: ${currentLAR.toFixed(2)})`}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Visual Lip-Bounding Viewfinder Guide */}
        {streamActive && isLipTrackingEnabled && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
            <div className={`w-28 h-12 rounded-xl border-2 transition-all flex items-center justify-center ${
              lipStatus === "speaking"
                ? "border-emerald-400 bg-emerald-500/10 shadow-lg"
                : "border-blue-400/60 bg-blue-500/5"
            }`}>
              <span className="text-[9px] font-mono text-white/80 font-bold">
                {lipStatus === "speaking" ? "ARTICULATING" : "LIP REGION"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* AI Lip Reading Predicted Visemes & Words Panel */}
      {isLipTrackingEnabled && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Visual Lip Reading Prediction</span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-600">
              {lipConfidence > 0 ? `${(lipConfidence * 100).toFixed(0)}% confidence` : "Uncertain / Resting"}
            </span>
          </div>

          {predictedWords.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-500 font-semibold self-center mr-1">Viseme Words:</span>
                {predictedWords.map((w, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]"
                  >
                    &quot;{w}&quot;
                  </span>
                ))}
              </div>

              {suggestedPhrases.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">Top Viseme Interpretations:</span>
                  <div className="grid grid-cols-1 gap-1">
                    {suggestedPhrases.slice(0, 3).map((p, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-medium text-[11px] flex items-center justify-between"
                      >
                        <span className="truncate">&quot;{p}&quot;</span>
                        <span className="text-[9px] text-slate-400 font-mono">Rank #{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic text-center py-1">
              {lipStatus === "face_not_detected"
                ? "Face not detected. Position your face in front of the camera."
                : lipStatus === "unclear_input"
                ? "Ambiguous lip motion. Move mouth clearly or use hand gesture."
                : "Awaiting speech articulation or lip movements in camera region..."}
            </div>
          )}
        </div>
      )}

      {/* Footer Status Indicators */}
      <div className="px-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span className="flex items-center space-x-2">
          <span>L: <strong className={leftHandTracked ? "text-emerald-600 font-bold" : "text-slate-400"}>{leftHandTracked ? "TRACKED" : "OFF"}</strong></span>
          <span>R: <strong className={rightHandTracked ? "text-emerald-600 font-bold" : "text-slate-400"}>{rightHandTracked ? "TRACKED" : "OFF"}</strong></span>
        </span>
        <span>Gesture: <strong className="text-slate-700">{currentGesture.replace(/_/g, " ")}</strong></span>
      </div>
    </div>
  );
}
