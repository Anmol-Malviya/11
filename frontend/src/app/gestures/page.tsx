"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Send,
  Trash2,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Mic,
  MicOff,
  Edit3,
  Check
} from "lucide-react";
import { LiveGestureWebcam } from "@/components/LiveGestureWebcam";
import {
  gestureApi,
  GesturePrediction,
  ConversationSummary,
  ConversationMessage
} from "@/lib/gestureApi";

export default function GestureAssistantPage() {
  // App state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Gesture & Phrase state
  const [recognizedGesture, setRecognizedGesture] = useState<string>("none");
  const [gestureConfidence, setGestureConfidence] = useState<number>(0);
  const [phraseText, setPhraseText] = useState<string>("");
  const [isEditingPhrase, setIsEditingPhrase] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.60);

  // Configurable phrase mapping
  const [phraseMap, setPhraseMap] = useState<Record<string, string>>({
    ok: "Okay",
    thumbsup: "Yes, I agree",
    thumbsdown: "No, I disagree",
    fist: "I need assistance",
    five: "Hello",
    blank: ""
  });

  // Conversation Partner 2-Way Input
  const [partnerInput, setPartnerInput] = useState<string>("");
  const [isSpeechListening, setIsSpeechListening] = useState<boolean>(false);
  const speechRecognitionRef = useRef<unknown>(null);

  // Text-To-Speech
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [ttsSupported, setTtsSupported] = useState<boolean>(true);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    // Check SpeechSynthesis support
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setTtsSupported(false);
    }
  }, []);

  const loadConversations = async () => {
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
      // Fallback: create default local
      createNewConversation();
    }
  };

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

  // Called continuously from LiveGestureWebcam when a gesture passes threshold
  const handleGestureDetected = (pred: GesturePrediction) => {
    if (pred.predicted_gesture === "blank") return;

    setRecognizedGesture(pred.predicted_gesture);
    setGestureConfidence(pred.confidence);

    const mapped = phraseMap[pred.predicted_gesture] || pred.mapped_phrase;
    if (mapped && !isEditingPhrase) {
      setPhraseText(mapped);
    }
  };

  // Text-To-Speech implementation
  const speakCurrentPhrase = (textToSpeak?: string) => {
    const text = textToSpeak || phraseText;
    if (!text.trim()) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported by your current browser.");
      return;
    }

    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const cancelSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Confirm and Send message as speech-impaired user
  const handleConfirmAndSendUserMessage = async () => {
    if (!phraseText.trim() || !activeConversationId) return;

    // Trigger TTS confirmation
    speakCurrentPhrase(phraseText);

    try {
      const newMsg = await gestureApi.addMessage(activeConversationId, {
        text: phraseText.trim(),
        speaker: "user",
        modality: "gesture",
        gesture_label: recognizedGesture !== "none" ? recognizedGesture : undefined,
        confidence: gestureConfidence > 0 ? gestureConfidence : undefined
      });
      setMessages((prev) => [...prev, newMsg]);
      setPhraseText("");
      setRecognizedGesture("none");
      setGestureConfidence(0);
      setIsEditingPhrase(false);
    } catch (e) {
      console.error("Could not send user message:", e);
    }
  };

  // Partner message submit
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim() || !activeConversationId) return;

    try {
      const newMsg = await gestureApi.addMessage(activeConversationId, {
        text: partnerInput.trim(),
        speaker: "partner",
        modality: "typed"
      });
      setMessages((prev) => [...prev, newMsg]);
      setPartnerInput("");
    } catch (e) {
      console.error("Could not send partner message:", e);
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
    <div className="max-w-7xl mx-auto py-4 px-2 sm:px-4 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Manthan 2.0 Assistive Suite</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Live Gesture Conversation Assistant
          </h1>
          <p className="text-xs text-slate-600">
            Real-time hand gesture recognition with CNN (100x120 grayscale) & Two-way communication.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={createNewConversation}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
          <button
            onClick={deleteCurrentConversation}
            title="Delete current conversation"
            className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Camera + Gesture Output, Right = 2-Way Chat + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Vision Feed & Gesture Action Board */}
        <div className="lg:col-span-7 space-y-5">
          {/* Webcam Component */}
          <LiveGestureWebcam
            onGestureRecognized={handleGestureDetected}
            confidenceThreshold={confidenceThreshold}
            phraseMapping={phraseMap}
          />

          {/* User Communication Output Area */}
          <div className="glass-panel p-5 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Your Communication Phrase
                </h2>
              </div>
              {recognizedGesture !== "none" && (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                  <span>Gesture: <strong>{recognizedGesture}</strong></span>
                  <span>({(gestureConfidence * 100).toFixed(0)}%)</span>
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
                placeholder="Show a hand gesture to the camera or type here directly..."
                rows={3}
                className="w-full text-lg sm:text-2xl font-bold text-slate-900 p-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-none transition resize-none bg-indigo-50/20"
              />
            </div>

            {/* Phrase Action Buttons (Speak, Confirm, Clear) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => speakCurrentPhrase()}
                  disabled={!phraseText.trim() || isSpeaking}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center space-x-2 shadow-sm transition disabled:opacity-50"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSpeaking ? "Speaking..." : "Speak Phrase"}</span>
                </button>

                {isSpeaking && (
                  <button
                    onClick={cancelSpeech}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    title="Stop speaking"
                  >
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setPhraseText("");
                    setRecognizedGesture("none");
                    setIsEditingPhrase(false);
                  }}
                  className="px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleConfirmAndSendUserMessage}
                disabled={!phraseText.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-indigo-200 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Send Message</span>
              </button>
            </div>
          </div>

          {/* Configurable Phrase Mapping Drawer */}
          <details className="group glass-panel rounded-2xl border border-slate-200/80 p-4 transition-all">
            <summary className="flex items-center justify-between cursor-pointer font-bold text-xs text-slate-700 uppercase tracking-wider">
              <span>Gesture-to-Phrase Mappings & Settings</span>
              <Sliders className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
            </summary>
            
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(phraseMap).filter(k => k !== "blank").map((gestureKey) => (
                  <div key={gestureKey} className="flex flex-col space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 uppercase font-mono">
                      {gestureKey}
                    </label>
                    <input
                      type="text"
                      value={phraseMap[gestureKey]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhraseMap(prev => ({ ...prev, [gestureKey]: val }));
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Confidence Threshold slider */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Confidence Filter: {(confidenceThreshold * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.30"
                  max="0.95"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-40"
                />
              </div>
            </div>
          </details>
        </div>

        {/* Right Column: Two-Way Conversation Panel & History */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Conversation Messages Thread */}
          <div className="glass-panel rounded-3xl border border-slate-200/80 p-4 sm:p-5 flex flex-col h-[520px] shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Dialogue</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {messages.length} messages
              </span>
            </div>

            {/* Message bubbles */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Loading history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2 text-slate-400">
                  <MessageSquare className="w-8 h-8 stroke-1 text-slate-300" />
                  <p className="text-xs font-medium">No messages in this conversation yet.</p>
                  <p className="text-[11px] text-slate-400">
                    Use gestures on the left or type a reply below to begin.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.speaker === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                        <span className="font-semibold text-slate-700">
                          {isUser ? "Speech Impaired User" : "Conversation Partner"}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.gesture_label && (
                          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-mono">
                            {m.gesture_label}
                          </span>
                        )}
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-xs ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-xs"
                            : "bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60"
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
                placeholder="Partner response (or click mic to speak)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-600 focus:outline-none bg-slate-50 focus:bg-white transition"
              />

              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 rounded-xl border transition ${
                  isSpeechListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Speak to text (Speech Recognition)"
              >
                {isSpeechListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="submit"
                disabled={!partnerInput.trim()}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white transition disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Conversation Sessions List */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Recent Conversations (MongoDB / Resilient Store)
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    activeConversationId === c.id
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
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
    </div>
  );
}

