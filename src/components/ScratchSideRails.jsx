import { C, FONT } from "../data/theme.js";
import { GRATTATORE_DEFS } from "../data/items.js";
import { VintageBadge } from "./Vintage.jsx";
import { LogSidebar } from "./LogPanel.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { Asset } from "./Asset.jsx";
import { Btn } from "./Btn.jsx";

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
export function RunStatsRail({ biome, palette, player, gameStats, onEquipGrattatore }) {
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
        <div style={{ color: C.dim, fontSize: "10px", letterSpacing: "2px", marginBottom: "3px" }}>
          ░ ZONA ░
        </div>
        <div style={{
          color: biome?.color || palette.accent, fontSize: "12px", fontWeight: "bold",
          textShadow: `0 0 10px ${palette.accent}66`, lineHeight: 1.3, marginBottom: "4px",
        }}>
          {biome?.name || "—"}
        </div>
        <div style={{ color: C.dim, fontSize: "10px", lineHeight: 1.5, fontStyle: "italic" }}>
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

        {/* Grattatori in zaino — selezionabili anche mentre si gratta, così
            non serve chiudere il grattino per cambiare attrezzo. Un click
            sul grattatore già attivo lo toglie (stesso toggle dello zaino
            a schermo intero). */}
        {player.grattatori?.length > 0 && (
          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: `1px solid ${palette.border}22` }}>
            <div style={{ color: C.dim, fontSize: "10px", letterSpacing: "2px", marginBottom: "5px" }}>
              ░ GRATTATORI ░
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {player.grattatori.map((g, idx) => {
                const def = GRATTATORE_DEFS[g.id];
                const isEquipped = player.equippedGrattatore?.inventoryIdx === idx;
                return (
                  <Tooltip key={idx} text={`${g.desc || def?.desc || ""} · ${g.usesLeft} uso/i`} color={C.cyan}>
                    <Btn
                      onClick={() => onEquipGrattatore?.(idx)}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        width: "100%", justifyContent: "flex-start",
                        background: isEquipped ? `${C.cyan}22` : "#0a0a18",
                        border: `1px solid ${isEquipped ? C.cyan : "#333355"}`,
                        color: isEquipped ? C.cyan : C.dim,
                        padding: "4px 6px", fontSize: "10px", fontFamily: FONT,
                        boxShadow: isEquipped ? `0 0 8px ${C.cyan}55` : "none",
                        letterSpacing: "0.3px",
                      }}
                    >
                      <span style={{ fontSize: "14px", flexShrink: 0, lineHeight: 1 }}>
                        <Asset id={`item-${g.id}`} emoji={g.emoji} size={16} />
                      </span>
                      <span style={{
                        flex: 1, minWidth: 0, textAlign: "left",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {g.name}
                      </span>
                      <span style={{
                        flexShrink: 0, fontWeight: "bold", fontSize: "9px", padding: "0 4px",
                        background: isEquipped ? C.cyan : "#222244",
                        color: isEquipped ? "#000" : C.dim,
                      }}>
                        {isEquipped ? "✓" : g.usesLeft}
                      </span>
                    </Btn>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
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
