import { useState, useRef, useEffect } from "react";
import { C, FONT } from "../data/theme.js";
import { SYMBOLS } from "../data/cards.js";
import { NAIL_INFO } from "../data/nails.js";
import { makeNailCursor } from "../utils/nail.js";
import { AudioEngine, ParticleSystem } from "../audio.js";
import { Haptics } from "../utils/haptics.js";

// ─── SCRATCH CELL (canvas silver-layer drag-to-reveal) ──────
export function ScratchCell({ cell, idx, onScratch, finished, isWinSymbol, isPartialMatch, ambidestri=false, bloodMode=false, isBloody=false, themeColor=null }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const revealed = useRef(cell.scratched);
  const scratchTicks = useRef(0); // throttle del check getImageData (costoso su mobile)
  const [winAnim, setWinAnim] = useState(false); // glow burst al reveal vincente
  const prevScratched = useRef(cell.scratched);
  // Pattern pseudo-random stabile basato su idx — così ogni cella sporca ha macchie di sangue coerenti
  // tra i render (altrimenti ballerebbero ad ogni update di React).
  const bloodSplatter = useRef(null);
  if (isBloody && !bloodSplatter.current) {
    // 3-5 macchie ellittiche + 1-2 gocce che colano
    const rng = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
    const blobs = [];
    const nBlobs = 3 + Math.floor(rng(idx + 1) * 3);
    for (let i = 0; i < nBlobs; i++) {
      blobs.push({
        cx: 10 + rng(idx * 7 + i) * 80,
        cy: 10 + rng(idx * 11 + i * 3) * 55,
        rx: 6 + rng(idx * 13 + i * 5) * 10,
        ry: 4 + rng(idx * 17 + i * 7) * 7,
        rot: rng(idx * 19 + i) * 180,
        op: 0.55 + rng(idx * 23 + i) * 0.35,
      });
    }
    const drips = [];
    const nDrips = 1 + Math.floor(rng(idx + 31) * 2);
    for (let i = 0; i < nDrips; i++) {
      drips.push({
        x: 15 + rng(idx * 29 + i) * 70,
        y: 5 + rng(idx * 31 + i) * 20,
        h: 12 + rng(idx * 37 + i) * 18,
      });
    }
    bloodSplatter.current = { blobs, drips };
  }

  // ── Win glow + haptics al reveal ──────────────────────────────
  useEffect(() => {
    if (!prevScratched.current && cell.scratched) {
      if (isWinSymbol) {
        setWinAnim(true);
        Haptics.win();
        setTimeout(() => setWinAnim(false), 900);
      }
    }
    prevScratched.current = cell.scratched;
  }, [cell.scratched, isWinSymbol]);

  // Init silver layer on mount
  useEffect(() => {
    if (cell.scratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Silver gradient — più brillante, stile CGA coin
    const grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    grad.addColorStop(0,   "#aaaaaa");
    grad.addColorStop(0.3, "#d4d4d4");
    grad.addColorStop(0.5, "#e8e8e8");
    grad.addColorStop(0.7, "#c0c0c0");
    grad.addColorStop(1,   "#888888");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Shimmer highlights
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i=0; i<55; i++) ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1.5, 1.5);
    // Dark grit
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    for (let i=0; i<25; i++) ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
    // Diagonal texture lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let i=0; i<8; i++) {
      ctx.beginPath();
      ctx.moveTo(i*(canvas.width/7), 0);
      ctx.lineTo(0, i*(canvas.height/7));
      ctx.stroke();
    }
  }, []);

  const doScratch = (e) => {
    if (finished || revealed.current || cell.scratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null) return;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI*2);
    if (ambidestri) { ctx.arc(x + 36, y - 10, 28, 0, Math.PI*2); }
    ctx.fill();
    AudioEngine.scratch();
    Haptics.scratch();
    ParticleSystem.spawn(clientX, clientY, 9, bloodMode);
    // Check how much is scratched — getImageData è costoso, throttle a 1 ogni 3
    // chiamate (su mobile il touchmove spara decine di eventi/secondo).
    scratchTicks.current += 1;
    if (scratchTicks.current % 3 !== 0) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i=3; i<data.length; i+=4) if (data[i]<100) transparent++;
    const pct = transparent / (canvas.width * canvas.height);
    if (pct > 0.35 && !revealed.current) {
      revealed.current = true;
      onScratch(idx);
    }
  };

  const isTrap = cell.isTrap;
  const isJolly = cell.isJolly;
  const isItem = cell.isItem;
  const isStop = cell.isStop;
  const isCard = cell.isRed !== undefined; // carta da gioco (sette e mezzo)
  // CGA: colori piatti puri, niente mezzi toni
  const borderColor = isTrap ? C.red : isJolly ? C.gold : isItem ? C.cyan : isStop ? C.red :
    isCard ? (isWinSymbol ? C.green : C.text) :
    isWinSymbol ? C.green : isPartialMatch ? C.gold : C.dim;
  const bg = isTrap ? "#550000" : isJolly ? "#555500" : isItem ? "#005555" : isStop ? "#550000" :
    isCard ? "#FFFFFF" :
    isWinSymbol ? "#005500" : isPartialMatch ? "#555500" : "#000033";
  const color = isTrap ? C.red : isJolly ? C.gold : isItem ? C.cyan : isStop ? C.red :
    isCard ? (cell.isRed ? "#FF0000" : "#000000") :
    isWinSymbol ? C.green : isPartialMatch ? C.gold : C.text;
  // CGA: cella non grattata = nero con bordo più visibile (aspetto "moneta CGA")
  const unrevealedBorder = themeColor || "#778899";
  const symFontSize = isCard ? "20px" : (cell.value !== undefined || isStop) ? "16px" : "24px";

  return (
    <div style={{
      width:"100%", aspectRatio:"1.3", position:"relative",
      border:`3px solid ${cell.scratched && isBloody ? "#ff2030" : (cell.scratched ? borderColor : unrevealedBorder)}`,
      borderRadius:"0", overflow:"hidden",
      background: cell.scratched ? bg : "#111",
      boxShadow: winAnim
        ? `0 0 0 3px ${C.green}ee, 0 0 24px ${C.green}aa, 0 0 48px ${C.green}55, 3px 3px 0 #000`
        : cell.scratched && isBloody
          ? "inset 0 0 14px #ff000088, 0 0 10px #ff000055, 3px 3px 0 #000"
          : "3px 3px 0 #000000",
      animation: winAnim ? "winFlash 0.9s ease-out forwards" : "none",
      transition: "box-shadow 0.15s",
    }}>
      {/* Symbol — visible only after reveal */}
      {cell.scratched && (
        <div style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:symFontSize, fontWeight:"bold", color,
          textShadow: isWinSymbol ? `0 0 8px ${C.green}` : isJolly ? `0 0 8px #ffd700` : isItem ? `0 0 8px #00cccc` : "none",
        }}>
          {cell.symbol}
        </div>
      )}
      {/* ASCII texture underneath canvas */}
      {!cell.scratched && (
        <div style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"10px", color:"#444", fontFamily:FONT, lineHeight:"1",
          overflow:"hidden", pointerEvents:"none", opacity:0.4,
        }}>
          ░▒▓█▓▒░<br/>▒▓█▓▒░▒<br/>▓█▓▒░▒▓
        </div>
      )}
      {/* Blood splatter overlay — visibile solo su cella grattata e "sporcata" */}
      {cell.scratched && isBloody && bloodSplatter.current && (
        <svg
          viewBox="0 0 100 70"
          preserveAspectRatio="none"
          style={{
            position:"absolute", inset:0, width:"100%", height:"100%",
            pointerEvents:"none",
            filter: "drop-shadow(0 0 2px #ff0000aa) drop-shadow(0 1px 1px #00000099)",
          }}
        >
          {/* Macchie grandi — rosso brillante con bordo scuro per definizione */}
          {bloodSplatter.current.blobs.map((b, i) => (
            <g key={`b${i}`} transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}>
              <ellipse
                cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
                fill="#ff1020"
                opacity={Math.min(1, b.op + 0.1)}
              />
              {/* Highlight al centro per effetto bagnato/fresco */}
              <ellipse
                cx={b.cx - b.rx * 0.25} cy={b.cy - b.ry * 0.3}
                rx={b.rx * 0.3} ry={b.ry * 0.35}
                fill="#ff6060"
                opacity="0.55"
              />
            </g>
          ))}
          {/* Gocce che colano — rosso scuro ma saturo */}
          {bloodSplatter.current.drips.map((d, i) => (
            <g key={`d${i}`}>
              <rect
                x={d.x - 1.2} y={d.y} width="2.6" height={d.h}
                fill="#dd0010" opacity="0.92"
              />
              {/* Goccia a fondo colata */}
              <circle cx={d.x} cy={d.y + d.h} r="1.4" fill="#ff1020" opacity="0.95" />
            </g>
          ))}
          {/* Piccoli schizzi puntiformi — rosso brillante */}
          {bloodSplatter.current.blobs.slice(0, 3).map((b, i) => (
            <circle key={`s${i}`} cx={b.cx + 8 + i * 3} cy={b.cy - 6 - i * 2} r="1.1" fill="#ff2030" opacity="0.95" />
          ))}
          {/* Micro-spruzzi extra per aumentare densità visiva */}
          {bloodSplatter.current.blobs.slice(0, 4).map((b, i) => (
            <circle key={`ms${i}`} cx={b.cx - 6 - i * 2} cy={b.cy + 4 + i * 2} r="0.7" fill="#ff4050" opacity="0.85" />
          ))}
        </svg>
      )}
      {/* Silver canvas overlay */}
      {!cell.scratched && (
        <canvas ref={canvasRef} width={90} height={70}
          style={{
            position:"absolute", inset:0, width:"100%", height:"100%",
            cursor: finished ? "default" : "inherit",
            touchAction:"none",
          }}
          onMouseDown={(e)=>{ drawing.current=true; doScratch(e); }}
          onMouseUp={()=>{ drawing.current=false; }}
          onMouseLeave={()=>{ drawing.current=false; }}
          onMouseMove={(e)=>{ if(drawing.current) doScratch(e); }}
          onTouchStart={(e)=>{ e.preventDefault(); drawing.current=true; doScratch(e); }}
          onTouchMove={(e)=>{ e.preventDefault(); doScratch(e); }}
          onTouchEnd={()=>{ drawing.current=false; }}
        />
      )}
    </div>
  );
}
