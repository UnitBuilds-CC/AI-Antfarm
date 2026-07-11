import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Antfarm | Decentralized Bio-Entropy Colony",
  description: "A deterministic antfarm simulation driven by live Solana blockchain entropy, Snowflake telemetry tracking, and Gemini Flash-Lite voiced existential monologues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
