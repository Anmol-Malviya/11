"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Layers,
  Volume2, 
  RefreshCw, 
  Send, 
  AlertCircle, 
  MessageSquare, 
  Mic, 
  MicOff, 
  Check, 
  SlidersHorizontal,
  Loader2
} from "lucide-react";
import { CameraLandmarkFeed } from "@/components/CameraLandmarkFeed";
import { ReplyCandidates } from "@/components/ReplyCandidates";
import { api, CandidateReply } from "@/lib/api";
import { gestureApi } from "@/lib/gestureApi";

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
  const [currentGesture, setCurrentGesture] = useState("unknown");
  const [lipActive, setLipActive] = useState(false);
  const [lastLipReading, setLastLipReading] = useState<string>("");
  const [lipStatus, setLipStatus] = useState<string>("resting");
  const [detectedVisemes, setDetectedVisemes] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CandidateReply[]>([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [currentInferenceId, setCurrentInferenceId] = useState("");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const triggerInference = async (
    transcript: string,
    gesture: string,
    lip: boolean,
    sessId = sessionId,
    lang = language,
    lipWords: string[] = [],
    curLipStatus = "resting"
  ) => {
    try {
      const wordsToPass = lipWords.length > 0 ? lipWords : (lastLipReading ? [lastLipReading] : []);
      const res = await api.runInference({
        session_id: sessId,
        raw_transcript_text: transcript,
        detected_gesture: gesture,
        lip_active: lip,
        language: lang,
        lip_reading_words: wordsToPass,
        lip_reading_status: curLipStatus || lipStatus,
      });
      setCandidates(res.candidates);
      setNeedsClarification(res.needs_clarification);
      setCurrentInferenceId(res.inference_id);
    } catch (err) {
      console.error("Inference trigger failed:", err);
    }
  };

  // Initialize MongoDB conversation thread & initial inference based on starting partner message
  useEffect(() => {
    let isMounted = true;
    async function initConversation() {
      try {
        const conv = await gestureApi.createConversation("Live Assistive Session", "Conversation Partner");
        if (isMounted && conv && conv.id) {
          setActiveConvId(conv.id);
          // Log initial greeting to db
          await gestureApi.addMessage(conv.id, {
            text: "Hello! Would you like some water or tea?",
            speaker: "partner",
            modality: "typed",
          });
        }
      } catch (err) {
        console.warn("MongoDB conversation initialization notice:", err);
      }
    }

    initConversation();
    triggerInference("Hello! Would you like some water or tea?", "unknown", false, sessionId, language);
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Microphone audio capture & ElevenLabs STT
  const startRecording = async () => {
    try {
      setAudioError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setIsTranscribing(true);
        try {
          const result = await api.transcribeAudio(sessionId, audioBlob, language);
          const transcribedText = result.text;
          if (transcribedText) {
            const newMsg: Message = {
              id: `m_${Date.now()}`,
              speaker: "partner",
              text: transcribedText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, newMsg]);

            if (activeConvId) {
              gestureApi.addMessage(activeConvId, {
                text: transcribedText,
                speaker: "partner",
                modality: "speech_to_text",
              }).catch(() => {});
            }

            triggerInference(transcribedText, currentGesture, lipActive);
          }
        } catch (err: unknown) {
          console.error("Transcription error:", err);
          setAudioError("Speech recognition failed. You can type or record again.");
        } finally {
          setIsTranscribing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      console.error("Microphone access error:", err);
      setAudioError("Microphone access was denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    const text = partnerInput.trim();
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      speaker: "partner",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (activeConvId) {
      gestureApi.addMessage(activeConvId, {
        text,
        speaker: "partner",
        modality: "typed",
      }).catch(() => {});
    }
    triggerInference(text, currentGesture, lipActive);
    setPartnerInput("");
  };

  const handleGestureChange = (gesture: string) => {
    setCurrentGesture(gesture);
    const lastPartnerMsg = [...messages].reverse().find((m) => m.speaker === "partner")?.text || "";
    triggerInference(lastPartnerMsg, gesture, lipActive);
  };

  const handleLipChange = (active: boolean) => {
    setLipActive(active);
    const lastPartnerMsg = [...messages].reverse().find((m) => m.speaker === "partner")?.text || "";
    triggerInference(lastPartnerMsg, currentGesture, active);
  };

  const handleLipReadingPredicted = (result: any) => {
    if (result.status) {
      setLipStatus(result.status);
    }
    if (result.visemes_detected) {
      setDetectedVisemes(result.visemes_detected);
    }
    if (result.predicted_words && result.predicted_words.length > 0) {
      setLastLipReading(result.predicted_words[0]);
      const lastPartnerMsg = [...messages].reverse().find((m) => m.speaker === "partner")?.text || "";
      triggerInference(
        lastPartnerMsg, 
        currentGesture, 
        lipActive, 
        sessionId, 
        language, 
        result.predicted_words, 
        result.status
      );
    }
  };

  const handleConfirmReply = async (candidateId?: string, editedText?: string) => {
    if (!currentInferenceId) return;
    setIsGeneratingAudio(true);
    setAudioError("");

    try {
      const chosenText =
        editedText ||
        candidates.find((c) => c.candidate_id === candidateId)?.text ||
        "Yes, thank you.";

      const newMsg: Message = {
        id: `m_${Date.now()}`,
        speaker: "patient",
        text: chosenText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMsg]);

      if (activeConvId) {
        gestureApi.addMessage(activeConvId, {
          text: chosenText,
          speaker: "user",
          modality: currentGesture !== "unknown" ? "gesture" : "speech_to_text",
          gesture_label: currentGesture !== "unknown" ? currentGesture : undefined,
        }).catch(() => {});
      }

      const confirmation = await api.confirmReply(
        sessionId,
        currentInferenceId,
        editedText ? "edit" : "confirm",
        candidateId,
        editedText
      );

      const audioBlob = await api.generateSpeech(sessionId, confirmation.confirmation_id);
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        await audioPlayerRef.current.play();
      }
    } catch (err: unknown) {
      console.error("Failed to confirm or speak:", err);
      // Fallback to native browser synthesis for high resilience
      const chosen = editedText || candidates.find((c) => c.candidate_id === candidateId)?.text || "";
      if (typeof window !== "undefined" && "speechSynthesis" in window && chosen) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(chosen);
        window.speechSynthesis.speak(u);
      } else {
        setAudioError("Unable to synthesize audio. Check voice permissions or network.");
      }
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleReject = () => {
    setCandidates([]);
  };

  return (
    <div className="space-y-6">
      {/* 2.5D Session Header Card */}
      <div className="panel-25d p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-xs">
            <Layers className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Multimodal Assistive Workspace
              </h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Feed Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Intelligent real-time fusion of lip articulation, dual-hand gestures, and dialogue context
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              sessionStorage.setItem("ps16_language", e.target.value);
            }}
            className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 shadow-2xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-all shadow-2xs border border-indigo-200/80 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh Intent</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Video & Dialogue, Right Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera + Conversation Dialogue */}
        <div className="lg:col-span-5 space-y-4">
          <CameraLandmarkFeed
            onGestureDetected={handleGestureChange}
            onLipActivityDetected={handleLipChange}
            onLipReadingPredicted={handleLipReadingPredicted}
          />

          {/* Dialogue Thread */}
          <div className="panel-25d p-4 space-y-3 flex flex-col h-[340px]">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2.5">
              <span className="flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Dialogue Context</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Dual stream</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {messages.map((msg) => {
                const isPartner = msg.speaker === "partner";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isPartner ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                        isPartner
                          ? "bg-slate-100 text-slate-900 border border-slate-200"
                          : "bg-blue-600 text-white font-medium shadow-xs"
                      }`}
                    >
                      <div className="text-[10px] opacity-75 font-semibold mb-0.5">
                        {isPartner ? "Partner" : "You (Spoken Voice)"}
                      </div>
                      <div className="leading-relaxed">{msg.text}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Partner Speech / Typed Entry with Live Microphone */}
            <form onSubmit={handlePartnerSubmit} className="pt-2.5 border-t border-slate-100 flex items-center space-x-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`p-2 rounded-lg font-medium transition-all ${
                  isRecording 
                    ? "bg-rose-600 text-white animate-pulse" 
                    : isTranscribing 
                      ? "bg-amber-100 text-amber-700 cursor-not-allowed" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
                title={isRecording ? "Stop recording speech" : "Record partner speech (ElevenLabs Scribe)"}
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                ) : isRecording ? (
                  <MicOff className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
              <input
                type="text"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                placeholder={isRecording ? "Listening to speech..." : isTranscribing ? "Transcribing speech..." : "Type partner speech or prompt..."}
                disabled={isRecording || isTranscribing}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-75"
              />
              <button
                type="submit"
                disabled={isRecording || isTranscribing || !partnerInput.trim()}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                title="Send partner prompt"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Suggested Candidate Responses */}
        <div className="lg:col-span-7 space-y-4">
          <div className="panel-25d p-5 sm:p-6 space-y-4">
            {audioError && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>{audioError}</span>
              </div>
            )}

            <ReplyCandidates
              candidates={candidates}
              needsClarification={needsClarification}
              onConfirm={handleConfirmReply}
              onReject={handleReject}
              isGeneratingAudio={isGeneratingAudio}
              lipStatus={lipStatus}
              detectedVisemes={detectedVisemes}
            />
          </div>
        </div>
      </div>

      {/* Hidden Audio Player for Synthesis */}
      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
}
