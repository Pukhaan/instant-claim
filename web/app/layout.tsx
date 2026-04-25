import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://teller-eight.vercel.app"),
  title: {
    default: "Finn — Multimodal AI Claims Assistant for bunq",
    template: "%s · Finn",
  },
  description:
    "Insurance claims should be one tap, not two weeks. Finn lives natively inside bunq and replaces the third-party claim portal with a 60-second multimodal flow: a photo, a voice note, and instant payout.",
  applicationName: "Finn",
  authors: [{ name: "Andreas Kruszakin-Liboska" }, { name: "David Pukha" }, { name: "Valeriu Ilicciev" }],
  keywords: [
    "bunq",
    "Finn",
    "AI insurance assistant",
    "instant claim",
    "multimodal AI",
    "AWS Bedrock",
    "Claude",
    "AWS Transcribe Streaming",
  ],
  openGraph: {
    type: "website",
    siteName: "Finn",
    title: "Finn — Multimodal AI Claims Assistant for bunq",
    description:
      "A 60-second multimodal claim flow inside bunq. Snap a photo, record a voice note, get paid in seconds.",
    url: "https://teller-eight.vercel.app",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finn — Multimodal AI Claims Assistant for bunq",
    description:
      "Insurance claims in 60 seconds: a photo, a voice note, instant payout. Built on AWS Bedrock + Transcribe Streaming inside bunq.",
  },
};

// Edge-to-edge on iPhone (notch + home indicator handled via env(safe-area-*)),
// disable user scaling — the claim flow has fixed layouts that should not
// zoom. themeColor is pure black so the iOS status bar reads the same as the
// claim flow background.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
