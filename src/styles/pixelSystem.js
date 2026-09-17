// GRATTINI — PIXEL-NATIVE VISUAL SYSTEM
//
// Questo file è la base del redesign grafico. Non viene ancora importato dal gioco:
// prima fissiamo la grammatica visiva, poi migriamo una schermata alla volta.
//
// Obiettivo: pixel art reale, non "retro CSS". Quindi niente blur, gradienti morbidi,
// scale frazionarie, border-radius arbitrari, glow gaussiani o misure responsive casuali.

export const PIXEL_VIEWPORT = {
  width: 640,
  height: 360,
  grid: 8,
};

export const PX = {
  hairline: 1,
  border: 2,
  shadow: 4,
  grid: 8,
  grid2: 16,
  grid3: 24,
  grid4: 32,
};

// Palette globale: scura nel mondo, ipersatura sui grattini e sui momenti premio.
// I colori sono volutamente piatti: il volume arriverà da blocchi, dithering e pattern,
// non da gradienti CSS o bloom.
export const PIXEL_COLORS = {
  void: "#09070d",
  ink: "#17121d",
  panel: "#21192a",
  panelHi: "#30223a",
  paper: "#f4e7be",
  silver: "#b9b8ad",
  white: "#fff7df",
  black: "#09070d",

  red: "#e63b32",
  orange: "#f47b20",
  yellow: "#f6d547",
  green: "#4fbf68",
  cyan: "#34c8d8",
  blue: "#3e72c9",
  purple: "#7446b8",
  pink: "#db4f8b",

  muted: "#75677f",
  mutedDark: "#473d50",
};

// Niente fluid typography nel canvas di gioco: le dimensioni devono restare intere.
// Finché non entra il bitmap font definitivo, usiamo una fallback monospace stretta.
export const PIXEL_FONT = {
  body: "'Courier New', Courier, monospace",
  display: "'Courier New', Courier, monospace",
  size: {
    xs: 8,
    sm: 10,
    md: 12,
    lg: 16,
    xl: 24,
    huge: 32,
  },
};

// Layout master 640×360. Tutte le coordinate principali rispettano multipli di 8.
export const PIXEL_LAYOUT = {
  outerPad: 8,
  gap: 8,
  headerH: 56,
  footerH: 48,
  sidebarW: 136,
  panelPad: 8,
  cardGap: 8,
};

// Primitive volutamente semplici e "stampate".
// Niente border-radius, blur, backdrop-filter o box-shadow sfumate.
export const PIXEL_STYLE = {
  canvas: {
    width: `${PIXEL_VIEWPORT.width}px`,
    height: `${PIXEL_VIEWPORT.height}px`,
    position: "relative",
    overflow: "hidden",
    background: PIXEL_COLORS.void,
    color: PIXEL_COLORS.white,
    fontFamily: PIXEL_FONT.body,
    imageRendering: "pixelated",
    textRendering: "geometricPrecision",
    boxSizing: "border-box",
  },

  panel: {
    background: PIXEL_COLORS.panel,
    border: `${PX.border}px solid ${PIXEL_COLORS.paper}`,
    borderRadius: 0,
    boxShadow: `${PX.shadow}px ${PX.shadow}px 0 ${PIXEL_COLORS.black}`,
    padding: `${PIXEL_LAYOUT.panelPad}px`,
    boxSizing: "border-box",
  },

  button: {
    minHeight: `${PX.grid4}px`,
    padding: `${PX.grid}px ${PX.grid2}px`,
    border: `${PX.border}px solid ${PIXEL_COLORS.paper}`,
    borderRadius: 0,
    background: PIXEL_COLORS.ink,
    color: PIXEL_COLORS.white,
    boxShadow: `${PX.shadow}px ${PX.shadow}px 0 ${PIXEL_COLORS.black}`,
    fontFamily: PIXEL_FONT.body,
    fontSize: `${PIXEL_FONT.size.md}px`,
    lineHeight: 1,
    cursor: "pointer",
  },
};

// Restituisce SOLO scale intere: 1x, 2x, 3x, 4x…
// Se lo spazio non basta a 1x, la UI va adattata con un layout dedicato invece di
// rimpicciolire a 0.83x e distruggere la griglia dei pixel.
export function getIntegerPixelScale(viewportWidth, viewportHeight) {
  const byWidth = Math.floor(viewportWidth / PIXEL_VIEWPORT.width);
  const byHeight = Math.floor(viewportHeight / PIXEL_VIEWPORT.height);
  return Math.max(1, Math.min(byWidth, byHeight));
}

export function isGridAligned(value, grid = PIXEL_VIEWPORT.grid) {
  return Number.isInteger(value) && value % grid === 0;
}

export function snapToGrid(value, grid = PIXEL_VIEWPORT.grid) {
  return Math.round(value / grid) * grid;
}

// Regole del redesign, tenute accanto al codice per evitare regressioni estetiche.
export const PIXEL_RULES = Object.freeze([
  "Canvas di gioco logico 640x360.",
  "Posizioni e dimensioni principali su griglia 8px.",
  "Scaling del canvas solo a moltiplicatori interi.",
  "Sprite e immagini con nearest-neighbour / image-rendering: pixelated.",
  "Niente backdrop blur, glow gaussiani o gradienti CSS morbidi.",
  "Niente border-radius decorativi: angoli vivi salvo elementi realmente circolari.",
  "Niente clamp(), vw/vh o scale frazionarie nel canvas di gioco.",
  "Ombre solo a blocchi con offset interi.",
  "La saturazione alta è riservata a grattini, premi, pericoli e feedback importanti.",
  "Emoji solo come fallback temporaneo: l'obiettivo finale è un set di sprite coerente.",
]);
