"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Send,
  Trash2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  Check,
  ChevronDown,
  Sparkles,
  Save,
  CheckCircle2
} from "lucide-react";
import { LiveGestureWebcam } from "@/components/LiveGestureWebcam";
import {
  gestureApi,
  ConversationSummary,
  ConversationMessage
} from "@/lib/gestureApi";
import { SupportedGesture } from "@/lib/vision";

interface GestureMappingItem {
  message: string;
  meaning: string;
}

const DEFAULT_ALL_MAPPINGS: Record<string, GestureMappingItem> = {
  // 6 Custom Two-Hand Gestures
  BOTH_THUMBS_UP: { message: "Absolutely yes!", meaning: "Strong agreement" },
  BOTH_THUMBS_DOWN: { message: "Absolutely not!", meaning: "Strong disagreement" },
  HAND_HEART: { message: "I love you.", meaning: "Affection" },
  PALMS_TOGETHER: { message: "Please.", meaning: "Request" },
  BOTH_OPEN_PALMS: { message: "Stop immediately!", meaning: "Strong stop command" },
  T_SHAPE: { message: "I need a break.", meaning: "Request a break" },
  
  // 10 Single-Hand Gestures
  THUMBS_UP: { message: "Yes, I agree.", meaning: "Okay / Yes" },
  THUMBS_DOWN: { message: "No, I don't agree.", meaning: "No" },
  OPEN_PALM: { message: "Please wait.", meaning: "Stop / Wait" },
  CLOSED_FIST: { message: "I need help.", meaning: "Help" },
  POINTING: { message: "I want this.", meaning: "This / That" },
  PEACE_SIGN: { message: "Hello!", meaning: "Greeting" },
  OK_SIGN: { message: "I understand.", meaning: "Understood" },
  WAVE: { message: "Excuse me!", meaning: "Attention" },
  CROSSED_FINGERS: { message: "Please.", meaning: "Request" },
  ONE_FINGER_UP: { message: "Give me a moment.", meaning: "Wait" },
  NO_GESTURE: { message: "", meaning: "No gesture" }
};

