import { useMemo, useRef, useEffect } from "react";
import { C, FONT, FS } from "../data/theme.js";
import { NODE_ICONS, NODE_TOOLTIPS } from "../data/map.js";
import { Asset } from "./Asset.jsx";
import { hasAsset } from "../assets/registry.js";
import { BIOMES, BIOME_MODIFIERS, BOSS_SPRITE } from "../data/biomes.js";
import { Tooltip } from "./Tooltip.jsx";
import { AudioEngine } from "../audio.js";
import { Haptics } from "../utils/haptics.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

// ─── COSTANTI LAYOUT ─────────────────────────────────────────────
// Altezza riga: 88px è il minimo per il touch su iPhone 16 Pro (target ≥44pt).
// Su desktop non c'è quel vincolo, quindi la riga si stringe fino a 62px per far
// entrare l'intera run (11 righe) in una schermata senza scroll.
const ROW_H_TOUCH = 88;
const ROW_H_MIN_DESKTOP = 58;
// Ingombro di HUD, intestazione bioma e legenda attorno all'area scrollabile.
// Misurato sul DOM: 220px. Era stimato 250 — 30px buttati che impedivano
// all'ultima riga di entrare a schermo intero.
const MAP_CHROME_H = 240;
const MAP_W_MOBILE = 780;    // larghezza max su telefono
const MAP_W_DESKTOP = 1180;  // su Mac a schermo intero i nodi non restano ammassati al centro
const DANGER_TYPES = new Set(["ladro","spacciatore","miniboss","poliziotto"]);
const SAFE_TYPES   = new Set(["locanda","tabaccaio","mendicante","sacerdote","chirurgo","maestroTe"]);

const LEGEND = [
  { col:"#ff4444", label:"PERICOLO" },
  { col:"#ffdd00", label:"NEUTRO"   },
  { col:"#44dd88", label:"SICURO"   },
  { col:"#ff9ec4", label:"SEGRETO"  },
  { col:"#ff6600", label:"ELITE"    },
];

