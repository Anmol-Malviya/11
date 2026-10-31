"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home,
  MessageSquare, 
  Hand, 
  Grid, 
  Clock, 
  ShieldCheck, 
  Settings, 
  Volume2,
  Bell,
  ChevronDown,
  Menu,
  X
} from "lucide-react";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("EN / हिन्दी / Hinglish");

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/conversation", label: "Live Conversation", icon: MessageSquare },
    { href: "/gestures", label: "Gesture Recognition", icon: Hand },
    { href: "/phrases", label: "Quick Phrases", icon: Grid },
    { href: "/evaluation", label: "Conversations", icon: Clock },
    { href: "/settings", label: "Voice & Privacy", icon: ShieldCheck },
    { href: "/settings", label: "Settings", icon: Settings, isSettingsSub: true },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f4f7fb] text-slate-900">
      {/* Desktop Navy Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#111e38] text-white flex-shrink-0 min-h-screen justify-between shadow-xl">
        <div>
          {/* Logo Brand Header */}
          <div className="p-5 flex items-center space-x-3 border-b border-slate-800/80">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">
                VoiceExpression
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Assistive Communication Platform
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              // Specific match logic
              const isActive = item.isSettingsSub 
                ? false 
                : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={`${item.href}-${idx}`}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Card */}
        <div className="p-4 m-3 rounded-2xl bg-[#0b1426] border border-slate-800/80 text-left">
          <div className="text-[12px] font-bold text-slate-200">
            Inclusive Communication
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            For Everyone & Everywhere
          </div>
          <div className="mt-2.5 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-medium">Model Pipeline Live</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <div className="flex items-center space-x-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-bold text-sm text-slate-900">VoiceExpression</span>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            {/* Context breadcrumb or left empty matching mockup */}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-3">
            {/* Language Selector Pill */}
            <div className="relative">
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="EN / हिन्दी / Hinglish">EN / हिन्दी / Hinglish</option>
                <option value="English">English</option>
                <option value="हिन्दी">हिन्दी (Hindi)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Notification Bell */}
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute top-2 right-2" />
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
                AA
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline">Aarav A.</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#111e38] text-white p-4 space-y-1 border-b border-slate-800">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`${item.href}-${idx}`}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
