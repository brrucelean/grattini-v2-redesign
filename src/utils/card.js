import { CARD_TYPES, CARD_BALANCE, CARD_SYMBOLS, CARD_SUITS, CARD_RANKS, CARD_VAL_MAP, SYMBOLS } from "../data/cards.js";
import { rng, roll, pick, shuffle } from "./random.js";

export function _makePlayingCard(rank) {
  const suit = CARD_SUITS[Math.floor(Math.random()*4)];
  return { rank, suit, symbol: rank+suit, value: CARD_VAL_MAP[rank]||0.5,
           isRed: suit==="♥"||suit==="♦", scratched:false };
}

// EV stimato: P(win) * prize_medio - costo
export function estimateCardEV(cardTypeId, playerState = {}) {
  const cb = CARD_BALANCE[cardTypeId];
  const ct = CARD_TYPES.find(t => t.id === cardTypeId);
  if (!cb || !ct) return null;
  const fortune = playerState.fortune || 0;
  const winP = Math.min(cb.winChance + Math.min(Math.max(fortune, 0), 5) * 0.06, 0.95); // cap fortune bonus
  const avgPrize = (cb.prizeMin + cb.prizeMax) / 2;
  const ev = winP * avgPrize - ct.cost;
  return { winP: Math.round(winP * 100), ev: Math.round(ev * 10) / 10 };
}

// Simulazione EV — usabile in console dev: window.simEV("maledetto", 10000)
// Esposto solo in dev mode (Vite tree-shakes questo blocco in build production)
if (import.meta.env?.DEV && typeof window !== "undefined") {
  window.simEV = (cardTypeId, runs = 10000) => {
    let total = 0;
    const ct = CARD_TYPES.find(t => t.id === cardTypeId);
    if (!ct) return "card not found";
    for (let i = 0; i < runs; i++) {
      const c = generateCard(cardTypeId, 0);
      total += (c.isWinner ? c.prize : 0) - ct.cost;
    }
    const ev = total / runs;
    // eslint-disable-next-line no-console
    console.log(`simEV(${cardTypeId}, ${runs}): EV = ${ev.toFixed(2)} | EV% = ${((ev/ct.cost)*100).toFixed(1)}%`);
    return ev;
  };
}

// Generate a scratch card instance
// Helper: two pairs of numbers that sum to 13, plus low-value fillers
export function _sum13WinnerNums(totalCells) {
  const validPairs = [[4,9],[5,8],[6,7]];
  const p1 = pick(validPairs);
  const p2 = pick(validPairs.filter(p => p[0] !== p1[0]));
  const fill = Array.from({length: totalCells - 4}, () => pick([1,2,3,4,5,6]));
  return shuffle([...p1, ...p2, ...fill]);
}

// True se NESSUN prefisso delle carte permette di fermarsi battendo il banco:
// scorrendo le carte in ordine, o si sballa (>7.5) prima di superare il banco,
// oppure non lo si supera mai. È la condizione che rende una carta davvero perdente.
export function _isLosingSetteEMezzoHand(cells, bancoTotal) {
  let sum = 0;
  for (const c of cells) {
    sum = Math.round((sum + c.value) * 10) / 10;
    if (sum > 7.5) return true;        // sballato: non poteva incassare
    if (sum > bancoTotal) return false; // poteva stare e vincere → non è perdente
  }
  return true; // arrivato in fondo senza mai battere il banco
}

// Mano perdente per Sette e Mezzo, garantita da _isLosingSetteEMezzoHand.
export function _makeLosingSetteEMezzoCells(count, bancoTotal) {
  const pool = ["5","6","7","A","2","3","4"];
  for (let att = 0; att < 60; att++) {
    const cells = Array.from({length: count}, () => _makePlayingCard(pick(pool)));
    if (_isLosingSetteEMezzoHand(cells, bancoTotal)) return cells;
  }
  // Fallback deterministico: prima carta ≤ banco (quindi non si può stare),
  // poi dei 7 che fanno sballare subito al secondo scoperto.
  const firstRanks = CARD_RANKS.filter(r => CARD_VAL_MAP[r] <= bancoTotal && CARD_VAL_MAP[r] + 7 > 7.5);
  const first = firstRanks.length > 0 ? pick(firstRanks) : "A";
  const cells = [_makePlayingCard(first)];
  while (cells.length < count) cells.push(_makePlayingCard("7"));
  return cells;
}

