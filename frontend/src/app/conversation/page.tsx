"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { CameraLandmarkFeed } from "@/components/CameraLandmarkFeed";
import { ReplyCandidates } from "@/components/ReplyCandidates";
import { api, CandidateReply } from "@/lib/api";

interface Message {
  id: string;
  speaker: "partner" | "patient";
  text: string;
  time: string;
}

export default function ConversationPage() {
  const [sessionId, setSessionId] = useState<string>("sess_demo");
  const [language, setLanguage] = useState("hi-en");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_init",
      speaker: "partner",
      text: "Hello! Would you like some water or tea?",
      time: "Just now"
    }
  ]);
  const [partnerInput, setPartnerInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentGesture, setCurrentGesture] = useState("unknown");
  const [lipActive, setLipActive] = useState(false);
  const [candidates, setCandidates] = useState<CandidateReply[]>([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [currentInferenceId, setCurrentInferenceId] = useState("");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Initialize session from storage
  useEffect(() => {
    const savedId = sessionStorage.getItem("ps16_session_id") || "sess_demo";
    const savedLang = sessionStorage.getItem("ps16_language") || "hi-en";
    setSessionId(savedId);
    setLanguage(savedLang);

    // Initial inference based on starting partner message
    triggerInference("Hello! Would you like some water or tea?", "unknown", false, savedId, savedLang);
  }, []);

  const triggerInference = async (
    transcript: string,
    gesture: string,
    lip: boolean,
    sessId = sessionId,
    lang = language
  ) => {
    try {
      const res = await api.runInference({
        session_id: sessId,
        raw_transcript_text: transcript,
        detected_gesture: gesture,
        lip_active: lip,
        language: lang
      });
      setCandidates(res.candidates);
      setNeedsClarification(res.needs_clarification);
      setCurrentInferenceId(res.inference_id);
    } catch (err) {
      console.error("Inference trigger failed:", err);
    }
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    const newMsg: Message = {
      id: `m_${Date.now()}`,
      speaker: "partner",
      text: partnerInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, newMsg]);
    const txt = partnerInput.trim();
    setPartnerInput("");
    triggerInference(txt, currentGesture, lipActive);
  };

  const handleGestureDetected = (gesture: string) => {
    setCurrentGesture(gesture);
    const lastPartnerText = messages.slice().reverse().find((m) => m.speaker === "partner")?.text || "";
    triggerInference(lastPartnerText, gesture, lipActive);
  };

  const handleLipMotionDetected = (active: boolean) => {
    setLipActive(active);
    const lastPartnerText = messages.slice().reverse().find((m) => m.speaker === "partner")?.text || "";
    triggerInference(lastPartnerText, currentGesture, active);
  };

  const handleConfirmCandidate = async (candidateId?: string, editedText?: string) => {
    setAudioError("");
    setIsGeneratingAudio(true);
    try {
      // 1. Send confirmation gate action
      const confRes = await api.confirmReply(
        sessionId,
        currentInferenceId,
        editedText ? "edit" : "confirm",
        candidateId,
        editedText
      );

      const confirmedText = confRes.confirmed_text || "Affirmative.";

      // Add to conversation transcript as verified patient speech
      const patientMsg: Message = {
        id: `p_${Date.now()}`,
        speaker: "patient",
        text: confirmedText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, patientMsg]);

      // 2. Synthesize speech using ElevenLabs (or high-fidelity PCM audio fallback)
      const audioBlob = await api.generateSpeech(sessionId, confRes.confirmation_id);
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        await audioPlayerRef.current.play();
      }
    } catch (err: any) {
      console.error("Speech playback error:", err);
      setAudioError(err.message || "Speech synthesis failed. Response preserved in transcript.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleRejectCandidate = async () => {
    if (!currentInferenceId) return;
    try {
      await api.confirmReply(sessionId, currentInferenceId, "reject");
      setCandidates([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* Hidden audio element for speech playback */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Left Column: Live Video, Landmarks & Sensors (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <CameraLandmarkFeed
          onGestureDetected={handleGestureDetected}
          onLipMotionDetected={handleLipMotionDetected}
        />

        {/* Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
          <div className="flex justify-between items-center text-slate-400 font-semibold uppercase tracking-wider">
            <span>Session Metadata</span>
            <span className="text-emerald-400">Connected</span>
          </div>
          <div className="flex justify-between">
            <span>Session ID:</span>
            <span className="font-mono text-indigo-300">{sessionId}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Language:</span>
            <span className="uppercase text-white font-medium">{language}</span>
          </div>
          <div className="flex justify-between">
            <span>Agency Guarantee:</span>
            <span className="text-purple-400 font-medium">User Confirmation Only</span>
          </div>
        </div>
      </div>

      {/* Right Column: Live Conversation Transcript & Reply Candidates (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Live Conversation Transcript */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[380px] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-bold text-white text-base">Conversation Transcript</h2>
            <span className="text-xs text-slate-400">Real-Time Speaker Feed</span>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.speaker === "partner" ? "items-start" : "items-end"
                }`}
              >
                <div className="text-xs text-slate-400 mb-1 flex items-center space-x-1">
                  <span>{m.speaker === "partner" ? "Partner (Spoken)" : "You (Confirmed Assistive Speech)"}</span>
                  <span>•</span>
                  <span>{m.time}</span>
                </div>
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-sm sm:text-base ${
                    m.speaker === "partner"
                      ? "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700"
                      : "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Partner Speech / Simulated Partner Input */}
          <form onSubmit={handlePartnerSubmit} className="pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Partner speech input (or enter partner question)..."
              value={partnerInput}
              onChange={(e) => setPartnerInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-600 flex items-center space-x-1"
            >
              <Send className="w-4 h-4" />
              <span>Simulate</span>
            </button>
          </form>
        </div>

        {/* Audio Error Alert if any */}
        {audioError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{audioError}</span>
          </div>
        )}

        {/* Reply Candidates & Human Confirmation Gate */}
        <ReplyCandidates
          candidates={candidates}
          needsClarification={needsClarification}
          onConfirm={handleConfirmCandidate}
          onReject={handleRejectCandidate}
          isGeneratingAudio={isGeneratingAudio}
        />
      </div>
    </div>
  );
}

