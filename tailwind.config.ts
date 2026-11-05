import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)", panel: "rgb(var(--panel) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)", muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)", brand: "rgb(var(--brand) / <alpha-value>)",
        soft: "rgb(var(--soft) / <alpha-value>)",
        good: "rgb(var(--good) / <alpha-value>)", warn: "rgb(var(--warn) / <alpha-value>)", bad: "rgb(var(--bad) / <alpha-value>)",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], mono: ["ui-monospace", "monospace"] },
    },
  },
  plugins: [],
} satisfies Config;
