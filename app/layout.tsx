import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instant Claim · bunq",
  description:
    "Multimodal AI insurance claims. Photo + voice note → decision + payout in under 30 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bunq-gray text-bunq-dark antialiased">
        {children}
      </body>
    </html>
  );
}
