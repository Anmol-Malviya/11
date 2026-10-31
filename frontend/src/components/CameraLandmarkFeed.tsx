"use client";

import React, { useRef, useEffect, useState } from "react";
import { Camera, CameraOff, Video, Sparkles, AlertCircle, Eye } from "lucide-react";
import { ClientVisionProcessor, VisionDetectionResult } from "@/lib/vision";

interface Props {
  onGestureDetected?: (gesture: string, confidence: number) => void;
  onLipActivityDetected?: (active: boolean) => void;
}

const visionProcessor = new ClientVisionProcessor();

export function CameraLandmarkFeed({ onGestureDetected, onLipActivityDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState("unknown");
  const [confidence, setConfidence] = useState(0);
  const [handInFrame, setHandInFrame] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

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
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("Camera access failed or denied:", err);
          setCameraError("Camera unavailable. You can continue with audio or touch response.");
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

  // Initialize MediaPipe Model
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

  // Live Detection Loop using requestAnimationFrame
  useEffect(() => {
    if (!streamActive || modelLoading) return;

    let isRunning = true;
    let lastExecution = 0;
    const THROTTLE_INTERVAL_MS = 66; // ~15 FPS to prevent CPU saturation & avoid delegate backlog

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

          const detected = result.gestureLabel;
          const conf = result.confidence;

          if (detected !== currentGesture || Math.abs(conf - confidence) > 0.1) {
            setCurrentGesture(detected);
            setConfidence(conf);
            if (onGestureDetected && detected !== "unknown") {
              onGestureDetected(detected, conf);
            }
          }

          if (result.mouthOpen !== mouthOpen) {
            setMouthOpen(result.mouthOpen);
            if (onLipActivityDetected) {
              onLipActivityDetected(result.mouthOpen);
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
  }, [streamActive, modelLoading, currentGesture, confidence, mouthOpen, onGestureDetected, onLipActivityDetected]);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs flex flex-col">
      {/* Header bar */}
      <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
          <Eye className="w-3.5 h-3.5 text-indigo-600" />
          <span>Non-Verbal Camera Ingestion</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              streamActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="text-slate-500 font-medium">
            {streamActive ? "Tracking" : "Standby"}
          </span>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            streamActive ? "opacity-100" : "opacity-0"
          }`}
        />

        {!streamActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2 bg-slate-50/90">
            <Camera className="w-8 h-8 text-slate-300 animate-bounce" />
            <p className="text-xs text-slate-500 font-medium">Starting secure local camera...</p>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2 bg-amber-50/90 text-amber-800">
            <AlertCircle className="w-7 h-7 text-amber-500" />
            <p className="text-xs max-w-xs">{cameraError}</p>
          </div>
        )}

        {/* Real-time Visual Badges Overlay */}
        {streamActive && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-md ${
                currentGesture !== "unknown"
                  ? "bg-indigo-600/90 text-white"
                  : "bg-white/80 text-slate-600 border border-slate-200/60"
              }`}
            >
              {currentGesture !== "unknown" ? `Gesture: ${currentGesture.replace("_", " ")}` : "Awaiting gesture"}
            </span>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-md ${
                mouthOpen
                  ? "bg-emerald-600/90 text-white animate-pulse"
                  : "bg-white/80 text-slate-500 border border-slate-200/60"
              }`}
            >
              {mouthOpen ? "Mouth Speaking" : "Mouth Resting"}
            </span>
          </div>
        )}
      </div>

      {/* Footer Status Indicators */}
      <div className="p-2.5 bg-white/70 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
        <span>Hand in frame: <strong className={handInFrame ? "text-emerald-600" : "text-slate-400"}>{handInFrame ? "Yes" : "No"}</strong></span>
        <span>Confidence: <strong className="text-slate-700">{Math.round(confidence * 100)}%</strong></span>
      </div>
    </div>
  );
}
