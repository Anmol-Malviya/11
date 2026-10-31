import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "PS16 - Multimodal Live Conversation Assistant",
  description: "Assistive AI communication assistant for people with speech impairments.",
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
      <body className="min-h-full bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/40 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 pb-16 sm:pb-0">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
