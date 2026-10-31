"use client";

import React, { useState } from "react";
import { Check, Edit2, X, Volume2, Sparkles, HelpCircle } from "lucide-react";
import { CandidateReply } from "@/lib/api";

interface Props {
  candidates: CandidateReply[];
  needsClarification: boolean;
  onConfirm: (candidateId?: string, editedText?: string) => void;
  onReject: () => void;
  isGeneratingAudio: boolean;
}

export function ReplyCandidates({
  candidates,
  needsClarification,
  onConfirm,
  onReject,
  isGeneratingAudio
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleStartEdit = (cand: CandidateReply) => {
    setEditingId(cand.candidate_id);
    setEditText(cand.text);
  };

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onConfirm(undefined, editText.trim());
      setEditingId(null);
    }
  };

  if (needsClarification) {
    return (
      <div className="bg-amber-950/30 border border-amber-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 text-amber-400">
          <HelpCircle className="w-6 h-6" />
          <h3 className="font-bold text-lg">Input Ambiguous or Missing Signals</h3>
        </div>
        <p className="text-sm text-amber-200/80">
          The audio or non-verbal signals are uncertain or conflicting. Please choose a clarification reply below or select a Quick Phrase.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {candidates.map((cand) => (
            <button
              key={cand.candidate_id}
              onClick={() => onConfirm(cand.candidate_id)}
              className="p-4 rounded-xl bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/60 text-left transition-all"
            >
              <div className="font-bold text-white text-base">{cand.text}</div>
              <div className="text-xs text-amber-300/80 mt-1">{cand.reason}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
        <Sparkles className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <h3 className="text-base font-semibold text-slate-300">Awaiting Conversation Signals</h3>
        <p className="text-xs text-slate-500">
          Speak with your partner or simulate a gesture above to generate personalized candidate replies.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Suggested Replies (Confirm to Speak)</h2>
        </div>
        <span className="text-xs text-slate-400 font-medium">Human Confirmation Required</span>
      </div>

      <div className="space-y-3">
        {candidates.map((cand) => (
          <div
            key={cand.candidate_id}
            className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-slate-600 transition-all space-y-3"
          >
            {editingId === cand.candidate_id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-500 rounded-lg p-3 text-white text-base focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isGeneratingAudio}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-sm flex items-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm & Speak Edited</span>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm"
                  >
                    Cancel Edit
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xl font-bold text-white tracking-wide">{cand.text}</div>
                  <div className="text-xs text-slate-400 flex items-center space-x-2">
                    <span>{cand.reason}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-semibold">
                      {Math.round(cand.confidence * 100)}% match
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* Confirm & Speak (Large primary action) */}
                  <button
                    onClick={() => onConfirm(cand.candidate_id)}
                    disabled={isGeneratingAudio}
                    className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-md hover:shadow-indigo-500/25 transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isGeneratingAudio ? "Speaking..." : "Confirm & Speak"}</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleStartEdit(cand)}
                    disabled={isGeneratingAudio}
                    className="p-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-colors"
                    title="Edit before speaking"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Reject / Cancel */}
                  <button
                    onClick={onReject}
                    disabled={isGeneratingAudio}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                    title="Reject reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

