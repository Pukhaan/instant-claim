import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";

// Only mono needs a web font — everything else uses the SF Pro Rounded
// system stack resolved at runtime by iOS/macOS Safari.
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

// Edge-to-edge on iPhone, status bar reads against the dark claim canvas,
// user scaling disabled so the fixed layouts don't zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05070a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
