const getApiBase = () => {
  // 1. In server functions / SSR, use Vercel service binding if provided
  if (process.env.BACKEND_URL) {
    return `${process.env.BACKEND_URL.replace(/\/$/, "")}/api/v1`;
  }
  // 2. Explicit public environment variable override
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  // 3. Client-side browser execution (relative to current domain)
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }
  // 4. Fallback for local development
  return "http://localhost:8000/api/v1";
};

const API_BASE = getApiBase();



export interface SessionResponse {
  session_id: string;
  status: string;
  language: string;
  created_at: string;
  accessibility: {
    text_scale: string;
    high_contrast: boolean;
    reduced_motion: boolean;
  };
}

export interface CandidateReply {
  candidate_id: string;
  text: string;
  reason: string;
  confidence: number;
}

export interface InferenceResponse {
  inference_id: string;
  needs_clarification: boolean;
  candidates: CandidateReply[];
  signals_used: string[];
  unknown_or_missing_signals: string[];
  created_at: string;
}

export interface ConfirmationResponse {
  confirmation_id: string;
  status: string;
  confirmed_text?: string;
}

export interface VoiceOption {
  voice_id: string;
  label: string;
  mode: string;
  language_support: string[];
}

export interface QuickPhrase {
  phrase_id: string;
  text: string;
  category: string;
  language: string;
}

export interface EvaluationMetrics {
  total_evaluations: number;
  average_wer: number;
  intent_top1_accuracy: number;
  intent_top3_accuracy: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  target_latency_achieved: boolean;
  samples: Record<string, unknown>[];
}

export const api = {
  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Sessions
  async createSession(language = "hi-en", highContrast = false): Promise<SessionResponse> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        accessibility: {
          text_scale: "large",
          high_contrast: highContrast,
          reduced_motion: false
        }
      })
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
  },

  async endSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/end`, {
      method: "POST"
    });
    return res.json();
  },

  // Transcription
  async transcribeAudio(sessionId: string, audioBlob: Blob, languageHint = "hi-en") {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("language_hint", languageHint);
    formData.append("audio_file", audioBlob, "recording.wav");

    const res = await fetch(`${API_BASE}/transcriptions`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Audio transcription failed");
    return res.json();
  },

  // Inference
  async runInference(payload: {
    session_id: string;
    raw_transcript_text?: string;
    detected_gesture?: string;
    lip_active?: boolean;
    language?: string;
  }): Promise<InferenceResponse> {
    const res = await fetch(`${API_BASE}/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Inference failed");
    return res.json();
  },

  // Confirmation Gate
  async confirmReply(
    sessionId: string,
    inferenceId: string,
    action: "confirm" | "edit" | "reject" | "cancel",
    candidateId?: string,
    editedText?: string
  ): Promise<ConfirmationResponse> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inference_id: inferenceId,
        candidate_id: candidateId,
        action,
        edited_text: editedText
      })
    });
    if (!res.ok) throw new Error("Confirmation failed");
    return res.json();
  },

  // Speech Generation
  async generateSpeech(
    sessionId: string,
    confirmationId: string,
    voiceId = "21m00Tcm4TlvDq8ikWAM",
    voiceMode = "standard"
  ): Promise<Blob> {
    const res = await fetch(`${API_BASE}/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        confirmation_id: confirmationId,
        voice_id: voiceId,
        voice_mode: voiceMode
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "Speech synthesis failed");
    }
    return res.blob();
  },

  // Voices & Consent
  async getVoices(): Promise<VoiceOption[]> {
    const res = await fetch(`${API_BASE}/voices`);
    return res.json();
  },

  async grantVoiceConsent(voiceId: string) {
    const res = await fetch(`${API_BASE}/voice-consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId,
        purpose: "Speak user-confirmed conversation replies",
        scope: "voice_cloning_and_generation"
      })
    });
    return res.json();
  },

  async revokeVoiceConsent(consentId: string) {
    await fetch(`${API_BASE}/voice-consents/${consentId}`, {
      method: "DELETE"
    });
  },

  // Quick Phrases
  async getQuickPhrases(): Promise<QuickPhrase[]> {
    const res = await fetch(`${API_BASE}/quick-phrases`);
    return res.json();
  },

  async createQuickPhrase(text: string, category: string, language: string): Promise<QuickPhrase> {
    const res = await fetch(`${API_BASE}/quick-phrases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, category, language })
    });
    return res.json();
  },

  // Evaluations
  async getMetrics(): Promise<EvaluationMetrics> {
    const res = await fetch(`${API_BASE}/evaluations/metrics`);
    return res.json();
  }
};

