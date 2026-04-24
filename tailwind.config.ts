import type { Config } from "tailwindcss";

// Design tokens taken from the SnapClaim "lab" persona (see /design refs).
// If you add new tokens here, update both the design and the Tailwind extras.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0c09",
          surface: "#141711",
          surface2: "#1c1f18",
        },
        text: {
          DEFAULT: "#ecefe4",
          muted: "#717a68",
          soft: "#9aa08c",
        },
        lime: {
          DEFAULT: "#c8f535",
          dim: "rgba(200,245,53,0.15)",
          faint: "rgba(200,245,53,0.06)",
          border: "rgba(200,245,53,0.22)",
        },
        signal: {
          red: "#ff6b6b",
          amber: "#ffb340",
          blue: "#7ec4ff",
        },
      },
      borderColor: {
        subtle: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "SF Mono", "monospace"],
      },
      borderRadius: {
        card: "20px",
        cta: "20px",
        chip: "18px",
      },
      letterSpacing: {
        tightest: "-0.6px",
      },
    },
  },
  plugins: [],
};

export default config;
