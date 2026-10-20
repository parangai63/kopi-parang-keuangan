import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 5174 / API 4100 supaya bisa jalan berdampingan dengan Parang-ops (5173 / 4000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
});
