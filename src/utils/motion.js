// ─── PREFERENZA DI MOVIMENTO RIDOTTO ─────────────────────────
// Lettura sincrona di `prefers-reduced-motion`, utilizzabile anche fuori da
// React (ParticleSystem in audio.js). Il lato CSS è gestito dal blocco
// @media (prefers-reduced-motion: reduce) dentro scratchlite.jsx; qui stanno
// solo i casi che il CSS non può coprire (canvas, animazioni ricreate in JS).
const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

// Sottoscrizione al cambio della preferenza di sistema (l'utente può girarla
// a gioco aperto). Ritorna la funzione di cleanup.
export function onReducedMotionChange(cb) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  const handler = (e) => cb(e.matches);
  // Safari < 14 non ha addEventListener sul MediaQueryList
  if (mq.addEventListener) {
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}
