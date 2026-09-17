import { RELIC_DEFS } from "../data/items.js";
import { pick } from "./random.js";

export const hasRelic = (player, effectId) => player?.relics?.some(r => r.effect === effectId);

// Reliquia casuale che il giocatore non ha ancora, come { id, ...def }; null se le ha tutte
export const pickNewRelic = (player) => {
  const owned = new Set((player?.relics || []).map(r => r.id));
  const available = Object.keys(RELIC_DEFS).filter(id => !owned.has(id));
  if (available.length === 0) return null;
  const id = pick(available);
  return { id, ...RELIC_DEFS[id] };
};
