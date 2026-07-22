// ─── LOCALSTORAGE HELPERS ────────────────────────────────────
// Safe read/write JSON in localStorage. Swallow quota/JSON errors
// silently — meta progression non è critica, meglio un fallback
// che un crash runtime su dispositivi con storage bloccato.
//
// Keys centralizzate qui per evitare typo nei nomi chiave.
export const STORAGE_KEYS = {
  achievements:      'grattini_achievements',
  cedola:            'grattini_cedola',
  relicsDiscovered:  'grattini_relics_discovered',
  relicsEnabled:     'grattini_relics_enabled',
  vintage:           'grattini_vintage',
  alltime:           'grattini_alltime',
  totalScratches:    'grattini_totalScratches',
};

export function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function removeStored(key) {
  try { localStorage.removeItem(key); } catch {}
}

// Variante per contatori numerici (es. totalScratches): evita
// JSON.stringify su interi, usa parseInt + String direttamente.
export function getStoredNumber(key, fallback = 0) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function setStoredNumber(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}
