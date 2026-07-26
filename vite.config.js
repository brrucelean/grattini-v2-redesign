import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ticketLayoutPlugin } from "./vite-plugin-ticket-layout.js";

export default defineConfig({
  // ticketLayoutPlugin è apply:"serve" — vive solo nel dev server
  plugins: [react(), ticketLayoutPlugin()],
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
