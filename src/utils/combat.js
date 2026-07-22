import { PLAYER_COMBAT_CELLS, ENEMY_COMBAT_POOLS } from "../data/combat.js";
import { roll, pick } from "./random.js";

// Sprint 5: Combat card visual variants
// MOLTO rare: ~92% normale, ~8% variant. Quando compaiono sono un evento.
// Glow potenziati per essere IMMEDIATAMENTE riconoscibili nel flusso combat.
export const CARD_VARIANTS = {
  FOIL:      { label: "FOIL",     chance: 0.025, valueMult: 1.0,  desc: "Foil iridescente — porta fortuna",        color: "#88ccff", glow: "0 0 28px #66aaffee, 0 0 52px #66aaff88, inset 0 0 32px #aaddff88" },
  STRAPPATO: { label: "STRAPPATO",chance: 0.015, valueMult: 0.8,  desc: "Carta rovinata — valore -20%",             color: "#b07040", glow: "0 0 22px #b07040cc, 0 0 40px #80402088, inset 0 0 24px #00000099" },
  ORO:       { label: "D'ORO",    chance: 0.010, valueMult: 1.4,  desc: "Edizione d'oro — valore +40%",             color: "#ffd700", glow: "0 0 36px #ffd700ff, 0 0 64px #ffaa00aa, inset 0 0 36px #ffaa0099" },
  BN:        { label: "B&N",      chance: 0.015, valueMult: 0.9,  desc: "Bianco e Nero — valore -10% ma +1 combo",  color: "#eeeeee", glow: "0 0 22px #ffffffcc, 0 0 44px #ffffff66, inset 0 0 28px #ffffff55" },
  MULTI:     { label: "MULTI",    chance: 0.015, valueMult: 1.0,  desc: "Multicategoria — combo triggera comunque", color: "#ff66cc", glow: "0 0 30px #ff66ccee, 0 0 56px #ff66cc99, inset 0 0 32px #ff88dd88" },
};

function rollVariant() {
  const r = Math.random();
  let acc = 0;
  for (const [key, v] of Object.entries(CARD_VARIANTS)) {
    acc += v.chance;
    if (r < acc) return key;
  }
  return null; // normale
}

export function generateCombatCell() {
  const categories = ["COMBATTIMENTO", "DIFESA", "DENARO"];
  // Tradeoff compaiono meno spesso (30% delle carte della categoria)
  const cat = pick(categories);
  const pool = PLAYER_COMBAT_CELLS[cat];
  const base = pool.filter(c => !c.tradeoff);
  const tradeoffs = pool.filter(c => c.tradeoff);
  const useTradeoff = tradeoffs.length > 0 && roll(0.28);
  const effect = useTradeoff ? pick(tradeoffs) : pick(base);
  const variant = rollVariant();
  return { ...effect, category: cat, variant, scratched: false };
}

// Genera una mano di N carte (per selezione 5-scegli-3)
export function generateCombatHand(count = 5) {
  return Array.from({ length: count }, generateCombatCell);
}

// Carte nemico — variano per tipo
export function generateEnemyCombatCell(enemyName) {
  const pool = ENEMY_COMBAT_POOLS[enemyName] || ENEMY_COMBAT_POOLS["Sfidante"];
  const categories = Object.keys(pool);
  const cat = pick(categories);
  const effect = pick(pool[cat]);
  return { ...effect, category: cat, scratched: false };
}

export function generateCombatCard(isSpecial = false, enemyName = null) {
  if (enemyName) {
    // Il Napoletano ha 4 carte invece di 3 — "'na mano napoletana"
    const isNapoletano = enemyName === "Il Napoletano";
    const poolKey = enemyName;
    if (isNapoletano) {
      const cells = [
        generateEnemyCombatCell(poolKey),
        generateEnemyCombatCell(poolKey),
        generateEnemyCombatCell(poolKey),
        generateEnemyCombatCell(poolKey),
      ];
      return { category: cells[0].category, cells, isSpecial: true };
    }
    const cells = [
      generateEnemyCombatCell(poolKey),
      generateEnemyCombatCell(poolKey),
      generateEnemyCombatCell(poolKey),
    ];
    return { category: cells[0].category, cells, isSpecial };
  }
  const cells = [generateCombatCell(), generateCombatCell(), generateCombatCell()];
  return { category: cells[0].category, cells, isSpecial };
}
