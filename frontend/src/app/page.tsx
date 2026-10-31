import Link from "next/link";
import { 
  ArrowRight, 
  MessageSquare, 
  Hand, 
  Volume2, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  Cpu, 
  Globe2 
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-12 space-y-12 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center max-w-3xl space-y-4 px-2">
        <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200/80 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Production Assistive Technology</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
          Expressive Communication Without Speech Barriers
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
          Designed for individuals with ALS, stroke, cerebral palsy, and vocal conditions. 
          Combines real-time hand gesture recognition, speech context, and natural speech synthesis 
          to give every user full control over what they speak.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Link
            href="/gestures"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-white text-sm shadow-xs transition-colors"
          >
            <Hand className="w-4 h-4" />
            <span>Launch Gesture Assistant</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <Link
            href="/conversation"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 font-medium text-slate-800 text-sm border border-slate-200 shadow-xs transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-slate-600" />
            <span>Open Live Dialogue</span>
          </Link>
        </div>
      </div>

      {/* Primary Modality Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: Gesture Recognition */}
        <div className="app-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <Hand className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Real-Time Gesture Vision</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Trained 2D Convolutional Neural Network with contour extraction and adaptive skin-chroma filtering. 
              Supports OK, Thumbs Up, Thumbs Down, Fist, and Five gestures with zero cloud video transmission.
            </p>
          </div>
          <Link 
            href="/gestures" 
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 pt-2"
          >
            <span>Open Gesture Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 2: Multimodal Dialogue */}
        <div className="app-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Contextual Response Predictions</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Fuses partner conversational speech with non-verbal physical signals using Gemini 2.5 Flash. 
              Generates 3 empathetic, natural candidate responses ready for 1-tap confirmation.
            </p>
          </div>
          <Link 
            href="/conversation" 
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center space-x-1 pt-2"
          >
            <span>Start Live Session</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 3: Consent & Synthesis */}
        <div className="app-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
              <Volume2 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Consented Voice Output</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              High-fidelity speech synthesis via ElevenLabs and local standard PCM fallback. 
              Strict cryptographic consent verification guarantees voice cloning cannot run without authorization.
            </p>
          </div>
          <Link 
            href="/settings" 
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center space-x-1 pt-2"
          >
            <span>Manage Privacy & Voice</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* System Specifications Bar */}
      <div className="app-card p-6 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center space-x-3">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span><strong>Engine:</strong> PyTorch CNN + OpenCV (100×120 ROI)</span>
        </div>
        <div className="flex items-center space-x-3">
          <Globe2 className="w-4 h-4 text-slate-400" />
          <span><strong>Language Support:</strong> English (en), Hindi (hi), Hinglish (hi-en)</span>
        </div>
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-emerald-700 font-medium">HIPAA / Privacy Compliant Architecture</span>
        </div>
      </div>
    </div>
  );
}