export function MapView({ map, currentRow, visitedNodes, onSelectNode, reachableNodes, currentBiome = 0, playerFortuna = 0 }) {
  const scrollRef = useRef(null);
  const { isMobile, vw, vh } = useIsMobile();

  // Su desktop comprimi le righe quanto basta a far entrare tutta la mappa
  // nell'altezza disponibile (≈ viewport meno HUD, header bioma e legenda).
  const ROW_H = useMemo(() => {
    if (isMobile) return ROW_H_TOUCH;
    const rows = map.rows.length || 1;
    const avail = Math.max(320, vh - MAP_CHROME_H);
    return Math.round(Math.min(ROW_H_TOUCH, Math.max(ROW_H_MIN_DESKTOP, avail / rows)));
  }, [isMobile, vh, map.rows.length]);

  // ── Scroll snap a scatti con suoni ────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let snapTimer = null;
    let rafId = null;
    let lastTickedRow = -1;

    const checkRowCross = () => {
      const row = Math.floor(el.scrollTop / ROW_H + 0.1);
      if (row !== lastTickedRow) {
        AudioEngine.mapTick();
        Haptics.tap();
        lastTickedRow = row;
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          checkRowCross();
          rafId = null;
        });
      }
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        const snapRow = Math.round(el.scrollTop / ROW_H);
        const targetY = snapRow * ROW_H;
        if (Math.abs(el.scrollTop - targetY) > 6) {
          el.scrollTo({ top: targetY, behavior: "smooth" });
        }
      }, 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(snapTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [map, ROW_H]);

  // ── Auto-scroll centrato con cascade tick ─────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetY = Math.max(0, currentRow * ROW_H - el.clientHeight / 2 + ROW_H / 2);
    // Cascade di scatti sul percorso
    const fromRow = Math.round(el.scrollTop / ROW_H);
    const rowDist = Math.abs(fromRow - currentRow);
    const ticks = Math.min(rowDist, 5);
    for (let i = 0; i < ticks; i++) {
      setTimeout(() => AudioEngine.mapTick(), i * 70 + 30);
    }
    el.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  }, [currentRow, map, ROW_H]);

  const rowsCount = map.rows.length || 1;
  const totalH    = rowsCount * ROW_H;
  const W         = Math.min(isMobile ? MAP_W_MOBILE : MAP_W_DESKTOP, vw - 8);

  // Nodi: dimensioni ottimizzate per iPhone 16 Pro touch target
  const maxNodesPerRow = map.rows.reduce((acc, r) => Math.max(acc, r.length), 1);
  const NW = Math.min(isMobile ? 104 : 110, Math.max(64, Math.floor(W / Math.max(1, maxNodesPerRow)) - 10));
  // L'altezza non può eccedere la riga, altrimenti i nodi si accavallano
  // verticalmente (con NW 148 il nodo era alto 107px in righe da 62px).
  // Si lascia anche uno stacco reale fra una riga e l'altra: a 12px di gap i
  // nodi si toccavano e gli archi verticali sparivano sotto i riquadri.
  const NH = Math.min(Math.round(NW * 0.86), ROW_H - 18);
  // L'etichetta è in sovrimpressione sul bordo basso, non impilata sotto lo
  // sprite: così il nodo resta compatto e l'emoji può prendersi tutta l'altezza.
  const spriteSize = (isBoss) => Math.max(18, Math.round((NH - 6) * (isBoss ? 1 : 0.9)));

  // Accorcia un arco fino al BORDO dei due nodi che collega.
  // Va calcolata l'uscita dal rettangolo del nodo, non un accorciamento
  // proporzionale sulla lunghezza: su una diagonale quest'ultimo lascia il capo
  // alla quota giusta ma spostato in orizzontale, staccato dal riquadro.
  const edgeExit = (dx, dy) => {
    const sx = dx ? (NW / 2) / Math.abs(dx) : Infinity;
    const sy = dy ? (NH / 2) / Math.abs(dy) : Infinity;
    return Math.min(sx, sy); // il lato colpito per primo
  };
  const trimEdge = (a, b) => {
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    if (!dx && !dy) return [a, b];
    const s = Math.min(edgeExit(dx, dy), 0.45); // mai oltre metà arco
    return [
      { cx: a.cx + dx * s, cy: a.cy + dy * s },
      { cx: b.cx - dx * s, cy: b.cy - dy * s },
    ];
  };

  const nodePos = useMemo(() => {
    const pos = {};
    const usableW = Math.max(NW, W - NW);
    map.rows.forEach((row, rIdx) => {
      row.forEach(node => {
        pos[node.id] = {
          cx: NW / 2 + node.x * usableW,
          cy: rIdx * ROW_H + ROW_H / 2,
        };
      });
    });
    return pos;
  }, [map, W, NW, ROW_H]);

  const edges = useMemo(() => {
    const list = [];
    Object.entries(map.connections).forEach(([fromId, toIds]) => {
      toIds.forEach(toId => {
        const fromNode = map.rows.flat().find(n => n.id === fromId);
        const toNode   = map.rows.flat().find(n => n.id === toId);
        const rowDiff  = toNode ? (toNode.row - (fromNode?.row ?? 0)) : 1;
        list.push({ fromId, toId, isShortcut: rowDiff > 1 });
      });
    });
    return list;
  }, [map]);

  const edgeColor = (toId, isActive, isPast, isShortcut) => {
    if (isPast)    return "#cc9900";
    if (!isActive) return "#1a1a2e";
    if (isShortcut) return C.magenta;
    const n = map.rows.flat().find(n => n.id === toId);
    if (!n) return `${C.gold}88`;
    if (DANGER_TYPES.has(n.type)) return `${C.red}bb`;
    if (SAFE_TYPES.has(n.type))   return `#44dd88bb`;
    if (n.type === "boss")         return `${C.red}dd`;
    if (n.type === "evento")       return `${C.magenta}99`;
    return `${C.gold}99`;
  };

  // Regola cromatica per schermata: la MAPPA è ciano-dominante (chrome/frame/header).
  // I colori dei nodi (rosso pericolo / verde sicuro / oro) restano di supporto semantico.
  const biomeColor = C.cyan;
  const biomeName  = BIOMES[currentBiome]?.name  || "Tabacchitalia Nord";
  const biomeBoss  = BIOMES[currentBiome]?.boss  || "Il Broker";
  const totalRows  = map.rows.length;
  const progressRow = Math.min(currentRow + 1, totalRows);
  const progressPct = (progressRow / totalRows) * 100;
  const BIOME_GLYPH = ["🏭","🎰","🍕","🏮"];
  const biomeGlyph  = BIOME_GLYPH[currentBiome] || "🏭";

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      border:`2px solid ${biomeColor}`,
      background:"rgba(5,5,15,0.55)",
      position:"relative", zIndex:1,
      boxShadow:`0 0 0 1px #000, 0 0 32px ${biomeColor}33`,
      flex:1, minHeight:0, overflow:"hidden",
    }}>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes mapCurrentRowPulse {
          0%,100% { background:${biomeColor}14; }
          50%      { background:${biomeColor}26; }
        }
        @keyframes mapNodeReachable {
          0%,100% { box-shadow:0 0 12px currentColor,0 0 4px currentColor inset; }
          50%      { box-shadow:0 0 26px currentColor,0 0 10px currentColor inset; }
        }
        @keyframes mapYouAreHere {
          0%,100% { opacity:1; transform:translateX(0) scaleX(1); }
          50%      { opacity:0.6; transform:translateX(3px) scaleX(1.15); }
        }
        @keyframes mapTrailFlow {
          0%   { stroke-dashoffset:24; }
          100% { stroke-dashoffset:0; }
        }
        @keyframes bossGlow {
          0%,100% { box-shadow:0 0 20px #ff2244ee,0 0 40px #ff224455,3px 3px 0 #000; }
          50%      { box-shadow:0 0 32px #ff2244ff,0 0 60px #ff224477,3px 3px 0 #000; }
        }
        @keyframes slotGlow {
          0%,100% { box-shadow:0 0 10px #cc9900cc,3px 3px 0 #000; }
          50%      { box-shadow:0 0 22px #ffcc00ee,0 0 40px #ffcc0033,3px 3px 0 #000; }
        }
        @keyframes mapRowIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes mapHeadPulse {
          0%,100% { box-shadow:inset 0 0 0 0 ${biomeColor}00; }
          50%      { box-shadow:inset 0 -2px 0 0 ${biomeColor}66; }
        }
        @keyframes progressShimmer {
          0%   { background-position:200% 0; }
          100% { background-position:-200% 0; }
        }
        .map-node-active:active { transform:scale(0.94)!important; }
      `}</style>

      {/* ══ HEADER FISSO ══════════════════════════════════════════ */}
      <div style={{
        flexShrink:0,
        background:`linear-gradient(180deg, ${biomeColor}22 0%, ${biomeColor}0a 100%)`,
        borderBottom:`2px solid ${biomeColor}88`,
        animation:"mapHeadPulse 3s ease-in-out infinite",
        padding:"0",
      }}>
        {/* riga superiore: bioma info + progresso */}
        <div style={{
          display:"flex", alignItems:"center", gap:"10px",
          padding:"8px 12px 6px",
        }}>
          {/* Glyph */}
          <span style={{
            fontSize:"28px", flexShrink:0,
            filter:`drop-shadow(0 0 8px ${biomeColor}) drop-shadow(0 0 16px ${biomeColor}66)`,
            lineHeight:1,
          }}>{biomeGlyph}</span>

          <div style={{flex:1, minWidth:0}}>
            {/* Badge bioma */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:"5px",
              marginBottom:"3px",
            }}>
              <span style={{
                background: biomeColor, color:"#000",
                fontFamily:FONT, fontWeight:"bold",
                fontSize:FS.xs, letterSpacing:"2px",
                padding:"1px 6px",
                boxShadow:`0 0 6px ${biomeColor}`,
              }}>BIOMA {currentBiome + 1}/4</span>
              <span style={{
                background:`${biomeColor}22`,
                border:`1px solid ${biomeColor}55`,
                color:biomeColor, fontSize:FS.xs,
                fontFamily:FONT, letterSpacing:"1px",
                padding:"1px 5px",
              }}>RIGA {progressRow}/{totalRows}</span>
            </div>
            {/* Nome bioma */}
            <div style={{
              color: biomeColor, fontFamily:FONT, fontWeight:"bold",
              fontSize:"15px", letterSpacing:"2.5px",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              textShadow:`0 0 12px ${biomeColor}bb, 0 0 24px ${biomeColor}44`,
              lineHeight:1.1,
            }}>{biomeName.toUpperCase()}</div>
            {/* Boss pill */}
            <div style={{display:"flex", alignItems:"center", gap:"4px", marginTop:"3px"}}>
              <span style={{
                background:`${C.red}cc`, color:"#fff",
                fontFamily:FONT, fontWeight:"bold",
                fontSize:FS.xs, letterSpacing:"1px",
                padding:"1px 5px",
                boxShadow:`0 0 6px ${C.red}88`,
              }}>BOSS</span>
              <span style={{
                color:`${C.red}dd`, fontSize:FS.xs,
                fontFamily:FONT, fontWeight:"bold",
                letterSpacing:"0.5px",
                textShadow:`0 0 6px ${C.red}88`,
              }}>{biomeBoss.toUpperCase()}</span>
            </div>
          </div>

          {/* Progress block */}
          <div style={{flexShrink:0, textAlign:"right", minWidth:"64px"}}>
            <div style={{
              width:"64px", height:"8px",
              background:"#111",
              border:`1px solid ${biomeColor}55`,
              position:"relative", overflow:"hidden",
              marginBottom:"3px",
            }}>
              <div style={{
                position:"absolute", inset:0,
                width:`${progressPct}%`,
                background:`linear-gradient(90deg, ${biomeColor}88, ${biomeColor}, ${C.red})`,
                backgroundSize:"200% 100%",
                animation:`progressShimmer 2s linear infinite`,
                transition:"width 0.5s",
              }}/>
              {/* scanline */}
              <div style={{
                position:"absolute", inset:0,
                backgroundImage:"repeating-linear-gradient(90deg, transparent 0, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 4px)",
                pointerEvents:"none",
              }}/>
            </div>
            <div style={{
              color:C.red, fontSize:FS.xs,
              fontFamily:FONT, letterSpacing:"1px",
              textShadow:`0 0 4px ${C.red}99`,
            }}>→ BOSS</div>
          </div>
        </div>

        {/* Modificatore bioma */}
        {BIOME_MODIFIERS[currentBiome] && (
          <div style={{
            display:"flex", alignItems:"center", gap:"6px",
            padding:"4px 12px",
            borderTop:`1px solid ${biomeColor}22`,
            background:`${biomeColor}08`,
            fontSize:"10px", fontFamily:FONT,
          }}>
            <span style={{fontSize:"13px", flexShrink:0}}>{BIOME_MODIFIERS[currentBiome].emoji}</span>
            <span style={{color:biomeColor, fontWeight:"bold", letterSpacing:"1px", flexShrink:0}}>
              {BIOME_MODIFIERS[currentBiome].label}
            </span>
            <span style={{color:`${biomeColor}66`, flexShrink:0}}>—</span>
            <span style={{color:"#aaaacc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {BIOME_MODIFIERS[currentBiome].desc}
            </span>
          </div>
        )}
      </div>

      {/* ══ AREA MAPPA SCROLLABILE A SCATTI ══════════════════════ */}
      <div
        ref={scrollRef}
        className="map-snap-scroll"
        style={{
          flex:1, minHeight:0,
          overflowY:"auto", overflowX:"hidden",
          WebkitOverflowScrolling:"touch",
          position:"relative",
        }}
      >
        <div style={{
          position:"relative",
          width:"100%", maxWidth:`${W}px`,
          height:`${totalH}px`,
          margin:"0 auto",
        }}>

          {/* ── Snap target invisibili per ogni riga ─────────────── */}
          {map.rows.map((_, rIdx) => (
            <div key={`snap-${rIdx}`} style={{
              position:"absolute",
              left:0, right:0,
              top: rIdx * ROW_H,
              height: ROW_H,
              scrollSnapAlign:"start",
              pointerEvents:"none",
            }}/>
          ))}

          {/* ── HIGHLIGHT RIGA CORRENTE ───────────────────────────── */}
          <div style={{
            position:"absolute", left:0, right:0,
            top: currentRow * ROW_H, height: ROW_H,
            animation:"mapCurrentRowPulse 2s ease-in-out infinite",
            borderTop:`2px solid ${biomeColor}66`,
            borderBottom:`2px solid ${biomeColor}66`,
            pointerEvents:"none", zIndex:0,
          }}/>

          {/* ── "SEI QUI" — indicatore freccia sinistra ──────────── */}
          <div style={{
            position:"absolute",
            left:0,
            top: currentRow * ROW_H + ROW_H / 2 - 12,
            zIndex:10, pointerEvents:"none",
          }}>
            {/* freccia */}
            <div style={{
              width:0, height:0,
              borderTop:"12px solid transparent",
              borderBottom:"12px solid transparent",
              borderLeft:`14px solid ${biomeColor}`,
              filter:`drop-shadow(0 0 8px ${biomeColor})`,
              animation:"mapYouAreHere 1.2s ease-in-out infinite",
            }}/>
          </div>

          {/* ── Numeri di riga sull'asse destro ──────────────────── */}
          {map.rows.map((_, rIdx) => (
            <div key={`rnum-${rIdx}`} style={{
              position:"absolute",
              right:2,
              top: rIdx * ROW_H + 2,
              color: rIdx === currentRow ? biomeColor : "#33334a",
              fontSize:FS.xs, fontFamily:FONT,
              letterSpacing:"1px",
              pointerEvents:"none", zIndex:1,
              fontWeight: rIdx === currentRow ? "bold" : "normal",
              textShadow: rIdx === currentRow ? `0 0 6px ${biomeColor}` : "none",
            }}>{rIdx + 1}</div>
          ))}

          {/* ── GRIGLIA SFONDO ───────────────────────────────────── */}
          <svg
            style={{position:"absolute", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none"}}
            aria-hidden
          >
            <defs>
              <pattern id="mapgrid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#ffffff03" strokeWidth="0.5"/>
              </pattern>
              <radialGradient id="biomeGlowMap" cx="50%" cy="35%" r="55%">
                <stop offset="0%"   stopColor={biomeColor} stopOpacity="0.06"/>
                <stop offset="100%" stopColor={biomeColor} stopOpacity="0"/>
              </radialGradient>
              {/* Regione del filtro in userSpaceOnUse, non in percentuale.
                  Le percentuali si riferiscono al bounding box dell'elemento: su
                  un arco VERTICALE il bbox ha larghezza 0, quindi l'area del
                  filtro risultava nulla e la linea spariva del tutto. Era il
                  motivo per cui i collegamenti dritti (stessa colonna, tipo
                  START → nodo centrale) non si vedevano mai. */}
              <filter id="lineglow" filterUnits="userSpaceOnUse"
                x={-24} y={-24} width={W + 48} height={totalH + 48}>
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="trailglow" filterUnits="userSpaceOnUse"
                x={-24} y={-24} width={W + 48} height={totalH + 48}>
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)"/>
            <rect width="100%" height="100%" fill="url(#biomeGlowMap)"/>
          </svg>

          {/* ── LINEE DI CONNESSIONE ─────────────────────────────── */}
          <svg
            style={{position:"absolute", top:0, left:0, width:W, height:totalH, pointerEvents:"none", overflow:"visible"}}
          >
            {edges.map(({ fromId, toId, isShortcut }) => {
              const fromC = nodePos[fromId];
              const toC   = nodePos[toId];
              if (!fromC || !toC) return null;
              // Gli archi partivano dal CENTRO dei nodi: su un collegamento
              // verticale (stessa colonna) la linea restava quasi tutta sotto i
              // due riquadri — con nodi alti 60px in righe da 72 ne avanzavano 12,
              // che col tratteggio sparivano del tutto. Qui si accorcia l'arco
              // fino al bordo dei nodi, così è sempre visibile per intero.
              const [from, to] = trimEdge(fromC, toC);
              const fromVisited = visitedNodes.includes(fromId);
              const toReachable = reachableNodes.includes(toId);
              const isActive    = fromVisited && toReachable;
              const isPast      = fromVisited && visitedNodes.includes(toId);

              // Arco non ancora percorribile: deve comunque LEGGERSI, altrimenti
              // la struttura del percorso è invisibile e si vede solo il tratto
              // attivo. Prima era opacità 0.10 con tratteggio "2 12", cioè nulla.
              if (!isActive && !isPast) return (
                <line key={`${fromId}-${toId}`}
                  x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                  stroke="#8fa3c8" strokeWidth="1.5" strokeOpacity="0.34"
                  strokeDasharray="3 6" strokeLinecap="round"
                />
              );

              const col = edgeColor(toId, isActive, isPast, isShortcut);

              if (isPast) return (
                <g key={`${fromId}-${toId}`}>
                  <line x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                    stroke={col} strokeWidth="5" strokeOpacity="0.20"
                    strokeLinecap="round" filter="url(#trailglow)"/>
                  <line x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                    stroke={col} strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                    stroke="#ffee88" strokeWidth="1.5" strokeOpacity="0.45"
                    strokeDasharray="3 20" strokeLinecap="round"
                    style={{animation:"mapTrailFlow 1.4s linear infinite"}}/>
                </g>
              );

              const sw   = 2.5;
              const dash = isShortcut ? "5 7" : "6 5";

              if (isShortcut) {
                const ctrl1x = from.cx - 55, ctrl1y = from.cy + 28;
                const ctrl2x = to.cx   - 55, ctrl2y = to.cy   - 28;
                return (
                  <path key={`${fromId}-${toId}`}
                    d={`M ${from.cx} ${from.cy} C ${ctrl1x} ${ctrl1y} ${ctrl2x} ${ctrl2y} ${to.cx} ${to.cy}`}
                    stroke={col} strokeWidth={sw} strokeDasharray={dash}
                    fill="none" strokeLinecap="round" filter="url(#lineglow)"/>
                );
              }
              return (
                <line key={`${fromId}-${toId}`}
                  x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                  stroke={col} strokeWidth={sw} strokeDasharray={dash}
                  strokeLinecap="round" filter="url(#lineglow)"/>
              );
            })}
          </svg>

          {/* ── NODI ─────────────────────────────────────────────── */}
          {map.rows.map((row, rIdx) => row.map(node => {
            const { cx, cy } = nodePos[node.id];
            const visited   = visitedNodes.includes(node.id);
            const reachable = reachableNodes.includes(node.id);
            const isActive  = reachable && !visited;
            const isBoss    = node.type === "boss";
            const isSecret  = !!node.secret;
            const isElite   = !!node.elite && !visited;
            const secretThreshold = BIOME_MODIFIERS[currentBiome]?.secretFortuneThreshold ?? 2;
            const secretUnlocked  = isSecret && playerFortuna >= secretThreshold;
            const effectivelyHidden = isSecret && !secretUnlocked && !visited;

            const icon = effectivelyHidden ? "🔒" : isSecret ? "🔮" : NODE_ICONS[node.type] || "?";
            const dangerNode = DANGER_TYPES.has(node.type);
            const safeNode   = SAFE_TYPES.has(node.type);

            const borderWidth = isBoss ? 3 : isElite || (isActive && secretUnlocked) ? 3 : isActive ? 2 : 1;
            const borderCol = visited             ? "#2a2016"
              : isBoss                            ? "#ff2244"
              : isElite                           ? C.orange
              : isActive && secretUnlocked        ? "#ff9ec4"
              : isActive && dangerNode            ? "#ff4444"
              : isActive && safeNode              ? "#44dd88"
              : isActive                          ? C.gold
              : "#181828";

            const bgCol = visited                  ? "#0e0b06"
              : isBoss                             ? "#380000"
              : isElite                            ? "#271600"
              : isActive && secretUnlocked         ? "#1e0026"
              : isActive && dangerNode             ? "#2a0000"
              : isActive && safeNode               ? "#002a00"
              : isActive                           ? "#090930"
              : "#080812";

            const shadow = visited
              ? "none"
              : isActive
                ? isBoss
                  ? `0 0 20px ${C.red}ee,0 0 44px ${C.red}55,3px 3px 0 #000`
                  : isElite
                    ? `0 0 16px ${C.orange}dd,3px 3px 0 #000`
                    : secretUnlocked
                      ? `0 0 16px #ff9ec4dd,3px 3px 0 #000`
                      : dangerNode
                        ? `0 0 14px #ff4444dd,3px 3px 0 #000`
                        : safeNode
                          ? `0 0 14px #44dd88dd,3px 3px 0 #000`
                          : `0 0 14px ${C.gold}dd,3px 3px 0 #000`
                : "none";

            const animation = isBoss && isActive ? "bossGlow 1.8s infinite"
              : isActive ? "slotGlow 2.4s ease-in-out infinite"
              : "none";

            const label = node.type === "boss"
              ? (node.bossName || "BOSS")
              : effectivelyHidden ? "???"
              : node.type;

            const tooltip = effectivelyHidden
              ? `🔒 Nodo Segreto — richiede Fortuna ≥ ${secretThreshold}`
              : isSecret ? "🔮 Nodo Segreto — evento raro con ricompense uniche!"
              : (isElite ? "★ ELITE — rischio e premi raddoppiati! " : "")
                + (NODE_TOOLTIPS[node.type] || node.type);

            const labelColor = visited             ? "#2e2818"
              : isBoss                             ? "#ff5577"
              : isActive && dangerNode             ? "#ff7777"
              : isActive && safeNode               ? "#77ffaa"
              : isActive && secretUnlocked         ? "#ccaaff"
              : isActive                           ? C.gold
              : "#202030";

            return (
              <Tooltip key={node.id} text={tooltip}>
                <div
                  className={isActive && !effectivelyHidden ? "map-node-active" : ""}
                  onClick={() => isActive && !effectivelyHidden ? onSelectNode(node, rIdx) : null}
                  style={{
                    position:"absolute",
                    left: cx - NW/2, top: cy - NH/2,
                    width: NW, height: NH,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                    gap:"3px",
                    border: `${borderWidth}px solid ${borderCol}`,
                    background: bgCol,
                    overflow:"hidden",
                    cursor: isActive && !effectivelyHidden ? "pointer" : "default",
                    opacity: visited ? 0.48 : effectivelyHidden ? 0.45 : 1,
                    zIndex: isBoss ? 3 : isActive ? 2 : 1,
                    boxShadow: shadow,
                    transition:"transform 0.1s, box-shadow 0.18s",
                    animation,
                    userSelect:"none",
                    touchAction:"manipulation",
                    WebkitTapHighlightColor:"transparent",
                    ...(visited ? {
                      background:`repeating-linear-gradient(
                        45deg,
                        #0e0b06 0px,#0e0b06 5px,
                        #0a0806 5px,#0a0806 10px
                      )`,
                    } : isActive ? {
                      // Sottile inner glow per nodi attivi
                      boxShadow: shadow + `, inset 0 0 10px ${borderCol}18`,
                    } : {}),
                  }}
                  onMouseEnter={e => { if(isActive && !effectivelyHidden) e.currentTarget.style.transform="scale(1.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; }}
                  onTouchStart={e => { if(isActive && !effectivelyHidden) e.currentTarget.style.transform="scale(1.08)"; }}
                  onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
                >
                  {/* Overlay diagonale visitati */}
                  {visited && (
                    <div style={{
                      position:"absolute", inset:0,
                      background:"linear-gradient(135deg,transparent 38%,rgba(0,0,0,0.35) 62%)",
                      pointerEvents:"none",
                    }}/>
                  )}

                  {/* Passata ottone: sheen diagonale caldo + luce superiore (rilievo materiale) */}
                  {isActive && !visited && (
                    <>
                      <div style={{
                        position:"absolute", inset:0,
                        background:`linear-gradient(135deg, ${C.gold}1c 0%, transparent 42%, transparent 62%, ${borderCol}14 100%)`,
                        pointerEvents:"none",
                      }}/>
                      <div style={{
                        position:"absolute", top:0, left:0, right:0, height:"34%",
                        background:"linear-gradient(180deg, rgba(255,236,150,0.18) 0%, transparent 100%)",
                        pointerEvents:"none",
                      }}/>
                    </>
                  )}

                  {/* Icona nodo — sprite se disponibile, altrimenti emoji */}
                  <span style={{
                    fontSize: isBoss ? "28px" : "22px",
                    lineHeight:1,
                    filter: visited
                      ? "grayscale(0.9) brightness(0.45)"
                      : isActive
                        ? `drop-shadow(0 0 6px ${borderCol}) drop-shadow(0 0 12px ${borderCol}66)`
                        : "none",
                    position:"relative", zIndex:1,
                    display:"inline-flex", alignItems:"center", justifyContent:"center",
                  }}>
                    {(() => {
                      if (effectivelyHidden || isSecret) return icon;
                      // Il nodo boss usava `spr-boss` in tutti i biomi: sulla mappa
                      // i quattro boss erano lo stesso disegno. Ora si risolve dal
                      // nome, con ricaduta sul generico se l'arte manca ancora.
                      const bossKey = node.type === "boss" ? BOSS_SPRITE[node.bossName] : null;
                      const key = bossKey && hasAsset(`spr-${bossKey}`) ? bossKey : node.type;
                      return hasAsset(`spr-${key}`)
                        ? <Asset id={`spr-${key}`} emoji={icon} size={spriteSize(isBoss)} />
                        : icon;
                    })()}
                  </span>

                  {/* Etichetta — in sovrimpressione sul bordo basso, su una velatura
                      scura: lo sprite può così occupare tutta l'altezza del nodo. */}
                  <span style={{
                    position:"absolute", left:0, right:0, bottom:0,
                    fontSize: FS.xs,
                    color: labelColor,
                    fontFamily:FONT, fontWeight:"bold",
                    textAlign:"center", lineHeight:"1.3",
                    padding:"1px 3px 2px",
                    background:"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.88) 100%)",
                    whiteSpace:"nowrap",
                    overflow:"hidden",
                    textOverflow:"ellipsis",
                    WebkitTextSizeAdjust:"none",
                    textSizeAdjust:"none",
                    textShadow: isActive && !visited ? `0 0 6px ${borderCol}, 0 1px 2px #000` : "0 1px 2px #000",
                    zIndex:2,
                    letterSpacing:"0.3px",
                  }}>
                    {label.toUpperCase()}
                  </span>

                  {/* ✓ checkmark visitati */}
                  {visited && (
                    <span style={{
                      position:"absolute", inset:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"20px", color:"#4a3a18", opacity:0.55,
                      pointerEvents:"none", zIndex:2,
                      textShadow:"0 0 4px #000",
                    }}>✓</span>
                  )}

                  {/* Badge ELITE */}
                  {isElite && (
                    <span style={{
                      position:"absolute", top:-8, right:-8,
                      fontSize:FS.xs, background:C.orange, color:"#000",
                      width:"17px", height:"17px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:"bold",
                      boxShadow:`0 0 10px ${C.orange}cc`,
                      zIndex:3,
                    }}>★</span>
                  )}
                </div>
              </Tooltip>
            );
          }))}
        </div>
      </div>

      {/* ══ FOOTER FISSO — Legenda + hint scroll ══════════════════ */}
      <div style={{
        flexShrink:0,
        borderTop:`1px solid ${biomeColor}33`,
        background:`linear-gradient(0deg,#060610 0%,#080814 100%)`,
        padding:"5px 10px",
        display:"flex", alignItems:"center", gap:"0",
        justifyContent:"space-between",
      }}>
        {/* Legenda tipo nodi */}
        <div style={{display:"flex", alignItems:"center", gap:"8px", flexWrap:"nowrap", overflow:"hidden"}}>
          {LEGEND.map(({ col, label }) => (
            <span key={label} style={{
              display:"flex", alignItems:"center", gap:"3px",
              color: col, fontSize:FS.xs, fontFamily:FONT, letterSpacing:"1px",
              flexShrink:0,
            }}>
              <span style={{
                display:"inline-block", width:"8px", height:"8px",
                background: col,
                boxShadow:`0 0 5px ${col}`,
              }}/>
              {label}
            </span>
          ))}
        </div>

        {/* Hint scroll */}
        <span style={{
          flexShrink:0,
          color:`${biomeColor}88`, fontSize:FS.xs,
          fontFamily:FONT, letterSpacing:"1px",
          marginLeft:"8px",
        }}>↕ SCORRI</span>
      </div>
    </div>
  );
}
