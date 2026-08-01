import { useState, memo } from "react";
import { C, FONT } from "../data/theme.js";
import { NAIL_INFO, NAIL_ORDER } from "../data/nails.js";
import { GRATTATORE_DEFS, ALL_IMPLANTS_META, CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { makeNailCursor, NAIL_CURSOR, getNailVisual } from "../utils/nail.js";
import { Tooltip } from "./Tooltip.jsx";
import { VintageBadge } from "./Vintage.jsx";
import { Asset } from "./Asset.jsx";
import { NailTierBar, NailScratchBar, NailSlotBar, readNail } from "./NailMeter.jsx";

// Chirurgo implants: slot totali e colore per tipo
const CHIRURGO_SLOTS = {
  plastica: { max: 2, color: "#44ddee", label: "PLASTICA" },
  ferro:    { max: 4, color: "#c0c0d0", label: "FERRO" },
  oro:      { max: 5, color: "#ffd700", label: "ORO" },
};

function NailSidebarImpl({ nails, activeNail, onSelectNail, locked=false, grattatori=[], equippedGrattatore=null, onEquipGrattatore=null, horizontal=false }) {
  // Tier/pip/tacche vivono in NailMeter.jsx — stesso linguaggio visivo dell'HUD
  // e del combattimento (vedi NailTierBar / NailScratchBar / NailSlotBar).
  return (
    <div style={horizontal
      ? {display:"flex", flexDirection:"row", gap:"6px", alignItems:"stretch", overflowX:"auto", overflowY:"hidden", width:"100%", paddingBottom:"2px"}
      : {display:"flex", flexDirection:"column", gap:"5px", alignItems:"stretch"}}>
      {/* Heading Vintage — solo in verticale (su mobile risparmiamo spazio) */}
      {!horizontal && (
        <div style={{textAlign:"center", marginBottom:"4px"}}>
          <VintageBadge color={locked ? C.orange : C.gold} size="md">
            {locked ? "🔒 BLOCCATA" : "🖐 UNGHIE"}
          </VintageBadge>
        </div>
      )}
      {nails.map((n, i) => {
        const info = NAIL_INFO[n.state];
        const visual = getNailVisual(n);
        const col = visual?.color || info.color;
        const isActive = i === activeNail;
        const isDead = n.state === "morta";
        const canSwitch = !isDead && !isActive && !locked;
        // Derivazione condivisa (tier vivi, grattate rimaste, stato spento…)
        const meter = readNail(n);
        const aliveTiers = meter.aliveTiers;
        const dmgFilled = isDead ? 0 : n.scratchCount;
        const accent = visual?.accent;
        const borderCol = isDead ? "#222"
          : accent && !isActive ? accent+"cc"
          : isActive ? col : col+"44";
        const sidebarGlow = isDead ? "none"
          : isActive ? (visual?.glow && visual.glow !== "none"
              ? `${visual.glow}, 0 0 10px ${col}55`
              : `0 0 10px ${col}55, inset 0 0 10px ${col}08`)
            : (visual?.glow && visual.glow !== "none" ? visual.glow : "none");
        const sidebarBg = isDead ? "#080810"
          : visual?.bg ? visual.bg
          : isActive ? col+"12" : "#080810";
        return (
          <div key={i} onClick={canSwitch ? () => onSelectNail(i) : undefined}
            style={{
              position:"relative",
              // Longhand sui 3 lati (no shorthand `border`) così non entra in
              // conflitto col `borderBottom` condizionale sotto — evita lo spam
              // del warning React "mixing shorthand and non-shorthand".
              borderTop:`1px solid ${borderCol}`,
              borderLeft:`1px solid ${borderCol}`,
              borderRight:`1px solid ${borderCol}`,
              borderBottom:`1px solid ${borderCol}`,
              background: sidebarBg,
              boxShadow: sidebarGlow,
              padding: horizontal ? "5px 4px 3px" : "5px 8px", borderRadius:"0",
              cursor: canSwitch ? "pointer" : "default",
              opacity: isDead ? 0.35 : 1,
              display:"flex",
              flexDirection: horizontal ? "column" : "row",
              alignItems:"center",
              justifyContent: horizontal ? "center" : undefined,
              gap: horizontal ? "2px" : "6px",
              transition:"box-shadow 0.25s, border-color 0.25s, background 0.25s",
              ...(horizontal ? {
                minWidth:"68px", maxWidth:"68px", height:"88px", flexShrink:0,
                borderBottom: isActive ? `3px solid ${col}` : isDead ? "3px solid #111" : `3px solid ${col}22`,
              } : {}),
            }}>
            {locked && !isActive && !isDead && (
              <div style={{
                position:"absolute", inset:0,
                background:"#000000bb",
                display:"flex", alignItems:"center", justifyContent:"center",
                pointerEvents:"none",
                fontSize:"13px",
              }}>🔒</div>
            )}

            {/* ── LAYOUT COMPATTO ORIZZONTALE (mobile) ── */}
            {horizontal && (() => {
              const tipLines = [];
              const chirurgo = !isDead && CHIRURGO_IMPLANT_IDS.has(n.implant) ? CHIRURGO_SLOTS[n.implant] : null;
              if (chirurgo) {
                tipLines.push(`${chirurgo.label} — ${n.implantUses}/${chirurgo.max} slot`);
              } else {
                tipLines.push(`${info.label} — x${(NAIL_INFO[n.state]?.mult||0).toFixed(1)} premio`);
                tipLines.push(`HP: ${aliveTiers}/5 · ${3-dmgFilled}/3 grattate rimaste`);
              }
              if (n.cremaHP > 0) tipLines.push(`🧴 Crema: ${n.cremaHP} colpi extra`);
              if (n.smalto > 0)  tipLines.push(`💅 Smalto: ${n.smalto} colpi`);
              // Etichette corte VERE (mai troncate a metà parola come
              // "SANGUIN."/"GRAFFIAT") + glifo non cromatico per gli stati
              // spenti: ✕ MORTA vs ◆ NERA, distinguibili anche senza colore.
              const stateLabel = chirurgo ? chirurgo.label
                : `${meter.glyph ? meter.glyph + " " : ""}${meter.shortLabel}`;
              return (
                <Tooltip text={tipLines.join("\n")} color={col}>
                  <span style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"2px", width:"100%"}}>
                    {/* Emoji grande */}
                    <span style={{
                      fontSize:"22px", lineHeight:1,
                      filter: !isDead && visual?.glow && visual.glow !== "none"
                        ? `drop-shadow(0 0 6px ${col})` : "none",
                      animation: isActive && !isDead ? "crtFlicker 6s ease-in-out infinite" : "none",
                    }}>
                      <Asset id={!n.implant ? `nail-${n.state}` : null} emoji={visual?.emoji || "🖐"} size={34} />
                    </span>
                    {/* Etichetta stato — 8px, niente ellipsis */}
                    <span style={{
                      color: isDead ? "#8a8aa0" : isActive ? col : col+"cc",
                      fontSize:"8px", fontWeight: isActive ? "bold" : "normal",
                      letterSpacing:"0.3px", lineHeight:1.1,
                      maxWidth:"64px", whiteSpace:"nowrap",
                      textAlign:"center",
                      textShadow: isActive && !isDead ? `0 0 6px ${col}88` : "none",
                    }}>{stateLabel}</span>
                    {/* HP tier + grattate — barre condivise (segmenti da 6px) */}
                    {chirurgo
                      ? <NailSlotBar nail={n} chirurgo={chirurgo} active={isActive} size="sm" />
                      : <>
                          <NailTierBar nail={n} active={isActive} size="sm" />
                          <NailScratchBar nail={n} active={isActive} size="sm" showCount={false} />
                        </>}
                    {/* Indicatore nail attiva — bottom bar gestita sul container */}
                  </span>
                </Tooltip>
              );
            })()}

            {/* ── LAYOUT COMPLETO VERTICALE (desktop/sidebar) ── */}
            {!horizontal && (() => {
              const chirurgo = !isDead && CHIRURGO_IMPLANT_IDS.has(n.implant) ? CHIRURGO_SLOTS[n.implant] : null;
              const tipLines = [];
              if (chirurgo) {
                tipLines.push(`${chirurgo.label} — ${n.implantUses}/${chirurgo.max} slot rimasti`);
                tipLines.push(`Non sanguina — si spezza a slot 0.`);
              } else {
                tipLines.push(`${info.label} — x${(NAIL_INFO[n.state]?.mult||0).toFixed(1)} premio`);
                tipLines.push(`HP: ${aliveTiers}/5 tier · ${3 - dmgFilled}/3 grattate rimaste`);
              }
              if (n.cremaHP > 0) tipLines.push(`🧴 Crema: ${n.cremaHP} colpi extra`);
              if (n.smalto > 0) tipLines.push(`💅 Smalto: ${n.smalto} colpi protetti`);
              if (n.implant) {
                const imp = ALL_IMPLANTS_META.find(im=>im.id===n.implant);
                if (imp) tipLines.push(`⚙ ${imp.name}: ${imp.desc}`);
              }
              const tipText = tipLines.join("\n");
              return (
                <Tooltip text={tipText} color={col}>
                  <span style={{display:"flex", alignItems:"center", gap:"6px", width:"100%"}}>
                    <span style={{
                      fontSize:"15px", lineHeight:1, flexShrink:0,
                      filter: !isDead && visual?.glow && visual.glow !== "none" ? `drop-shadow(0 0 4px ${col})` : "none",
                    }}>
                      <Asset id={!n.implant ? `nail-${n.state}` : null} emoji={visual?.emoji || "🖐"} size={30} />
                    </span>
                    <span style={{flex:1, minWidth:0}}>
                      <span style={{display:"flex", alignItems:"center", gap:"4px"}}>
                        <span style={{color: isDead ? "#8a8aa0" : isActive ? col : col+"aa", fontSize:"9px", fontWeight: isActive ? "bold" : "normal", whiteSpace:"nowrap"}}>
                          {/* Glifo ✕/◆ davanti agli stati spenti: morta e unghia
                              nera non si distinguono più solo per la tinta */}
                          {chirurgo ? chirurgo.label : `${meter.glyph ? meter.glyph + " " : ""}${info.label}`}
                        </span>
                      </span>
                      {chirurgo ? (
                        // ─── CHIRURGO: slot fissi (2/4/5) colorati, niente bleeding ───
                        <span style={{display:"flex", marginTop:"4px"}}>
                          <NailSlotBar nail={n} chirurgo={chirurgo} active={isActive} size="md" />
                        </span>
                      ) : (
                        <>
                          {/* HP tier — segmenti da 6px (prima 5px) */}
                          <span style={{display:"flex", marginTop:"3px"}}>
                            <NailTierBar nail={n} active={isActive} size="md" />
                          </span>
                          {/* Grattate rimaste — barra piena da 6px + conteggio
                              (prima: 3 tacche da 3px, sotto la soglia visibile) */}
                          <span style={{display:"flex", marginTop:"3px"}}>
                            <NailScratchBar nail={n} active={isActive} size="md" />
                          </span>
                        </>
                      )}
                      {n.smalto > 0 && <span style={{display:"block", color:C.magenta, fontSize:"8px", marginTop:"1px"}}>💅×{n.smalto}</span>}
                    </span>
                  </span>
                </Tooltip>
              );
            })()}
          </div>
        );
      })}
      {/* ── GRATTATORE EQUIPAGGIATO — solo quello attivo ── */}
      {(() => {
        const g = equippedGrattatore;
        if (!g) return null;
        const uses = g.usesLeft || 0;
        return (
          <>
            {!horizontal && (
              <div style={{textAlign:"center", marginTop:"6px", marginBottom:"3px", borderTop:`1px solid #1a1a2e`, paddingTop:"6px"}}>
                <VintageBadge color={C.cyan} size="md">🔧 GRATTATORE</VintageBadge>
              </div>
            )}
            <Tooltip text={`${g.emoji} ${g.name}\n${g.desc}\n${uses > 10 ? uses : uses + "/" + (g.maxUses||uses)} usi rimasti`} color={C.cyan}>
            <div style={{
              border:`1px solid ${C.cyan}`,
              background: C.cyan+"18",
              padding:"5px 8px", cursor:"default",
              display:"flex", alignItems:"center", gap:"6px",
              ...(horizontal ? { minWidth:"122px", flexShrink:0 } : {}),
            }}>
              <span style={{fontSize:"15px", lineHeight:1, flexShrink:0}}><Asset id={`item-${g.id}`} emoji={g.emoji} size={15} /></span>
              <span style={{flex:1, minWidth:0}}>
                <span style={{color:C.cyan, fontSize:"9px", fontWeight:"bold", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{g.name}</span>
                <span style={{display:"flex", gap:"2px", marginTop:"3px", flexWrap:"wrap", alignItems:"center"}}>
                  {Array(Math.min(uses, 10)).fill(0).map((_,pi) => (
                    <span key={pi} style={{
                      display:"inline-block", width:"9px", height:"5px",
                      background:C.cyan, border:`1px solid ${C.cyan}aa`,
                      boxShadow:`0 0 4px ${C.cyan}88`, flexShrink:0,
                    }}/>
                  ))}
                  {uses > 10 && <span style={{color:C.cyan, fontSize:"7px", marginLeft:"2px"}}>{uses}</span>}
                </span>
              </span>
            </div>
            </Tooltip>
          </>
        );
      })()}
      <div style={{color: locked ? C.orange : C.dim, fontSize:"8px", textAlign:"center", marginTop:"4px", lineHeight:"1.4", opacity: locked ? 0.8 : 0.5}}>
        {locked ? <>🔒 finisci il<br/>grattino prima</> : <>clicca per<br/>cambiare</>}
      </div>
    </div>
  );
}

export const NailSidebar = memo(NailSidebarImpl);