// ─── BIGLIETTI INIZIALI (Nonno Carmelo) ──────────────────────
// I 3 grattini d'apertura sono pescati a caso tra tutti quelli giocabili
// nell'overlay di grattata, non più fissi (fortunaFlash/setteEMezzo/portaFortuna).
//
// Due esclusioni, entrambe perché l'intro imposta `scratchingCard` direttamente
// senza passare da handleSelectCard:
//  • labirinto/combina/tesoro hanno schermate dedicate e ScratchCardView non le
//    implementa: finirebbero nel ramo "match" generico con matchNeeded 0,
//    cioè vincita immediata alla prima cella scoperta;
//  • requiresGrattatore (jackpotMix) va grattata solo con un attrezzo, e a inizio
//    partita non ne hai: il controllo che lo impone vive in handleSelectCard.
const INTRO_EXCLUDED_MECHANICS = new Set(["labirinto", "combina", "tesoro"]);

export function introCardPool() {
  return CARD_TYPES.filter(t =>
    !INTRO_EXCLUDED_MECHANICS.has(t.mechanic) && !t.requiresGrattatore
  );
}

// Pesi per tier del pescaggio iniziale.
// A pool uniforme il premio intascabile medio era €70, e con €70 il primo
// tabaccaio ti apre già 16 carte su 17 e tutti i grattatori: non resta niente
// da desiderare. A questi pesi la media scende a €29 (12 carte su 17: devi
// scegliere) e le partenze sopra €200 passano dal 10,6% al 2,9%.
//   • tier 4 escluso — Tredici e Maledetto sono le carte-obiettivo, e sono loro
//     a produrre la coda da €1400: regalarne una al minuto zero brucia sia la
//     scoperta sia l'economia;
//   • tier 3 raro — è il "oh, è uscita la Bocca del Drago" che rende
//     interessante il pescaggio casuale, ma come eccezione, non come normalità.
export const INTRO_TIER_WEIGHTS = { 1: 4, 2: 3, 3: 1, 4: 0 };

const introTierWeight = (t) =>
  INTRO_TIER_WEIGHTS[CARD_BALANCE[t.id]?.tier ?? t.tier] ?? 0;

// N biglietti distinti, pescati dal pool con i pesi per tier.
export function generateIntroCards(count = 3, fortune = 0) {
  const remaining = introCardPool().filter(t => introTierWeight(t) > 0);
  const picked = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((s, t) => s + introTierWeight(t), 0);
    let r = rng() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= introTierWeight(remaining[i]);
      if (r <= 0) { idx = i; break; }
    }
    picked.push(remaining.splice(idx, 1)[0]); // estratto: niente doppioni
  }
  return picked.map(t => ({ ...generateCard(t.id, fortune), owned: false }));
}

