import { NAIL_ORDER, NAIL_INFO } from "../data/nails.js";
import { CHIRURGO_IMPLANT_IDS } from "../data/items.js";

export function nailStateIndex(state) { return NAIL_ORDER.indexOf(state); }

// ─── RANKING COMPLETO DEGLI STATI ────────────────────────────
// NAIL_ORDER contiene solo la catena di degrado: piede/polliceVerde/unghiaNera
// ne sono fuori e `indexOf` restituisce -1, cioè "peggio di morta" (indice 0).
// Risultato: gli impianti sostituivano un 🦶 PIEDE (×3.0) o un 🌿 POLLICE VERDE
// (×2.5) invece dell'unghia rovinata, e le cure li declassavano a Sana.
// nailRank ordina TUTTI gli stati per desiderabilità reale (mult crescente).
const NAIL_RANK = {
  morta: 0,
  marcia: 1,
  unghiaNera: 1.5,   // ×0.4 + rischio annullo: tra marcia (×0.25) e sanguinante (×0.5)
  sanguinante: 2,
  graffiata: 3,
  sana: 4,
  kawaii: 5,         // ×2.0
  polliceVerde: 6,   // ×2.5
  piede: 7,          // ×3.0
};
export function nailRank(state) {
  const r = NAIL_RANK[state];
  return r === undefined ? NAIL_RANK.sana : r; // stato ignoto → trattalo come sano
}

// ─── ASCII PORTRAIT NORMALIZER ────────────────────────────────
// Centers every line of an ASCII portrait within the max visual width.
// Accounts for wide chars (CJK, emoji) that occupy 2 terminal columns.
function _vw(ch) {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 1;
  // CJK Unified / Extension A-F, CJK Compatibility, Hangul, wide symbols, emoji blocks
  if (
    (cp >= 0x1100  && cp <= 0x115F)  || // Hangul Jamo
    (cp >= 0x2E80  && cp <= 0x303E)  || // CJK Radicals / Kangxi
    (cp >= 0x3041  && cp <= 0x33FF)  || // Hiragana / Katakana / CJK
    (cp >= 0x3400  && cp <= 0x4DBF)  || // CJK Extension A
    (cp >= 0x4E00  && cp <= 0xA4CF)  || // CJK Unified
    (cp >= 0xA960  && cp <= 0xA97F)  || // Hangul Jamo Extended-A
    (cp >= 0xAC00  && cp <= 0xD7FF)  || // Hangul Syllables
    (cp >= 0xF900  && cp <= 0xFAFF)  || // CJK Compatibility Ideographs
    (cp >= 0xFE10  && cp <= 0xFE19)  || // Vertical Forms
    (cp >= 0xFE30  && cp <= 0xFE6F)  || // CJK Compatibility Forms
    (cp >= 0xFF01  && cp <= 0xFF60)  || // Fullwidth Latin
    (cp >= 0xFFE0  && cp <= 0xFFE6)  || // Fullwidth Signs
    (cp >= 0x1B000 && cp <= 0x1B0FF) || // Kana Supplement
    (cp >= 0x1F004 && cp <= 0x1F0CF) || // Mahjong / playing cards
    (cp >= 0x1F300 && cp <= 0x1FAFF) || // Misc Symbols / Emoji
    (cp >= 0x20000 && cp <= 0x3FFFD)    // CJK Extension B-F
  ) return 2;
  return 1;
}
function _lineVW(line) {
  return [...line].reduce((w, ch) => w + _vw(ch), 0);
}
export function normalizePortrait(lines) {
  if (!lines || lines.length === 0) return lines;
  const widths = lines.map(_lineVW);
  const maxW = Math.max(...widths);
  return lines.map((line, i) => {
    const pad = maxW - widths[i];
    if (pad <= 0) return line;
    // distribute extra space: more on the left so art stays left-anchored when
    // the delta is odd, but add at least half to the left to center-ish it.
    const leftPad = Math.floor(pad / 2);
    return ' '.repeat(leftPad) + line;
  });
}

