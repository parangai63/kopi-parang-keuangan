/** @type {import('tailwindcss').Config} */
// Tema "espresso & krim": sidebar & tombol utama espresso, pilihan aktif karamel, permukaan krem padat.
// Semua warna = variabel CSS di src/index.css.
// Preflight dimatikan supaya perilaku dasar elemen sama dengan rancangan original.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        sunk: "var(--sunk)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", soft: "var(--accent-soft)" },
        soga: { DEFAULT: "var(--soga)", soft: "var(--soga-soft)" },
        good: { DEFAULT: "var(--good)", soft: "var(--good-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        crit: { DEFAULT: "var(--crit)", soft: "var(--crit-soft)" },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        sans: ["Plus Jakarta Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
