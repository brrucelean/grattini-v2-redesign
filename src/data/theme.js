// ─── THEME & COLORS — CGA ARCADE / Pixel-art Dark ────────────
export const C = {
  bg:      "#050508",   // void nero-blu — display CRT spento
  card:    "#0a0a16",   // pannelli blu-abisso
  cardHi:  "#141428",   // panel hover / selezionato
  text:    "#dddddd",   // quasi-bianco, alta leggibilità su nero
  bright:  "#ffffff",   // bianco puro
  dim:     "#556677",   // grigio-azzurrato per bordi secondari
  green:   "#00ff44",   // CGA green pieno — terminale verde
  red:     "#ff2222",   // rosso CGA intenso — pericolo/sangue
  gold:    "#ffdd00",   // oro caldo saturo — bonus/money
  cyan:    "#00eeff",   // cyan CGA puro — UI/link
  // Era #ff00ff (magenta CGA puro, tinta 300° = viola pieno): stonava con la
  // dominante ciano/oro della UI ed era la macchia viola dell'HUD. Spostato a
  // 340°, cioè rosa-rosso: stesso ruolo semantico (effetti speciali, reliquie,
  // zaino, scorciatoie) ma fuori dalla banda dei viola.
  magenta: "#ff2e88",   // rosa acceso — effetti speciali
  orange:  "#ff6600",   // arancio saturo — warning/elite
  blue:    "#4488ff",   // blu elettrico — neutro positivo
  pink:    "#ff44bb",   // rosa saturo — Kawaii / speciale

  // ─── GERARCHIA TONALE ──────────────────────────────────────
  // La palette CGA sopra è tutta a piena saturazione: se ogni elemento urla,
  // niente urla. Regola d'uso: la tinta PIENA resta riservata a 1-2 elementi
  // critici per schermata (l'azione principale, il pericolo imminente);
  // "…Mid" è il livello di default per tutto ciò che è informativo e presente
  // ma non urgente; "…Low" è per stati inerti / disabilitati / decorativi.
  greenMid:   "#35b35c",  greenLow:   "#1e6b38",
  redMid:     "#b34040",  redLow:     "#6b2a2a",
  goldMid:    "#b39b2e",  goldLow:    "#6b5d1f",
  cyanMid:    "#35a8b3",  cyanLow:    "#1f666b",
  magentaMid: "#b34a70",  magentaLow: "#6b2f47",
  orangeMid:  "#b3653a",  orangeLow:  "#6b3d22",
  blueMid:    "#4a6fb3",  blueLow:    "#2e446b",
  pinkMid:    "#b35a94",  pinkLow:    "#6b3759",
  // Neutri di supporto: grigi leggibili su fondo nero (il vecchio #202030
  // sul bg #080812 dava ~1.15:1 di contrasto, cioè invisibile).
  dimMid:     "#7a7a95",  // grigio medio — label di elementi bloccati/inerti (validato ~4.7:1 sulla velatura scura dell'etichetta nodo mappa)
  dimLow:     "#33334a",  // bordi di elementi inerti
};

// Vista "per famiglia" della gerarchia tonale: comoda quando il colore
// semantico arriva da una variabile (`TONE[kind].mid`) invece che da una
// costante scritta a mano.
export const TONE = {
  green:   { full: C.green,   mid: C.greenMid,   low: C.greenLow   },
  red:     { full: C.red,     mid: C.redMid,     low: C.redLow     },
  gold:    { full: C.gold,    mid: C.goldMid,    low: C.goldLow    },
  cyan:    { full: C.cyan,    mid: C.cyanMid,    low: C.cyanLow    },
  magenta: { full: C.magenta, mid: C.magentaMid, low: C.magentaLow },
  orange:  { full: C.orange,  mid: C.orangeMid,  low: C.orangeLow  },
  blue:    { full: C.blue,    mid: C.blueMid,    low: C.blueLow    },
  pink:    { full: C.pink,    mid: C.pinkMid,    low: C.pinkLow    },
  dim:     { full: C.dim,     mid: C.dimMid,     low: C.dimLow     },
};

