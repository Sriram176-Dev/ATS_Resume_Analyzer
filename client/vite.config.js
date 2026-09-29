import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs on :5000; proxying /api keeps the browser same-origin (no CORS).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_DEV_API_TARGET || "http://localhost:5000", changeOrigin: true } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: false,
    globals: true,
  },
});
