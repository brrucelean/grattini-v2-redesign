import { C, FONT } from "../data/theme.js";
import { ticketLayout, inset } from "../data/ticketLayout.js";
import { Asset } from "./Asset.jsx";
import { hasAsset } from "../assets/registry.js";

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
          background: "linear-gradient(160deg, #c8c8d4 0%, #8e8e9e 58%, #63636f 100%)",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: "2px",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.35)",
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

      {/* Titolo dentro al cartiglio dell'arte */}
      <div style={{
        position: "absolute", inset: inset(layout.header), zIndex: 3,
        containerType: "size",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div style={{
          color: "#fff", fontWeight: "bold", fontFamily: FONT,
          fontSize: layout.header.dir === "row"
            ? "clamp(6px, min(6.5cqw, 62cqh), 15px)"
            : "clamp(6px, min(9.5cqw, 46cqh), 15px)",
          letterSpacing: "0.5px", lineHeight: 1.05, textAlign: "center",
          WebkitTextStroke: `0.4px ${accent}`,
          textShadow: `0 0 5px ${accent}, 0 0 12px ${accent}99, 0 1px 2px #000`,
        }}>{card.name}</div>
      </div>

      {/* Area grattabile — stessa zona che in partita ospita le celle */}
      <div style={{
        position: "absolute", inset: inset(layout.play), zIndex: 2,
        border: `1px solid ${accent}55`,
        boxShadow: `0 0 10px ${accent}44, inset 0 0 18px ${accent}22`,
        padding: "3%",
      }}>
        {cells}
      </div>
    </div>
  );
}
