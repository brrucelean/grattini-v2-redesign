import { C, FONT } from "../data/theme.js";
import { NAIL_INFO } from "../data/nails.js";
import { CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { getNailVisual } from "../utils/nail.js";
import { Asset } from "./Asset.jsx";
import { NailPipRow, CHIRURGO_SLOT_MAX } from "./NailMeter.jsx";

export function NailDisplay({ nails, activeNail, compact=false, onSelectNail=null }) {
  // Compatto (HUD di combattimento) → pattern condiviso con l'HUD di gioco:
  // stessa pip, stessi stati spenti, stesso tooltip. Vedi NailMeter.jsx.
  if (compact) {
    return <NailPipRow nails={nails} activeNail={activeNail} size="md" onSelectNail={onSelectNail} />;
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
            }}><Asset id={!n.implant ? `nail-${n.state}` : null} emoji={visual?.emoji || "🖐"} size={30} /></div>
            <div style={{color: isActive ? col : isDead ? "#555" : col + "aa", fontSize:"10px", fontWeight: isActive ? "bold" : "normal"}}>
              {isChirurgo ? n.implant.toUpperCase() : info.label}
            </div>
            <div style={{color: isActive ? col + "cc" : C.dim, fontSize:"10px"}}>
              {isDead ? "---" : isChirurgo ? `${n.implantUses}/${CHIRURGO_SLOT_MAX[n.implant]} slot` : `${n.scratchCount}/3`}
            </div>
            {hasImplant && !isChirurgo && <div style={{color: col, fontSize:"10px", fontWeight:"bold", letterSpacing:"0.5px"}}>{n.implant.toUpperCase()}</div>}
            {n.smalto > 0 && <div style={{color: C.magenta, fontSize:"10px", }}>💅×{n.smalto}</div>}
            {isActive && <div style={{color: col, fontSize:"10px", }}>▲ ATTIVA</div>}
            {canSwitch && <div style={{color: col + "88", fontSize:"10px"}}>↑ usa</div>}
          </div>
        );
      })}
    </div>
  );
}
