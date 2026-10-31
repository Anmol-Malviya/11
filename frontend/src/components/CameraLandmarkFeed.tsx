"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { visionProcessor, VisionDetectionResult } from "@/lib/vision";

interface Props {
  onGestureDetected: (gesture: string) => void;
  onLipMotionDetected: (active: boolean) => void;
}

export function CameraLandmarkFeed({ onGestureDetected, onLipMotionDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastGestureReportedRef = useRef<string>("unknown");
  const gestureDebounceCountRef = useRef<Record<string, number>>({});

  const [streamActive, setStreamActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [currentGesture, setCurrentGesture] = useState<string>("unknown");
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [handInFrame, setHandInFrame] = useState(false);
  const [lipActive, setLipActive] = useState(false);

  // 1. Initialize Camera
  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let isCancelled = false;

    async function initCamera() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          }
        });

        if (videoRef.current && !isCancelled) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((err) => console.warn("Video play error:", err));
            setStreamActive(true);
          };
        }
      } catch (err) {
        console.warn("Camera video stream unavailable:", err);
        if (!isCancelled) setStreamActive(false);
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

  // 2. Initialize MediaPipe Model
  useEffect(() => {
    let isCancelled = false;

    async function loadModel() {
      setModelLoading(true);
      const recognizer = await visionProcessor.initializeRecognizer();
      if (!isCancelled) {
        setModelLoading(false);
      }
    }

    loadModel();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 3. Live Detection Loop using requestAnimationFrame
  useEffect(() => {
    if (!streamActive || modelLoading) return;

    let isRunning = true;

    const processFrame = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused && !video.ended) {
        const timestamp = performance.now();
        const result: VisionDetectionResult = visionProcessor.detectForVideo(video, timestamp);

        setHandInFrame(result.handDetected);

        const detected = result.gestureLabel;
        const confidence = result.confidence;

        if (confidence > 0.4 && detected !== "unknown") {
          // Debounce detection over multiple consecutive frames
          gestureDebounceCountRef.current[detected] = (gestureDebounceCountRef.current[detected] || 0) + 1;

          if (gestureDebounceCountRef.current[detected] >= 3) {
            if (lastGestureReportedRef.current !== detected) {
              lastGestureReportedRef.current = detected;
              setCurrentGesture(detected);
              setDetectionConfidence(Math.round(confidence * 100));
              onGestureDetected(detected);
            }
          }
        } else if (!result.handDetected) {
          gestureDebounceCountRef.current = {};
          if (lastGestureReportedRef.current !== "unknown") {
            lastGestureReportedRef.current = "unknown";
            setCurrentGesture("unknown");
            setDetectionConfidence(0);
            onGestureDetected("unknown");
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [streamActive, modelLoading, onGestureDetected]);

  // Manual fallback simulation
  const simulateGesture = (g: string) => {
    lastGestureReportedRef.current = g;
    setCurrentGesture(g);
    setDetectionConfidence(100);
    onGestureDetected(g);
  };

  const toggleLip = () => {
    const next = !lipActive;
    setLipActive(next);
    onLipMotionDetected(next);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {streamActive ? (
            <Camera className="w-5 h-5 text-purple-400" />
          ) : (
            <CameraOff className="w-5 h-5 text-slate-500" />
          )}
          <span className="font-semibold text-sm text-white">Visual Gesture Feed (MediaPipe AI)</span>
        </div>
        <div className="flex items-center space-x-2">
          {modelLoading ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading AI Model...</span>
            </span>
          ) : streamActive ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Live AI Tracking</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
              Camera Inactive
            </span>
          )}
        </div>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${streamActive ? "block" : "hidden"}`}
        />

        {!streamActive && (
          <div className="text-center p-4 text-slate-500 text-xs space-y-1">
            <CameraOff className="w-8 h-8 mx-auto text-slate-600 mb-1" />
            <p>Camera inactive or permission not granted.</p>
            <p className="text-indigo-400">You can test gestures using buttons below.</p>
          </div>
        )}

        {/* Live Detected Overlay Badge */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-lg p-2.5 flex items-center justify-between text-xs text-slate-200 shadow-md">
          <div className="flex items-center space-x-2">
            <span>Gesture:</span>
            <strong
              className={`px-2 py-0.5 rounded uppercase text-[11px] ${
                currentGesture !== "unknown"
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {currentGesture.replace("_", " ")}
            </strong>
            {detectionConfidence > 0 && (
              <span className="text-[10px] text-emerald-400 font-mono">({detectionConfidence}%)</span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-[11px]">
            <span>Hand in frame:</span>
            <span
              className={`w-2 h-2 rounded-full ${
                handInFrame ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Quick Accessible Fallback Controls */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Manual Quick Signs (Accessible Trigger)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "thumbs_up", label: "Thumbs Up 👍" },
            { id: "thumbs_down", label: "Thumbs Down 👎" },
            { id: "open_palm", label: "Open Palm ✋" },
            { id: "pointing", label: "Pointing ☝️" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => simulateGesture(btn.id)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all ${
                currentGesture === btn.id
                  ? "bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-500/50"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleLip}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
            lipActive
              ? "bg-purple-900/50 border-purple-500 text-purple-200"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          {lipActive ? "Simulating Lip Movement (Active)" : "Simulate Lip Movement"}
        </button>
      </div>
    </div>
  );
}
