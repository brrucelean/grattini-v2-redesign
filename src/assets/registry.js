// ─── ASSET REGISTRY — auto-registro sprite ──────────────────
// Ogni file in ./img/<id>.png|webp|svg diventa disponibile con chiave =
// nome-file senza estensione (es. "combat-attacco", "nail-sana", "hud-hp").
// Basta droppare un PNG con il nome giusto e si "accende" nel gioco via <Asset>,
// senza toccare altro codice. Vite fa il bundling con import.meta.glob.
const modules = import.meta.glob("./img/*.{png,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const ASSETS = {};
for (const path in modules) {
  const id = path.split("/").pop().replace(/\.(png|webp|svg)$/i, "");
  ASSETS[id] = modules[path];
}

// URL dello sprite per un id, o null se non ancora prodotto.
export function assetUrl(id) {
  return id ? (ASSETS[id] || null) : null;
}

// True se esiste uno sprite per quell'id.
export function hasAsset(id) {
  return !!assetUrl(id);
}

// Risolve un id "grezzo" (es. "fintoMilionario" o "cerotto") provando i prefissi
// di categoria, così i call-site possono passare solo l'id senza sapere il prefisso.
// Ritorna la chiave completa esistente (es. "card-fintoMilionario") o null.
const ASSET_PREFIXES = ["", "card-", "item-", "spr-", "nail-", "hud-", "combat-"];
export function resolveAsset(id) {
  if (!id) return null;
  for (const p of ASSET_PREFIXES) {
    if (ASSETS[p + id]) return p + id;
  }
  return null;
}
