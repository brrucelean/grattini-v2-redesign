// ─── HAPTIC FEEDBACK UTILITY ────────────────────────────────────
// Usa il Web Vibration API (Android Chrome / PWA).
// Quando wrappato con Capacitor, sostituire con @capacitor/haptics.
// Su iOS Safari vanilla: no-op silenzioso (vibrate non è supportato).

const vib = (pattern) => {
  try { navigator?.vibrate?.(pattern); } catch (_) {}
};

export const Haptics = {
  // Gratto su una cella
  scratch: () => vib(6),
  // Simbolo vincente rivelato
  win:     () => vib([12, 40, 20]),
  // Perdita (no match)
  lose:    () => vib(40),
  // Unghia che degrada
  nailHurt: () => vib([20, 20, 20]),
  // Unghia morta
  nailDead: () => vib([60, 30, 60, 30, 80]),
  // Game Over
  gameOver: () => vib([200, 100, 200, 100, 400]),
  // Vittoria finale
  victory:  () => vib([30, 60, 30, 60, 30, 60, 120]),
  // Acquisto nello shop
  buy:      () => vib(15),
  // Boss sconfitto
  boss:     () => vib([50, 50, 50, 50, 150]),
  // Tap generico (button press)
  tap:      () => vib(8),
};
