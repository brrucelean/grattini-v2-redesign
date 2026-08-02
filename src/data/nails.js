import { C } from "./theme.js";

// ─── NAIL STATES (ordered worst→best) ────────────────────────
export const NAIL_ORDER = ["morta","marcia","sanguinante","graffiata","sana","kawaii"];
export const NAIL_INFO = {
  kawaii:       { label: "KAWAII ♡",      color: C.pink,    mult: 2.0, cancelChance: 0 },
  sana:        { label: "Sana",          color: C.green,   mult: 1.0, cancelChance: 0 },
  graffiata:   { label: "Graffiata",     color: C.gold,    mult: 1.0, cancelChance: 0 },
  // Fa male ma non riduce più il premio: solo "marcia" penalizza economicamente,
  // sanguinante resta uno stadio di avviso prima di quello.
  sanguinante: { label: "Sanguinante",   color: C.orange,  mult: 1.0, cancelChance: 0 },
  marcia:      { label: "Marcia",        color: C.red,     mult: 0.25, cancelChance: 0 },
  morta:       { label: "MORTA ✝",       color: "#444",    mult: 0, cancelChance: 1 },
  piede:       { label: "🦶 PIEDE",     color: "#8B4513", mult: 3.0, cancelChance: 0 },
  // ─── SPRINT 2: stati speciali risk/reward da sigaretta/erba ───
  // Fuori dalla catena NAIL_ORDER: persistono finché non viene degradata.
  polliceVerde: { label: "🌿 POLLICE VERDE", color: "#00ff88", mult: 2.5, cancelChance: 0 },
  unghiaNera:   { label: "🖤 UNGHIA NERA",   color: "#222222", mult: 0.4, cancelChance: 0.15 },
};