export default function GestureAssistantPage() {
  // App state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Gesture & Phrase state
  const [recognizedGesture, setRecognizedGesture] = useState<SupportedGesture>("NO_GESTURE");
  const [gestureConfidence, setGestureConfidence] = useState<number>(0);
  const [detectedHandedness, setDetectedHandedness] = useState<string>("Unknown");
  const [phraseText, setPhraseText] = useState<string>("");
  const [isEditingPhrase, setIsEditingPhrase] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.65);

  // Configurable 10-Gesture mapping
  const [mappings, setMappings] = useState<Record<string, GestureMappingItem>>(DEFAULT_ALL_MAPPINGS);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState("");

  // Conversation Partner 2-Way Input
  const [partnerInput, setPartnerInput] = useState<string>("");
  const [isSpeechListening, setIsSpeechListening] = useState<boolean>(false);
  const speechRecognitionRef = useRef<unknown>(null);

  // ElevenLabs Text-To-Speech
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Load conversations and persistent mappings on mount
  const loadConversations = useCallback(async () => {
    try {
      const convs = await gestureApi.listConversations();
      setConversations(convs);
      if (convs.length > 0) {
        selectConversation(convs[0].id);
      } else {
        createNewConversation();
      }
    } catch (e) {
      console.error("Could not load conversations:", e);
    }
  }, []);

  const loadMappings = useCallback(async () => {
    try {
      const remote = await gestureApi.getGestureMappings();
      if (remote && Object.keys(remote).length > 0) {
        setMappings(remote);
      }
    } catch (e) {
      console.warn("Using default local mappings:", e);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadMappings();
  }, [loadConversations, loadMappings]);

  const selectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setLoadingMessages(true);
    try {
      const data = await gestureApi.getMessages(convId);
      setMessages(data.messages);
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const createNewConversation = async () => {
    try {
      const newConv = await gestureApi.createConversation(
        `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        "Caregiver / Partner"
      );
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (e) {
      console.error("Create conversation failed:", e);
    }
  };

  const deleteCurrentConversation = async () => {
    if (!activeConversationId) return;
    try {
      await gestureApi.deleteConversation(activeConversationId);
      const remaining = conversations.filter((c) => c.id !== activeConversationId);
      setConversations(remaining);
      if (remaining.length > 0) {
        selectConversation(remaining[0].id);
      } else {
        createNewConversation();
      }
    } catch (e) {
      console.error("Delete conversation failed:", e);
    }
  };

  // Called when stable hand gesture is detected
  const handleGestureDetected = (pred: {
    gesture: SupportedGesture;
    confidence: number;
    mapped_phrase: string;
    handedness: string;
  }) => {
    if (pred.gesture === "NO_GESTURE") return;

    setRecognizedGesture(pred.gesture);
    setGestureConfidence(pred.confidence);
    setDetectedHandedness(pred.handedness);

    const mapped = mappings[pred.gesture]?.message || pred.mapped_phrase;
    if (mapped && !isEditingPhrase) {
      setPhraseText(mapped);
    }
  };

  // Speak confirmed phrase using ElevenLabs with browser TTS fallback
  const speakConfirmedPhrase = async (textToSpeak?: string) => {
    const text = (textToSpeak || phraseText).trim();
    if (!text) return;

    setIsSpeaking(true);
    try {
      const audioBlob = await gestureApi.speakGestureMessage(text);
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.onended = () => setIsSpeaking(false);
        audioPlayerRef.current.onerror = () => setIsSpeaking(false);
        await audioPlayerRef.current.play();
      }
    } catch (err) {
      console.warn("ElevenLabs TTS notice, falling back to local SpeechSynthesis:", err);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  const cancelSpeech = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // User confirms phrase to send to conversation thread and speak aloud
  const handleConfirmAndSendUserMessage = async () => {
    if (!phraseText.trim()) return;

    // 1. Speak phrase immediately through ElevenLabs
    speakConfirmedPhrase(phraseText);

    // 2. Add message to database & thread
    try {
      const msg = await gestureApi.addMessage(activeConversationId, {
        text: phraseText.trim(),
        speaker: "user",
        modality: "gesture",
        gesture_label: recognizedGesture !== "NO_GESTURE" ? recognizedGesture : null,
        confidence: gestureConfidence > 0 ? gestureConfidence : null
      });
      setMessages((prev) => [...prev, msg]);
      setIsEditingPhrase(false);
    } catch (e) {
      console.error("Failed to post message:", e);
    }
  };

  // Save customized mappings to MongoDB
  const handleSaveMappings = async () => {
    setIsSavingMappings(true);
    setSavedSuccessMsg("");
    try {
      await gestureApi.updateGestureMappings(mappings);
      setSavedSuccessMsg("Mappings saved to database successfully.");
      setTimeout(() => setSavedSuccessMsg(""), 3000);
    } catch (e) {
      console.error("Save mappings failed:", e);
    } finally {
      setIsSavingMappings(false);
    }
  };

  // Partner submits written or spoken prompt
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    try {
      const msg = await gestureApi.addMessage(activeConversationId, {
        text: partnerInput.trim(),
        speaker: "partner",
        modality: isSpeechListening ? "speech_to_text" : "typed"
      });
      setMessages((prev) => [...prev, msg]);
      setPartnerInput("");
    } catch (e) {
      console.error("Failed to post partner message:", e);
    }
  };

  // Speech-to-Text for conversation partner
  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isSpeechListening) {
      if (speechRecognitionRef.current) {
        (speechRecognitionRef.current as { stop: () => void }).stop();
      }
      setIsSpeechListening(false);
      return;
    }

    try {
      const recognition = new (SpeechRecognition as new () => { continuous: boolean; interimResults: boolean; lang: string; onstart: () => void; onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; onend: () => void; start: () => void; stop: () => void })();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsSpeechListening(true);
      recognition.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
        const transcript = event.results[0][0].transcript;
        setPartnerInput(transcript);
        setIsSpeechListening(false);
      };
      recognition.onerror = () => setIsSpeechListening(false);
      recognition.onend = () => setIsSpeechListening(false);

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition error:", err);
      setIsSpeechListening(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="app-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Functional Hand Gesture Communication Studio
            </h1>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>MediaPipe 10-Gesture Kinematics</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time hand landmarks, temporal gesture detection (WAVE), and ElevenLabs vocalization
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={createNewConversation}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
          <button
            onClick={deleteCurrentConversation}
            disabled={!activeConversationId}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors disabled:opacity-40"
            title="Delete current conversation"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Webcam + Gesture Prediction Output */}
        <div className="lg:col-span-7 space-y-4">
          <LiveGestureWebcam
            onGestureRecognized={handleGestureDetected}
            confidenceThreshold={confidenceThreshold}
            phraseMapping={mappings}
          />

          {/* User Spoken Phrase Composer */}
          <div className="app-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recognized Expression & Spoken Message
                </h2>
              </div>
              {recognizedGesture !== "NO_GESTURE" && (
                <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono">
                  <span>Detected: <strong>{recognizedGesture.replace("_", " ")}</strong></span>
                  <span className="text-slate-400">({detectedHandedness})</span>
                  <span className="text-blue-600 font-bold">{(gestureConfidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>

            {/* Editable Large Phrase Box */}
            <div className="relative">
              <textarea
                value={phraseText}
                onChange={(e) => {
                  setPhraseText(e.target.value);
                  setIsEditingPhrase(true);
                }}
                placeholder="Show a hand gesture in front of the camera or edit the message here before speaking..."
                rows={2}
                className="w-full text-base sm:text-xl font-bold text-slate-900 p-3.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-none transition resize-none bg-slate-50/50"
              />
            </div>

            {/* Phrase Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => speakConfirmedPhrase()}
                  disabled={!phraseText.trim() || isSpeaking}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isSpeaking ? "Speaking..." : "Confirm & Speak (ElevenLabs)"}</span>
                </button>

                {isSpeaking && (
                  <button
                    onClick={cancelSpeech}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition"
                    title="Stop speaking"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setPhraseText("");
                    setRecognizedGesture("NO_GESTURE");
                    setIsEditingPhrase(false);
                  }}
                  className="px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleConfirmAndSendUserMessage}
                disabled={!phraseText.trim()}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Post to Dialogue</span>
              </button>
            </div>
          </div>

          {/* Configurable 10-Gesture Mapping Drawer */}
          <details className="group app-card p-4 transition-all">
            <summary className="flex items-center justify-between cursor-pointer font-bold text-xs text-slate-700 uppercase tracking-wider">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span>Configurable Gesture-to-Message Mappings (10 Single-Hand + 6 Two-Hand)</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>
            
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(mappings).filter(k => k !== "NO_GESTURE").map((gestureKey) => (
                  <div key={gestureKey} className="flex flex-col space-y-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-800 font-mono uppercase">
                        {gestureKey.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {mappings[gestureKey]?.meaning}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={mappings[gestureKey]?.message || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMappings(prev => ({
                          ...prev,
                          [gestureKey]: {
                            ...prev[gestureKey],
                            message: val
                          }
                        }));
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Confidence Threshold slider & Save button */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="text-slate-600 font-medium">Stability Threshold: {(confidenceThreshold * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min="0.40"
                    max="0.95"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-32"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  {savedSuccessMsg && (
                    <span className="text-emerald-600 text-xs font-medium flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{savedSuccessMsg}</span>
                    </span>
                  )}
                  <button
                    onClick={handleSaveMappings}
                    disabled={isSavingMappings}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingMappings ? "Saving..." : "Save to MongoDB"}</span>
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Right Column: Two-Way Conversation Panel & History */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Conversation Dialogue Thread */}
          <div className="app-card p-4 sm:p-5 flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Dialogue Log</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {messages.length} messages
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Loading dialogue...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300" />
                  <p>No messages yet. Confirm a recognized gesture or have your partner type below.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.speaker === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-1 px-1">
                        <span className="font-semibold text-slate-700">
                          {isUser ? "You (Spoken)" : "Partner"}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.gesture_label && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-mono border border-blue-200">
                            {m.gesture_label}
                          </span>
                        )}
                      </div>

                      <div
                        className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                          isUser
                            ? "bg-blue-600 text-white font-medium shadow-xs"
                            : "bg-slate-100 text-slate-900 border border-slate-200"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Conversation Partner Input Bar */}
            <form onSubmit={handlePartnerSubmit} className="pt-3 border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                placeholder="Partner response or inquiry..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-blue-600 focus:outline-none bg-slate-50 focus:bg-white transition"
              />

              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2 rounded-lg border transition ${
                  isSpeechListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Speak to text (Speech Recognition)"
              >
                {isSpeechListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              <button
                type="submit"
                disabled={!partnerInput.trim()}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Conversation Sessions List */}
          <div className="app-card p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Saved Sessions (MongoDB Atlas)
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                    activeConversationId === c.id
                      ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate max-w-[180px]">{c.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {c.message_count} msgs
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Audio Player for ElevenLabs Speech */}
      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
}
