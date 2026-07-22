import { C, FONT } from "../data/theme.js";
import { NAIL_INFO, NAIL_ORDER } from "../data/nails.js";
import { CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { getNailVisual } from "../utils/nail.js";

// Slot totali per impianto chirurgo (deve matchare NailSidebar)
const CHIRURGO_SLOT_MAX = { plastica: 2, ferro: 4, oro: 5 };

export function NailDisplay({ nails, activeNail, compact=false, onSelectNail=null }) {
  if (compact) {
    const THRESHOLD = 3;
    return (
      <span style={{display:"inline-flex", gap:"3px", alignItems:"flex-end", verticalAlign:"middle"}}>
        {nails.map((n, i) => {
          const info = NAIL_INFO[n.state];
          const visual = getNailVisual(n);
          const displayCol = visual?.color || info.color;
          const isDead = n.state === "morta";
          const isActive = i === activeNail;
          const hasImplant = !!n.implant && (n.implantUses || 0) > 0;
          const isChirurgo = hasImplant && CHIRURGO_IMPLANT_IDS.has(n.implant);
          // Colore dietro la batteria: prossimo stato peggiore, ma nero se marcia (ultima prima di morta)
          const nextIdx = NAIL_ORDER.indexOf(n.state) - 1;
          const nextColor = (isDead || n.state === "marcia" || nextIdx < 0)
            ? "#000"
            : NAIL_INFO[NAIL_ORDER[nextIdx]].color + "cc";
          // Percentuale rimanente: per chirurgo usa implantUses/max, altrimenti scratchCount
          const fillPct = isDead ? 0
            : isChirurgo ? (n.implantUses || 0) / (CHIRURGO_SLOT_MAX[n.implant] || 1)
            : (THRESHOLD - n.scratchCount) / THRESHOLD;
          const hasSmalto = n.smalto && n.smalto > 0;
          const title = `${isChirurgo ? n.implant.toUpperCase() : info.label}${hasImplant && !isChirurgo ? ` + ${n.implant.toUpperCase()}` : ""}${isChirurgo ? ` (${n.implantUses}/${CHIRURGO_SLOT_MAX[n.implant]} slot)` : !isDead ? ` (${n.scratchCount}/${THRESHOLD})` : ""}${hasSmalto ? ` 💅×${n.smalto}` : ""}`;
          return (
            <span key={i} title={title}
              style={{
                display:"inline-block",
                width: isActive ? "11px" : "9px",
                height: "22px",
                borderRadius: "2px",
                border: `1px solid ${isDead ? "#333" : hasSmalto ? C.magenta : isActive ? displayCol : displayCol + "88"}`,
                boxShadow: isDead ? "none"
                  : isActive ? `0 0 6px ${displayCol}cc${hasSmalto ? `, 0 0 4px ${C.magenta}88` : ""}`
                  : hasImplant ? `0 0 5px ${displayCol}88`
                  : hasSmalto ? `0 0 4px ${C.magenta}66`
                  : "none",
                background: nextColor,
                overflow:"hidden",
                position:"relative",
                transition:"width 0.15s",
              }}>
              {/* Strato pieno — sale dal basso */}
              <span style={{
                position:"absolute",
                bottom:0, left:0, right:0,
                height: `${fillPct * 100}%`,
                background: isDead ? "transparent" : displayCol,
                transition:"height 0.25s ease",
                display:"block",
              }} />
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
      {nails.map((n,i) => {
        const info = NAIL_INFO[n.state];
        const visual = getNailVisual(n);
        const col = visual?.color || info.color;
        const isActive = i === activeNail;
        const isDead = n.state === "morta";
        const canSwitch = onSelectNail && !isDead && !isActive;
        const hasImplant = !!n.implant && (n.implantUses || 0) > 0;
        const isChirurgo = hasImplant && CHIRURGO_IMPLANT_IDS.has(n.implant);
        const cardBg = isDead ? "#0f0f18"
          : visual?.bg ? visual.bg
          : isActive ? col + "18" : "#0f0f18";
        const cardGlow = isDead ? "none"
          : isActive ? (visual?.glow && visual.glow !== "none"
              ? `${visual.glow}, 0 0 8px ${col}99`
              : `0 0 8px ${col}99, 0 0 2px ${col}`)
            : (visual?.glow && visual.glow !== "none" ? visual.glow : "none");
        return (
          <div key={i}
            onClick={canSwitch ? () => onSelectNail(i) : undefined}
            style={{
              width: "65px", minHeight: "80px",
              border: `1px solid ${isActive ? col : isDead ? "#333" : col + "55"}`,
              background: cardBg,
              boxShadow: cardGlow,
              padding: "4px 8px", borderRadius: "3px", textAlign: "center",
              cursor: canSwitch ? "pointer" : "default",
              opacity: isDead ? 0.4 : 1,
              transition: "box-shadow 0.2s, border-color 0.2s",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
            }}>
            <div style={{
              fontSize:"18px",
              filter: !isDead && visual?.glow && visual.glow !== "none" ? `drop-shadow(0 0 4px ${col})` : "none",
            }}>{visual?.emoji || "🖐"}</div>
            <div style={{color: isActive ? col : isDead ? "#555" : col + "aa", fontSize:"10px", fontWeight: isActive ? "bold" : "normal"}}>
              {isChirurgo ? n.implant.toUpperCase() : info.label}
            </div>
            <div style={{color: isActive ? col + "cc" : C.dim, fontSize:"9px"}}>
              {isDead ? "---" : isChirurgo ? `${n.implantUses}/${CHIRURGO_SLOT_MAX[n.implant]} slot` : `${n.scratchCount}/3`}
            </div>
            {hasImplant && !isChirurgo && <div style={{color: col, fontSize:"9px", fontWeight:"bold", letterSpacing:"0.5px"}}>{n.implant.toUpperCase()}</div>}
            {n.smalto > 0 && <div style={{color: C.magenta, fontSize:"9px", }}>💅×{n.smalto}</div>}
            {isActive && <div style={{color: col, fontSize:"9px", }}>▲ ATTIVA</div>}
            {canSwitch && <div style={{color: col + "88", fontSize:"9px"}}>↑ usa</div>}
          </div>
        );
      })}
    </div>
  );
}
