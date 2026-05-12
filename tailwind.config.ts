import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Areen CUBs official brand palette
        brand: {
          DEFAULT: "#3B8BBA", // Blue (NCS)
          dark: "#2C6E96",
          light: "#E8F2F9",
        },
        accent: {
          DEFAULT: "#FF9E1F", // Orange Peel
          dark: "#E08800",
          light: "#FFF0DB",
        },
        ink: {
          DEFAULT: "#1E1E24", // Raisin Black
          soft: "#2A2A33",
        },
        cream: {
          DEFAULT: "#FFF8F0", // Floral White
          dark: "#F4ECE0",
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
        "brand-glow":
          "0 12px 24px -12px rgba(59, 139, 186, 0.45), 0 4px 12px -4px rgba(59, 139, 186, 0.25)",
        "accent-glow":
          "0 12px 24px -12px rgba(255, 158, 31, 0.45), 0 4px 12px -4px rgba(255, 158, 31, 0.25)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #3B8BBA 0%, #2C6E96 50%, #1E1E24 100%)",
        "accent-gradient":
          "linear-gradient(135deg, #FF9E1F 0%, #E08800 100%)",
        "hero-mesh":
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(59,139,186,0.18), transparent 60%), radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,158,31,0.12), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
