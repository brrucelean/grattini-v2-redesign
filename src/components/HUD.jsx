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
import { ANIM, LOOP } from "../styles/animations.js";
import { NailPipRow } from "./NailMeter.jsx";

// ─── SCALA HUD ───────────────────────────────────────────────────
// Una sola tabella di misure per tutta la barra. Prima ogni pastiglia si
// dimensionava per conto suo e nella stessa riga convivevano box alti
// 37 / 34 / 28 / 24 / 20px con sei corpi di testo diversi: la barra sembrava
// montata a pezzi. Ora l'altezza è unica (h) e le uniche differenze sono
// deliberate e leggibili: i soldi hanno il corpo maggiore (1° livello), i
// contatori il corpo medio, le etichette il minore, gli status chip stanno
// su un gradino più basso (hChip) perché sono informazione secondaria.
const HUD_SCALE = {
  desk:   { h: 34, hChip: 24, fsMoney: 18, fsValue: 15, fsLabel: 10, fsChip: 11,
            icon: 20, iconMoney: 22, iconChip: 13, padX: 11, padXChip: 8, gap: 6 },
  mobile: { h: 28, hChip: 22, fsMoney: 14, fsValue: 12, fsLabel: 9,  fsChip: 11,
            icon: 16, iconMoney: 17, iconChip: 13, padX: 8,  padXChip: 6, gap: 4 },
};

// ─── HudPill: la pastiglia della barra — altezza, padding e bordo in un posto solo ───
function HudPill({ color, u, strong = false, onClick, children, style = {}, ...rest }) {
  return (
    <span onClick={onClick} {...rest} style={{
      display:"inline-flex", alignItems:"center", gap:`${u.gap}px`,
      height:`${u.h}px`, boxSizing:"border-box", padding:`0 ${u.padX}px`,
      border:`2px solid ${color}${strong ? "cc" : "88"}`,
      color, lineHeight:1, flexShrink:0, whiteSpace:"nowrap",
      cursor: onClick ? "pointer" : "default", userSelect:"none",
      ...style,
    }}>{children}</span>
  );
}

