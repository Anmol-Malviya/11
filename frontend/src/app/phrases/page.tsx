"use client";

import React, { useState, useEffect } from "react";
import { Volume2, Plus, Trash2, Heart, Sparkles } from "lucide-react";
import { api, QuickPhrase } from "@/lib/api";

export default function QuickPhrasesPage() {
  const [phrases, setPhrases] = useState<QuickPhrase[]>([]);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("Needs");
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    loadPhrases();
  }, []);

  const loadPhrases = async () => {
    try {
      const data = await api.getQuickPhrases();
      setPhrases(data);
    } catch (err) {
      console.error("Error loading phrases:", err);
    }
  };

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
      const inf = await api.runInference({ session_id: "sess_phrases", raw_transcript_text: phrase.text });
      const conf = await api.confirmReply("sess_phrases", inf.inference_id, "edit", undefined, phrase.text);
      const audioBlob = await api.generateSpeech("sess_phrases", conf.confirmation_id);
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await audio.play();
    } catch (err) {
      console.error("Audio error:", err);
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Quick Phrases & Presets
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          High-priority, one-touch tiles for immediate spoken communication.
        </p>
      </div>

      {/* Add Custom Phrase Input */}
      <form onSubmit={handleAddPhrase} className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Type a new frequent phrase..."
          className="flex-1 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="Needs">Needs & Assistance</option>
          <option value="Social">Greetings & Social</option>
          <option value="Health">Physical & Comfort</option>
          <option value="Emergency">Urgent</option>
        </select>
        <button
          type="submit"
          disabled={loading || !newText.trim()}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add Phrase</span>
        </button>
      </form>

      {/* Phrases Grid (Responsive 1-col mobile, 2/3 col tablet/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {phrases.map((phrase) => {
          const isPlaying = playingId === phrase.phrase_id;
          return (
            <button
              key={phrase.phrase_id}
              onClick={() => handleSpeakPhrase(phrase)}
              disabled={isPlaying}
              className="glass-panel p-4 rounded-2xl text-left border border-slate-200/80 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group active:scale-98"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {phrase.category}
                </span>
                <p className="font-semibold text-slate-900 text-sm sm:text-base mt-2 group-hover:text-indigo-600 transition-colors">
                  "{phrase.text}"
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px]">1-Tap to Speak</span>
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    isPlaying ? "bg-indigo-600 text-white animate-spin" : "bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-600"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
