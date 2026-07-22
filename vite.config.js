import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",  // path relativi — necessario per itch.io
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // React/ReactDOM in chunk separato — immutabile tra deploy, cache lunga
        manualChunks: { vendor: ["react", "react-dom"] },
      },
    },
    // index chunk ora ~300kB (era 472kB) — le schermate sono chunk lazy separati
    chunkSizeWarningLimit: 320,
  },
});
