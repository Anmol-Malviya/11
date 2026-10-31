"use client";

import React, { useState, useEffect } from "react";
import { Shield, Volume2, Check, Trash2, Key, Sliders } from "lucide-react";
import { api, VoiceOption } from "@/lib/api";

export default function SettingsPage() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM");
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      const data = await api.getVoices();
      setVoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGrantConsent = async () => {
    try {
      const res = await api.grantVoiceConsent("user_consented_clone_v1");
      setConsentId(res.consent_id);
      setConsentGranted(true);
      setStatusMsg("Voice cloning consent granted and securely recorded.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeConsent = async () => {
    if (!consentId) return;
    try {
      await api.revokeVoiceConsent(consentId);
      setConsentGranted(false);
      setConsentId(null);
      setStatusMsg("Voice cloning consent revoked. Cloned synthesis is now blocked.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Voice & Privacy Settings</h1>
        <p className="text-slate-300">
          Control synthetic voice selection, explicit cloning consent grants, and session data retention.
        </p>
      </div>

      {statusMsg && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-700/60 rounded-xl text-indigo-300 text-sm">
          {statusMsg}
        </div>
      )}

      {/* Voice Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Synthesized Output Voice</h2>
        </div>

        <div className="space-y-3">
          {voices.map((v) => (
            <div
              key={v.voice_id}
              onClick={() => setSelectedVoice(v.voice_id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedVoice === v.voice_id
                  ? "bg-indigo-600/20 border-indigo-500 text-white"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              <div>
                <div className="font-semibold text-sm flex items-center space-x-2">
                  <span>{v.label}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {v.mode}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Supported: {v.language_support.join(", ")}
                </div>
              </div>
              {selectedVoice === v.voice_id && <Check className="w-5 h-5 text-indigo-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Voice Cloning Consent Controls (SRC-07 / FR-013) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Voice Cloning Consent Gate</h2>
        </div>
        <p className="text-sm text-slate-300">
          Cloned or personalized voice models strictly require active, revocable consent before speech generation can occur.
        </p>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Cloning Consent Status</div>
            <div className="text-xs text-slate-400">
              {consentGranted ? "Active (Granted for this browser session)" : "Revoked / Not Granted"}
            </div>
          </div>
          {consentGranted ? (
            <button
              onClick={handleRevokeConsent}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-xs text-white transition-colors"
            >
              Revoke Consent
            </button>
          ) : (
            <button
              onClick={handleGrantConsent}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition-colors"
            >
              Grant Explicit Consent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

