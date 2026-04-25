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

  // /home was the previous URL for the bunq home screen; it now lives at /.
  // Permanent redirect so any links your team has already shared keep
  // working.
  async redirects() {
    return [{ source: "/home", destination: "/", permanent: true }];
  },
};

export default nextConfig;
