"use client";

import React, { useState } from "react";
import { Check, Edit2, X, Volume2, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
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
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center space-x-2 text-amber-800">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm sm:text-base">Input Ambiguous or Missing Signals</h3>
        </div>
        <p className="text-xs sm:text-sm text-amber-700 leading-relaxed">
          The speech audio or visual gestures were unclear. Tap a quick clarification below to speak it:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {candidates.map((cand) => (
            <button
              key={cand.candidate_id}
              onClick={() => onConfirm(cand.candidate_id)}
              disabled={isGeneratingAudio}
              className="p-3.5 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-200 text-left transition-all shadow-xs active:scale-98"
            >
              <div className="font-semibold text-slate-800 text-sm">{cand.text}</div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">{cand.reason}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-8 glass-panel-subtle rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs sm:text-sm">
        Waiting for partner speech or patient gesture...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Suggested Candidate Responses</span>
        </div>
        <span className="text-[11px] text-indigo-600 font-medium">1-Tap to Speak</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {candidates.map((cand, index) => {
          const isPrimary = index === 0;
          const isBeingEdited = editingId === cand.candidate_id;

          if (isBeingEdited) {
            return (
              <div
                key={cand.candidate_id}
                className="p-3.5 rounded-2xl bg-white border border-indigo-300 shadow-sm space-y-2.5"
              >
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isGeneratingAudio}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs"
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
              className={`group relative p-3.5 sm:p-4 rounded-2xl transition-all border ${
                isPrimary
                  ? "bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white border-indigo-200/90 shadow-sm hover:border-indigo-300"
                  : "bg-white/80 hover:bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isPrimary ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isPrimary ? "Top Match" : `Option ${index + 1}`}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {Math.round(cand.confidence * 100)}% match
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1 leading-snug">
                    &quot;{cand.text}&quot;
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cand.reason}</p>
                </div>

                {/* Accessible Action Controls */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => handleStartEdit(cand)}
                    title="Edit response text"
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onConfirm(cand.candidate_id)}
                    disabled={isGeneratingAudio}
                    className={`flex items-center space-x-1.5 px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all shadow-xs active:scale-95 ${
                      isPrimary
                        ? "bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700"
                        : "bg-slate-800 hover:bg-slate-900"
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Speak</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={onReject}
          className="text-xs text-slate-400 hover:text-rose-500 transition-colors flex items-center space-x-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Dismiss suggestions</span>
        </button>
      </div>
    </div>
  );
}
