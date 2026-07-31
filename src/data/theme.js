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
};

export const FONT = "'Courier New', Courier, monospace";

// ─── SCALA TIPOGRAFICA — 3 taglie fisse, minimo assoluto 10px ─────────
// Elimina i micro-testi 7-9px: più respiro, meno rumore.
export const FS = {
  xs: "10px",   // minimo assoluto — badge, label nodi, subtitle, legenda
  sm: "12px",   // testo secondario / descrizioni
  md: "15px",   // titoli di sezione / voci principali
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
