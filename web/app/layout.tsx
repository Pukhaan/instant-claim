import type { Metadata, Viewport } from "next";
import { DM_Mono, Geist_Mono, Inter, Syne } from "next/font/google";
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

// SnapClaim flow uses a different display + mono pair than the rest of Teller.
// Scoped via the `.snap` class so it can't bleed into chat / dashboard.
const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono-snap",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teller — your bunq co-pilot",
  description:
    "A multi-modal AI banker for bunq. Voice, image, and proactive intelligence, talking to the real bunq API.",
};

// Edge-to-edge on iPhone (notch + home indicator handled via env(safe-area-*)),
// disable user scaling — the claim flow has fixed layouts that should not zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0c09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${syne.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
