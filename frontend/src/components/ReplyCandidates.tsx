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
  lipStatus?: string;
  detectedVisemes?: string[];
}

export function ReplyCandidates({
  candidates,
  needsClarification,
  onConfirm,
  onReject,
  isGeneratingAudio,
  lipStatus = "resting",
  detectedVisemes = [],
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
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 space-y-3.5 shadow-xs">
        <div className="flex items-center space-x-2 text-amber-900">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-sm tracking-tight">Ambiguous Input Detected</h3>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          The speech audio or visual gestures were ambiguous. Tap a verified clarification below to immediately speak:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {candidates.map((cand) => (
            <button
              key={cand.candidate_id}
              onClick={() => onConfirm(cand.candidate_id)}
              disabled={isGeneratingAudio}
              className="p-3.5 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-200 text-left transition-all shadow-xs active:scale-98"
            >
              <div className="font-bold text-slate-900 text-xs sm:text-sm">{cand.text}</div>
              <div className="text-[11px] text-amber-700 mt-1 font-medium">{cand.reason}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (lipStatus === "unclear_input") {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-2.5 shadow-lg">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Insufficient Visual Input</span>
        </div>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Lip movement sequence was below the articulation threshold or ambiguous. Please articulate naturally in front of the camera or use a hand gesture.
        </p>
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-14 panel-25d text-slate-400 text-xs sm:text-sm flex flex-col items-center justify-center space-y-2">
        <Sparkles className="w-6 h-6 text-indigo-400 opacity-60" />
        <p className="font-medium text-slate-500">Waiting for conversational context, lip movements, or physical gestures...</p>
        <span className="text-[11px] text-slate-400">Perform a gesture or speak into the microphone to begin intent fusion.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 2.5D Candidate Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span>Multimodal Recommended Replies</span>
        </div>
        <span className="text-[11px] text-indigo-600 font-semibold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
          1-Tap to Confirm & Speak
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {candidates.map((cand, index) => {
          const isPrimary = index === 0;
          const isBeingEdited = editingId === cand.candidate_id;

          if (isBeingEdited) {
            return (
              <div
                key={cand.candidate_id}
                className="p-4 rounded-2xl bg-white border-2 border-indigo-500 shadow-md space-y-3"
              >
                <div className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                  Edit Intended Message
                </div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-xs sm:text-sm font-medium text-slate-800 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isGeneratingAudio}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-[0_2px_8px_rgba(79,70,229,0.3)] transition-all active:scale-95"
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
              className={`p-4 rounded-2xl transition-all border ${
                isPrimary
                  ? "bg-gradient-to-br from-indigo-50/50 via-white to-white border-indigo-200/90 hover:border-indigo-300 shadow-[0_4px_12px_rgba(79,70,229,0.06)] ring-1 ring-indigo-500/10"
                  : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isPrimary ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isPrimary ? "Primary Intent" : `Alternative ${index + 1}`}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-semibold">
                      {Math.round(cand.confidence * 100)}% verified confidence
                    </span>
                  </div>

                  <div className="text-sm sm:text-base font-bold text-slate-900 pt-0.5 leading-snug">
                    &ldquo;{cand.text}&rdquo;
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">
                    {cand.reason}
                  </p>
                </div>

                {/* 2.5D Action Controls */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => handleStartEdit(cand)}
                    className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/70 transition-all shadow-2xs active:scale-95"
                    title="Edit custom phrasing before speaking"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onConfirm(cand.candidate_id)}
                    disabled={isGeneratingAudio}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isGeneratingAudio ? "Speaking..." : "Confirm & Speak"}</span>
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
