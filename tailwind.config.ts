import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Areen CUBs legacy brand palette (backward-compat) ──────────────
        brand: {
          DEFAULT: "#3B8BBA",
          dark: "#2C6E96",
          light: "#E8F2F9",
        },
        accent: {
          DEFAULT: "#FF9E1F",
          dark: "#E08800",
          light: "#FFF0DB",
        },
        ink: {
          DEFAULT: "#1E1E24",
          soft: "#2A2A33",
        },
        cream: {
          DEFAULT: "#FFF8F0",
          dark: "#F4ECE0",
        },

        // ── Dark-first design tokens ────────────────────────────────────────
        bg: "#0B0F14",

        surface: {
          DEFAULT: "#111827",
          elevated: "#18212F",
          overlay: "#1E2A3A",
        },

        border: {
          DEFAULT: "#263244",
          muted: "#1A2234",
          strong: "#334155",
        },

        text: {
          primary: "#F8FAFC",
          secondary: "#94A3B8",
          muted: "#64748B",
        },

        neon: {
          cyan: "#22D3EE",
          violet: "#A78BFA",
        },

        status: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#F43F5E",
          info: "#38BDF8",
        },

        chart: {
          1: "#22D3EE",
          2: "#A78BFA",
          3: "#22C55E",
          4: "#F59E0B",
          5: "#F43F5E",
          6: "#38BDF8",
          7: "#FB923C",
        },
      },

      fontFamily: {
        sans: [
          "var(--font-franklin)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },

      boxShadow: {
        // legacy
        "brand-glow":
          "0 12px 24px -12px rgba(59, 139, 186, 0.45), 0 4px 12px -4px rgba(59, 139, 186, 0.25)",
        "accent-glow":
          "0 12px 24px -12px rgba(255, 158, 31, 0.45), 0 4px 12px -4px rgba(255, 158, 31, 0.25)",
        // new dark-first shadows
        "glow-cyan":
          "0 0 20px rgba(34,211,238,0.35), 0 0 60px rgba(34,211,238,0.15)",
        "glow-violet": "0 0 20px rgba(167,139,250,0.35)",
        surface:
          "0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3)",
        "surface-lg":
          "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
      },

      backgroundImage: {
        // legacy
        "brand-gradient":
          "linear-gradient(135deg, #3B8BBA 0%, #2C6E96 50%, #1E1E24 100%)",
        "accent-gradient":
          "linear-gradient(135deg, #FF9E1F 0%, #E08800 100%)",
        "hero-mesh":
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(59,139,186,0.18), transparent 60%), radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,158,31,0.12), transparent 60%)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
