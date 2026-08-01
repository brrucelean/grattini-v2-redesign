import { useState, useEffect, memo } from "react";
import { C } from "../data/theme.js";
import { BIOME_PALETTE } from "../data/biomes.js";
import { AudioEngine } from "../audio.js";
import { S } from "../utils/styles.js";
import { fmtMoney } from "../utils/money.js";
import { GRATTATORE_DEFS } from "../data/items.js";
import { Tooltip } from "./Tooltip.jsx";
import { NewsTicker } from "./NewsTicker.jsx";
import { Asset } from "./Asset.jsx";
import { ANIM } from "../styles/animations.js";

// ─── StatusChip: pill riutilizzabile per status effects dell'HUD ───
// Style unificato: gradient sottile + border colorato + neon glow.
// varianti:
//  - normal: chip standard
//  - danger: border più marcato + pulse animation
//  - active: più glow + textShadow (per effetti attivi tipo cappello)
function StatusChip({ color, children, danger = false, active = false, onClick, pulse = false, pulseSpeed = "1s", style = {} }) {
  return (
    <span onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap:"3px",
      background: `linear-gradient(180deg, ${color}1c, ${color}06)`,
      border: `2px solid ${color}${danger ? "dd" : "88"}`,
      color, fontSize:"11px", fontWeight: active ? "bold" : "normal",
      padding:"2px 7px", letterSpacing:"0.5px",
      boxShadow: active
        ? `0 0 8px ${color}aa, inset 0 0 6px ${color}18`
        : danger
          ? `0 0 6px ${color}88, inset 0 0 4px ${color}14`
          : `inset 0 0 6px ${color}10`,
      textShadow: active ? `0 0 6px ${color}cc` : "none",
      cursor: onClick ? "pointer" : "default",
      animation: pulse ? `pulse ${pulseSpeed} infinite` : "none",
      userSelect:"none",
      ...style,
    }}>{children}</span>
  );
}

