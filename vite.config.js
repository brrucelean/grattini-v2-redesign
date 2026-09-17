import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { ticketLayoutPlugin } from "./vite-plugin-ticket-layout.js";

export default defineConfig({
  // ticketLayoutPlugin è apply:"serve" — vive solo nel dev server
  // visualizer: solo con ANALYZE=1 e fuori da dist/, altrimenti i report
  // finivano su gh-pages (stats.html era pubblico). Uso: npm run analyze
  plugins: [
    react(),
    ticketLayoutPlugin(),
    ...(process.env.ANALYZE
      ? [
          visualizer({ filename: ".stats/stats.html", gzipSize: true, brotliSize: true }),
          visualizer({ filename: ".stats/stats.json", template: "raw-data", gzipSize: true, brotliSize: true }),
        ]
      : []),
  ],
  base: "./",  // path relativi — necessario per itch.io
  // PORT permette a piu' dev server (es. due sessioni) di convivere
  server: { port: Number(process.env.PORT) || 5173 },
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
