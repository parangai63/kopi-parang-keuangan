/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Exact tokens pulled from the Figma "Selection colors" palette.
        parang: {
          bg: "#F9F9FF",           // page background — design system's surface.canvas
          sidebar: "#FFFFFF",     // sidebar is light-themed per latest reference
          text: "#151C27",        // primary dark text (near-black navy) — text.primary
          textDeep: "#0A1422",    // deepest text/icon accent
          muted: "#616363",       // secondary muted text
          subtle: "#6B7280",      // tertiary muted text (meta labels) — text.secondary
          neutral: "#44474C",     // neutral dark gray (icons, secondary labels)
          outline: "#C5C6CC",     // borders / dividers
          divider: "#DFE0E0",     // hairline dividers
        },
        // App-wide design system's accent.* tokens (design_system.md) —
        // vivid blue is now THE primary action/active color everywhere
        // (buttons, active nav, chart lines, ring fill), replacing the
        // older convention of using parang.text/textDeep for primary
        // buttons. success/danger reuse the existing status.* values
        // exactly (they already matched the intended accent colors);
        // primary/warning are genuinely new.
        accent: {
          primary: "#2563EB",
          primaryDeep: "#1D4ED8",
          success: "#15803D",
          successBg: "#DCFCE7",
          warning: "#D97706",
          warningBg: "#FEF3C7",
          danger: "#DC2626",
          dangerBg: "#FEE2E2",
        },
        status: {
          instock: "#15803D",
          instockBg: "#DCFCE7",
          low: "#B91C1C",
          lowBg: "#FEE2E2",
          error: "#BA1A1A",       // destructive actions (delete)
        },
        info: {
          container: "#E7EEFE",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
