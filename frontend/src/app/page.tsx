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
  Globe2,
  Layers,
  Activity,
  HeartHandshake
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 space-y-10 max-w-6xl mx-auto">
      {/* 2.5D Hero Section */}
      <div className="text-center max-w-3xl space-y-4 px-2">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200/80 text-indigo-800 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Next-Generation Healthcare Assistive AI</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
          Expressive Communication <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 bg-clip-text text-transparent">
            Without Speech Barriers
          </span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
          Built for individuals with ALS, stroke, cerebral palsy, and speech motor impairments. 
          Unifies real-time lip reading, dual-hand gesture tracking, conversational context, and 
          consenual ElevenLabs voice synthesis.
        </p>

        {/* 2.5D Primary Action Buttons */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full">
          <Link
            href="/conversation"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-sm shadow-[0_4px_14px_0_rgba(79,70,229,0.35)] transition-all active:scale-95"
          >
            <Layers className="w-4 h-4" />
            <span>Launch Unified Workspace</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <Link
            href="/gestures"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 font-bold text-slate-800 text-sm border border-slate-200 shadow-2xs transition-all active:scale-95 hover:border-slate-300"
          >
            <Hand className="w-4 h-4 text-emerald-600" />
            <span>Open Gesture Studio</span>
          </Link>
        </div>
      </div>

      {/* 2.5D Interactive Capability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: Multimodal Workspace */}
        <div className="panel-25d-interactive p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Unified Live Workspace</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Synchronous webcam view with green hand outlines, MediaPipe face mesh lip kinematics, 
              two-way dialogue, and 1-tap ElevenLabs vocal confirmation.
            </p>
          </div>
          <Link 
            href="/conversation" 
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1 pt-2"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 2: Dual-Hand Gesture Vision */}
        <div className="panel-25d-interactive p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-xs">
              <Hand className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Dual-Hand Gesture Studio</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Tracks Left and Right hands independently in bright green (#22C55E). Recognizes 10 single-hand 
              postures plus 6 custom two-hand communication symbols (Heart, Palms, Thumbs, T-Shape).
            </p>
          </div>
          <Link 
            href="/gestures" 
            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 inline-flex items-center space-x-1 pt-2"
          >
            <span>Configure Mappings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 3: Consent & Synthesis */}
        <div className="panel-25d-interactive p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shadow-xs">
              <Volume2 className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Consented Voice Output</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Powered by ElevenLabs high-fidelity TTS API with local fallback. 
              Zero automated vocalization without explicit user tap/editing confirmation.
            </p>
          </div>
          <Link 
            href="/settings" 
            className="text-xs font-bold text-purple-600 hover:text-purple-800 inline-flex items-center space-x-1 pt-2"
          >
            <span>Manage Voice & Privacy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2.5D System Specifications Footer */}
      <div className="panel-25d p-5 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span><strong>Inference:</strong> MediaPipe Vision + Groq / Gemini Intent Fusion</span>
        </div>
        <div className="flex items-center space-x-2.5">
          <Globe2 className="w-4 h-4 text-indigo-600" />
          <span><strong>Languages:</strong> English, Hindi (Devanagari), Hinglish (Code-mixed)</span>
        </div>
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-emerald-700 font-bold">Privacy-Preserving On-Device Vision</span>
        </div>
      </div>
    </div>
  );
}
