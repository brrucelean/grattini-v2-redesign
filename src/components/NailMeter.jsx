import { C } from "../data/theme.js";
import { NAIL_INFO, NAIL_ORDER } from "../data/nails.js";
import { CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { getNailVisual } from "../utils/nail.js";

// ─── NAIL METER — rappresentazione UNIFICATA della vita delle unghie ──
// Prima esistevano 3 disegni scollegati per la stessa informazione:
//   a) NailDisplay compact  → barretta verticale 9×22 che si riempie dal basso
//   b) HUD (mobile/desktop) → 5 pip anonimi "vite" 7×11 / 10×16, tutti dello
//      stesso colore, che ignoravano lo stato reale della singola unghia
//   c) NailSidebar          → pip di tier 7×4 + tacche grattate 7×2 (sotto la
//      soglia di percezione: 2px non si vedono, figurarsi contarli)
// Qui restano DUE pattern, entrambi alimentati dagli stessi dati:
//   · NailPipRow   — compatto (HUD, combattimento): una pip per unghia
//   · NailTierBar + NailScratchBar — esteso (sidebar): tier e grattate leggibili
// Nessun elemento sotto i 5px sul lato corto.

export const SCRATCH_THRESHOLD = 3;
export const CHIRURGO_SLOT_MAX = { plastica: 2, ferro: 4, oro: 5 };

// Catena dei tier "vivi", peggio→meglio (morta è fuori: è lo zero)
export const TIER_ORDER = ["marcia", "sanguinante", "graffiata", "sana", "kawaii"];
export const TIER_COLORS = {
  marcia: C.red, sanguinante: C.orange, graffiata: C.gold, sana: C.green, kawaii: C.pink,
};
// Stati speciali fuori catena → tier equivalente più vicino
const SPECIAL_TIER_MAP = { polliceVerde: "kawaii", unghiaNera: "marcia", piede: "kawaii" };

// ── Stati "spenti": distinguibili SENZA colore ────────────────
// "morta" (#444) e "unghia nera" (#222222) erano due grigi quasi identici.
// Ora ognuno porta una texture, un bordo e un glifo suoi: restano leggibili
// anche in scala di grigi o con visione dei colori ridotta.
const DEAD_HATCH = "repeating-linear-gradient(45deg, #33333f 0px, #33333f 2px, #0a0a10 2px, #0a0a10 5px)";
export const OFF_STATES = {
  // morta: tratteggio diagonale + bordo tratteggiato + croce
  morta: { fill: DEAD_HATCH, border: "dashed", borderCol: "#5c5c72", glyph: "✕", glyphCol: "#9a9ab0" },
  // unghia nera: pieno compatto + bordo spesso continuo + rombo
  unghiaNera: { fill: "#15151d", border: "solid", borderCol: "#9a9ab8", glyph: "◆", glyphCol: "#c9c9e2" },
};

// Etichette corte SENZA troncamento — prima "SANGUIN." e "GRAFFIAT"
// venivano tagliati a metà parola dall'ellipsis a 7px.
const SHORT_LABEL = {
  morta: "MORTA", marcia: "MARCIA", sanguinante: "SANGUE", graffiata: "GRAFFI",
  sana: "SANA", kawaii: "KAWAII", polliceVerde: "VERDE", unghiaNera: "NERA", piede: "PIEDE",
};

// ── Derivazione condivisa: da un oggetto unghia a tutto ciò che serve ──
export function readNail(nail) {
  const n = nail || {};
  const info = NAIL_INFO[n.state] || NAIL_INFO.sana;
  const visual = getNailVisual(n);
  const isDead = n.state === "morta";
  const hasImplant = !!n.implant && (n.implantUses || 0) > 0;
  const isChirurgo = hasImplant && CHIRURGO_IMPLANT_IDS.has(n.implant);
  const chirurgoMax = isChirurgo ? (CHIRURGO_SLOT_MAX[n.implant] || 1) : 0;
  const off = OFF_STATES[n.state] || null;
  const col = visual?.color || info.color;
  // Tier vivi (1..5); morta = 0
  const tierIdx = TIER_ORDER.indexOf(SPECIAL_TIER_MAP[n.state] || n.state);
  const aliveTiers = isDead ? 0 : tierIdx + 1;
  const scratchCount = n.scratchCount || 0;
  const scratchLeft = Math.max(0, SCRATCH_THRESHOLD - scratchCount);
  // Riempimento della pip: slot per gli impianti chirurgo, grattate rimaste altrimenti
  const fillPct = isDead ? 0
    : isChirurgo ? (n.implantUses || 0) / chirurgoMax
    : scratchLeft / SCRATCH_THRESHOLD;
  // Colore dietro il riempimento = tier in cui precipiti al prossimo colpo
  const nextIdx = NAIL_ORDER.indexOf(n.state) - 1;
  const nextColor = (isDead || n.state === "marcia" || nextIdx < 0)
    ? "#000" : NAIL_INFO[NAIL_ORDER[nextIdx]].color + "cc";
  const shortLabel = isChirurgo ? n.implant.toUpperCase() : (SHORT_LABEL[n.state] || info.label.toUpperCase());
  return {
    info, visual, col, isDead, off, hasImplant, isChirurgo, chirurgoMax,
    aliveTiers, scratchCount, scratchLeft, fillPct, nextColor,
    smalto: n.smalto || 0, cremaHP: n.cremaHP || 0,
    shortLabel, glyph: off?.glyph || null,
  };
}

// Testo tooltip/title condiviso fra HUD, combattimento e sidebar
export function nailTitle(nail) {
  const r = readNail(nail);
  const parts = [r.isChirurgo ? `${nail.implant.toUpperCase()} (${nail.implantUses}/${r.chirurgoMax} slot)`
    : `${r.info.label}${r.hasImplant ? ` + ${nail.implant.toUpperCase()}` : ""}`];
  if (!r.isDead && !r.isChirurgo) parts.push(`HP ${r.aliveTiers}/5 · ${r.scratchLeft}/3 grattate`);
  if (r.smalto > 0) parts.push(`💅×${r.smalto}`);
  if (r.cremaHP > 0) parts.push(`🧴×${r.cremaHP}`);
  return parts.join(" — ");
}

// ─── PATTERN COMPATTO: una pip per unghia ────────────────────
const PIP_SIZES = {
  sm: { w: 9, h: 18, activeW: 11, glyph: 8 },
  md: { w: 11, h: 22, activeW: 13, glyph: 10 },
};

export function NailPip({ nail, active = false, size = "md", onClick = null }) {
  const s = PIP_SIZES[size] || PIP_SIZES.md;
  const r = readNail(nail);
  const hasSmalto = r.smalto > 0;
  const borderCol = r.off ? r.off.borderCol
    : hasSmalto ? C.magenta
    : active ? r.col : r.col + "88";
  return (
    <span
      title={nailTitle(nail)}
      onClick={onClick || undefined}
      style={{
        display: "inline-block", position: "relative", flexShrink: 0,
        width: `${active ? s.activeW : s.w}px`, height: `${s.h}px`,
        borderRadius: "2px",
        border: `${r.off && r.off.border === "solid" ? 2 : 1}px ${r.off ? r.off.border : "solid"} ${borderCol}`,
        background: r.off ? r.off.fill : r.nextColor,
        boxShadow: r.isDead ? "none"
          : active ? `0 0 6px ${r.col}cc${hasSmalto ? `, 0 0 4px ${C.magenta}88` : ""}`
          : r.hasImplant ? `0 0 5px ${r.col}88`
          : hasSmalto ? `0 0 4px ${C.magenta}66`
          : "none",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "width 0.15s",
      }}>
      {/* Riempimento — sale dal basso (grattate rimaste / slot impianto).
          L'unghia nera è viva: mantiene il suo livello, ma in grigio chiaro
          perché il suo colore di stato (#222222) sparirebbe sul pieno scuro. */}
      {!r.isDead && (
        <span style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: `${r.fillPct * 100}%`,
          background: r.off ? "#4a4a5e" : r.col,
          transition: "height 0.25s ease", display: "block",
        }} />
      )}
      {/* Glifo non cromatico per gli stati spenti (✕ morta / ◆ nera) */}
      {r.off && (
        <span style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: `${s.glyph}px`, lineHeight: 1, fontWeight: "bold",
          color: r.off.glyphCol, textShadow: "0 1px 2px #000",
        }}>{r.off.glyph}</span>
      )}
    </span>
  );
}

