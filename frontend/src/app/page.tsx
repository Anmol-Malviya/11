import Link from "next/link";
import { ArrowRight, Mic, Video, Brain, CheckCircle2, Shield, HeartHandshake } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl space-y-4">
        <div className="inline-flex items-center space-x-2 bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
          <HeartHandshake className="w-4 h-4 text-indigo-400" />
          <span>AI Manthan 2.0 / Problem Statement 16</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Multimodal Live Conversation Assistant for People with Speech Impairments
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
          Empowering individuals with ALS, Cerebral Palsy, Parkinson’s, stroke, or laryngectomy. Fuses live speech transcription, camera gesture detection, and conversational context—always preserving human agency with strict confirmation gates.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-3 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-lg shadow-lg hover:shadow-indigo-500/25 transition-all transform active:scale-95"
          >
            <span>Start Live Conversation</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/phrases"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-200 text-lg border border-slate-700 transition-all"
          >
            <span>Quick Phrases</span>
          </Link>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Mic className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Partner Speech Recognition</h2>
          <p className="text-sm text-slate-400">
            ElevenLabs Scribe captures and separates conversational dialogue in English, Hindi, and code-mixed Hinglish.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Video className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Camera Gesture & Lip Landmarks</h2>
          <p className="text-sm text-slate-400">
            MediaPipe extracts non-verbal geometric signals directly on-device. Zero raw video streams are stored.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Human Confirmation Gate</h2>
          <p className="text-sm text-slate-400">
            The AI proposes ranked replies. The speaker explicitly Confirms, Edits, or Cancels before voice playback.
          </p>
        </div>
      </div>

      {/* Trust & Privacy Notice */}
      <div className="max-w-2xl text-center bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 text-sm text-slate-400 flex items-center space-x-3">
        <Shield className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <p className="text-left">
          <strong>Privacy By Design:</strong> No raw audio or video recordings are stored by default. Cloned voices require explicit affirmative consent, revocable at any time.
        </p>
      </div>
    </div>
  );
}
