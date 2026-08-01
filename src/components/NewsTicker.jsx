import { useState, useEffect, useMemo, memo } from "react";
import { C, FONT } from "../data/theme.js";
import { TICKER_COLORS, TICKER_LABELS, getNewsPool } from "../data/art.js";
import { ANIM } from "../styles/animations.js";
import { useReducedMotion } from "../hooks/useReducedMotion.js";

function NewsTickerImpl({ currentBiome = 0 }) {
  // Pool notizie = globali + quelle del bioma corrente (ricomputate al cambio bioma)
  const pool = useMemo(() => getNewsPool(currentBiome), [currentBiome]);
  const reducedMotion = useReducedMotion();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length));
  const [key, setKey] = useState(0);
  const duration = 10; // secondi traversata

  // Se il pool cambia (nuovo bioma), riparti dall'inizio con una notizia casuale di quel pool
  useEffect(() => {
    setIdx(Math.floor(Math.random() * pool.length));
    setKey(k => k + 1);
  }, [pool]);

  const safeIdx = idx % pool.length;
  const col = TICKER_COLORS[safeIdx % TICKER_COLORS.length];
  const label = TICKER_LABELS[safeIdx % TICKER_LABELS.length];

  useEffect(() => {
    // Avvia il prossimo leggermente prima che il testo esca — zero gap
    const t = setTimeout(() => {
      setIdx(i => (i + 1) % pool.length);
      setKey(k => k + 1);
    }, (duration - 0.5) * 1000);
    return () => clearTimeout(t);
  }, [key, pool.length]);

  // Movimento ridotto: niente scorrimento. La notizia resta ferma e leggibile e
  // cambia di colpo allo scadere del timer (stesso ritmo, zero movimento).
  const textStyle = reducedMotion ? {
    position:"static", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
    color: col, fontSize:"11px", fontWeight:"bold", lineHeight:"20px",
    textShadow:`0 0 8px ${col}88, 0 0 16px ${col}44`,
    letterSpacing:"0.3px",
  } : {
    position:"absolute", left:"100%", top:0, whiteSpace:"nowrap",
    color: col, fontSize:"11px", fontWeight:"bold", lineHeight:"20px",
    textShadow:`0 0 8px ${col}88, 0 0 16px ${col}44`,
    animation: `newsTicker ${duration}s linear forwards`,
    willChange:"transform",
    letterSpacing:"0.3px",
  };

  return (
    <div style={{flex:1, minWidth:0, display:"flex", alignItems:"center", gap:"8px"}}>
      {/* Area testo scorrevole — fade a sinistra, nasce da destra vicino al badge */}
      <div style={{
        flex:1, overflow:"hidden", position:"relative", height:"20px",
        // Con la notizia ferma la maschera taglierebbe le prime parole
        WebkitMaskImage: reducedMotion ? "none" : "linear-gradient(to right, transparent 0%, black 18%)",
        maskImage: reducedMotion ? "none" : "linear-gradient(to right, transparent 0%, black 18%)",
      }}>
        <div key={key} style={textStyle}>
          {pool[safeIdx]}
        </div>
      </div>
      {/* Badge fisso a DESTRA — origine delle notizie */}
      <div style={{
        flexShrink:0,
        background: col, color:"#000",
        fontSize:"10px", fontWeight:"bold", letterSpacing:"1px",
        padding:"2px 6px", whiteSpace:"nowrap",
        animation: reducedMotion ? "none" : ANIM.pulseActive,
      }}>{label}</div>
    </div>
  );
}


export function NpcCommentStrip({ comment, commentKey }) {
  const reducedMotion = useReducedMotion();
  if (!comment) return null;
  const duration = Math.max(10, comment.length * 0.1);
  return (
    <div style={{
      width:"100%", flexShrink:0, height:"30px",
      display:"flex", alignItems:"stretch",
      background:"#04040a",
      borderTop:`1px solid ${C.gold}18`,
      borderBottom:`1px solid ${C.gold}18`,
      overflow:"hidden",
    }}>
      {/* Badge */}
      <div style={{
        flexShrink:0, width:"44px",
        display:"flex", alignItems:"center", justifyContent:"center",
        borderRight:`1px solid ${C.gold}22`,
        background:"#08060a", fontSize:"14px", lineHeight:1,
      }}>🧓</div>
      {/* Scrolling text */}
      <div style={{
        flex:1, position:"relative", overflow:"hidden",
        maskImage: reducedMotion ? "none" : "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
        WebkitMaskImage: reducedMotion ? "none" : "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
        display:"flex", alignItems:"center", paddingLeft: reducedMotion ? "8px" : 0,
      }}>
        <div key={commentKey} style={reducedMotion ? {
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", lineHeight:"30px",
          color:C.gold+"bb", fontSize:"11px", fontStyle:"italic",
          textShadow:`0 0 8px ${C.gold}33`,
        } : {
          position:"absolute", left:"100%", top:0, whiteSpace:"nowrap", lineHeight:"30px",
          animation:`newsTicker ${duration}s linear forwards`,
          willChange:"transform",
          color:C.gold+"bb", fontSize:"11px", fontStyle:"italic",
          textShadow:`0 0 8px ${C.gold}33`,
        }}>
          {comment}
        </div>
      </div>
    </div>
  );
}

export const NewsTicker = memo(NewsTickerImpl);
