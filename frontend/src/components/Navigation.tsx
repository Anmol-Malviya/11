"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, ThumbsUp, Settings, BarChart2, Sparkles } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/gestures", label: "Gesture Assistant", icon: Sparkles },
    { href: "/conversation", label: "Live Assist", icon: MessageSquare },
    { href: "/phrases", label: "Quick Phrases", icon: ThumbsUp },
    { href: "/evaluation", label: "Telemetry", icon: BarChart2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Desktop / Tablet Top Header */}
      <header className="w-full glass-panel sticky top-0 z-50 border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center font-bold text-sm text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-slate-800 block">
                PS16 Assistive AI
              </span>
              <span className="text-[11px] text-indigo-600 font-medium block -mt-1 hidden sm:block">
                Live Conversation Partner
              </span>
            </div>
          </Link>

          {/* Desktop Nav Pills */}
          <nav className="hidden sm:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-white text-indigo-600 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-slate-200/90 px-3 py-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? "text-indigo-600 font-semibold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? "bg-indigo-50" : ""}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
