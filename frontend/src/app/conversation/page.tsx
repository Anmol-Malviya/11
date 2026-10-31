"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, RefreshCw, Send, AlertTriangle, MessageCircle, HelpCircle } from "lucide-react";
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
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ps16_session_id") || "sess_demo";
    }
    return "sess_demo";
  });
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ps16_language") || "hi-en";
    }
    return "hi-en";
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_init",
      speaker: "partner",
      text: "Hello! Would you like some water or tea?",
      time: "Just now",
    },
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
        language: lang,
      });
      setCandidates(res.candidates);
      setNeedsClarification(res.needs_clarification);
      setCurrentInferenceId(res.inference_id);
    } catch (err) {
      console.error("Inference trigger failed:", err);
    }
  };

  // Initial inference based on starting partner message
  useEffect(() => {
    triggerInference("Hello! Would you like some water or tea?", "unknown", false, sessionId, language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    const newMsg: Message = {
      id: `m_${Date.now()}`,
      speaker: "partner",
      text: partnerInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    triggerInference(partnerInput.trim(), currentGesture, lipActive);
    setPartnerInput("");
  };

  const handleGestureChange = (gesture: string) => {
    setCurrentGesture(gesture);
    const lastPartnerMsg = [...messages].reverse().find((m) => m.speaker === "partner")?.text || "";
    triggerInference(lastPartnerMsg, gesture, lipActive);
  };

  const handleLipChange = (active: boolean) => {
    setLipActive(active);
    if (active) {
      const lastPartnerMsg = [...messages].reverse().find((m) => m.speaker === "partner")?.text || "";
      triggerInference(lastPartnerMsg, currentGesture, true);
    }
  };

  const handleConfirmReply = async (candidateId?: string, editedText?: string) => {
    setIsGeneratingAudio(true);
    setAudioError("");

    try {
      const action = editedText ? "edit" : "confirm";
      const confirmation = await api.confirmReply(
        sessionId,
        currentInferenceId,
        action,
        candidateId,
        editedText
      );

      const confirmedText = confirmation.confirmed_text || editedText || "Acknowledged";

      // Append Patient message to chat stream
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          speaker: "patient",
          text: confirmedText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Request synthesized voice
      const audioBlob = await api.generateSpeech(sessionId, confirmation.confirmation_id);
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        await audioPlayerRef.current.play();
      }
    } catch (err: unknown) {
      console.error("Failed to confirm or speak:", err);
      setAudioError("Unable to synthesize audio. Check voice permissions or network.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleReject = () => {
    setCandidates([]);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Session Bar */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Live Conversation Session</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          </h1>
          <p className="text-xs text-slate-500">
            Real-time multimodal speech and gesture fusion
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              sessionStorage.setItem("ps16_language", e.target.value);
            }}
            className="text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="hi-en">Code-mixed (Hindi + English)</option>
            <option value="en">English (US/UK)</option>
            <option value="hi">Hindi (Devanagari)</option>
          </select>

          <button
            onClick={() =>
              triggerInference(
                [...messages].reverse().find((m) => m.speaker === "partner")?.text || "Help me respond",
                currentGesture,
                lipActive
              )
            }
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Responsive 2-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column: Camera + Live Transcripts (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <CameraLandmarkFeed
            onGestureDetected={handleGestureChange}
            onLipActivityDetected={handleLipChange}
          />

          {/* Transcript / Dialogue Feed */}
          <div className="glass-panel rounded-2xl p-4 space-y-3 flex flex-col h-[280px] sm:h-[340px]">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 border-b border-slate-100 pb-2">
              <span className="flex items-center space-x-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
                <span>Conversation Context</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Dual stream</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs sm:text-sm">
              {messages.map((msg) => {
                const isPartner = msg.speaker === "partner";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isPartner ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                        isPartner
                          ? "bg-slate-100 text-slate-800 rounded-tl-xs"
                          : "bg-gradient-to-r from-indigo-600 to-sky-600 text-white rounded-tr-xs"
                      }`}
                    >
                      <div className="text-[10px] opacity-75 font-medium mb-0.5">
                        {isPartner ? "Partner" : "You (Spoken Voice)"}
                      </div>
                      <div className="leading-snug">{msg.text}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Simulated Partner Input Form */}
            <form onSubmit={handlePartnerSubmit} className="pt-2 border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                placeholder="Partner speaking or typing..."
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                title="Send partner prompt"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Candidate Responses & Confirmation Gate (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
            {audioError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{audioError}</span>
              </div>
            )}

            <ReplyCandidates
              candidates={candidates}
              needsClarification={needsClarification}
              onConfirm={handleConfirmReply}
              onReject={handleReject}
              isGeneratingAudio={isGeneratingAudio}
            />
          </div>
        </div>
      </div>

      {/* Hidden Audio Player */}
      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
}
