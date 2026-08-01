import { C, FONT } from "../data/theme.js";
import { VintageBadge } from "./Vintage.jsx";
import { LogSidebar } from "./LogPanel.jsx";

// ─── FIANCATE DEL BANCO — solo desktop largo ─────────────────
// Il grattino NON si allarga (romperebbe le proporzioni degli asset): lo spazio
// desktop eccedente viene occupato componendo ATTORNO alla carta — dossier della
// run + bioma corrente a sinistra, log dei colpi a destra — invece di lasciare
// nero puro fino al 40% dello schermo.
// Nessuno stato nuovo: tutto arriva da gameStats / player / useLog già esistenti.

const RAIL_W = "230px";

function railBox(pal) {
  return {
    width: RAIL_W, flexShrink: 0,
    // Sticky: la fiancata resta a vista mentre il grattino scorre. alignSelf
    // flex-start (non stretch) altrimenti il box prende l'altezza della riga e
    // lo sticky non ha margine di scorrimento.
    alignSelf: "flex-start", position: "sticky", top: 0,
    // Altezza DEFINITA (non maxHeight): serve perché il LogSidebar interno usa
    // height:100% + overflow per l'auto-scroll in fondo al log.
    height: "calc(100dvh - 150px)",
    display: "flex", flexDirection: "column", minHeight: 0,
    fontFamily: FONT,
    background: pal.panelBg,
    border: `1px solid ${pal.border}33`,
    boxShadow: `inset 0 0 26px rgba(0,0,0,0.6)`,
    overflow: "hidden",
  };
}

function StatRow({ icon, label, value, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px",
      padding: "4px 2px", borderBottom: "1px solid #0d0d1a",
      fontSize: "10px", letterSpacing: "0.5px",
    }}>
      <span style={{ color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {icon} {label}
      </span>
      <span style={{ color, fontWeight: "bold", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

// ── SINISTRA: dossier della run + ambiente del bioma corrente ──
export function RunStatsRail({ biome, palette, player, gameStats }) {
  return (
    <div style={railBox(palette)}>
      <div style={{
        textAlign: "center", padding: "8px 6px 6px",
        borderBottom: `1px solid ${palette.border}33`,
      }}>
        <VintageBadge color={palette.accent} size="md">DOSSIER RUN</VintageBadge>
      </div>

      {/* Bioma corrente — l'ambiente in cui stai grattando */}
      <div style={{ padding: "8px 8px 10px", borderBottom: `1px solid ${palette.border}22` }}>
        <div style={{ color: C.dim, fontSize: "8px", letterSpacing: "2px", marginBottom: "3px" }}>
          ░ ZONA ░
        </div>
        <div style={{
          color: biome?.color || palette.accent, fontSize: "12px", fontWeight: "bold",
          textShadow: `0 0 10px ${palette.accent}66`, lineHeight: 1.3, marginBottom: "4px",
        }}>
          {biome?.name || "—"}
        </div>
        <div style={{ color: C.dim, fontSize: "9px", lineHeight: 1.5, fontStyle: "italic" }}>
          {biome?.desc || ""}
        </div>
      </div>

      {/* Statistiche della run in corso */}
      <div style={{ padding: "6px 8px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        <StatRow icon="💰" label="PORTAFOGLIO" value={`€${player.money}`} color={C.gold} />
        <StatRow icon="🖐️" label="GRATTATE" value={gameStats.cardsScratched || 0} color={C.magenta} />
        <StatRow icon="✅" label="VINTE" value={gameStats.scratchWins || 0} color={C.green} />
        <StatRow icon="❌" label="PERSE" value={gameStats.scratchLosses || 0} color={C.red} />
        <StatRow icon="🏆" label="MIGLIOR €" value={`€${gameStats.bestPrize || 0}`} color={C.gold} />
        <StatRow icon="🗺️" label="NODI" value={gameStats.nodesVisited || 0} color={C.cyan} />
      </div>
    </div>
  );
}

// ── DESTRA: log dei colpi, riuso di LogSidebar (nessun log parallelo) ──
export function ScratchLogRail({ log, palette }) {
  return (
    <div style={railBox(palette)}>
      <LogSidebar log={log} />
    </div>
  );
}
