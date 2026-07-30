import { BIOMES } from "../data/biomes.js";
import { NODE_POOL_WEIGHTS } from "../data/map.js";
import { roll, pick, shuffle, weightedPick } from "./random.js";

// Generate map for a biome — layered graph with branching paths
export function generateMap(biomeIdx = 0) {
  // ── LAYER LAYOUT: 11 righe su una griglia a colonne fisse ──────
  // Prima ogni riga aveva le sue X (0.08/0.27/0.47… vs 0.1/0.3/0.5…): i nodi
  // non si allineavano mai in verticale e con 5 per riga la mappa risultava
  // affollata. Ora ogni nodo cade su una delle 5 colonne qui sotto, quindi le
  // righe si incolonnano, e il massimo per riga scende da 5 a 4 (38 → 29 nodi).
  // Le righe restano 11: la lunghezza del bioma non cambia.
  const L = 0.14, ML = 0.32, MID = 0.5, MR = 0.68, R = 0.86;
  const LAYER_XS = [
    [MID],                  // row 0: start
    [L, MID, R],            // row 1: 3-way split
    [L, MID, R],            // row 2
    [L, ML, MR, R],         // row 3: si allarga
    [L, MID, R],            // row 4
    [L, ML, MR, R],         // row 5
    [L, MID, R],            // row 6
    [L, ML, MR, R],         // row 7
    [L, MID, R],            // row 8: inizia la convergenza
    [ML, MR],               // row 9: 2 nodi pre-boss
    [MID],                  // row 10: boss
  ];

  // Tipi per zona X: sinistra=pericolo, destra=sicuro, centro=bilanciato.
  // Combattimento (ladro/miniboss) alzato ovunque — il gioco è centrato
  // sulle fight, anche la zona "sicura" ora ne contiene un po'.
  const LEFT_POOL  = [
    {type:"ladro",w:38},{type:"spacciatore",w:14},{type:"miniboss",w:26},
    {type:"evento",w:12},{type:"stregone",w:8},{type:"tabaccaio",w:8},
  ];
  const RIGHT_POOL = [
    {type:"locanda",w:20},{type:"tabaccaio",w:18},{type:"chirurgo",w:10},
    {type:"mendicante",w:12},{type:"sacerdote",w:8},
    {type:"ladro",w:18},{type:"miniboss",w:10},
  ];
  const MID_POOL = NODE_POOL_WEIGHTS;

  const getTypeForX = (x) => {
    if (x < 0.25) return weightedPick(LEFT_POOL);
    if (x > 0.75) return weightedPick(RIGHT_POOL);
    return weightedPick(MID_POOL);
  };

  // ── Costruisce le righe ──────────────────────────────────────
  const rows = LAYER_XS.map((xs, rIdx) => {
    if (rIdx === 0) return xs.map((x, c) => ({ type:"start", id:`r${rIdx}c${c}`, x, row:rIdx }));
    if (rIdx === LAYER_XS.length - 1) return [{ type:"boss", id:"boss", bossName: BIOMES[biomeIdx]?.boss || "Il Broker", x:0.5, row:rIdx }];
    return xs.map((x, c) => ({ type: getTypeForX(x), id:`r${rIdx}c${c}`, x, row:rIdx }));
  });

  // ── NPC a comparsa tardiva ──────────────────────────────────
  rows.slice(3).flat().forEach(n => {
    if (n.type !== "boss" && n.type !== "start" && roll(0.07)) n.type = "poliziotto";
  });
  rows.slice(4).flat().forEach(n => {
    if (n.type !== "boss" && n.type !== "start" && n.type !== "poliziotto" && roll(0.05)) n.type = "anziana";
  });
  rows.slice(5).flat().forEach(n => {
    if (n.type !== "boss" && n.type !== "start" && n.type !== "poliziotto" && n.type !== "anziana" && roll(0.04)) n.type = "bambino";
  });
  rows.slice(6).flat().forEach(n => {
    if (n.type !== "boss" && n.type !== "start" && n.type !== "poliziotto" && n.type !== "anziana" && n.type !== "bambino" && roll(0.04)) n.type = "streamer";
  });
  if (biomeIdx >= 1) {
    rows.slice(3).flat().forEach(n => {
      if (n.type !== "boss" && n.type !== "start" && n.type !== "poliziotto" && n.type !== "anziana" && roll(0.05)) n.type = "macellaio";
    });
  }
  // Bioma 3 (Quartiere Cinese): inietta Maestro del Tè (15% dei nodi safe)
  if (biomeIdx === 3) {
    rows.slice(2).flat().forEach(n => {
      if (["locanda","mendicante","sacerdote"].includes(n.type) && roll(0.15)) n.type = "maestroTe";
    });
  }

  // ── DISTRIBUZIONE / SPACING ─────────────────────────────────
  // Fix: "?" eventi, stregoni e NPC rari si ammassavano.
  //  · UNIQUE_PER_ROW: al massimo 1 per riga per i tipi "speciali"
  //  · MIN_ROW_GAP: distanza minima tra occorrenze dello stesso tipo su righe vicine
  //  · NO_ADJACENT_SAME: nella stessa riga, due nodi vicini non possono avere lo stesso tipo
  const UNIQUE_PER_ROW = new Set([
    "evento","stregone","miniboss","chirurgo","spacciatore","ladro",
    "poliziotto","anziana","bambino","streamer","macellaio","maestroTe","sacerdote",
    // anche i "comuni safe" devono essere unici in riga — senza questo si
    // ottengono 2 tabaccai o 2 mendicanti adiacenti nella stessa row
    "tabaccaio","locanda","mendicante",
  ]);
  // Gap minimo tra occorrenze su righe vicine (verticale/diagonale).
  // spacciatore/ladro/poliziotto hanno gap 2 per evitare che si ammassino su 3+
  // righe consecutive anche se ogni riga ne ha al massimo 1.
  const MIN_ROW_GAP = {
    evento: 2, stregone: 3,
    miniboss: 2, chirurgo: 2, macellaio: 2,
    spacciatore: 2, ladro: 2, poliziotto: 2,
    anziana: 2, bambino: 2, streamer: 2, sacerdote: 2,
    // gap 2 per i "comuni safe": basta 1 riga di pausa tra 2 mendicanti/tabaccai/locande
    // (evita stack verticali tipo 3 mendicanti sulla stessa colonna destra)
    tabaccaio: 2, locanda: 2, mendicante: 2,
  };
  const lastSeenRow = {};

  const replacementFor = (x, forbidden) => {
    const pool = (x < 0.25 ? LEFT_POOL : x > 0.75 ? RIGHT_POOL : MID_POOL)
      .filter(e => !forbidden.has(e.type));
    if (pool.length === 0) return "tabaccaio";
    for (let tries = 0; tries < 6; tries++) {
      const t = weightedPick(pool);
      if (!forbidden.has(t)) return t;
    }
    return pool[0].type;
  };

  for (let rIdx = 1; rIdx < rows.length - 1; rIdx++) {
    const row = [...rows[rIdx]].sort((a, b) => a.x - b.x);
    const seenInRow = new Set();
    for (let i = 0; i < row.length; i++) {
      const n = row[i];
      const prevType = i > 0 ? row[i - 1].type : null;
      const buildForbidden = () => {
        const f = new Set();
        seenInRow.forEach(t => { if (UNIQUE_PER_ROW.has(t)) f.add(t); });
        if (prevType) f.add(prevType); // no-adjacent-same
        Object.entries(MIN_ROW_GAP).forEach(([t, gap]) => {
          if (lastSeenRow[t] != null && rIdx - lastSeenRow[t] < gap) f.add(t);
        });
        return f;
      };
      let tries = 0;
      while (tries < 5) {
        const forbidden = buildForbidden();
        if (!forbidden.has(n.type)) break;
        n.type = replacementFor(n.x, forbidden);
        tries++;
      }
      seenInRow.add(n.type);
      lastSeenRow[n.type] = rIdx;
    }
  }

  // ── GUANTAIO: 1 nodo per mappa nelle righe pre-boss (7-9) ──
  // Vende il Guanto da BOSS — protezione unica contro il combattimento finale.
  const guantaioCandidates = rows.slice(7, 10).flat().filter(n =>
    n.type !== "boss" && n.type !== "start" && n.type !== "poliziotto" && n.type !== "anziana" && n.type !== "bambino"
  );
  if (guantaioCandidates.length > 0) {
    const chosen = pick(guantaioCandidates);
    chosen.type = "guantaio";
  }

  // ── Garantisci almeno 2 tabaccai, 2 locande, 1 sacerdote ────
  // IMPORTANTE: rispetta MIN_ROW_GAP anche quando si forzano le quote, per
  // evitare di ri-introdurre cluster (es. 2 tabaccai su righe adiacenti).
  const midRows = rows.slice(1, LAYER_XS.length - 1).flat();
  const rowsOfType = (type) => {
    const set = new Set();
    midRows.forEach(n => { if (n.type === type) set.add(n.row); });
    return set;
  };
  const respectsGap = (type, row) => {
    const gap = MIN_ROW_GAP[type] || 0;
    if (!gap) return true;
    for (const r of rowsOfType(type)) {
      if (Math.abs(row - r) < gap) return false;
    }
    return true;
  };
  const ensureMin = (type, min, exclude=[]) => {
    const countRows = () => rowsOfType(type).size;
    if (countRows() >= min) return;
    // candidati: nodi di un tipo "sostituibile" (non escluso, non unico già altrove)
    // ordinati per row più lontana dalle occorrenze esistenti, così si sparpagliano
    const cands = midRows.filter(n =>
      !exclude.includes(n.type) && n.type !== type &&
      n.type !== "boss" && n.type !== "start" &&
      // non toccare NPC rari / elite / segreti / vecchio
      !["poliziotto","anziana","bambino","streamer","macellaio","maestroTe","miniboss","guantaio"].includes(n.type) &&
      !n.elite && !n.secret && !n._isVecchio
    );
    // prima prova con gap rispettato
    for (const c of cands) {
      if (countRows() >= min) break;
      if (respectsGap(type, c.row)) c.type = type;
    }
    // fallback: se ancora sotto quota, ignora il gap (meglio avere il tipo che non averlo)
    for (const c of cands) {
      if (countRows() >= min) break;
      if (c.type !== type) c.type = type;
    }
  };
  ensureMin("tabaccaio", 2, ["locanda"]);
  ensureMin("locanda", 2, ["tabaccaio"]);
  if (!midRows.some(n => n.type === "sacerdote")) {
    const cand = midRows.find(n => n.x > 0.6 && n.type !== "tabaccaio" && n.type !== "locanda" && !["poliziotto","anziana","bambino","streamer","miniboss","guantaio"].includes(n.type));
    if (cand) cand.type = "sacerdote";
  }

  // ── PRIMA SCELTA: garantisci sempre almeno 1 tabaccaio in rows[1] ─
  // Il giocatore parte senza soldi e con poche carte: deve sempre poter
  // andare a comprare materiale fin dal primo step.
  const firstRow = rows[1] || [];
  if (firstRow.length > 0 && !firstRow.some(n => n.type === "tabaccaio")) {
    // candidato sostituibile: niente NPC rari/elite/segreti/boss
    const cand = firstRow.find(n =>
      n.type !== "boss" && n.type !== "start" && n.type !== "tabaccaio" &&
      !["poliziotto","anziana","bambino","streamer","macellaio","maestroTe","miniboss","guantaio"].includes(n.type) &&
      !n.elite && !n.secret && !n._isVecchio
    ) || firstRow.find(n =>
      n.type !== "boss" && n.type !== "start" && !n.elite && !n.secret && !n._isVecchio
    );
    if (cand) cand.type = "tabaccaio";
  }

  // ── Nodi SEGRETI: 2 per mappa, visibili solo con Fortuna ────
  const secretCandidates = rows.slice(2, 8).flat().filter(n =>
    n.type !== "boss" && n.type !== "start" && n.x < 0.15
  );
  shuffle(secretCandidates).slice(0, 2).forEach(n => { n.secret = true; n.type = "evento"; });

  // ── Nodi ELITE: 1-2 per mappa, rischio/premio raddoppiato ──
  const eliteCandidates = rows.slice(3, 9).flat().filter(n =>
    n.type === "miniboss" || n.type === "ladro" || n.type === "tabaccaio"
  );
  shuffle(eliteCandidates).slice(0, 2).forEach(n => { n.elite = true; });

  // ── Il Vecchio: 1 nodo evento per mappa diventa "Il Vecchio" ──
  const vecchioCandidates = rows.slice(2, 9).flat().filter(n => n.type === "evento" && !n.elite && !n.secret);
  if (vecchioCandidates.length > 0) {
    shuffle(vecchioCandidates)[0]._isVecchio = true;
  }

  // ── NPC VOLATILI: spacciatore/poliziotto hanno il 25% di chance di
  // essere già arrabbiati quando li incontri (deciso in generazione, non
  // ad ogni visita) — offrono bribe/combatti/scappa invece delle scelte
  // normali. Fissato in generazione così è coerente per tutta la run.
  rows.flat().forEach(n => {
    if ((n.type === "spacciatore" || n.type === "poliziotto") && roll(0.25)) {
      n.angry = true;
    }
  });

  // ── Connessioni: no incroci garantiti, 2-3 uscite per nodo ──
  // Algoritmo: indice primario = floor(i*(n-1)/(m-1)), monotono.
  // 2° connessione: destra se zona lo permette, sinistra altrimenti.
  // 3° connessione: 55% se zona larga ≥ 2 slot.
  // Fallback raggiungibilità: zone-based (mantiene non-crossing).
  const connections = {};

  for (let r = 0; r < rows.length - 1; r++) {
    const currSorted = [...rows[r]].sort((a, b) => a.x - b.x);
    const nextSorted = [...rows[r + 1]].sort((a, b) => a.x - b.x);
    const m = currSorted.length;
    const n = nextSorted.length;

    const pJ = m === 1
      ? currSorted.map(() => 0)
      : currSorted.map((_, i) => Math.min(n - 1, Math.floor(i * (n - 1) / (m - 1))));

    for (let i = 0; i < m; i++) {
      const node = currSorted[i];

      // Row 0 → tutti i nodi row 1 (3-way split visivo)
      if (r === 0) { connections[node.id] = nextSorted.map(nd => nd.id); continue; }

      const conns = new Set([pJ[i]]);
      const rBound = i + 1 < m ? pJ[i + 1] : n;   // limite destro: non supera primary del nodo successivo
      const lBound = i > 0 ? pJ[i - 1] : -1;       // limite sinistro: non scende sotto primary del precedente

      // 2° connessione: espandi a destra se c'è spazio, sinistra come fallback
      const rJ = pJ[i] + 1;
      if (rJ < n && rJ <= rBound) {
        conns.add(rJ);
      } else {
        const lJ = pJ[i] - 1;
        if (lJ >= 0 && lJ > lBound) conns.add(lJ);
      }

      // 3° connessione: 55% se zona abbastanza larga (gap ≥ 2)
      const rJ2 = pJ[i] + 2;
      if (rJ2 < n && rJ2 <= rBound && roll(0.55)) conns.add(rJ2);

      connections[node.id] = [...conns].map(j => nextSorted[j].id);
    }

    // Ogni nodo successivo deve essere raggiungibile — zone-based (no crossing)
    nextSorted.forEach((nextNode, jIdx) => {
      if (Object.values(connections).some(cs => cs.includes(nextNode.id))) return;
      // Owner: il nodo corrente la cui zona copre jIdx
      let ownerI = m - 1;
      for (let i = 0; i < m - 1; i++) {
        if (jIdx < pJ[i + 1]) { ownerI = i; break; }
      }
      if (!connections[currSorted[ownerI].id]) connections[currSorted[ownerI].id] = [];
      connections[currSorted[ownerI].id].push(nextNode.id);
    });
  }

  return { rows, connections };
}

