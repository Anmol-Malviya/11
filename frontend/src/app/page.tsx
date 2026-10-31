import Link from "next/link";
import { ArrowRight, Mic, Video, CheckCircle2, Shield, HeartHandshake, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-12 space-y-8 sm:space-y-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl space-y-4 px-2">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200/60 text-indigo-700 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide shadow-xs">
          <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
          <span>Multimodal Assistive Technology</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
          Multimodal Live Conversation Assistant
        </h1>
        <p className="text-sm sm:text-lg text-slate-600 leading-relaxed font-normal">
          Designed for individuals with ALS, Cerebral Palsy, Parkinson’s, stroke, or laryngectomy. 
          Fuses speech audio, camera gesture tracking, and lip movement to predict natural responses, speaking with an expressive, consented voice.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
          <Link
            href="/conversation"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 font-semibold text-white text-base shadow-sm shadow-indigo-200 transition-all active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Live Assistant</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <Link
            href="/phrases"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 font-medium text-slate-700 text-base border border-slate-200/90 shadow-xs transition-all"
          >
            <span>Quick Phrases</span>
          </Link>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl w-full">
        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-3 transition-all hover:shadow-md">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600">
            <Mic className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Partner & Patient Speech</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            ElevenLabs Scribe captures conversational speech in English, Hindi, and code-mixed formats, interpreting context in real-time.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-3 transition-all hover:shadow-md">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
            <Video className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Lip & Gesture Landmarks</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            MediaPipe on-device tracking measures Lip Aspect Ratio (LAR), nodding, and hand gestures. Zero raw video ever leaves your device.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-3 transition-all hover:shadow-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Human Confirmation Gate</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Agency always stays with the user: candidate replies are presented as easy one-tap cards with an option to edit before voice synthesis.
          </p>
        </div>
      </div>

      {/* Trust & Privacy Notice */}
      <div className="max-w-2xl w-full glass-panel-subtle rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-slate-600 flex items-center space-x-3 border border-slate-200/70">
        <Shield className="w-6 h-6 text-emerald-600 flex-shrink-0" />
        <p>
          <strong className="text-slate-800">Privacy & Consent First:</strong> Zero unconsented storage. Voice cloning strictly requires signed explicit permission that can be revoked anytime.
        </p>
      </div>
    </div>
  );
}