// ─── FONT ────────────────────────────────────────────────────
// FONT       → corpo, dati, tutto ciò che "esce dal terminale".
// FONT_TITLE → titoli e numeri-chiave. Grottesco condensato di sistema:
//   nessun webfont da scaricare, ma un contrasto di voce netto rispetto al
//   monospace (lettere strette + peso alto = insegna arcade, non listato).
export const FONT = "'Courier New', Courier, monospace";
export const FONT_TITLE = "'Haettenschweiler', 'Arial Narrow', 'Helvetica Neue Condensed', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// ─── SCALA TIPOGRAFICA — 7 passi, minimo assoluto 10px ────────────────
// Elimina i micro-testi 7-9px: più respiro, meno rumore.
// Prima erano solo 3 taglie (10/12/15): troppo poche per costruire una
// gerarchia, così ogni schermata inventava la sua con valori letterali.
export const FS = {
  xs:   "10px",  // minimo assoluto — badge, label nodi, legenda
  sm:   "12px",  // testo secondario / descrizioni
  md:   "14px",  // corpo principale / voci di lista
  lg:   "16px",  // sotto-titoli, voci in evidenza
  xl:   "20px",  // titoli di sezione
  xxl:  "26px",  // titoli di schermata
  huge: "36px",  // numeri-chiave, esiti (VINTO / PERSO), title screen
};

// ─── SPAZIATURA — scala a passi di 4px ───────────────────────
export const SP = {
  xs:  "2px",
  sm:  "4px",
  md:  "8px",
  lg:  "12px",
  xl:  "18px",
  xxl: "28px",
};

// ─── RAGGI ───────────────────────────────────────────────────
// L'estetica è pixel-art: gli angoli vivi sono la regola, non l'eccezione.
export const R = {
  none: "0",
  sm:   "2px",   // solo micro-elementi (thumb slider, scrollbar)
  pill: "999px", // solo indicatori circolari
};

// ─── Z-INDEX ─────────────────────────────────────────────────
// Ordine di sovrapposizione dichiarato una volta sola invece che a numeri
// magici crescenti sparsi (999999 e simili).
export const Z = {
  base:    0,
  raised:  2,     // nodi mappa attivi, celle in evidenza
  panel:   10,
  sticky:  60,    // barre che restano in vista
  hud:     500,
  modal:   9000,
  toast:   9500,
  grain:   90000, // grana pellicola + vignettatura (sopra la UI)
  flash:   99998, // flash di dolore / transizioni di schermata
  cursor:  99999, // cursore-unghia custom
};

// ─── MOVIMENTO — durate + easing ─────────────────────────────
// Prima: 12 durate letterali (0.1s → 1.5s) e 9 easing diversi, di cui 3
// cubic-bezier riscritte a mano in punti diversi del file. Qui restano
// 4 durate con un ruolo dichiarato e 2 curve.
export const D = {
  instant:    "120ms",  // feedback diretto: hover, press, focus
  base:       "200ms",  // transizioni di stato standard
  emphatic:   "400ms",  // entrate di pannelli, reveal
  ceremonial: "900ms",  // momenti narrativi: vittoria, game over, boss
};

export const E = {
  // Entrate e hover: parte svelta, si posa piano. Nessun rimbalzo.
  out:    "cubic-bezier(0.22, 0.61, 0.36, 1)",
  // Feedback d'impatto: supera il bersaglio e rientra — colpi, pop, premi.
  impact: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// Scorciatoie pronte all'uso per le transizioni più frequenti.
export const T = {
  instant: `${D.instant} ${E.out}`,
  base:    `${D.base} ${E.out}`,
  impact:  `${D.base} ${E.impact}`,
};

export const MAX_ITEMS = 8; // Inventory cap

// ─── LARGHEZZE DI LAYOUT ─────────────────────────────────────
// Il tetto storico era 900px: su un Mac a schermo intero (1512-2560px)
// il contenuto occupava meno di due terzi della larghezza, lasciando grandi
// vuoti laterali. CONTENT è il tetto per le schermate di gioco (combat, shop,
// mappa, intro); READABLE resta stretto per i pannelli di solo testo, dove
// righe troppo lunghe peggiorano la leggibilità.
export const W = {
  content: "1280px",
  readable: "900px",
};