export function NailPipRow({ nails, activeNail = -1, size = "md", onSelectNail = null, gap = 3 }) {
  return (
    <span style={{ display: "inline-flex", gap: `${gap}px`, alignItems: "flex-end", verticalAlign: "middle" }}>
      {nails.map((n, i) => (
        <NailPip key={i} nail={n} active={i === activeNail} size={size}
          onClick={onSelectNail && n.state !== "morta" ? () => onSelectNail(i) : null} />
      ))}
    </span>
  );
}

// ─── PATTERN ESTESO: barre della sidebar ─────────────────────
// Segmenti a 6px di lato corto (prima 4px e — per le grattate — 2px).
const BAR_SIZES = {
  sm: { segW: 8, segH: 6, gap: 1, scratchW: 10 },
  md: { segW: 10, segH: 6, gap: 2, scratchW: 13 },
};

// Barra dei tier: 5 segmenti (marcia→kawaii) + smalto rosa + crema bianca
export function NailTierBar({ nail, active = false, size = "md" }) {
  const s = BAR_SIZES[size] || BAR_SIZES.md;
  const r = readNail(nail);
  const emptyTiers = Math.max(0, TIER_ORDER.length - r.aliveTiers);
  const smaltoInTiers = Math.min(emptyTiers, r.isDead ? 0 : r.smalto);
  const smaltoExtra = Math.max(0, (r.isDead ? 0 : r.smalto) - smaltoInTiers);
  const seg = (key, bg, border, extra = {}) => (
    <span key={key} style={{
      display: "inline-block", width: `${s.segW}px`, height: `${s.segH}px`,
      background: bg, border: `1px solid ${border}`, flexShrink: 0, ...extra,
    }} />
  );
  return (
    <span style={{ display: "flex", gap: `${s.gap}px`, alignItems: "center" }}>
      {TIER_ORDER.map((tier, ti) => {
        const filled = ti < r.aliveTiers;
        if (!filled && ti < r.aliveTiers + smaltoInTiers) {
          return seg(ti, C.pink, C.pink + "aa", { boxShadow: active ? `0 0 4px ${C.pink}aa` : `0 0 2px ${C.pink}66` });
        }
        // Il tier vuoto di un'unghia MORTA porta il tratteggio, non solo il grigio
        if (!filled && r.isDead) return seg(ti, DEAD_HATCH, "#3a3a48");
        const pipCol = filled ? TIER_COLORS[tier] : "#222";
        return seg(ti, filled ? pipCol : "#111", filled ? pipCol + "aa" : "#2a2a2a",
          filled && active ? { boxShadow: `0 0 4px ${pipCol}88` } : {});
      })}
      {Array(smaltoExtra).fill(0).map((_, si) => seg("s" + si, C.pink, C.pink + "aa",
        { boxShadow: active ? `0 0 4px ${C.pink}aa` : `0 0 2px ${C.pink}66` }))}
      {Array(r.cremaHP).fill(0).map((_, ci) => seg("c" + ci, "#ffffff", "#aaaaaa",
        active ? { boxShadow: "0 0 4px #ffffff88" } : {}))}
    </span>
  );
}

