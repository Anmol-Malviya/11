"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Volume2, Check, Trash2, ShieldAlert } from "lucide-react";
import { api, VoiceOption } from "@/lib/api";

export default function SettingsPage() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM");
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const loadVoices = async () => {
    try {
      const data = await api.getVoices();
      setVoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVoices();
  }, []);

  const handleGrantConsent = async () => {
    try {
      const res = await api.grantVoiceConsent("user_consented_clone_v1");
      setConsentId(res.consent_id);
      setConsentGranted(true);
      setStatusMsg("Affirmative voice cloning consent recorded successfully in database.");
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
      setStatusMsg("Consent revoked. Custom voice cloning is permanently blocked.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="app-card p-5">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Voice Synthesis & Privacy Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure synthetic speech models, manage voice cloning authorization, and privacy policies
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Voice Selection Panel */}
      <div className="app-card p-5 space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
          <Volume2 className="w-4 h-4 text-blue-600" />
          <span>Synthetic Speech Voice Profile</span>
        </div>

        <div className="space-y-2 max-w-md">
          <label className="text-xs font-semibold text-slate-700">Selected Voice</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-medium"
          >
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.label} ({v.mode})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Powered by ElevenLabs Multilingual V2 with automatic browser PCM fallback.
          </p>
        </div>
      </div>

      {/* Consent & Ethics Panel */}
      <div className="app-card p-5 space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Voice Cloning Governance & Consent</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          In strict compliance with bioethics and medical AI standards, synthesizing or cloning 
          a patient&apos;s personal voice model requires affirmative cryptographic authorization. 
          Consent may be revoked at any time to immediately lock synthesis access.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {!consentGranted ? (
            <button
              onClick={handleGrantConsent}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Grant Affirmative Consent</span>
            </button>
          ) : (
            <button
              onClick={handleRevokeConsent}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Revoke Authorization</span>
            </button>
          )}

          <span className="text-xs text-slate-500">
            Current Status: <strong className={consentGranted ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium"}>
              {consentGranted ? "Authorized (Custom Model Active)" : "Standard System Voices Only"}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