// ─── StatusChip: pill riutilizzabile per status effects dell'HUD ───
// Style unificato: gradient sottile + border colorato + neon glow.
// varianti:
//  - normal: chip standard
//  - danger: border più marcato + pulse animation
//  - active: più glow + textShadow (per effetti attivi tipo cappello)
function StatusChip({ color, children, danger = false, active = false, onClick, pulse = false, pulseSpeed = LOOP.active, u = HUD_SCALE.desk, style = {} }) {
  return (
    <span onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap:"4px",
      height:`${u.hChip}px`, boxSizing:"border-box", padding:`0 ${u.padXChip}px`,
      lineHeight:1, whiteSpace:"nowrap", flexShrink:0,
      background: `linear-gradient(180deg, ${color}1c, ${color}06)`,
      border: `2px solid ${color}${danger ? "dd" : "88"}`,
      color, fontSize:`${u.fsChip}px`, fontWeight: active ? "bold" : "normal",
      letterSpacing:"0.5px",
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

function HUDImpl({ player, onOpenInventory, inventoryOpen = false, moneyBling = 0, currentBiome = 0, hideInventoryButton = false }) {
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
  const u = mobile ? HUD_SCALE.mobile : HUD_SCALE.desk;   // scala unica della barra
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
          <StatusChip u={u} color={player.cappelloSbirroWorn ? C.gold : C.dim} active={player.cappelloSbirroWorn} onClick={onOpenInventory}>
            <Asset id="hud-cappello" emoji="🎩" size={u.iconChip} />{player.cappelloSbirroWorn ? "▲" : "▼"}
          </StatusChip>
        </Tooltip>
      )}
      {player.clipViraleActive && (
        <Tooltip text="🎬 CLIP VIRALE ATTIVA! Prossima vincita x2!">
          <StatusChip u={u} color={C.gold} active pulse pulseSpeed={LOOP.active}><Asset id="hud-clip" emoji="🎬" size={u.iconChip} /> x2</StatusChip>
        </Tooltip>
      )}
      {player.equippedGrattatore && (
        <Tooltip text={`${player.equippedGrattatore.name} — ${GRATTATORE_DEFS[player.equippedGrattatore.id]?.desc || "grattatore equipaggiato"}\n\n${player.equippedGrattatore.usesLeft} usi rimasti`}>
          <StatusChip u={u} color={C.cyan}><Asset id={`item-${player.equippedGrattatore.id}`} emoji={player.equippedGrattatore.emoji} size={u.iconChip} /> <b>{player.equippedGrattatore.usesLeft}</b></StatusChip>
        </Tooltip>
      )}
      {player.fortune > 0 && (
        <Tooltip text={`🍀 FORTUNA +${player.fortune} — ${player.fortuneTurns} turni rimasti`}>
          <StatusChip u={u} color={C.green} active><Asset id="hud-fortuna" emoji="🍀" size={u.iconChip} /> +{player.fortune}<span style={{fontSize:"10px", opacity:0.65, marginLeft:"2px"}}>({player.fortuneTurns}t)</span></StatusChip>
        </Tooltip>
      )}
      {player.tumore && (
        <Tooltip text="💀 TUMORE AI POLMONI — -5 Fortuna permanente.">
          <StatusChip u={u} color={C.red} danger pulse pulseSpeed={LOOP.active}><Asset id="hud-tumore" emoji="💀" size={u.iconChip} /> −5F</StatusChip>
        </Tooltip>
      )}
      {player.skills?.includes("ambidestri") && (
        <StatusChip u={u} color={C.magenta} active>🙌</StatusChip>
      )}
      {player.grattaMania && (
        <Tooltip text="⚡ GRATTAMANIA — Premi x2 MA ogni grattata fa danni!">
          <StatusChip u={u} color={C.red} danger pulse pulseSpeed={LOOP.urgent}><Asset id="hud-grattamania" emoji="⚡" size={u.iconChip} />☠</StatusChip>
        </Tooltip>
      )}
      {player.relics?.length > 0 && player.relics.map((r, i) => (
        <Tooltip key={i} text={`${r.emoji} ${r.name} — ${r.desc}`}>
          <StatusChip u={u} color={C.magenta} active><Asset id={`item-${r.id}`} emoji={r.emoji} size={u.iconChip} /></StatusChip>
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
        <div style={{display:"flex", alignItems:"center", gap:"6px", padding:"5px 8px", minHeight:`${u.h + 10}px`}}>
          {/* Soldi */}
          <HudPill key={moneyBling} u={u} color={C.gold} strong style={{
            background:`linear-gradient(135deg, ${C.gold}28, ${C.gold}0a)`,
            fontWeight:"bold", fontSize:`${u.fsMoney}px`,
            boxShadow:`0 0 8px ${C.gold}55, inset 0 0 8px ${C.gold}0a`,
            textShadow:`0 0 8px ${C.gold}99`,
            animation: moneyBling > 0 ? "moneyBling 0.6s ease-out" : "none",
          }}><Asset id="hud-soldi" emoji="💰" size={u.iconMoney} /> €{fmtMoney(player.money)}</HudPill>
          {/* Grattini */}
          <HudPill u={u} color={C.cyan} style={{
            fontSize:`${u.fsValue}px`,
            background:`${C.cyan}0a`,
            boxShadow:`inset 0 0 6px ${C.cyan}14`,
          }}><Asset id="hud-grattino" emoji="🎫" size={u.icon} /><b>{ownedCards}</b></HudPill>
          {/* Spacer */}
          <span style={{flex:1}} />
          {/* VITE pips compatti */}
          <HudPill u={u} color={viteColor} style={{
            background: aliveNails <= 1 ? "#1a0005" : "transparent",
            animation: aliveNails <= 1 ? ANIM.pulseActive : "none",
          }}>
            {/* Stessa pip del combattimento (NailMeter): mostra lo stato REALE di
                ogni unghia, non 5 tacche anonime tutte dello stesso colore. */}
            <NailPipRow nails={player.nails} size="sm" gap={2} />
            <span style={{color:viteColor, fontSize:`${u.fsValue}px`, fontWeight:"bold"}}>{aliveNails}/5</span>
          </HudPill>
          {/* Volume icona (no slider) */}
          <HudPill u={u} color={C.dim}
            onClick={() => { const v = muted ? 0.7 : 0; setVol(v); AudioEngine.setVolume(v); }}
            style={{fontSize:`${u.icon - 2}px`, padding:`0 ${u.padXChip}px`}}
          >{muted ? "🔇" : "🔊"}</HudPill>
          {/* Inventario — nascosto quando la fiancata ZAINO è già a vista
              (tabaccaio, desktop largo): stesso comando due volte è rumore. */}
          {onOpenInventory && !hideInventoryButton && (
            <HudPill
              u={u}
              color={inventoryOpen || tot > 0 ? C.magenta : C.dim}
              onClick={onOpenInventory}
              style={{
                fontSize:`${u.fsValue}px`,
                background: inventoryOpen ? `${C.magenta}18` : "transparent",
              }}
            ><Asset id="hud-zaino" emoji="🎒" size={u.icon} /><b>{tot}</b></HudPill>
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
          <HudPill key={moneyBling} u={u} color={C.gold} strong style={{
            background:`linear-gradient(180deg, ${C.gold}22, ${C.gold}08)`,
            fontWeight:"bold", fontSize:`${u.fsMoney}px`, letterSpacing:"1px",
            boxShadow:`0 0 8px ${C.gold}55, inset 0 0 6px ${C.gold}14`,
            textShadow:`0 0 6px ${C.gold}88`,
            animation: moneyBling > 0 ? "moneyBling 0.6s ease-out" : "none",
          }}><Asset id="hud-soldi" emoji="💰" size={u.iconMoney} /> €{fmtMoney(player.money)}</HudPill>
        </Tooltip>
        <Tooltip text={`🎫 grattini tuoi — comprati al tabaccaio`}>
          <HudPill u={u} color={C.cyan} style={{
            fontSize:`${u.fsValue}px`,
            boxShadow:`inset 0 0 6px ${C.cyan}18`,
          }}><Asset id="hud-grattino" emoji="🎫" size={u.icon} /> <b>{ownedCards}</b></HudPill>
        </Tooltip>
      </div>
      {/* ── STATUS CHIPS ── */}
      {statusChips}
      {/* ── CENTRO: news ticker (nascosto quando lo spazio manca) ── */}
      {!compact && <NewsTicker currentBiome={currentBiome} />}
      {/* ── DESTRA: vite + volume ── */}
      <div style={{display:"flex", alignItems:"center", gap:"8px", flexShrink:0, minWidth:0, flexWrap:"wrap", justifyContent:"flex-end"}}>
        <Tooltip text={`💀 unghie ancora vive su 5 — se arrivano a 0 sei MORTO poverino`}>
          <HudPill u={u} color={viteColor} style={{
            background: aliveNails <= 1 ? "#1a0005" : "transparent",
            boxShadow: aliveNails <= 1 ? `0 0 6px ${C.red}66, inset 0 0 4px ${C.red}22` : "none",
            animation: aliveNails <= 1 ? ANIM.pulseActive : "none",
          }}>
            <span style={{color:C.dim, fontSize:`${u.fsLabel}px`, letterSpacing:"1.5px"}}>VITE</span>
            {/* Pattern compatto condiviso (NailMeter) — identico a combattimento
                e HUD mobile: colore = stato dell'unghia, riempimento = grattate
                rimaste, ✕ tratteggiato = morta, ◆ = unghia nera. */}
            <NailPipRow nails={player.nails} size="md" gap={3} />
            <span style={{color:viteColor, fontSize:`${u.fsValue}px`, fontWeight:"bold"}}>{aliveNails}/5</span>
          </HudPill>
        </Tooltip>
        <Tooltip text={`🔊 volume musicale — alzalo e GODITI l'8-bit bro`}>
          <HudPill u={u} color={C.dim} style={{boxShadow:`inset 0 0 6px ${C.dim}18`}}>
            <span
              style={{cursor:"pointer", fontSize:`${u.icon - 3}px`, userSelect:"none", lineHeight:1}}
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
          </HudPill>
        </Tooltip>
        {onOpenInventory && !hideInventoryButton && (() => {
          const tot = (player?.items?.length||0) + (player?.grattatori?.length||0);
          // Lo zaino è l'unico comando cliccabile della barra: prima era uno
          // StatusChip da 11px identico a quelli informativi e sbiadito a 0.7
          // di opacità quando vuoto, quindi non si notava. Ora è un pulsante
          // pieno, con etichetta e pastiglia del conteggio — ma sulla stessa
          // altezza delle altre pastiglie: si distingue per colore e glow,
          // non perché è più alto di tutto il resto (prima 40px contro 28).
          const col = tot > 0 || inventoryOpen ? C.gold : C.dim;
          return (
            <Tooltip text={inventoryOpen ? "" : "cosa hai nello zaino? forse niente, forse oro"}>
              <HudPill
                u={u} color={col} strong
                onClick={onOpenInventory}
                style={{
                  fontWeight:"bold",
                  border:`2px solid ${col}`,
                  background: inventoryOpen
                    ? `linear-gradient(180deg, ${col}38, ${col}12)`
                    : `linear-gradient(180deg, ${col}18, transparent)`,
                  boxShadow: `0 0 10px ${col}55, inset 0 0 8px ${col}14`,
                  transition:"box-shadow 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 18px ${col}, inset 0 0 10px ${col}22`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 10px ${col}55, inset 0 0 8px ${col}14`; }}
              >
                <Asset id="hud-zaino" emoji="🎒" size={u.icon} />
                {!compact && <span style={{fontSize:`${u.fsLabel}px`, letterSpacing:"1.5px"}}>ZAINO</span>}
                <span style={{
                  minWidth:"20px", textAlign:"center", fontSize:`${u.fsValue}px`,
                  background: col, color:"#000", padding:"1px 5px",
                  boxShadow:`0 0 6px ${col}aa`,
                }}>{tot}</span>
              </HudPill>
            </Tooltip>
          );
        })()}
      </div>
    </div>
  );
}

export const HUD = memo(HUDImpl);
