"use client";

import React, { useState, useEffect } from "react";
import { Volume2, Plus, Bookmark, RefreshCw, Check } from "lucide-react";
import { api, QuickPhrase } from "@/lib/api";

export default function QuickPhrasesPage() {
  const [phrases, setPhrases] = useState<QuickPhrase[]>([]);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("Needs");
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const loadPhrases = async () => {
    try {
      const data = await api.getQuickPhrases();
      setPhrases(data);
    } catch (err) {
      console.error("Error loading phrases:", err);
    }
  };

  useEffect(() => {
    loadPhrases();
  }, []);

  const handleAddPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setLoading(true);
    try {
      await api.createQuickPhrase(newText.trim(), newCategory, "hi-en");
      setNewText("");
      await loadPhrases();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakPhrase = async (phrase: QuickPhrase) => {
    setPlayingId(phrase.phrase_id);
    try {
      // 1. First attempt browser native synthesis for instant responsiveness
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(phrase.text);
        u.onend = () => setPlayingId(null);
        u.onerror = () => setPlayingId(null);
        window.speechSynthesis.speak(u);
      }

      // 2. Also register confirmation with backend for evaluation logging
      const inf = await api.runInference({ session_id: "sess_phrases", raw_transcript_text: phrase.text });
      await api.confirmReply("sess_phrases", inf.inference_id, "edit", undefined, phrase.text);
    } catch (err) {
      console.error("Audio error:", err);
      setPlayingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="app-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Accessible Quick Phrases
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono">
              {phrases.length} Saved
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            High-priority phrase presets for instantaneous 1-tap spoken communication
          </p>
        </div>
      </div>

      {/* Add Custom Phrase Input */}
      <form onSubmit={handleAddPhrase} className="app-card p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Enter a new frequent spoken phrase..."
          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="text-xs bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-medium"
        >
          <option value="Needs">Needs & Care</option>
          <option value="Social">Greetings & Conversation</option>
          <option value="Health">Physical Comfort</option>
          <option value="Emergency">Urgent Alerts</option>
        </select>
        <button
          type="submit"
          disabled={loading || !newText.trim()}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Save Phrase</span>
        </button>
      </form>

      {/* Phrases Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {phrases.map((phrase) => {
          const isPlaying = playingId === phrase.phrase_id;
          return (
            <button
              key={phrase.phrase_id}
              onClick={() => handleSpeakPhrase(phrase)}
              disabled={isPlaying}
              className="app-card-interactive p-4 text-left flex flex-col justify-between group active:scale-98"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
                  {phrase.category}
                </span>
                <p className="font-semibold text-slate-900 text-sm mt-2.5 group-hover:text-blue-600 transition-colors">
                  &quot;{phrase.text}&quot;
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] font-medium text-slate-500">Tap to Speak</span>
                <div
                  className={`p-1.5 rounded-md transition-colors ${
                    isPlaying 
                      ? "bg-blue-600 text-white animate-pulse" 
                      : "bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-600"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