function HUDImpl({ player, onOpenInventory, inventoryOpen = false, moneyBling = 0, currentBiome = 0 }) {
  const bioPal = BIOME_PALETTE[currentBiome] || BIOME_PALETTE[0];
  const aliveNails = player.nails.filter(n => n.state !== "morta").length;
  const [vol, setVol] = useState(AudioEngine.getVolume());
  // ── Responsive: traccia larghezza viewport per nascondere elementi non-critici
  //   quando il canvas 16:9 diventa stretto (es. schermi piccoli / finestre ridotte)
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const compact = vw < 900;   // sotto 900px nascondi ticker nel panel
  const mobile  = vw < 600;   // mobile: layout single-row compatto
  const handleVol = (e) => {
    const v = parseFloat(e.target.value);
    setVol(v);
    AudioEngine.setVolume(v);
  };
  const muted = vol === 0;

  // ── STATUS CHIPS — usati sia in desktop che mobile ──
  const ownedCards = player.scratchCards.filter(c => c.owned).length;
  const viteColor = aliveNails <= 1 ? C.red : aliveNails <= 2 ? C.orange : C.green;

  const statusChips = (
    <>
      {player.items.includes("cappelloSbirro") && (
        <Tooltip text={player.cappelloSbirroWorn ? "🎩 INDOSSATO — clicca per toglierlo." : "🎩 In borsa — non ti protegge! Clicca per indossarlo."}>
          <StatusChip color={player.cappelloSbirroWorn ? C.gold : C.dim} active={player.cappelloSbirroWorn} onClick={onOpenInventory}>
            <Asset id="hud-cappello" emoji="🎩" size={13} />{player.cappelloSbirroWorn ? "▲" : "▼"}
          </StatusChip>
        </Tooltip>
      )}
      {player.clipViraleActive && (
        <Tooltip text="🎬 CLIP VIRALE ATTIVA! Prossima vincita x2!">
          <StatusChip color={C.gold} active pulse pulseSpeed="1s"><Asset id="hud-clip" emoji="🎬" size={13} /> x2</StatusChip>
        </Tooltip>
      )}
      {player.equippedGrattatore && (
        <Tooltip text={`${player.equippedGrattatore.name} — ${GRATTATORE_DEFS[player.equippedGrattatore.id]?.desc || "grattatore equipaggiato"}\n\n${player.equippedGrattatore.usesLeft} usi rimasti`}>
          <StatusChip color={C.cyan}><Asset id={`item-${player.equippedGrattatore.id}`} emoji={player.equippedGrattatore.emoji} size={13} /> <b>{player.equippedGrattatore.usesLeft}</b></StatusChip>
        </Tooltip>
      )}
      {player.fortune > 0 && (
        <Tooltip text={`🍀 FORTUNA +${player.fortune} — ${player.fortuneTurns} turni rimasti`}>
          <StatusChip color={C.green} active><Asset id="hud-fortuna" emoji="🍀" size={13} /> +{player.fortune}<span style={{fontSize:"10px", opacity:0.65, marginLeft:"2px"}}>({player.fortuneTurns}t)</span></StatusChip>
        </Tooltip>
      )}
      {player.tumore && (
        <Tooltip text="💀 TUMORE AI POLMONI — -5 Fortuna permanente.">
          <StatusChip color={C.red} danger pulse pulseSpeed="1.5s"><Asset id="hud-tumore" emoji="💀" size={13} /> −5F</StatusChip>
        </Tooltip>
      )}
      {player.skills?.includes("ambidestri") && (
        <StatusChip color={C.magenta} active>🙌</StatusChip>
      )}
      {player.grattaMania && (
        <Tooltip text="⚡ GRATTAMANIA — Premi x2 MA ogni grattata fa danni!">
          <StatusChip color={C.red} danger pulse pulseSpeed="0.6s"><Asset id="hud-grattamania" emoji="⚡" size={13} />☠</StatusChip>
        </Tooltip>
      )}
      {player.relics?.length > 0 && player.relics.map((r, i) => (
        <Tooltip key={i} text={`${r.emoji} ${r.name} — ${r.desc}`}>
          <StatusChip color={C.magenta} active><Asset id={`item-${r.id}`} emoji={r.emoji} size={13} /></StatusChip>
        </Tooltip>
      ))}
    </>
  );

  const hasStatusChips = player.items.includes("cappelloSbirro") || player.clipViraleActive
    || player.equippedGrattatore || player.fortune > 0 || player.tumore
    || player.skills?.includes("ambidestri") || player.grattaMania || player.relics?.length > 0;

  // ── MOBILE HUD: riga singola pulita ─────────────────────────────
  if (mobile) {
    const tot = (player?.items?.length||0) + (player?.grattatori?.length||0);
    return (
      <div style={{
        display:"flex", flexDirection:"column",
        background: bioPal.hudBg,
        border:`2px solid ${bioPal.border}77`,
        margin:"4px 8px",
        boxShadow:`3px 3px 0 #000000, 0 0 16px ${bioPal.border}18`,
        fontFamily: "inherit",
        overflow:"hidden",
        transition:"border-color 0.6s, box-shadow 0.6s, background 0.6s",
      }}>
        {/* ── Riga principale ── */}
        <div style={{display:"flex", alignItems:"center", gap:"6px", padding:"5px 10px", minHeight:"36px"}}>
          {/* Soldi */}
          <span key={moneyBling} style={{
            display:"inline-flex", alignItems:"center", gap:"4px",
            background:`linear-gradient(135deg, ${C.gold}28, ${C.gold}0a)`,
            border:`2px solid ${C.gold}cc`,
            color:C.gold, fontWeight:"bold", fontSize:"14px",
            padding:"2px 8px",
            boxShadow:`0 0 8px ${C.gold}55, inset 0 0 8px ${C.gold}0a`,
            textShadow:`0 0 8px ${C.gold}99`,
            animation: moneyBling > 0 ? "moneyBling 0.6s ease-out" : "none",
            cursor:"default", flexShrink:0,
          }}><Asset id="hud-soldi" emoji="💰" size={15} style={{marginRight:"1px"}} /> €{fmtMoney(player.money)}</span>
          {/* Grattini */}
          <span style={{
            display:"inline-flex", alignItems:"center", gap:"3px",
            color:C.cyan, fontSize:"12px",
            border:`2px solid ${C.cyan}88`,
            background:`${C.cyan}0a`,
            padding:"2px 6px", flexShrink:0,
            boxShadow:`inset 0 0 6px ${C.cyan}14`,
          }}>🎫<b>{ownedCards}</b></span>
          {/* Spacer */}
          <span style={{flex:1}} />
          {/* VITE pips compatti */}
          <span style={{
            display:"inline-flex", alignItems:"center", gap:"4px",
            border:`1px solid ${viteColor}88`,
            padding:"2px 6px", flexShrink:0,
            background: aliveNails <= 1 ? "#1a0005" : "transparent",
            animation: aliveNails <= 1 ? ANIM.pulseActive : "none",
          }}>
            <span style={{display:"inline-flex", gap:"2px"}}>
              {[0,1,2,3,4].map(i => {
                const filled = i < aliveNails;
                return (
                  <span key={i} style={{
                    display:"inline-block", width:"7px", height:"11px",
                    background: filled ? viteColor : "#111",
                    border:`2px solid ${filled ? viteColor+"ee" : "#333344"}`,
                    boxShadow: filled ? `0 0 4px ${viteColor}88` : "none",
                  }}/>
                );
              })}
            </span>
            <span style={{color:viteColor, fontSize:"13px", fontWeight:"bold"}}>{aliveNails}/5</span>
          </span>
          {/* Volume icona (no slider) */}
          <span
            style={{cursor:"pointer", fontSize:"16px", userSelect:"none", flexShrink:0}}
            onClick={() => { const v = muted ? 0.7 : 0; setVol(v); AudioEngine.setVolume(v); }}
          >{muted ? "🔇" : "🔊"}</span>
          {/* Inventario */}
          {onOpenInventory && (
            <span
              onClick={onOpenInventory}
              style={{
                display:"inline-flex", alignItems:"center", gap:"2px",
                color: inventoryOpen || tot > 0 ? C.magenta : C.dim,
                border:`2px solid ${inventoryOpen || tot > 0 ? C.magenta : C.dim}88`,
                padding:"1px 5px", fontSize:"12px",
                background: inventoryOpen ? `${C.magenta}18` : "transparent",
                cursor:"pointer", flexShrink:0,
              }}
            >🎒<b style={{fontSize:"11px"}}>{tot}</b></span>
          )}
        </div>
        {/* ── Status chips: riga aggiuntiva solo se ci sono effetti attivi ── */}
        {hasStatusChips && (
          <div style={{
            display:"flex", alignItems:"center", flexWrap:"wrap", gap:"4px",
            padding:"3px 10px 5px",
            borderTop:`1px solid ${C.dim}33`,
          }}>
            {statusChips}
          </div>
        )}
      </div>
    );
  }

  // ── DESKTOP HUD: layout completo ────────────────────────────────
  // Divider Vintage fra gruppi del HUD
  const Sep = () => (
    <span style={{color:C.dim+"66", fontSize:"10px", userSelect:"none", margin:"0 2px"}}>│</span>
  );
  return (
    <div style={{...S.panel, display:"flex", justifyContent:"space-between", alignItems:"center",
      flexWrap:"wrap", gap:"8px", padding:"10px 14px", background: bioPal.hudBg, border: `2px solid ${bioPal.border}66`,
      maxWidth:"calc(100% - 16px)", width:"calc(100% - 16px)", margin:"4px 8px",
      boxSizing:"border-box", overflow:"hidden", minWidth:0,
      position:"relative",
      boxShadow:`4px 4px 0 #000000, 0 0 18px ${bioPal.border}22, inset 0 0 16px #00000099`,
      transition:"border-color 0.6s, box-shadow 0.6s, background 0.6s",
    }}>
      {/* ── Corner brackets — biome-tinted ── */}
      {["tl","tr","bl","br"].map(pos => {
        const [v,h] = pos.split("");
        return (
          <span key={pos} style={{
            position:"absolute",
            [v==="t"?"top":"bottom"]:"-2px",
            [h==="l"?"left":"right"]:"-2px",
            width:"12px", height:"12px",
            borderTop: v==="t" ? `2px solid ${bioPal.border}99` : "none",
            borderBottom: v==="b" ? `2px solid ${bioPal.border}99` : "none",
            borderLeft: h==="l" ? `2px solid ${bioPal.border}99` : "none",
            borderRight: h==="r" ? `2px solid ${bioPal.border}99` : "none",
            boxShadow:`0 0 6px ${bioPal.border}77`,
            pointerEvents:"none",
            transition:"border-color 0.6s, box-shadow 0.6s",
          }}/>
        );
      })}
      {/* ── SINISTRA: soldi + grattini ── */}
      <div style={{display:"flex", alignItems:"center", gap:"8px", flexShrink:0, minWidth:0}}>
        <Tooltip text={`🤑 i tuoi SUDATISSIMI soldi!! spendili bene o piangi`}>
          <span key={moneyBling} style={{
            display:"inline-flex", alignItems:"center", gap:"4px",
            background:`linear-gradient(180deg, ${C.gold}22, ${C.gold}08)`,
            border:`2px solid ${C.gold}cc`,
            color:C.gold, fontWeight:"bold", fontSize:"18px",
            padding:"4px 12px",
            letterSpacing:"1px",
            boxShadow:`0 0 8px ${C.gold}55, inset 0 0 6px ${C.gold}14`,
            textShadow:`0 0 6px ${C.gold}88`,
            cursor:"default",
            animation: moneyBling > 0 ? "moneyBling 0.6s ease-out" : "none",
          }}><Asset id="hud-soldi" emoji="💰" size={22} style={{marginRight:"1px"}} /> €{fmtMoney(player.money)}</span>
        </Tooltip>
        <Tooltip text={`🎫 grattini tuoi — comprati al tabaccaio`}>
          <span style={{
            display:"inline-flex", alignItems:"center", gap:"3px",
            color:C.cyan, cursor:"default", fontSize:"16px",
            border:`2px solid ${C.cyan}88`,
            padding:"4px 10px",
            boxShadow:`inset 0 0 6px ${C.cyan}18`,
          }}><Asset id="hud-grattino" emoji="🎫" size={22} style={{marginRight:"1px"}} /> <b>{ownedCards}</b></span>
        </Tooltip>
      </div>
      {/* ── STATUS CHIPS ── */}
      {statusChips}
      {/* ── CENTRO: news ticker (nascosto quando lo spazio manca) ── */}
      {!compact && <NewsTicker currentBiome={currentBiome} />}
      {/* ── DESTRA: vite + volume ── */}
      <div style={{display:"flex", alignItems:"center", gap:"8px", flexShrink:0, minWidth:0, flexWrap:"wrap", justifyContent:"flex-end"}}>
        <Tooltip text={`💀 unghie ancora vive su 5 — se arrivano a 0 sei MORTO poverino`}>
          <span style={{
            display:"inline-flex", alignItems:"center", gap:"5px",
            border:`1px solid ${viteColor}88`,
            padding:"2px 7px", cursor:"default",
            background: aliveNails <= 1 ? "#1a0005" : "transparent",
            boxShadow: aliveNails <= 1 ? `0 0 6px ${C.red}66, inset 0 0 4px ${C.red}22` : "none",
            animation: aliveNails <= 1 ? ANIM.pulseActive : "none",
          }}>
            <span style={{color:C.dim, fontSize:"11px", letterSpacing:"1px"}}>VITE</span>
            <span style={{display:"inline-flex", gap:"2px"}}>
              {[0,1,2,3,4].map(i => {
                const filled = i < aliveNails;
                return (
                  <span key={i} style={{
                    display:"inline-block", width:"10px", height:"16px",
                    background: filled ? viteColor : "#111",
                    border: `2px solid ${filled ? viteColor+"ee" : "#333344"}`,
                    boxShadow: filled ? `0 0 6px ${viteColor}99, 0 0 12px ${viteColor}44` : "none",
                  }}/>
                );
              })}
            </span>
            <span style={{color:viteColor, fontSize:"13px", fontWeight:"bold"}}>{aliveNails}/5</span>
          </span>
        </Tooltip>
        <Tooltip text={`🔊 volume musicale — alzalo e GODITI l'8-bit bro`}>
          <span style={{display:"flex", alignItems:"center", gap:"4px"}}>
            <span
              style={{cursor:"pointer", fontSize:"14px", userSelect:"none"}}
              onClick={() => { const v = muted ? 0.7 : 0; setVol(v); AudioEngine.setVolume(v); }}
            >{muted ? "🔇" : vol < 0.4 ? "🔈" : "🔊"}</span>
            <input
              type="range" min="0" max="1" step="0.05" value={vol}
              onChange={handleVol}
              style={{
                width: compact ? "36px" : "60px", height:"4px", cursor:"pointer", accentColor: C.gold,
                background:"transparent",
              }}
            />
          </span>
        </Tooltip>
        {onOpenInventory && (() => {
          const tot = (player?.items?.length||0) + (player?.grattatori?.length||0);
          // Lo zaino è l'unico comando cliccabile della barra: prima era uno
          // StatusChip da 11px identico a quelli informativi e sbiadito a 0.7
          // di opacità quando vuoto, quindi non si notava. Ora è un pulsante
          // pieno, con etichetta e pastiglia del conteggio.
          const col = tot > 0 || inventoryOpen ? C.gold : C.dim;
          return (
            <Tooltip text={inventoryOpen ? "" : "cosa hai nello zaino? forse niente, forse oro"}>
              <span
                onClick={onOpenInventory}
                style={{
                  display:"inline-flex", alignItems:"center", gap:"6px",
                  padding:"4px 12px", cursor:"pointer", userSelect:"none",
                  border:`2px solid ${col}`, color:col, fontWeight:"bold",
                  background: inventoryOpen
                    ? `linear-gradient(180deg, ${col}38, ${col}12)`
                    : `linear-gradient(180deg, ${col}18, transparent)`,
                  boxShadow: `0 0 10px ${col}55, inset 0 0 8px ${col}14`,
                  transition:"box-shadow 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 18px ${col}, inset 0 0 10px ${col}22`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 10px ${col}55, inset 0 0 8px ${col}14`; }}
              >
                <Asset id="hud-zaino" emoji="🎒" size={26} />
                {!compact && <span style={{fontSize:"10px", letterSpacing:"1.5px"}}>ZAINO</span>}
                <span style={{
                  minWidth:"20px", textAlign:"center", fontSize:"14px",
                  background: col, color:"#000", padding:"0 5px",
                  boxShadow:`0 0 6px ${col}aa`,
                }}>{tot}</span>
              </span>
            </Tooltip>
          );
        })()}
      </div>
    </div>
  );
}

export const HUD = memo(HUDImpl);
