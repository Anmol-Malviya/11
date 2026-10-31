"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, X, Copy, Check, ExternalLink, Wifi } from "lucide-react";

interface PhoneCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairingSessionId: string;
  isPhoneConnected: boolean;
}

export function PhoneCameraModal({
  isOpen,
  onClose,
  pairingSessionId,
  isPhoneConnected,
}: PhoneCameraModalProps) {
  const [pairingUrl, setPairingUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/remote-camera?session=${pairingSessionId}`;
      setPairingUrl(url);
    }
  }, [pairingSessionId]);

  if (!isOpen) return null;

  const copyUrl = () => {
    if (pairingUrl) {
      navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Use Phone as Camera</h3>
            <p className="text-xs text-slate-400">
              Scan with your phone to use its camera instead of this laptop.
            </p>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="bg-white p-5 rounded-2xl flex flex-col items-center justify-center mx-auto shadow-inner w-56 h-56">
          {pairingUrl ? (
            <QRCodeSVG
              value={pairingUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          ) : (
            <div className="text-xs text-slate-500">Generating QR...</div>
          )}
        </div>

        {/* Connection Status Indicator */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
          isPhoneConnected 
            ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
            : "bg-slate-800/60 border-slate-700/60 text-slate-300"
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isPhoneConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"}`} />
            <span className="font-medium">
              {isPhoneConnected ? "Phone Connected & Streaming!" : "Waiting for phone scan..."}
            </span>
          </div>
          <Wifi className="w-4 h-4 opacity-70" />
        </div>

        {/* Share link option */}
        <div className="space-y-2">
          <span className="text-[11px] text-slate-400 font-medium block">
            Or open this link on your phone browser:
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={pairingUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 select-all font-mono truncate focus:outline-none"
            />
            <button
              onClick={copyUrl}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Close / Done */}
        <div className="pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-slate-200 transition"
          >
            {isPhoneConnected ? "Back to Assistant" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
