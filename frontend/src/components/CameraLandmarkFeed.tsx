"use client";

import React, { useRef, useEffect, useState } from "react";
import { Camera, CameraOff, Sparkles } from "lucide-react";
import { visionProcessor, VisionDetectionResult } from "@/lib/vision";

interface Props {
  onGestureDetected: (gesture: string) => void;
  onLipMotionDetected: (active: boolean) => void;
}

export function CameraLandmarkFeed({ onGestureDetected, onLipMotionDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string>("unknown");
  const [lipActive, setLipActive] = useState(false);

  useEffect(() => {
    let mediaStream: MediaStream | null = null;

    async function initCamera() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStreamActive(true);
        }
      } catch (err) {
        console.warn("Camera video stream unavailable:", err);
        setStreamActive(false);
      }
    }

    initCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const simulateGesture = (g: string) => {
    setCurrentGesture(g);
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
          <span className="font-semibold text-sm text-white">Visual Landmarks Feed</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            streamActive ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-slate-800 text-slate-400"
          }`}
        >
          {streamActive ? "Camera Active (On-Device)" : "Simulated / Inactive"}
        </span>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${streamActive ? "block" : "hidden"}`}
        />
        {!streamActive && (
          <div className="text-center p-4 text-slate-500 text-xs space-y-1">
            <CameraOff className="w-8 h-8 mx-auto text-slate-600 mb-1" />
            <p>Camera inactive or permission not granted.</p>
            <p className="text-indigo-400">You can use test gesture buttons below.</p>
          </div>
        )}

        {/* Live Detected Overlay Badge */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg p-2 flex items-center justify-between text-xs text-slate-200">
          <div>
            Gesture: <strong className="text-indigo-300 uppercase">{currentGesture}</strong>
          </div>
          <div>
            Lip Motion: <strong className={lipActive ? "text-emerald-400" : "text-slate-400"}>{lipActive ? "Speaking/Open" : "Resting"}</strong>
          </div>
        </div>
      </div>

      {/* Quick Gesture Trigger / Fallback Controls */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Simulate Non-Verbal Signs (Accessible Trigger)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "thumbs_up", label: "Thumbs Up 👍" },
            { id: "thumbs_down", label: "Thumbs Down 👎" },
            { id: "head_nod", label: "Nod Yes 🙆" },
            { id: "head_shake", label: "Shake No 🙅" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => simulateGesture(btn.id)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all ${
                currentGesture === btn.id
                  ? "bg-indigo-600 text-white border-indigo-400"
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
            lipActive ? "bg-purple-900/50 border-purple-500 text-purple-200" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          {lipActive ? "Simulating Lip Movement (Active)" : "Simulate Lip Movement"}
        </button>
      </div>
    </div>
  );
}

