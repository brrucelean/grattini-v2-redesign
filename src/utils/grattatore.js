// ─── USO DEL GRATTATORE EQUIPAGGIATO ─────────────────────────
// Prima questa logica esisteva in tre copie (grattini, combattimento, effetti
// da combattimento), con il log "consumato!" lanciato dentro l'updater.

// Un uso in meno al grattatore equipaggiato: esaurito, esce dall'inventario e
// si sgancia. Funzione pura, da passare a updatePlayer.
export function spendGrattatoreUse(p) {
  const eq = p.equippedGrattatore;
  const g = eq && p.grattatori?.[eq.inventoryIdx];
  if (!g) return p;
  const grattatori = [...p.grattatori];
  const usesLeft = g.usesLeft - 1;
  if (usesLeft <= 0) {
    grattatori.splice(eq.inventoryIdx, 1);
    return {...p, grattatori, equippedGrattatore: null};
  }
  grattatori[eq.inventoryIdx] = {...g, usesLeft};
  return {...p, grattatori, equippedGrattatore: {...eq, usesLeft}};
}

// Il grattatore equipaggiato, se questo è il suo ultimo uso (per il log)
export function grattatoreAtLastUse(p) {
  const eq = p?.equippedGrattatore;
  const g = eq && p.grattatori?.[eq.inventoryIdx];
  return g && g.usesLeft <= 1 ? g : null;
}

// Grattatori con effetto solo in combattimento: non si consumano per carta
// grattata ma quando l'effetto scatta (o, il Guanto da BOSS, a fine boss-fight)
export const COMBAT_ONLY_EFFECTS = new Set(["atkBoost", "widePerfect", "guaranteedParry", "bossShield"]);
