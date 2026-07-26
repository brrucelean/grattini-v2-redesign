import { useState } from "react";
import { C, FONT } from "../data/theme.js";
import { NAIL_INFO, NAIL_ORDER } from "../data/nails.js";
import { GRATTATORE_DEFS, ALL_IMPLANTS_META, CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { makeNailCursor, NAIL_CURSOR, getNailVisual } from "../utils/nail.js";
import { Tooltip } from "./Tooltip.jsx";
import { VintageBadge } from "./Vintage.jsx";
import { Asset } from "./Asset.jsx";

// Chirurgo implants: slot totali e colore per tipo
const CHIRURGO_SLOTS = {
  plastica: { max: 2, color: "#44ddee", label: "PLASTICA" },
  ferro:    { max: 4, color: "#c0c0d0", label: "FERRO" },
  oro:      { max: 5, color: "#ffd700", label: "ORO" },
};

export function NailSidebar({ nails, activeNail, onSelectNail, locked=false, grattatori=[], equippedGrattatore=null, onEquipGrattatore=null, horizontal=false }) {
  // Alive tiers in order worst→best (excluding morta)
  const TIER_ORDER = ["marcia","sanguinante","graffiata","sana","kawaii"];
  const TIER_COLORS = { marcia:C.red, sanguinante:C.orange, graffiata:C.gold, sana:C.green, kawaii:C.pink };
  // Sprint 2: stati speciali fuori catena — mappa pip all'equivalente più vicino
  const SPECIAL_TIER_MAP = { polliceVerde: "kawaii", unghiaNera: "marcia" };
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
        // HP pips: how many tiers still alive
        const pipState = SPECIAL_TIER_MAP[n.state] || n.state;
        const tierIdx = TIER_ORDER.indexOf(pipState); // -1 if morta, 0-4 otherwise
        const aliveTiers = isDead ? 0 : tierIdx + 1; // 1-5 pips filled
        // Smalto: colpi protetti → riempi pip vuoti dei tier con rosa (kawaii),
        // poi se ne avanzano aggiungili come pip extra dopo (come cremaHP).
        const smaltoCount = isDead ? 0 : (n.smalto || 0);
        const emptyTiers = Math.max(0, TIER_ORDER.length - aliveTiers);
        const smaltoInTiers = Math.min(emptyTiers, smaltoCount);
        const smaltoExtra = Math.max(0, smaltoCount - smaltoInTiers);
        // Scratch damage bar within current tier (3 ticks)
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
              const stateLabel = isDead ? "MORTA"
                : chirurgo ? chirurgo.label
                : n.state === "sanguinante" ? "SANGUIN."
                : n.state === "graffiata"   ? "GRAFFIAT"
                : n.state === "polliceVerde" ? "🌿VERDE"
                : n.state === "unghiaNera"   ? "🖤NERA"
                : info.label.toUpperCase();
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
                    {/* Etichetta stato */}
                    <span style={{
                      color: isDead ? "#444" : isActive ? col : col+"aa",
                      fontSize:"7px", fontWeight: isActive ? "bold" : "normal",
                      letterSpacing:"0.4px", lineHeight:1.1,
                      maxWidth:"64px", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap",
                      textAlign:"center",
                      textShadow: isActive && !isDead ? `0 0 6px ${col}88` : "none",
                    }}>{stateLabel}</span>
                    {/* HP tier pips */}
                    <span style={{display:"flex", gap:"1px", alignItems:"center"}}>
                      {TIER_ORDER.map((tier, ti) => {
                        const filled = ti < aliveTiers;
                        const isSmaltoPip = !filled && ti < aliveTiers + smaltoInTiers;
                        if (isSmaltoPip) return <span key={ti} style={{display:"inline-block", width:"7px", height:"4px", background:C.pink, border:`1px solid ${C.pink}aa`, flexShrink:0}}/>;
                        const pipCol = filled ? TIER_COLORS[tier] : "#222";
                        return <span key={ti} style={{display:"inline-block", width:"7px", height:"4px", background: filled ? pipCol : "#111", border:`1px solid ${filled ? pipCol+"aa" : "#2a2a2a"}`, flexShrink:0}}/>;
                      })}
                    </span>
                    {/* Scratch damage ticks */}
                    {!isDead && (
                      <span style={{display:"flex", gap:"1px", alignItems:"center"}}>
                        {[0,1,2].map(t => {
                          const rem = 3 - dmgFilled;
                          return <span key={t} style={{display:"inline-block", width:"7px", height:"2px", background: t < rem ? col+"cc" : "#111", border:`1px solid ${t < rem ? col+"55" : "#222"}`, flexShrink:0}}/>;
                        })}
                      </span>
                    )}
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
                        <span style={{color: isActive ? col : col+"88", fontSize:"9px", fontWeight: isActive ? "bold" : "normal", whiteSpace:"nowrap"}}>
                          {chirurgo ? chirurgo.label : info.label}
                        </span>
                      </span>
                      {chirurgo ? (
                        // ─── CHIRURGO: slot fissi (2/4/5) colorati, niente bleeding ───
                        <span style={{display:"flex", gap:"3px", marginTop:"4px", alignItems:"center", flexWrap:"wrap"}}>
                          {Array(chirurgo.max).fill(0).map((_, si) => {
                            const filled = si < (n.implantUses || 0);
                            return (
                              <span key={si} style={{
                                display:"inline-block",
                                width: chirurgo.max === 2 ? "14px" : chirurgo.max === 4 ? "11px" : "9px",
                                height: "8px",
                                background: filled ? chirurgo.color : "#111",
                                border: `1px solid ${filled ? chirurgo.color : "#2a2a2a"}`,
                                boxShadow: filled && isActive ? `0 0 6px ${chirurgo.color}cc, inset 0 0 3px #fff3` : filled ? `0 0 3px ${chirurgo.color}66` : "none",
                                flexShrink:0,
                              }}/>
                            );
                          })}
                          <span style={{color: chirurgo.color+"aa", fontSize:"7px", marginLeft:"2px", letterSpacing:"0.5px"}}>
                            {n.implantUses || 0}/{chirurgo.max}
                          </span>
                        </span>
                      ) : (
                        <>
                          {/* HP tier pips */}
                          <span style={{display:"flex", gap:"2px", marginTop:"3px", alignItems:"center"}}>
                            {TIER_ORDER.map((tier, ti) => {
                              const filled = ti < aliveTiers;
                              // Pip vuoto coperto da smalto → riempi di rosa kawaii
                              const isSmaltoPip = !filled && ti < aliveTiers + smaltoInTiers;
                              if (isSmaltoPip) {
                                return (
                                  <span key={ti} style={{
                                    display:"inline-block", width:"9px", height:"5px",
                                    background: C.pink,
                                    border: `1px solid ${C.pink}aa`,
                                    boxShadow: isActive ? `0 0 4px ${C.pink}aa` : `0 0 2px ${C.pink}66`,
                                    flexShrink:0,
                                  }}/>
                                );
                              }
                              const pipCol = filled ? TIER_COLORS[tier] : "#222";
                              return (
                                <span key={ti} style={{
                                  display:"inline-block", width:"9px", height:"5px",
                                  background: filled ? pipCol : "#111",
                                  border: `1px solid ${filled ? pipCol+"aa" : "#2a2a2a"}`,
                                  boxShadow: filled && isActive ? `0 0 4px ${pipCol}88` : "none",
                                  flexShrink:0,
                                }}/>
                              );
                            })}
                            {/* Smalto extra: pip rosa dopo i 5 tier (se smalto > tier vuoti) */}
                            {Array(smaltoExtra).fill(0).map((_,si) => (
                              <span key={"s"+si} style={{
                                display:"inline-block", width:"9px", height:"5px",
                                background: C.pink,
                                border: `1px solid ${C.pink}aa`,
                                boxShadow: isActive ? `0 0 4px ${C.pink}aa` : `0 0 2px ${C.pink}66`,
                                flexShrink:0,
                              }}/>
                            ))}
                            {/* CremaHP white pips (extra buffer beyond kawaii) */}
                            {Array(n.cremaHP||0).fill(0).map((_,ci) => (
                              <span key={"c"+ci} style={{
                                display:"inline-block", width:"9px", height:"5px",
                                background:"#ffffff",
                                border:"1px solid #aaaaaa",
                                boxShadow: isActive ? "0 0 4px #ffffff88" : "none",
                                flexShrink:0,
                              }}/>
                            ))}
                          </span>
                          {/* Scratch damage ticks */}
                          {!isDead && (
                            <span style={{display:"flex", gap:"2px", marginTop:"2px", alignItems:"center"}}>
                              {[0,1,2].map(t => {
                                const remaining = 3 - dmgFilled;
                                const filled = t < remaining;
                                return (
                                  <span key={t} style={{
                                    display:"inline-block", width:"9px", height:"3px",
                                    background: filled ? col+"cc" : "#111",
                                    border: `1px solid ${filled ? col+"55" : "#222"}`,
                                    flexShrink:0,
                                  }}/>
                                );
                              })}
                              <span style={{color:C.dim, fontSize:"7px", marginLeft:"2px", opacity:0.6}}>{3 - dmgFilled}/3</span>
                            </span>
                          )}
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
