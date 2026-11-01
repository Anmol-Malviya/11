"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  MessageSquare, 
  Hand, 
  Bookmark, 
  Activity, 
  Settings, 
  Volume2,
  Sparkles,
  Camera,
  Layers
} from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/conversation", label: "Unified Workspace", icon: Layers, badge: "AI Live" },
    { href: "/gestures", label: "Gesture Studio", icon: Hand },
    { href: "/phrases", label: "Quick Phrases", icon: Bookmark },
    { href: "/evaluation", label: "Telemetry & Logs", icon: Activity },
    { href: "/settings", label: "Voice & Privacy", icon: Settings },
  ];

  return (
    <>
      {/* Premium Desktop / Tablet Top Header with 2.5D Depth */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 px-4 sm:px-8 py-2.5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 flex items-center justify-center text-white shadow-[0_4px_10px_0_rgba(79,70,229,0.30),inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform group-hover:scale-105">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-900">
                  VoiceExpression
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block -mt-0.5 hidden sm:block">
                Multimodal Assistive Communication
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-indigo-900 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1 text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* System Status Indicator Pill */}
          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Vision & Audio Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                isActive
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
