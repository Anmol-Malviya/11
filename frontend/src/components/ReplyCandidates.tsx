"use client";

import React, { useState } from "react";
import { Check, Edit2, Volume2, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
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
  isGeneratingAudio,
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
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center space-x-2 text-amber-900">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <h3 className="font-semibold text-sm">Ambiguous Input Detected</h3>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          The speech audio or visual gestures were unclear. Tap a clarification below to immediately speak:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {candidates.map((cand) => (
            <button
              key={cand.candidate_id}
              onClick={() => onConfirm(cand.candidate_id)}
              disabled={isGeneratingAudio}
              className="p-3 rounded-lg bg-white hover:bg-amber-100/50 border border-amber-200 text-left transition-colors shadow-2xs"
            >
              <div className="font-semibold text-slate-800 text-xs sm:text-sm">{cand.text}</div>
              <div className="text-[11px] text-amber-700 mt-0.5">{cand.reason}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-12 glass-panel-subtle text-slate-500 text-xs sm:text-sm">
        Waiting for conversation context or patient physical gesture...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-600">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Recommended Spoken Replies</span>
        </div>
        <span className="text-[11px] text-blue-600 font-medium">1-Tap to Confirm & Speak</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {candidates.map((cand, index) => {
          const isPrimary = index === 0;
          const isBeingEdited = editingId === cand.candidate_id;

          if (isBeingEdited) {
            return (
              <div
                key={cand.candidate_id}
                className="p-3.5 rounded-xl bg-white border border-blue-300 shadow-xs space-y-2.5"
              >
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-xs sm:text-sm text-slate-800 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isGeneratingAudio}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors"
                  >
                    Confirm & Speak
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={cand.candidate_id}
              className={`p-3.5 sm:p-4 rounded-xl transition-all border ${
                isPrimary
                  ? "bg-blue-50/40 border-blue-200 hover:border-blue-300 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isPrimary ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isPrimary ? "Primary Match" : `Option ${index + 1}`}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {Math.round(cand.confidence * 100)}% confidence
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
                    &quot;{cand.text}&quot;
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cand.reason}</p>
                </div>

                {/* Accessible Action Controls */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => handleStartEdit(cand)}
                    title="Edit response text"
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onConfirm(cand.candidate_id)}
                    disabled={isGeneratingAudio}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
