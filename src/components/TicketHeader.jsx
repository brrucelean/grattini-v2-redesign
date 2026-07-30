import { C, FONT } from "../data/theme.js";
import { inset } from "../data/ticketLayout.js";

// ─── HEADER DEL BIGLIETTO ────────────────────────────────────
// Titolo + badge costo/max dentro al cartiglio dell'arte, posizionati con
// TICKET_LAYOUT. Usato SIA dal biglietto giocabile (ScratchCardView) SIA
// dall'anteprima (TicketThumb): stessa impaginazione in entrambi, così non
// possono divergere. Tutte le misure sono in unità container-query (cqw/cqh),
// quindi scalano da sole col riquadro, grande o piccolo che sia.
// `compact` = anteprima: niente badge COSTO/MAX (costo e premio max sono già
// scritti nel pannello informativo accanto) così il titolo si prende tutta la
// fascia. Su cartigli bassi come quello di Doppio o Nulla — alto il 7,5% del
// biglietto — a dimensione ridotta titolo e badge finivano uno sopra l'altro.
export function TicketHeader({ card, accent, layout, compact = false }) {
  const headerRow = layout.header.dir === "row";

  // Alone cromatico "da sala giochi": neon accento + sfrangiatura ciano/magenta.
  const haloTitle = [
    `0 0 6px ${accent}`, `0 0 14px ${accent}cc`, `0 0 26px ${accent}66`,
    `-1.5px 0 6px ${C.cyan}88`, `1.5px 0 6px ${C.magenta}88`,
    "0 2px 3px #000", "-1px -1px 0 #000", "1px 1px 0 #000",
  ].join(", ");

  const neonPill = (bg, label) => (
    <span style={{
      fontSize: "clamp(5px, min(3.4cqw, 30cqh), 13px)",
      color: "#000", fontWeight: "bold", fontFamily: FONT,
      background: bg, padding: "0.15em 0.6em", letterSpacing: "1px",
      whiteSpace: "nowrap", lineHeight: 1.5,
      border: `1px solid ${bg}`,
      boxShadow: `0 0 8px ${bg}cc, 0 0 18px ${bg}55, 0 1px 2px #000`,
    }}>{label}</span>
  );

  return (
    <div style={{
      position: "absolute", inset: inset(layout.header), zIndex: 3,
      containerType: "size",
      display: "flex", pointerEvents: "none",
      flexDirection: headerRow ? "row" : "column",
      alignItems: "center",
      justifyContent: headerRow ? "space-between" : "center",
      gap: headerRow ? "2%" : "0.35em",
    }}>
      {/* Titolo — come un vero gratta e vinci, dentro al cartiglio dell'arte */}
      <div style={{
        color: "#fff", fontWeight: "bold",
        fontSize: compact
          ? (headerRow ? "clamp(7px, min(9cqw, 85cqh), 30px)" : "clamp(7px, min(12cqw, 70cqh), 30px)")
          : (headerRow ? "clamp(7px, min(6.5cqw, 62cqh), 30px)" : "clamp(7px, min(9.5cqw, 46cqh), 30px)"),
        letterSpacing: "1.5px", lineHeight: 1.05,
        WebkitTextStroke: `0.6px ${accent}`,
        textShadow: haloTitle,
        animation: "ticketNeon 3.2s ease-in-out infinite",
        fontFamily: FONT, textAlign: "center",
        maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textTransform: "uppercase",
      }}>
        {card.name}
      </div>
      {/* Badge costo / max — pill neon, mai sopra il titolo */}
      {!compact && (
        <div style={{
          display: "flex", gap: "0.5em", flexWrap: "nowrap",
          justifyContent: "center", alignItems: "center",
        }}>
          {neonPill(C.gold, `COSTO €${card.cost}`)}
          {neonPill(C.green, `MAX €${card.maxPrize}`)}
        </div>
      )}
    </div>
  );
}

// Respiro neon dell'insegna. Serve a chi monta TicketHeader fuori da
// ScratchCardView (che definisce già la stessa @keyframes al suo interno).
export const TICKET_NEON_KEYFRAMES = `
  @keyframes ticketNeon {
    0%, 100% { filter: brightness(1); }
    45%      { filter: brightness(1.16); }
    52%      { filter: brightness(0.97); }
  }
`;
