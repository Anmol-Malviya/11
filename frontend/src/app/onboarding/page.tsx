"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Video, Check, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [camGranted, setCamGranted] = useState<boolean | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("hi-en");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const requestPermissions = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setMicGranted(true);
      setCamGranted(true);
      // Release stream after permission test
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      console.warn("Permission request error:", err);
      // Attempt separate queries
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicGranted(true);
        audioStream.getTracks().forEach((t) => t.stop());
      } catch {
        setMicGranted(false);
      }
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCamGranted(true);
        videoStream.getTracks().forEach((t) => t.stop());
      } catch {
        setCamGranted(false);
      }
      setErrorMsg("Camera or Microphone permission was partially denied. The app can still run in accessible text/phrase mode.");
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const session = await api.createSession(selectedLanguage);
      sessionStorage.setItem("ps16_session_id", session.session_id);
      sessionStorage.setItem("ps16_language", selectedLanguage);
      router.push("/conversation");
    } catch (err) {
      console.error(err);
      // Fallback local demo session if backend is initializing
      sessionStorage.setItem("ps16_session_id", "sess_demo_local");
      sessionStorage.setItem("ps16_language", selectedLanguage);
      router.push("/conversation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white">Setup & Permissions</h1>
        <p className="text-slate-300">
          Configure your conversation preferences and permit browser sensor access.
        </p>
      </div>

      {/* Language Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Select Language Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "hi-en", label: "Hinglish (Code-Mixed)", desc: "English + Hindi combined" },
            { id: "en", label: "English", desc: "Standard English" },
            { id: "hi", label: "Hindi (हिंदी)", desc: "Pure Hindi dialogue" }
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLanguage(lang.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedLanguage === lang.id
                  ? "bg-indigo-600/20 border-indigo-500 text-white"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              <div className="font-semibold text-sm">{lang.label}</div>
              <div className="text-xs text-slate-400 mt-1">{lang.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Permission Checkers */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-white">Sensor Permissions</h2>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mic className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-sm font-semibold text-white">Microphone</div>
                <div className="text-xs text-slate-400">Listens to conversation partner</div>
              </div>
            </div>
            {micGranted === true ? (
              <span className="flex items-center text-xs text-emerald-400 font-medium">
                <Check className="w-4 h-4 mr-1" /> Granted
              </span>
            ) : micGranted === false ? (
              <span className="flex items-center text-xs text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 mr-1" /> Denied
              </span>
            ) : (
              <span className="text-xs text-slate-400">Pending</span>
            )}
          </div>

          <div className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Video className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-sm font-semibold text-white">Camera</div>
                <div className="text-xs text-slate-400">Non-verbal gesture & lip landmarks</div>
              </div>
            </div>
            {camGranted === true ? (
              <span className="flex items-center text-xs text-emerald-400 font-medium">
                <Check className="w-4 h-4 mr-1" /> Granted
              </span>
            ) : camGranted === false ? (
              <span className="flex items-center text-xs text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 mr-1" /> Denied
              </span>
            ) : (
              <span className="text-xs text-slate-400">Pending</span>
            )}
          </div>
        </div>

        {micGranted === null && (
          <button
            onClick={requestPermissions}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-600 transition-colors"
          >
            Request Microphone & Camera Access
          </button>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-lg shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
      >
        <span>{loading ? "Starting Session..." : "Enter Live Conversation"}</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

