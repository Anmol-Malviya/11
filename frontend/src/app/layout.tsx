import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SidebarLayout } from "@/components/SidebarLayout";

export const metadata: Metadata = {
  title: "VoiceExpression — Assistive Multimodal Communication",
  description: "Next-generation assistive communication platform integrating speech synthesis, real-time gesture recognition, and conversational AI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#f4f7fb] text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
        <SidebarLayout>
          {children}
        </SidebarLayout>
      </body>
    </html>
  );
}
