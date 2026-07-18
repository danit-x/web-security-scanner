// tailwind.config.js
// This is the single source of truth for your design system — colors,
// font. Every page pulls from these same tokens instead of hardcoding
// hex values, so changing a color here updates it everywhere.

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Background layers
        bg: "#0f172a", // page background
        surface: "#1e293b", // cards, navbar, inputs

        // Accent
        primary: "#2563eb", // buttons, links
        "primary-hover": "#1d4ed8",

        // Severity colors (already used across FindingCard/ReportPage)
        critical: "#991b1b",
        high: "#ef4444",
        medium: "#eab308",
        low: "#3b82f6",

        // Grade colors
        "grade-good": "#22c55e", // A/B
        "grade-mid": "#eab308", // C
        "grade-bad": "#ef4444", // D/E/F

        // Text
        "text-primary": "#f8fafc",
        "text-secondary": "#94a3b8",
        "text-muted": "#64748b",

        border: "#334155",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
