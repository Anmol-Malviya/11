"use client";

import React, { useState, useEffect } from "react";
import { Volume2, Plus, Trash2, Heart, AlertCircle } from "lucide-react";
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
      // Create quick confirmed entry
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
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Quick Assistive Phrases</h1>
        <p className="text-slate-300">
          Large touch tiles for instant one-click communication, customized for critical daily needs.
        </p>
      </div>

      {/* Add New Phrase Form */}
      <form onSubmit={handleAddPhrase} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Enter quick phrase text (e.g. 'Can you please open the door?')..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
        >
          <option value="Needs">Needs</option>
          <option value="General">General</option>
          <option value="Assistance">Assistance</option>
          <option value="Emergency">Emergency</option>
        </select>
        <button
          type="submit"
          disabled={loading || !newText.trim()}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add Phrase</span>
        </button>
      </form>

      {/* Phrases Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {phrases.map((phrase) => (
          <button
            key={phrase.phrase_id}
            onClick={() => handleSpeakPhrase(phrase)}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-850 text-left transition-all group flex flex-col justify-between h-36 relative overflow-hidden shadow-md"
          >
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                {phrase.category}
              </span>
              <div className="mt-2 text-lg font-bold text-white group-hover:text-indigo-200 transition-colors">
                {phrase.text}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="flex items-center space-x-1">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>{playingId === phrase.phrase_id ? "Speaking..." : "Tap to Speak"}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

