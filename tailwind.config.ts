import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Noto Sans Arabic stays IN the sans stack, after Manrope: Manrope
        // has no Arabic coverage, so without this fallback any Arabic glyph in
        // a `font-sans` element renders from an arbitrary system face at the
        // wrong weight and line height.
        sans: [
          "var(--font-manrope)",
          "var(--font-noto-arabic)",
          "system-ui",
          "sans-serif",
        ],
        arabic: ["var(--font-noto-arabic)", "var(--font-manrope)", "sans-serif"],
      },
      transitionTimingFunction: {
        ac: "var(--ac-ease)",
        "ac-soft": "var(--ac-ease-soft)",
      },
      transitionDuration: {
        1: "var(--ac-dur-1)",
        2: "var(--ac-dur-2)",
        3: "var(--ac-dur-3)",
      },
      colors: {
        // ── Areen semantic tokens (src/styles/tokens.css) ──────────────────
        // Every one resolves through an RGB-triplet CSS variable, so opacity
        // modifiers work (`bg-surface/60`) and both themes are one lookup.
        // Prefer these over any literal colour in a component.
        canvas: "rgb(var(--ac-canvas) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--ac-surface) / <alpha-value>)",
          2: "rgb(var(--ac-surface-2) / <alpha-value>)",
          3: "rgb(var(--ac-surface-3) / <alpha-value>)",
        },
        rail: {
          DEFAULT: "rgb(var(--ac-rail) / <alpha-value>)",
          2: "rgb(var(--ac-rail-2) / <alpha-value>)",
          border: "rgb(var(--ac-rail-border) / <alpha-value>)",
          fg: "rgb(var(--ac-on-rail) / <alpha-value>)",
          muted: "rgb(var(--ac-on-rail-muted) / <alpha-value>)",
        },
        content: {
          DEFAULT: "rgb(var(--ac-text) / <alpha-value>)",
          2: "rgb(var(--ac-text-2) / <alpha-value>)",
          3: "rgb(var(--ac-text-3) / <alpha-value>)",
          inverse: "rgb(var(--ac-text-inverse) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--ac-border) / <alpha-value>)",
          strong: "rgb(var(--ac-border-strong) / <alpha-value>)",
        },
        brand: {
          // DEFAULT / dark / light are kept alongside the numeric ramp because
          // `bg-brand` (77 uses), `text-brand` (54) and the gradient pairs
          // `from-brand to-brand-dark` reference them. Dropping them silently
          // produced a transparent gradient with white text on the light
          // canvas — 1.19:1, caught by axe rather than by eye.
          DEFAULT: "rgb(var(--ac-accent) / <alpha-value>)",
          dark: "rgb(var(--ac-accent-hover) / <alpha-value>)",
          light: "rgb(var(--ac-accent-weak) / <alpha-value>)",
          50: "rgb(var(--ac-brand-50) / <alpha-value>)",
          100: "rgb(var(--ac-brand-100) / <alpha-value>)",
          200: "rgb(var(--ac-brand-200) / <alpha-value>)",
          300: "rgb(var(--ac-brand-300) / <alpha-value>)",
          400: "rgb(var(--ac-brand-400) / <alpha-value>)",
          500: "rgb(var(--ac-brand-500) / <alpha-value>)",
          600: "rgb(var(--ac-brand-600) / <alpha-value>)",
          700: "rgb(var(--ac-brand-700) / <alpha-value>)",
          800: "rgb(var(--ac-brand-800) / <alpha-value>)",
          900: "rgb(var(--ac-brand-900) / <alpha-value>)",
          950: "rgb(var(--ac-brand-950) / <alpha-value>)",
        },
        accent2: {
          DEFAULT: "rgb(var(--ac-accent) / <alpha-value>)",
          hover: "rgb(var(--ac-accent-hover) / <alpha-value>)",
          weak: "rgb(var(--ac-accent-weak) / <alpha-value>)",
          fg: "rgb(var(--ac-on-accent) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--ac-info) / <alpha-value>)",
          weak: "rgb(var(--ac-info-weak) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--ac-success) / <alpha-value>)",
          weak: "rgb(var(--ac-success-weak) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--ac-warning) / <alpha-value>)",
          weak: "rgb(var(--ac-warning-weak) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--ac-danger) / <alpha-value>)",
          weak: "rgb(var(--ac-danger-weak) / <alpha-value>)",
        },
        // Legacy aliases kept for the same reason as ink/cream.
        accent: {
          DEFAULT: "rgb(var(--ac-warning) / <alpha-value>)",
          dark: "rgb(var(--ac-warning) / <alpha-value>)",
          light: "rgb(var(--ac-warning-weak) / <alpha-value>)",
        },
        chart: {
          1: "rgb(var(--ac-chart-1) / <alpha-value>)",
          2: "rgb(var(--ac-chart-2) / <alpha-value>)",
          3: "rgb(var(--ac-chart-3) / <alpha-value>)",
          4: "rgb(var(--ac-chart-4) / <alpha-value>)",
          5: "rgb(var(--ac-chart-5) / <alpha-value>)",
          6: "rgb(var(--ac-chart-6) / <alpha-value>)",
          grid: "rgb(var(--ac-chart-grid) / <alpha-value>)",
          track: "rgb(var(--ac-chart-track) / <alpha-value>)",
        },

        // ── Legacy names, now resolving through the SAME tokens ────────────
        // These four were fixed literals, which is why globals.css carried
        // ~90 lines of `html:not(.light) .text-ink { ... !important }` to make
        // them readable in the other theme. `text-ink` alone appears 419 times.
        //
        // Pointing the names at tokens fixes every one of those usages and
        // every opacity variant at once — `text-ink/60` becomes the text role
        // at 60%, `bg-ink/5` a subtle raised surface, `border-ink/10` a
        // hairline — all correct in both themes, with no override table.
        // The names are kept rather than renamed so the change is a
        // definition swap, not a 419-site edit that could silently miss one.
        ink: {
          DEFAULT: "rgb(var(--ac-text) / <alpha-value>)",
          soft: "rgb(var(--ac-text-2) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "rgb(var(--ac-surface) / <alpha-value>)",
          dark: "rgb(var(--ac-surface-2) / <alpha-value>)",
        },

        // The former literal blocks (bg / surface / border / text / neon /
        // status / chart) are gone: each duplicated a name my token version
        // now defines, which TypeScript flagged as TS1117. What survives here
        // are the aliases still referenced in markup, resolving through roles.
        bg: "rgb(var(--ac-canvas) / <alpha-value>)",

        neon: {
          cyan: "rgb(var(--ac-accent) / <alpha-value>)",
          violet: "rgb(var(--ac-chart-4) / <alpha-value>)",
        },

        status: {
          success: "rgb(var(--ac-success) / <alpha-value>)",
          warning: "rgb(var(--ac-warning) / <alpha-value>)",
          danger: "rgb(var(--ac-danger) / <alpha-value>)",
          info: "rgb(var(--ac-info) / <alpha-value>)",
        },
      },

      boxShadow: {
        // Areen depth scale — shallow on purpose; see tokens.css.
        "ac-sm": "var(--ac-shadow-sm)",
        ac: "var(--ac-shadow)",
        "ac-md": "var(--ac-shadow-md)",
        "ac-lg": "var(--ac-shadow-lg)",
        rail: "var(--ac-shadow-rail)",
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
  plugins: [
    // A coarse pointer is a finger. The 44x44 minimum applies there and only
    // there — enforcing it on a mouse-driven screen would inflate every dense
    // table row for no one's benefit.
    plugin(({ addVariant }) => {
      addVariant("pointer-coarse", "@media (pointer: coarse)");
    }),
    tailwindcssAnimate],
};

export default config;
