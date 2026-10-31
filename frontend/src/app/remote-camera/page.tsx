"use client";

import React, { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CameraOff, Smartphone, RefreshCw, CheckCircle2, AlertCircle, FlipHorizontal } from "lucide-react";
import { gestureApi, GesturePrediction } from "@/lib/gestureApi";

function RemoteCameraClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "default_session";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [statusMessage, setStatusMessage] = useState("Connecting to laptop session...");
  const [detectedGesture, setDetectedGesture] = useState<string>("blank");
  const [confidence, setConfidence] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize WebSocket connection to backend
  useEffect(() => {
    let wsUrl = "";
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Connect to same host or configured backend
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        wsUrl = `${proto}//${window.location.hostname}:8000/ws/remote-camera/${sessionId}`;
      } else {
        wsUrl = `${proto}//${window.location.host}/ws/remote-camera/${sessionId}`;
      }
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusMessage("Paired with Laptop!");
      ws.send(JSON.stringify({ role: "phone" }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "STATUS") {
          setStatusMessage(data.message);
        }
      } catch (e) {}
    };

    ws.onerror = () => {
      setStatusMessage("Connection error with backend.");
    };

    ws.onclose = () => {
      setStatusMessage("Disconnected from laptop.");
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Start mobile camera
  const startCamera = async (mode = facingMode) => {
    setErrorMsg(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
      setStatusMessage("Camera live! Point at your hand gestures.");
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setErrorMsg("Camera permission denied or camera not found on this phone.");
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setStatusMessage("Camera paused.");
  };

  const flipCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Continuous frame capture loop
  const captureAndSend = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessingRef.current || !isStreaming) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.65);

    isProcessingRef.current = true;
    try {
      // 1. Run CNN model prediction on backend
      const pred = await gestureApi.predictGesture(b64, 0.60);
      setDetectedGesture(pred.predicted_gesture);
      setConfidence(pred.confidence);

      // 2. Stream remote frame & prediction to laptop over WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "FRAME",
          image: b64,
          prediction: pred
        }));
      }
    } catch (err) {
      console.error("Inference or stream error:", err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [isStreaming]);

  useEffect(() => {
    let interval: any = null;
    if (isStreaming) {
      interval = setInterval(() => {
        captureAndSend();
      }, 250); // 4 FPS
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, captureAndSend]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Phone Camera Node</h1>
            <span className="text-[10px] text-slate-400 font-mono">Session: {sessionId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={flipCamera}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Flip camera"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative aspect-4/3 w-full rounded-3xl bg-black overflow-hidden my-4 border border-slate-800 flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Hand Guide Target Box */}
        {isStreaming && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-44 h-44 border-2 border-dashed border-emerald-400 rounded-2xl flex flex-col justify-between p-2">
              <span className="text-[9px] text-emerald-400 uppercase font-mono bg-black/60 px-1 rounded self-start">
                ROI (100x120)
              </span>
              <span className="text-[10px] text-emerald-300 text-center font-medium">
                Hold hand inside
              </span>
            </div>
          </div>
        )}

        {!isStreaming && (
          <div className="text-center p-6 space-y-3">
            <Camera className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">Tap below to turn on your phone&apos;s camera.</p>
          </div>
        )}

        {/* Live Detected Overlay */}
        {isStreaming && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-2.5 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Gesture</span>
              <span className="font-bold text-white text-sm capitalize">
                {detectedGesture !== "blank" ? detectedGesture : "Waiting..."}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Confidence</span>
              <span className="font-mono font-bold text-emerald-400">
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="space-y-3">
        {!isStreaming ? (
          <button
            onClick={() => startCamera()}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition active:scale-98"
          >
            <Camera className="w-4 h-4" />
            <span>Turn On Phone Camera</span>
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition active:scale-98"
          >
            <CameraOff className="w-4 h-4" />
            <span>Pause Stream</span>
          </button>
        )}

        {/* Status card */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300 font-medium">{statusMessage}</span>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Helper guide */}
      <div className="mt-auto pt-6 text-center text-xs text-slate-500">
        Frames and hand gestures are streamed live to your laptop screen in real time.
      </div>
    </div>
  );
}

export default function RemoteCameraPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-white">Loading remote camera...</div>}>
      <RemoteCameraClient />
    </Suspense>
  );
}

