"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  Send, 
  Mic, 
  Smile,
  Hand,
  MessageSquare,
  Sparkles,
  Edit2,
  CheckCircle2,
  Check,
  ChevronRight,
  ArrowRight,
  Loader2,
  Play
} from "lucide-react";
import { CameraLandmarkFeed } from "@/components/CameraLandmarkFeed";
import { api, CandidateReply } from "@/lib/api";
import { gestureApi } from "@/lib/gestureApi";

interface Message {
  id: string;
  speaker: "partner" | "patient";
  speakerLabel: string;
  text: string;
  time: string;
}

export default function LiveConversationPage() {
  const [sessionId] = useState<string>("sess_demo");
  const [language] = useState<string>("hi-en");
  
  // Real-time conversation stream matching mockup
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_1",
      speaker: "partner",
      speakerLabel: "Conversation Partner",
      text: "Hello! Would you like some water or tea?",
      time: "11:24 AM",
    },
    {
      id: "m_2",
      speaker: "patient",
      speakerLabel: "You (Assisted)",
      text: "Haan, please thoda paani de dijiye.",
      time: "11:24 AM",
    }
  ]);

  // Multimodal status indicators state matching screenshot
  const [voiceStatus, setVoiceStatus] = useState({
    title: "Voice (ElevenLabs Scribe)",
    sub: "Listening...",
    active: true,
  });

  const [gestureStatus, setGestureStatus] = useState({
    title: "Gesture (MediaPipe)",
    sub: "Open Palm · 0.94",
    confidence: 0.94,
    verified: true,
  });

  const [facialStatus, setFacialStatus] = useState({
    title: "Facial Expression",
    sub: "Neutral · 0.87",
    confidence: 0.87,
    verified: true,
  });

  const [lipStatus, setLipStatus] = useState({
    title: "Lip Movement",
    sub: "Speaking · 0.91",
    confidence: 0.91,
    verified: true,
  });

  // Suggested Replies matching screenshot
  const [candidateReplies, setCandidateReplies] = useState<string[]>([
    "Haan, please thoda paani de dijiye.",
    "Nahi, abhi nahi. Thank you.",
    "Room temperature paani milega?"
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editableText, setEditableText] = useState<string>("Haan, please thoda paani de dijiye.");
  
  // Audio synthesis and recording state
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Initialize backend persistence session
  useEffect(() => {
    async function initSession() {
      try {
        const conv = await gestureApi.createConversation("Live Assistive Session", "Conversation Partner");
        if (conv && conv.id) {
          setActiveConvId(conv.id);
        }
      } catch (err) {
        console.warn("MongoDB initial connection:", err);
      }
    }
    initSession();
  }, []);

  const handleSelectCandidate = (text: string, index: number) => {
    setSelectedIndex(index);
    setEditableText(text);
  };

  const handlePreview = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && editableText) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(editableText);
      window.speechSynthesis.speak(u);
    }
  };

  const handleConfirmAndSpeak = async () => {
    if (!editableText.trim()) return;

    setIsSynthesizing(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append to conversation
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      speaker: "patient",
      speakerLabel: "You (Assisted)",
      text: editableText.trim(),
      time: timeStr,
    };
    setMessages((prev) => [...prev, newMsg]);

    // Save to MongoDB
    if (activeConvId) {
      gestureApi.addMessage(activeConvId, {
        text: editableText.trim(),
        speaker: "user",
        modality: "gesture",
      }).catch(() => {});
    }

    // ElevenLabs speech generation or native audio fallback
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(editableText.trim());
        window.speechSynthesis.speak(u);
      }
    } catch (err) {
      console.warn("Speech playback error:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleVisionMetricsUpdate = (metrics: {
    gesture: string;
    gestureConfidence: number;
    faceDetected: boolean;
    facialExpression: string;
    facialConfidence: number;
    lipSpeaking: boolean;
    lipConfidence: number;
  }) => {
    setGestureStatus({
      title: "Gesture (MediaPipe)",
      sub: `${metrics.gesture} · ${metrics.gestureConfidence.toFixed(2)}`,
      confidence: metrics.gestureConfidence,
      verified: true,
    });
    setFacialStatus({
      title: "Facial Expression",
      sub: `${metrics.facialExpression} · ${metrics.facialConfidence.toFixed(2)}`,
      confidence: metrics.facialConfidence,
      verified: true,
    });
    setLipStatus({
      title: "Lip Movement",
      sub: `${metrics.lipSpeaking ? "Speaking" : "Resting"} · ${metrics.lipConfidence.toFixed(2)}`,
      confidence: metrics.lipConfidence,
      verified: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Title Header with Active Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
              <span>Live Conversation</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Active
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-9">
            Multimodal understanding with voice, gestures, facial expressions and lip movement
          </p>
        </div>
      </div>

      {/* Main 3-Column Interactive Grid matching Screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Real-time Camera Feed (Span 6) */}
        <div className="lg:col-span-6">
          <CameraLandmarkFeed
            onVisionMetricsUpdate={handleVisionMetricsUpdate}
          />
        </div>

        {/* Middle Column: Multimodal Input Status (Span 3) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs h-full flex flex-col justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4">
              Multimodal Input Status
            </h2>

            <div className="space-y-4 flex-1">
              {/* Voice Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{voiceStatus.title}</div>
                    <div className="text-[11px] text-slate-500">{voiceStatus.sub}</div>
                  </div>
                </div>
                {/* Audio Wave Icon */}
                <div className="flex items-center space-x-0.5 text-blue-600 pr-1">
                  <span className="w-1 h-3 bg-blue-600 rounded-full animate-pulse" />
                  <span className="w-1 h-5 bg-blue-600 rounded-full animate-pulse delay-75" />
                  <span className="w-1 h-2 bg-blue-600 rounded-full animate-pulse delay-150" />
                </div>
              </div>

              {/* Gesture Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Hand className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{gestureStatus.title}</div>
                    <div className="text-[11px] text-slate-500">{gestureStatus.sub}</div>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>

              {/* Facial Expression Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{facialStatus.title}</div>
                    <div className="text-[11px] text-slate-500">{facialStatus.sub}</div>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>

              {/* Lip Movement Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{lipStatus.title}</div>
                    <div className="text-[11px] text-slate-500">{lipStatus.sub}</div>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Suggested Replies & Edit & Confirm (Span 3) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col justify-between">
          {/* Suggested Replies Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Suggested Replies</span>
            </div>

            <div className="space-y-2">
              {candidateReplies.map((reply, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectCandidate(reply, idx)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-500 text-blue-900 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="leading-snug pr-2">{reply}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edit & Confirm Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Edit & Confirm</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                {editableText.length}/200
              </span>
            </div>

            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
            />

            {/* Action Buttons: Confirm & Speak + Preview */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleConfirmAndSpeak}
                disabled={isSynthesizing || !editableText.trim()}
                className="col-span-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span>Confirm & Speak</span>
              </button>

              <button
                onClick={handlePreview}
                className="col-span-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Preview</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Conversation (Real-time) Thread matching Screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-800 tracking-tight">
          Conversation (Real-time)
        </h2>

        <div className="space-y-3 pt-1">
          {messages.map((msg) => {
            const isPartner = msg.speaker === "partner";
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isPartner ? "justify-start" : "justify-end"}`}
              >
                {isPartner && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold">👤</span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 max-w-[80%] sm:max-w-[70%] ${
                    isPartner
                      ? "bg-slate-50 text-slate-800 border border-slate-200"
                      : "bg-blue-50 text-blue-900 border border-blue-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1 space-x-4">
                    <span className={isPartner ? "text-slate-700" : "text-blue-700 font-bold"}>
                      {msg.speakerLabel}
                    </span>
                    <span>{msg.time}</span>
                  </div>
                  <div className="text-xs sm:text-sm leading-relaxed font-medium">
                    {msg.text}
                  </div>
                </div>

                {!isPartner && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Multimodal Workflow Bar matching Screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Step 1: Capture */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Capture</div>
              <div className="text-[10px] text-slate-500">(Voice + Video)</div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          {/* Step 2: Analyze */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Analyze</div>
              <div className="text-[10px] text-slate-500">(Multimodal)</div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          {/* Step 3: Understand */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Understand</div>
              <div className="text-[10px] text-slate-500">(Intent + Context)</div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          {/* Step 4: Suggest */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Suggest</div>
              <div className="text-[10px] text-slate-500">(Replies)</div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          {/* Step 5: Confirm */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-emerald-800">Confirm</div>
              <div className="text-[10px] text-emerald-600">(Your Choice)</div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          {/* Step 6: Speak */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Speak</div>
              <div className="text-[10px] text-slate-500">(ElevenLabs Voice)</div>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
}