// True se l'unghia ha un impianto del chirurgo (plastica/ferro/oro) ancora attivo
// — questi impianti NON sanguinano, non degradano, hanno slot fissi (implantUses).
export function hasChirurgoImplant(nail) {
  return !!nail && CHIRURGO_IMPLANT_IDS.has(nail.implant) && (nail.implantUses || 0) > 0;
}

// ─── NAIL VISUAL THEMES ──────────────────────────────────────
// Ogni impianto sovrascrive l'aspetto dell'unghia (emoji, colore,
// glow, background). Smalto aggiunge un halo magenta sopra.
// Lo stato (kawaii/sana/morta/etc.) rimane la base fallback.
export const IMPLANT_VISUALS = {
  oro:       { emoji:"🥇", color:"#ffd700", glow:"0 0 14px #ffd70099, inset 0 0 16px #ffaa0055", bg:"linear-gradient(145deg,#3a2e0a 0%,#6b4e10 50%,#3a2e0a 100%)" },
  ferro:     { emoji:"⚙️", color:"#c0c0d0", glow:"0 0 8px #c0c0d066, inset 0 0 10px #55556644", bg:"linear-gradient(145deg,#1a1a22 0%,#333344 50%,#1a1a22 100%)" },
  plastica:  { emoji:"🧪", color:"#44ddee", glow:"0 0 8px #44ddee88, inset 0 0 8px #22889933", bg:"linear-gradient(145deg,#0a2830 0%,#144050 50%,#0a2830 100%)" },
  sacra:     { emoji:"✨", color:"#fff7cc", glow:"0 0 18px #fff7cc99, 0 0 4px #ffd700, inset 0 0 14px #ffd70055", bg:"linear-gradient(145deg,#2a2508 0%,#55481c 50%,#2a2508 100%)" },
  baddie:    { emoji:"💋", color:"#ff4477", glow:"0 0 12px #ff447799, inset 0 0 10px #aa224466", bg:"linear-gradient(145deg,#2a0811 0%,#55112a 50%,#2a0811 100%)" },
  neonato:   { emoji:"👶", color:"#ffc0cb", glow:"0 0 8px #ffc0cb88", bg:"linear-gradient(145deg,#2a1016 0%,#55202c 50%,#2a1016 100%)" },
  marcione:  { emoji:"🧟", color:"#6b8e23", glow:"0 0 8px #6b8e2388, inset 0 0 8px #44551144", bg:"linear-gradient(145deg,#111808 0%,#223010 50%,#111808 100%)" },
  velenosa:  { emoji:"☠️", color:"#88ff44", glow:"0 0 10px #88ff4488, inset 0 0 8px #449922", bg:"linear-gradient(145deg,#0a1f08 0%,#15401a 50%,#0a1f08 100%)" },
  parassita: { emoji:"🪱", color:"#ff6fae", glow:"0 0 10px #ff6fae88, inset 0 0 8px #cc447755", bg:"linear-gradient(145deg,#220a16 0%,#4a1430 50%,#220a16 100%)" },
};

// Emoji default per stato "base" (quando non c'è impianto)
const STATE_EMOJI = {
  morta:"💀", piede:"🦶", kawaii:"💖",
  polliceVerde:"🌿", unghiaNera:"🖤",
  sana:"🖐", graffiata:"🖐", sanguinante:"🖐", marcia:"🖐",
};

