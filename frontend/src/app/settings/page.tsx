"use client";

import React, { useState, useEffect } from "react";
import { Shield, Volume2, Check, Trash2, Key, Sliders, Sparkles } from "lucide-react";
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
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Voice & Privacy Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Synthetic voice models, cloning consent controls, and privacy boundaries.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs sm:text-sm flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Voice Selection Panel */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm sm:text-base border-b border-slate-100 pb-2">
          <Volume2 className="w-4 h-4 text-indigo-600" />
          <span>ElevenLabs Synthetic Voice</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Select Voice Profile</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full text-xs sm:text-sm bg-white border border-slate-200/90 text-slate-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.label} ({v.mode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Consent & Ethics Panel */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm sm:text-base border-b border-slate-100 pb-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span>Explicit Voice Cloning Consent</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          In compliance with ethical AI requirements, cloning the patient's pre-recorded or restored voice requires explicit affirmative consent. Consent may be revoked anytime to immediately block synthesis.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!consentGranted ? (
            <button
              onClick={handleGrantConsent}
              className="flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Grant Affirmative Consent</span>
            </button>
          ) : (
            <button
              onClick={handleRevokeConsent}
              className="flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Revoke Consent & Block Clone</span>
            </button>
          )}

          <span className="text-[11px] text-slate-400 self-center">
            Status: <strong className={consentGranted ? "text-emerald-600" : "text-amber-600"}>{consentGranted ? "Consented (Active)" : "Default System Voice Only"}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