// Barra grattate rimaste: 3 segmenti PIENI (prima erano 3 tacche da 2px di
// altezza — invisibili) + conteggio testuale come ridondanza non grafica.
export function NailScratchBar({ nail, active = false, size = "md", showCount = true }) {
  const s = BAR_SIZES[size] || BAR_SIZES.md;
  const r = readNail(nail);
  if (r.isDead) return null;
  return (
    <span style={{ display: "flex", gap: `${s.gap}px`, alignItems: "center" }}>
      {[0, 1, 2].map(t => {
        const filled = t < r.scratchLeft;
        return (
          <span key={t} style={{
            display: "inline-block", width: `${s.scratchW}px`, height: `${s.segH}px`,
            background: filled ? r.col + "dd" : "#111",
            border: `1px solid ${filled ? r.col + "88" : "#242430"}`,
            boxShadow: filled && active ? `0 0 4px ${r.col}66` : "none",
            flexShrink: 0,
          }} />
        );
      })}
      {showCount && (
        <span style={{ color: C.dim, fontSize: "10px", marginLeft: "2px", opacity: 0.75 }}>
          {r.scratchLeft}/3
        </span>
      )}
    </span>
  );
}

// Slot fissi degli impianti chirurgo (2/4/5) — stesso linguaggio visivo dei tier
export function NailSlotBar({ nail, chirurgo, active = false, size = "md" }) {
  const s = BAR_SIZES[size] || BAR_SIZES.md;
  const used = nail.implantUses || 0;
  return (
    <span style={{ display: "flex", gap: `${s.gap}px`, alignItems: "center", flexWrap: "wrap" }}>
      {Array(chirurgo.max).fill(0).map((_, si) => {
        const filled = si < used;
        return (
          <span key={si} style={{
            display: "inline-block",
            width: `${chirurgo.max === 2 ? s.segW + 4 : chirurgo.max === 4 ? s.segW + 1 : s.segW}px`,
            height: `${s.segH + 2}px`,
            background: filled ? chirurgo.color : "#111",
            border: `1px solid ${filled ? chirurgo.color : "#2a2a2a"}`,
            boxShadow: filled && active ? `0 0 6px ${chirurgo.color}cc, inset 0 0 3px #fff3`
              : filled ? `0 0 3px ${chirurgo.color}66` : "none",
            flexShrink: 0,
          }} />
        );
      })}
      <span style={{ color: chirurgo.color + "cc", fontSize: "10px", marginLeft: "2px", letterSpacing: "0.5px" }}>
        {used}/{chirurgo.max}
      </span>
    </span>
  );
}
