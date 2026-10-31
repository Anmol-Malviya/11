"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, ThumbsUp, Settings, BarChart2, ShieldCheck } from "lucide-react";

export function Navigation() {
  return (
    <header className="w-full bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <Link href="/" className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner group-hover:scale-105 transition-transform">
          PS
        </div>
        <div>
          <span className="font-bold text-lg tracking-wide block">PS16 Assistive AI</span>
          <span className="text-xs text-indigo-300 block -mt-1">Multimodal Live Conversation Partner</span>
        </div>
      </Link>

      <nav className="flex items-center space-x-2 sm:space-x-4">
        <Link
          href="/conversation"
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors focus:ring-2 focus:ring-white"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Live Conversation</span>
        </Link>
        <Link
          href="/phrases"
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-colors"
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="hidden sm:inline">Quick Phrases</span>
        </Link>
        <Link
          href="/evaluation"
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          <span className="hidden sm:inline">Telemetry & Benchmarks</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </nav>
    </header>
  );
}

