import { CARD_BALANCE } from "../data/cards.js";
import { BIOME_MODIFIERS } from "../data/biomes.js";
import { roundMoney } from "./money.js";

// ─── PREZZI DEL TABACCAIO ────────────────────────────────────
// Un solo calcolo per il prezzo mostrato e quello pagato. Prima il negozio
// mostrava (e confrontava coi soldi) il prezzo di listino: con lo sconto certi
// articoli sembravano fuori portata, e con la cedola Monopolio il click su un
// tier 3+ non faceva semplicemente nulla.

// Sconto totale: cedola "Sconto da Parente" + modificatore del bioma
export const shopDiscount = (player, biome) =>
  (player.shopDiscountMeta || 0) + (BIOME_MODIFIERS[biome]?.shopDiscount || 0);

// La cedola Monopolio raddoppia il prezzo dei grattini tier 3+
export const monopolioMult = (player, card) =>
  (CARD_BALANCE[card.id]?.tier || card.tier || 1) >= 3 ? (player.highCardCostMeta || 1) : 1;

// Grattini: al centesimo (il Poveraccio costa €0,50)
export const cardPrice = (player, biome, card) =>
  Math.max(0, roundMoney(card.cost * (1 - shopDiscount(player, biome)) * monopolioMult(player, card)));

// Oggetti e grattatori: all'euro intero
export const itemPrice = (player, biome, baseCost) =>
  Math.max(0, Math.round(baseCost * (1 - shopDiscount(player, biome))));
