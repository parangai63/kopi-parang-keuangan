/** @type {import('tailwindcss').Config} */
// Tampilan mengikuti rancangan original (original/kopi-parang-keuangan-artifact.html):
// nila (indigo batik) sebagai aksen, soga (cokelat batik Solo) untuk merek, mode gelap otomatis.
// Semua warna = variabel CSS di src/index.css, jadi utility Tailwind ikut berganti di mode gelap.
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
        display: ["Literata", "Georgia", "Times New Roman", "serif"],
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