// Ritorna aspetto visuale per un'unghia (emoji, colore primario,
// glow CSS, background CSS, e flag decorativi)
export function getNailVisual(nail) {
  if (!nail) return null;
  const stateInfo = NAIL_INFO[nail.state] || NAIL_INFO.sana;
  const isDead = nail.state === "morta";
  const hasImplant = !!nail.implant && (nail.implantUses || 0) > 0;
  const hasSmalto = (nail.smalto || 0) > 0;

  // Base: stato dell'unghia
  let visual = {
    emoji: STATE_EMOJI[nail.state] || "🖐",
    color: stateInfo.color,
    glow: "none",
    bg: null,
    accent: null,         // bordo secondario (smalto)
    label: stateInfo.label,
  };

  // Override: impianto attivo → colore/emoji/glow dedicati
  if (!isDead && hasImplant) {
    const iv = IMPLANT_VISUALS[nail.implant];
    if (iv) {
      visual.emoji = iv.emoji;
      visual.color = iv.color;
      visual.glow = iv.glow;
      visual.bg = iv.bg;
    }
  }

  // Smalto: aggiunge bordo/halo magenta sopra (preserva emoji impianto)
  if (!isDead && hasSmalto) {
    visual.accent = "#ff4bd8";            // magenta kawaii
    visual.glow = visual.glow === "none"
      ? "0 0 8px #ff4bd888"
      : `${visual.glow}, 0 0 6px #ff4bd877`;
  }

  return visual;
}

export function degradeNail(state, amount=1) {
  const idx = nailStateIndex(state);
  return NAIL_ORDER[Math.max(0, idx - amount)];
}

// Degrade a nail object — respects cremaHP, smalto protection and piede special case
export function degradeNailObj(nail, amount=1) {
  const newNail = {...nail};
  let dmg = amount;
  // Impianti chirurgo (plastica/ferro/oro): NON sanguinano — ignorano completamente
  // il danno da grattata. Gli slot vengono consumati separatamente per-carta nel
  // flusso di useScratchHandlers (implantUses → morta a esaurimento).
  if (CHIRURGO_IMPLANT_IDS.has(newNail.implant) && (newNail.implantUses || 0) > 0) {
    return newNail;
  }
  // CremaHP assorbe danni extra (cella bianca oltre kawaii)
  if (newNail.cremaHP && newNail.cremaHP > 0) {
    const absorbed = Math.min(newNail.cremaHP, dmg);
    newNail.cremaHP -= absorbed;
    dmg -= absorbed;
  }
  // Smalto assorbe danni prima dell'unghia
  if (newNail.smalto && newNail.smalto > 0) {
    const absorbed = Math.min(newNail.smalto, dmg);
    newNail.smalto -= absorbed;
    dmg -= absorbed;
  }
  if (dmg <= 0) {
    // Kawaii revert: se smalto è ora 0 e lo stato è kawaii, torna a sana
    if (newNail.state === "kawaii" && (!newNail.smalto || newNail.smalto <= 0)) {
      newNail.state = "sana";
    }
    return newNail;
  }
  // Piede: al primo danno diventa graffiata (perde x3 ma resta usabile)
  if (newNail.state === "piede") { newNail.state = "graffiata"; return newNail; }
  // Sprint 2: stati speciali fuori catena
  if (newNail.state === "polliceVerde") {
    // Buff si consuma al primo danno: torna Sana
    newNail.state = "sana";
    newNail.scratchCount = 0;
    dmg -= 1;
    if (dmg <= 0) return newNail;
  }
  if (newNail.state === "unghiaNera") {
    // Già marcia/nera: al primo colpo muore
    newNail.state = "morta";
    return newNail;
  }
  newNail.state = degradeNail(newNail.state, dmg);
  // Kawaii revert: se smalto è esaurito e stato è kawaii, torna a sana
  if (newNail.state === "kawaii" && (!newNail.smalto || newNail.smalto <= 0)) {
    newNail.state = "sana";
  }
  return newNail;
}

// Cura verso `target` — non declassa mai. Usa nailRank così un 🦶 PIEDE (×3.0)
// o un 🌿 POLLICE VERDE (×2.5) non vengono "curati" verso Sana (×1.0).
export function healNail(state, target) {
  return nailRank(target) > nailRank(state) ? target : state;
}