// ─── LABIRINTO GENERATOR ────────────────────────────────────
// Costanti di bilanciamento (costo carta €15, target RTP 91% = evTarget -0.09).
// Calibrate risolvendo l'EV di ogni strategia "fermati dopo n passi" sulla
// distribuzione reale delle lunghezze di percorso (6:31% 8:29% 10:18% 12:13% 14:10%):
// il massimo su tutte le strategie è €13.66 → RTP 91.0%, e l'ottimo è spingere
// fino all'uscita, così il jackpot resta un'esca vera e non decorativa.
// (le celle a rischio sono L-1: start e uscita sono sempre sicure)
export const LABIRINTO_DEATH_P = 0.24;   // chance che una cella del percorso sia 💀
export const LABIRINTO_CELL_PRIZE = 6;   // € per ogni cella nuova superata
export const LABIRINTO_JACKPOT = 50;     // bonus all'uscita 🏆

export function generateLabirintoGrid() {
  // 4x4 grid, start [0,0], end [3,3]
  // Genera percorso valido e riempi le altre celle con direzioni random o 💀
  const DIRS = ["→", "↓", "←", "↑"];
  const DELTA = { "→":[0,1], "↓":[1,0], "←":[0,-1], "↑":[-1,0] };

  // Il giocatore non sceglie la direzione: segue la freccia della cella.
  // Quindi il percorso DEVE arrivare a [3,3], altrimenti il jackpot è
  // irraggiungibile e la traiettoria può finire in un ciclo (soldi infiniti,
  // +€8 a click). Il random walk falliva nel 43% dei casi: qui si ritenta,
  // con fallback deterministico a L (riga 0 → colonna 3).
  let grid = null, pathSet = null;
  for (let tries = 0; tries < 40 && !grid; tries++) {
    const g = Array.from({length:4}, () => Array(4).fill(null));
    const seen = new Set(["0,0"]);
    let cur = [0,0];
    let steps = 0;
    while ((cur[0] !== 3 || cur[1] !== 3) && steps < 200) {
      steps++;
      const possible = DIRS.filter(d => {
        const [dr,dc] = DELTA[d];
        const nr = cur[0]+dr, nc = cur[1]+dc;
        return nr>=0 && nr<4 && nc>=0 && nc<4 && !seen.has(`${nr},${nc}`);
      });
      if (possible.length === 0) break; // vicolo cieco → si ritenta da capo
      const dir = pick(possible);
      const [dr,dc] = DELTA[dir];
      g[cur[0]][cur[1]] = dir;
      cur = [cur[0]+dr, cur[1]+dc];
      seen.add(`${cur[0]},${cur[1]}`);
    }
    if (cur[0] === 3 && cur[1] === 3) { grid = g; pathSet = seen; }
  }
  if (!grid) {
    // Fallback deterministico: → → → poi ↓ ↓ ↓ fino a [3,3]
    grid = Array.from({length:4}, () => Array(4).fill(null));
    pathSet = new Set();
    for (let c = 0; c < 3; c++) { grid[0][c] = "→"; pathSet.add(`0,${c}`); }
    for (let r = 0; r < 3; r++) { grid[r][3] = "↓"; pathSet.add(`${r},3`); }
    pathSet.add("3,3");
  }
  grid[3][3] = "🏆";
  pathSet.add("3,3");

  // Riempi le celle non del percorso con direzioni random (puramente decorative:
  // il giocatore segue le frecce e non esce mai dal percorso).
  for (let r=0; r<4; r++) for (let c=0; c<4; c++) {
    if (grid[r][c] === null) grid[r][c] = pick(DIRS);
  }

  // 💀 SUL percorso, non fuori. Prima erano piazzate solo su celle non-percorso,
  // quindi irraggiungibili: il giocatore arrivava sempre al 🏆 senza alcun
  // rischio (RTP 2472%). Ogni passo ha ora LABIRINTO_DEATH_P di essere fatale,
  // così "incassa e scappa" diventa una decisione vera.
  for (const key of pathSet) {
    if (key === "0,0" || key === "3,3") continue; // start e uscita sempre sicuri
    if (roll(LABIRINTO_DEATH_P)) {
      const [r, c] = key.split(",").map(Number);
      grid[r][c] = "💀";
    }
  }

  return grid;
}

