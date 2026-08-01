import { useState, useEffect } from "react";
import { prefersReducedMotion, onReducedMotionChange } from "../utils/motion.js";

// Ritorna true se l'utente ha chiesto movimento ridotto a livello di sistema.
// Si aggiorna se la preferenza cambia mentre il gioco è aperto.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => onReducedMotionChange(setReduced), []);
  return reduced;
}
