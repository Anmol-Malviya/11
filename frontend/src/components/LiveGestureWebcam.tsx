"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, RefreshCw, AlertCircle, Eye, Smartphone, QrCode } from "lucide-react";
import { gestureApi, GesturePrediction } from "@/lib/gestureApi";
import { PhoneCameraModal } from "@/components/PhoneCameraModal";

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
  const remoteImgRef = useRef<HTMLImageElement | null>(null);

  const [cameraSource, setCameraSource] = useState<"laptop" | "phone">("laptop");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [stableGesture, setStableGesture] = useState<string>("blank");
  const [stableConfidence, setStableConfidence] = useState<number>(0);

  // Phone remote camera pairing (Token-based)
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [pairingToken, setPairingToken] = useState<string>("");
  const [remoteFrameSrc, setRemoteFrameSrc] = useState<string | null>(null);

  // Temporal smoothing queue (last 5 detections)
  const historyRef = useRef<{ gesture: string; confidence: number; timestamp: number }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate 6-digit alphanumeric token on mount
  useEffect(() => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPairingToken(token);
    
    // Register laptop session
    fetch(`/api/remote-camera/session/${token}/register?role=laptop`, { method: "POST" }).catch(() => {});
  }, []);

  // Poll for phone frames using HTTP token endpoint (works across 4G/5G, hotspots, and any network)
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

            if (data.image) {
              setRemoteFrameSrc(data.image);
            }
            if (data.prediction) {
              handlePredictionResult(data.prediction);
            }
          } else {
            setIsPhoneConnected(false);
          }
        }
      } catch (err) {}
    }, 250); // Poll 4 times/sec

    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [pairingToken]);

  const handlePredictionResult = (pred: GesturePrediction) => {
    if (phraseMapping && phraseMapping[pred.predicted_gesture]) {
      pred.mapped_phrase = phraseMapping[pred.predicted_gesture];
    }

    const now = Date.now();
    historyRef.current.push({
      gesture: pred.predicted_gesture,
      confidence: pred.confidence,
      timestamp: now
    });
    if (historyRef.current.length > 5) {
      historyRef.current.shift();
    }

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

    if (pred.is_reliable || (avgConfidence >= confidenceThreshold && highestGesture !== "blank")) {
      onGestureRecognized({
        ...pred,
        predicted_gesture: highestGesture,
        confidence: avgConfidence,
        mapped_phrase: (phraseMapping && phraseMapping[highestGesture]) || pred.mapped_phrase
      });
    }
  };

  // Start laptop webcam
  const startLaptopCamera = async () => {
    setCameraError(null);
    setCameraSource("laptop");
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
  };

  // Capture single frame from laptop webcam: extracts centered ROI corresponding to the green viewfinder box
  const captureAndPredict = useCallback(async () => {
    if (cameraSource !== "laptop" || !videoRef.current || !canvasRef.current || isProcessing) return;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    const canvas = canvasRef.current;
    // Extract centered square ROI matching viewfinder box (50% of min dimension)
    const roiSize = Math.floor(Math.min(vw, vh) * 0.50);
    const sx = Math.floor((vw - roiSize) / 2);
    const sy = Math.floor((vh - roiSize) / 2);

    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the cropped ROI directly onto the canvas
    ctx.drawImage(video, sx, sy, roiSize, roiSize, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.75);

    setIsProcessing(true);
    try {
      const pred = await gestureApi.predictGesture(base64Data, confidenceThreshold);
      handlePredictionResult(pred);
    } catch (e) {
      console.error("Frame inference error:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [cameraSource, confidenceThreshold, isProcessing]);

  // Continuous loop for laptop webcam
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isCameraActive && cameraSource === "laptop") {
      intervalId = setInterval(() => {
        captureAndPredict();
      }, 250); // 4 FPS
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive, cameraSource, captureAndPredict]);

  useEffect(() => {
    return () => {
      stopLaptopCamera();
    };
  }, []);

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
            CNN (100x120)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* QR Code Phone Camera Button with Token */}
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            title="Scan QR to pair phone camera with token"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isPhoneConnected ? `Phone Paired (${pairingToken}) ✓` : "Use Phone Camera (Token QR)"}</span>
          </button>

          {cameraSource === "laptop" && !isCameraActive ? (
            <button
              onClick={startLaptopCamera}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Laptop Cam</span>
            </button>
          ) : cameraSource === "laptop" && isCameraActive ? (
            <>
              <button
                onClick={captureAndPredict}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-medium flex items-center space-x-1 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                <span>Capture</span>
              </button>
              <button
                onClick={stopLaptopCamera}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setCameraSource("laptop");
                startLaptopCamera();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Switch to Laptop Cam
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative aspect-video w-full rounded-2xl bg-black/60 overflow-hidden mt-3 flex items-center justify-center border border-slate-800/80">
        {/* Laptop Video Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            cameraSource === "laptop" && isCameraActive ? "block" : "hidden"
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Remote Phone Camera Stream Image */}
        {cameraSource === "phone" && remoteFrameSrc && (
          <img
            ref={remoteImgRef}
            src={remoteFrameSrc}
            alt="Remote Phone Camera Stream"
            className="w-full h-full object-contain"
          />
        )}

        {/* Hand Overlay Target Guide Box */}
        {((cameraSource === "laptop" && isCameraActive) || (cameraSource === "phone" && isPhoneConnected)) && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-emerald-400/70 rounded-2xl flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono bg-black/50 px-1.5 py-0.5 rounded self-start">
                ROI (100x120)
              </span>
              <span className="text-[10px] text-emerald-400/80 text-center font-sans">
                Position gesture inside target
              </span>
            </div>
          </div>
        )}

        {/* Standby / Phone Connect Prompt */}
        {!isCameraActive && (!isPhoneConnected || cameraSource === "laptop") && !cameraError && (
          <div className="text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Eye className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-300 font-medium">Camera is currently paused.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              <button
                onClick={startLaptopCamera}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-sm transition"
              >
                Start Laptop Camera
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-indigo-300 flex items-center space-x-1.5 transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Use Phone Camera (Token QR)</span>
              </button>
            </div>
          </div>
        )}

        {/* Camera Error Message with One-click Phone Fallback */}
        {cameraError && (
          <div className="text-center p-6 space-y-3 bg-rose-950/40 rounded-2xl border border-rose-800/50 max-w-md m-4">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-semibold text-rose-200">{cameraError}</p>
            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                onClick={startLaptopCamera}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 rounded-xl text-xs font-semibold text-white"
              >
                Retry Laptop Cam
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white flex items-center space-x-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan Phone QR</span>
              </button>
            </div>
          </div>
        )}

        {/* Real-time gesture badge overlay */}
        {((cameraSource === "laptop" && isCameraActive) || (cameraSource === "phone" && isPhoneConnected)) && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-xl flex items-center space-x-3 text-xs shadow-lg">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-mono">
                  {cameraSource === "phone" ? "Phone Gesture" : "Laptop Gesture"}
                </span>
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

            {cameraSource === "phone" && isPhoneConnected && (
              <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 px-2.5 py-1 rounded-lg text-[11px] flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Token: {pairingToken}</span>
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
