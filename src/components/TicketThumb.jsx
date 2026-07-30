import { C } from "../data/theme.js";
import { ticketLayout, inset } from "../data/ticketLayout.js";
import { Asset } from "./Asset.jsx";
import { hasAsset } from "../assets/registry.js";
import { TicketHeader, TICKET_NEON_KEYFRAMES } from "./TicketHeader.jsx";

// ─── TICKET THUMB ────────────────────────────────────────────
// Anteprima statica di un biglietto, composta come in partita: l'arte PNG,
// il titolo dentro al cartiglio e la griglia coperta nell'area di gioco,
// usando lo stesso TICKET_LAYOUT di ScratchCardView (nessun layout duplicato).
// Serve dove il biglietto va mostrato ma non ancora grattato (intro, shop).

// Griglia effettiva per le meccaniche che non usano rows×cols della card.
function gridOf(card) {
  switch (card.mechanic) {
    case "setteemezzo":  return { cols: 4, rows: 1 };
    case "ruota":        return { cols: 3, rows: 1 };
    case "doppioOnulla": return { cols: 1, rows: 1 };
    default:             return { cols: card.cols || 3, rows: card.rows || 3 };
  }
}

export function TicketThumb({ card, width = 190, style }) {
  if (!card) return null;
  const accent = card.theme?.border || C.gold;
  const layout = ticketLayout(card.id);
  const { cols, rows } = gridOf(card);
  const hasArt = hasAsset(`ticket-${card.id}`);

  // Alcune carte (doppioOnulla, ruota) hanno insets NEGATIVI: in partita è voluto,
  // il pannello da grattare deborda oltre il biglietto. In miniatura però le celle
  // coprirebbero l'illustrazione, che è proprio la cosa da mostrare: qui il rect
  // viene riportato dentro i bordi.
  const playRect = Object.fromEntries(
    Object.entries(layout.play).map(([k, v]) =>
      [k, typeof v === "number" ? Math.max(v, 3) : v])
  );

  const cells = (
    <div style={{
      width: "100%", height: "100%",
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: "4%",
    }}>
      {Array(cols * rows).fill(0).map((_, i) => (
        <div key={i} style={{
          // Stessa patina argento e stesso bordo-accento delle celle non grattate
          // in partita (ScratchCell: unrevealedBorder = themeColor).
          background: "linear-gradient(160deg, #e8e8e8 0%, #c0c0c0 70%, #9a9aa4 100%)",
          border: `1px solid ${accent}`,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.3)",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{
      position: "relative", width: `${width}px`, aspectRatio: "4 / 3",
      flexShrink: 0, overflow: "hidden",
      border: `1px solid ${accent}55`, borderRadius: "3px",
      boxShadow: `0 0 16px ${accent}33`,
      background: hasArt ? "transparent" : "#0a0a16",
      ...style,
    }}>
      {hasArt && (
        <Asset id={`ticket-${card.id}`} size={width} style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%", objectFit: "cover", display: "block",
        }} />
      )}

      {/* Titolo: stesso componente del biglietto giocabile */}
      <style>{TICKET_NEON_KEYFRAMES}</style>
      <TicketHeader card={card} accent={accent} layout={layout} compact />

      {/* Area grattabile — stessa zona che in partita ospita le celle */}
      <div style={{
        position: "absolute", inset: inset(playRect), zIndex: 2,
        border: `1px solid ${accent}55`,
        boxShadow: `0 0 10px ${accent}44, inset 0 0 18px ${accent}22`,
        padding: "3%",
      }}>
        {cells}
      </div>
    </div>
  );
}
