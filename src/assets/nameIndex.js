// ─── INDICE NOME → ASSET ─────────────────────────────────────
// Molti modali/liste hanno solo il NOME dell'oggetto (non l'id), es.
// itemFoundModal.name = "Il Finto Milionario". Questo indice mappa il
// nome all'id sprite giusto (card-/item-/spr-) così un unico aggancio
// nel render li accende TUTTI, ovunque, senza toccare ogni call-site.
import { CARD_TYPES } from "../data/cards.js";
import { ITEM_DEFS, GRATTATORE_DEFS, RELIC_DEFS,
         MACELLAIO_IMPLANTS, ANZIANA_IMPLANTS, CHIRURGO_OSCURO_IMPLANTS } from "../data/items.js";
import { assetUrl } from "./registry.js";

const NAME_TO_ID = {};
// Carte → card-<id>
for (const c of CARD_TYPES) if (c?.name) NAME_TO_ID[c.name] = `card-${c.id}`;
// Consumabili / grattatori / reliquie (defs a oggetto) → item-<id>
for (const [id, d] of Object.entries(ITEM_DEFS))       if (d?.name) NAME_TO_ID[d.name] = `item-${id}`;
for (const [id, d] of Object.entries(GRATTATORE_DEFS)) if (d?.name) NAME_TO_ID[d.name] = `item-${id}`;
for (const [id, d] of Object.entries(RELIC_DEFS))       if (d?.name) NAME_TO_ID[d.name] = `item-${id}`;
// Impianti (array con id proprio) → item-<id> (se un giorno generati)
for (const arr of [MACELLAIO_IMPLANTS, ANZIANA_IMPLANTS, CHIRURGO_OSCURO_IMPLANTS])
  for (const d of arr) if (d?.name) NAME_TO_ID[d.name] = `item-${d.id}`;

// Ritorna la chiave sprite per un nome oggetto, solo se lo sprite esiste davvero.
export function assetIdByName(name) {
  const id = name && NAME_TO_ID[name];
  return id && assetUrl(id) ? id : null;
}