export function generateCard(typeId, fortune=0, relicBonus=0, forceWin=false) {
  const type = CARD_TYPES.find(t => t.id === typeId) || CARD_TYPES[0];
  const totalCells = type.rows * type.cols;
  const cardSymbols = CARD_SYMBOLS[type.id] || SYMBOLS;
  const cb = CARD_BALANCE[type.id];
  const baseWinChance = cb?.winChance ?? 0.18;
  // forceWin = vincita garantita (usata da impianti come Unghia Sacra/Neonato/Marcia/Baddie)
  const isWinner = forceWin || roll(baseWinChance + Math.min(Math.max(fortune, 0), 5) * 0.06 + relicBonus);
  // EV-calibrated prize roll — usa prizeMin/prizeMax di CARD_BALANCE (single source of truth).
  // Fallback a type.cost/type.maxPrize per eventuali carte senza balance entry.
  const pMin = cb?.prizeMin ?? type.cost;
  const pMax = cb?.prizeMax ?? type.maxPrize;
  const rollPrize = () => Math.max(type.cost, Math.round(pMin + rng() * (pMax - pMin)));
  let cells = [];
  let prize = 0;

  // ── setteemezzo mechanic ─────────────────────────────────────
  if (type.mechanic === "setteemezzo") {
    // Genera banco (2 carte, già rivelate) — non sballa mai
    let bancoCards, bancoTotal;
    let attempts = 0;
    do {
      bancoCards = [pick(CARD_RANKS), pick(CARD_RANKS)].map(r => {
        const suit = pick(CARD_SUITS); return { rank:r, suit, symbol:r+suit, value:CARD_VAL_MAP[r]||0.5, isRed:suit==="♥"||suit==="♦" };
      });
      bancoTotal = bancoCards.reduce((s,c) => s+c.value, 0);
      attempts++;
    } while ((bancoTotal > 7.5 || bancoTotal < 2) && attempts < 30);
    bancoTotal = Math.round(bancoTotal * 10) / 10;

    // Carte giocatore: 4 da grattare
    const playerCount = 4;
    let playerCells;
    if (isWinner) {
      // Garantisce che le prime N carte (senza sballare) battano il banco
      let att = 0;
      let total = 0;
      do {
        playerCells = Array.from({length: playerCount}, () => _makePlayingCard(pick(CARD_RANKS)));
        total = playerCells.reduce((s,c) => s+c.value, 0);
        att++;
      } while ((total <= bancoTotal || total > 7.5) && att < 80);
      // Fallback: force una combo vincente
      if (att >= 80) {
        const need = bancoTotal + 0.5; // es. banco=3 → need=3.5
        const safeRanks = CARD_RANKS.filter(r => CARD_VAL_MAP[r] <= need && CARD_VAL_MAP[r] > 0);
        playerCells = [_makePlayingCard(pick(safeRanks))];
        let cur = playerCells[0].value;
        while (playerCells.length < playerCount) {
          const remaining = 7.5 - cur;
          const fill = CARD_RANKS.filter(r => CARD_VAL_MAP[r] <= Math.max(remaining, 0.5));
          const r = fill.length > 0 ? pick(fill) : "J";
          playerCells.push(_makePlayingCard(r));
          cur += CARD_VAL_MAP[r]||0.5;
          if (cur > 7.5) { cur -= CARD_VAL_MAP[r]||0.5; playerCells.pop(); break; }
        }
        while (playerCells.length < playerCount) playerCells.push(_makePlayingCard("J"));
      }
    } else {
      // Perdente: NESSUN prefisso deve poter "stare" battendo il banco.
      // Il vecchio pool 5/6/7 sballava solo sulla somma totale, ma la PRIMA carta
      // (es. 7) supera già un banco basso: il giocatore poteva incassare in
      // anticipo su una carta perdente (60% dei casi → RTP 221%).
      // Ora si valida direttamente la proprietà: per ogni prefisso, o si è già
      // sballato (>7.5) oppure non si è ancora superato il banco.
      playerCells = _makeLosingSetteEMezzoCells(playerCount, bancoTotal);
    }
    prize = isWinner ? Math.max(type.cost*2, rollPrize()) : 0;
    cells = playerCells.map(c => ({...c, scratched:false}));
    return { ...type, isWinner, prize, cells, symbols:cells.map(c=>c.symbol), scratchCount:0, bancoCards, bancoTotal };
  }

  // ── sum13 mechanic (Tredici) ─────────────────────────────────
  if (type.mechanic === "sum13") {
    // Winner: cells with 2 guaranteed winning pairs + low fillers
    // Loser: all 7-9 → any 2 scratches sum ≥14 → always bust
    const nums = isWinner
      ? _sum13WinnerNums(totalCells)
      : Array.from({length: totalCells}, () => pick([7,8,9]));
    cells = nums.map(n => ({ symbol: String(n), scratched: false, value: n }));
    prize = isWinner ? Math.max(type.cost * 2, rollPrize()) : 0;

  // ── collect mechanic (Miliardario) ──────────────────────────
  } else if (type.mechanic === "collect") {
    // Rebalance: stopCount 2→5 e valuePool ridotto → ROI ottimale ≈ −11% (t3 sano).
    // Player optimal: peek ~2-3 celle; optimal stop vicino a €60-90.
    const valuePool = [5, 10, 15, 25, 40, 80];
    const stopCount = 5;
    const values = Array.from({length: totalCells - stopCount}, () => pick(valuePool));
    const valueCells = values.map(v => ({ symbol: `€${v}`, scratched: false, value: v, isStop: false }));
    const stopCells = Array.from({length: stopCount}, () => ({ symbol: "🛑", scratched: false, value: 0, isStop: true }));
    cells = shuffle([...valueCells, ...stopCells]);
    prize = values.reduce((a,b) => a+b, 0); // theoretical max (all non-stop)

  // ── ruota mechanic (La Ruota — slot machine) ───────────────
  } else if (type.mechanic === "ruota") {
    const ruotaSyms = CARD_SYMBOLS.ruota;
    if (isWinner) {
      // Jackpot: 3 same symbols
      const winSym = pick(ruotaSyms);
      cells = [
        { symbol: winSym, scratched: false, reelIdx: 0 },
        { symbol: winSym, scratched: false, reelIdx: 1 },
        { symbol: winSym, scratched: false, reelIdx: 2 },
      ];
      prize = Math.max(type.cost * 3, rollPrize());
    } else if (roll(0.30)) {
      // Near-win: 2 matching, small prize (rebalance Beta 4.1: 0.35→0.30, mult 1.5x→1.3x)
      const winSym = pick(ruotaSyms);
      let loseSym; do { loseSym = pick(ruotaSyms); } while (loseSym === winSym);
      const reels = shuffle([winSym, winSym, loseSym]);
      cells = reels.map((s, i) => ({ symbol: s, scratched: false, reelIdx: i }));
      prize = Math.round(type.cost * 1.3);
    } else {
      // Full loss: all different
      const syms = shuffle([...ruotaSyms]).slice(0, 3);
      cells = syms.map((s, i) => ({ symbol: s, scratched: false, reelIdx: i }));
      prize = 0;
    }

  // ── doppioOnulla mechanic ─────────────────────────────────
  } else if (type.mechanic === "doppioOnulla") {
    const win = isWinner;
    cells = [{ symbol: win ? "✅" : "❌", scratched: false, isDoppioWin: win }];
    // Payout calibrato via CARD_BALANCE — niente maxPrize hard-coded a €200.
    prize = win ? rollPrize() : 0;

  // ── match / jolly / trap mechanics ──────────────────────────
  } else {
    const safeSymbols = cardSymbols.filter(s => s !== "🔥");
    const symbols = [];
    if (isWinner) {
      const winSymbol = pick(safeSymbols);
      const winPositions = shuffle([...Array(totalCells).keys()]).slice(0, type.matchNeeded);
      for (let i = 0; i < totalCells; i++) {
        if (winPositions.includes(i)) { symbols.push(winSymbol); }
        else { let s; do { s = pick(safeSymbols); } while (s === winSymbol); symbols.push(s); }
      }
    } else {
      const available = shuffle([...safeSymbols]).slice(0, Math.min(totalCells, safeSymbols.length));
      for (let i = 0; i < totalCells; i++) symbols.push(available[i % available.length]);
      // Ripeti dedup finché nessun simbolo raggiunge matchNeeded
      // (le sostituzioni possono creare nuove combo accidentali)
      // Guardia matchNeeded >= 2: labirinto e mappaTesor0 hanno matchNeeded 0 e
      // finivano in un loop degenere (`counts[s] >= 0` sempre vero finché il
      // contatore non andava in negativo, con `symbols[-1] = ...` per giunta).
      // Quelle carte hanno schermate dedicate e non usano queste celle.
      let safe = type.matchNeeded < 2;
      let guard = 0;
      while (!safe && guard < 50) {
        safe = true;
        guard++;
        const counts = {};
        symbols.forEach(s => counts[s] = (counts[s]||0)+1);
        for (const s in counts) {
          while (counts[s] >= type.matchNeeded) {
            safe = false;
            const idx = symbols.lastIndexOf(s);
            let rep; do { rep = pick(safeSymbols); } while (rep === s);
            symbols[idx] = rep; counts[s]--; counts[rep] = (counts[rep]||0)+1;
          }
        }
      }
    }
    cells = symbols.map(s => ({ symbol: s, scratched: false }));

    // Trappole fuoco (boccaDrago)
    if (type.mechanic === "trap") {
      const counts = {};
      cells.forEach(c => { counts[c.symbol] = (counts[c.symbol]||0)+1; });
      const winSym = Object.entries(counts).find(([,c]) => c >= type.matchNeeded)?.[0];
      const protected_ = winSym ? cells.map((c,i) => c.symbol === winSym ? i : -1).filter(i => i>=0) : [];
      const available = cells.map((_,i) => i).filter(i => !protected_.includes(i));
      shuffle(available).slice(0, 2).forEach(i => {
        cells[i] = { symbol: "🔥", scratched: false, isTrap: true };
      });
    }

    // Jolly cell (portaFortuna)
    if (type.mechanic === "jolly") {
      const counts = {};
      cells.forEach(c => { counts[c.symbol] = (counts[c.symbol]||0)+1; });
      const winSym = isWinner ? Object.entries(counts).find(([,c]) => c >= type.matchNeeded)?.[0] : null;
      const protected_ = winSym ? cells.map((c,i) => c.symbol === winSym ? i : -1).filter(i => i>=0) : [];
      const available = cells.map((_,i) => i).filter(i => !protected_.includes(i));
      if (available.length > 0) cells[pick(available)] = { symbol: "✨", scratched: false, isJolly: true };
      // Carta perdente: se il JOLLY completa un tris, assegna un premio ridotto
      if (!isWinner) {
        const afterCounts = {};
        cells.forEach(c => { if (!c.isJolly) afterCounts[c.symbol] = (afterCounts[c.symbol]||0)+1; });
        if (Object.values(afterCounts).some(c => c >= type.matchNeeded - 1)) {
          // Consolation jolly: 45% del premio massimo calibrato
          prize = Math.max(type.cost, Math.round(pMin + rng() * (pMax * 0.45 - pMin)));
        }
      }
    }

    if (isWinner) {
      prize = rollPrize();
    }
  }

  // ── Item cells nascosti (tier 2+, non su collect/sum13) ──────
  if (type.tier >= 2 && roll(0.25) && type.mechanic !== "collect" && type.mechanic !== "sum13") {
    const itemsByTier = {
      2: [["bottone","🔘"],["bullone","🔩"],["cerotto","🩹"]],
      3: [["cremaRinforzante","🧴"],["unghiaFinta","💅"]],
      4: [["plettro","🎸"],["moneta_argento","🥈"],["sieroRicrescita","💉"]],
    };
    const pool = itemsByTier[Math.min(type.tier, 4)] || itemsByTier[2];
    const [itemId, itemEmoji] = pick(pool);
    const counts = {};
    cells.forEach(c => { if (c.symbol && !c.isTrap && !c.isJolly) counts[c.symbol] = (counts[c.symbol]||0)+1; });
    const winSym = Object.entries(counts).find(([,c]) => c >= (type.matchNeeded||2))?.[0];
    const available = cells.map((c,i) => i).filter(i =>
      !cells[i].isTrap && !cells[i].isJolly && !cells[i].isStop && cells[i].symbol !== winSym
    );
    if (available.length > 1) cells[pick(available)] = { symbol: itemEmoji, scratched: false, isItem: true, itemId };
  }

  return { ...type, isWinner, prize, cells, symbols: cells.map(c => c.symbol), scratchCount: 0 };
}