// ─── GRATTA & COMBINA GENERATOR ─────────────────────────────
// Bilanciamento (costo €25, target RTP 90% = evTarget -0.10).
// La carta non ha stato di sconfitta e il giocatore sceglie l'ordine dei click,
// quindi può sempre accoppiare i simboli uguali: con 5 simboli e 15% di celle
// vuote la MEGA COMBO scattava nel 56% dei casi (RTP 1099%). Con 9 simboli e
// 35% di vuoti la MEGA torna un evento raro (~8%) e l'RTP scende a ~89%.
export const COMBINA_COMBO_PRIZE = 10;
export const COMBINA_MEGA_MULT = 5;

export function generateCombinaState() {
  const SYMS = ["⭐","🔔","💎","🍋","🎯","🍒","🔥","🍀","👑"];
  const makeGrid = () => Array.from({length:6}, () => roll(0.35) ? null : pick(SYMS));
  return {
    gridA: makeGrid(), gridB: makeGrid(),
    revealedA: Array(6).fill(false), revealedB: Array(6).fill(false),
    lastRevealedA: null, lastRevealedB: null,
    combos: 0, prize: 0, done: false,
  };
}

// ─── MAPPA DEL TESORO GENERATOR ─────────────────────────────
// Bilanciamento (costo €35, target RTP 90% = evTarget -0.10).
// Con 2 bombe su 16 e gli hint di distanza un giocatore informato trovava
// quasi sempre entrambi i tesori: RTP 953%. Con 4 bombe e premi ridotti
// (vedi TESORO_X_PRIZE / TESORO_JACKPOT) il Monte Carlo dà RTP ≈ 90%.
export const TESORO_BOMBS = 4;
export const TESORO_X_PRIZE = 30;   // € per ogni X trovata
export const TESORO_JACKPOT = 75;   // bonus per aver trovato entrambe

export function generateTesoroState() {
  const positions = shuffle([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  const treasures = new Set([positions[0], positions[1]]);
  const bombs = new Set(positions.slice(2, 2 + TESORO_BOMBS));
  return {
    treasures, bombs,
    revealed: Array(16).fill(false),
    foundTreasures: 0, prize: 0, done: false,
  };
}