// Trova l'indice dell'unghia più degradata (rank più basso).
// Include "morta" nel confronto. Per escludere morte usa findWorstAliveIdx.
export function findWorstNailIdx(nails) {
  return nails.reduce((a, n, i) =>
    nailRank(n.state) < nailRank(nails[a].state) ? i : a, 0);
}

// Trova l'indice dell'unghia più degradata tra quelle vive (!= morta).
// Se tutte morte ritorna 0 (fallback sicuro per array non vuoti): i chiamanti
// controllano comunque `state !== "morta"` prima di curare.
export function findWorstAliveIdx(nails) {
  let worst = -1;
  for (let i = 0; i < nails.length; i++) {
    if (nails[i]?.state === "morta") continue;
    if (worst === -1 || nailRank(nails[i].state) < nailRank(nails[worst].state)) worst = i;
  }
  return worst === -1 ? 0 : worst;
}

// ─── NAIL CURSOR — pixel art hand con sangue progressivo ─────
// Genera cursore a mano pixel-art; l'unghia si riempie di sangue
// in base allo stato: sana=pulita, graffiata=scratch, sanguinante=gocce,
// marcia=sangue pesante, morta=dito interamente insanguinato
export function makeNailCursor(nailState = "sana") {
  const S = "#f5c5a3"; // incarnato
  const B = "#111111"; // bordo nero
  const P = 2;         // pixel size (SVG units)
  const GW = 14, GH = 14;

  // Costruisci griglia GW×GH come array 2D di colori (null = trasparente)
  const G = Array.from({length: GH}, () => Array(GW).fill(null));

  // — Bordo outline —
  for (let x = 4; x <= 7; x++) G[0][x] = B;             // cap dito
  for (let y = 1; y <= 5; y++) { G[y][3] = B; G[y][8] = B; } // lati dito
  [2,3,4,9,10,11,12].forEach(x => G[6][x] = B);          // nocca
  for (let y = 7; y <= 10; y++) { G[y][0] = B; G[y][13] = B; } // mano
  for (let y = 11; y <= 12; y++) { G[y][1] = B; G[y][12] = B; }
  for (let x = 2; x <= 11; x++) G[13][x] = B;            // fondo

  // — Incarnato fill —
  for (let y = 1; y <= 5; y++)
    for (let x = 4; x <= 7; x++) G[y][x] = S;
  for (let x = 5; x <= 8; x++) G[6][x] = S;
  for (let y = 7; y <= 10; y++)
    for (let x = 1; x <= 12; x++) G[y][x] = S;
  for (let y = 11; y <= 12; y++)
    for (let x = 2; x <= 11; x++) G[y][x] = S;

  // — Unghia + sangue per stato —
  // Posizioni unghia: rows 1-2, cols 5-6
  const nail = [[1,5],[1,6],[2,5],[2,6]];
  const rC = "#e8c9a8"; // unghia naturale — nessuno smalto, tono nude
  const r1 = "#ff6666"; // sangue fresco
  const r2 = "#cc1122"; // sangue medio
  const r3 = "#881122"; // sangue scuro
  const r4 = "#440a0a"; // sangue secco/morta
  const rH = "#ff99cc"; // kawaii highlight

  if (nailState === "kawaii") {
    nail.forEach(([r,c]) => G[r][c] = "#ff69b4");
    G[1][5] = rH;
  } else if (nailState === "sana") {
    nail.forEach(([r,c]) => G[r][c] = rC);
  } else if (nailState === "graffiata") {
    nail.forEach(([r,c]) => G[r][c] = rC);
    G[1][6] = r1;                         // singolo pixel graffiato
  } else if (nailState === "sanguinante") {
    nail.forEach(([r,c]) => G[r][c] = r1);
    G[2][6] = r2;                         // bordo unghia insanguinato
    G[3][6] = r1;                         // prima goccia
    G[4][6] = r2;                         // goccia più scura
  } else if (nailState === "marcia") {
    nail.forEach(([r,c]) => G[r][c] = r2);
    G[2][5] = r3; G[2][6] = r3;
    G[3][5] = r2; G[3][6] = r2;
    G[4][5] = r1; G[4][6] = r3;
    G[5][5] = r2; G[5][6] = r2;
    G[6][5] = r3;                         // sangue sulla nocca
  } else if (nailState === "morta") {
    for (let y = 1; y <= 5; y++)
      for (let x = 4; x <= 7; x++) G[y][x] = r3; // intero dito insanguinato
    nail.forEach(([r,c]) => G[r][c] = r4);         // unghia secca
    G[6][5] = r3; G[6][6] = r3;                    // sangue sulla nocca
    G[7][4] = r3; G[7][5] = r3;                    // cola sulla mano
    G[8][5] = r2;
  } else { // scheletro — game over: punta d'osso, niente pelle, canale midollare vuoto
    const BN = "#d4c4a0"; // osso chiaro
    const BO = "#1a1208"; // vuoto midollare
    // Falange superiore: pareti d'osso + canale cavo
    for (let y = 1; y <= 5; y++) {
      G[y][4] = BN; G[y][7] = BN;   // pareti laterali
      G[y][5] = BO; G[y][6] = BO;   // canale midollare vuoto
    }
    // Nocca: piatto osseo senza pelle
    G[6][5] = BN; G[6][6] = BN; G[6][7] = BN;
    // Mano / metacarpo: tutto osso pallido (le ossa della mano non sono cave alla stessa scala)
    for (let y = 7; y <= 10; y++)
      for (let x = 1; x <= 12; x++) G[y][x] = BN;
    for (let y = 11; y <= 12; y++)
      for (let x = 2; x <= 11; x++) G[y][x] = BN;
    // Unghia: cariata/assente, slot scuro
    nail.forEach(([r,c]) => G[r][c] = BO);
    G[1][5] = "#2a2010"; G[1][6] = "#2a2010"; // stub unghia secca
    // Sangue secco residuo sulla nocca
    G[6][5] = r4; G[9][5] = r4;
  }

  let rects = "";
  G.forEach((row, y) =>
    row.forEach((fill, x) => {
      if (fill) rects += `<rect x='${x*P}' y='${y*P}' width='${P}' height='${P}' fill='${fill}'/>`;
    })
  );
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${GW*P}' height='${GH*P}' viewBox='0 0 ${GW*P} ${GH*P}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 0, pointer`;
}

export const NAIL_CURSOR = makeNailCursor("sana");

// ─── CURSORE = SPRITE DEL DITO ───────────────────────────────
// Usa lo sprite PNG (cursor-<stato>) come cursore del mouse, con hotspot
// sulla punta dell'unghia. Fallback all'hand SVG se lo sprite manca.
import { assetUrl } from "../assets/registry.js";
const CURSOR_STATE_ALIAS = { scheletro: "morta" };
export function nailCursor(nailState = "sana") {
  const key = CURSOR_STATE_ALIAS[nailState] || nailState;
  const url = assetUrl(`cursor-${key}`);
  return url ? `url("${url}") 28 2, pointer` : makeNailCursor(nailState);
}

// ─── CURSORE = GRATTATORE EQUIPAGGIATO ───────────────────────
// Mentre si gratta con un grattatore in mano (bullone, moneta, ecc.), il
// puntatore mostra l'attrezzo al posto del dito — hotspot al centro (56×56,
// stessa taglia dei cursor-<stato>). Se manca lo sprite dedicato (oggetto
// nuovo senza cursor-item-<id>), niente sostituzione: resta il dito.
export function grattatoreCursor(itemId, fallback) {
  const url = itemId ? assetUrl(`cursor-item-${itemId}`) : null;
  return url ? `url("${url}") 28 28, pointer` : fallback;
}
