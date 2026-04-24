import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev resources (HMR, etc.) when accessed via ngrok tunnels
  // and the Mac's LAN IP. Without this, React never hydrates on remote
  // devices and every button looks dead.
  allowedDevOrigins: [
    "twilight-guts-matrix.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "192.168.250.181",
  ],
};

export default nextConfig;
