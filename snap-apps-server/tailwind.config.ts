import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Mino brand colors
        mino: {
          primary: "#00D4FF",
          secondary: "#8B5CF6",
          accent: "#10B981",
          dark: "#0A0A0F",
          glass: "rgba(255, 255, 255, 0.08)",
        },
        // TinyFish Current palette
        current: {
          bg: "#FFFEFB",
          ink: "#09162F",
          primary: "#223D48",
          accent: "#DB3B31",
          green: "#3D6A3D",
          blue: "#1C7BBB",
          orange: "#F14731",
          text: "#42515A",
          border: "#C6D2D9",
        },
      },
      fontFamily: {
        sans: [
          "DM Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "Instrument Serif",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Monaco",
          "monospace",
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "shimmer": "shimmer 2s infinite linear",
        "pulse-glow": "pulse-glow 2s infinite ease-in-out",
        "float": "float 3s infinite ease-in-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
