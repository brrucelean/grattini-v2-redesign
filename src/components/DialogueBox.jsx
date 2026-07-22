import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import { SPR_BIG } from "../data/art.js";
import { AudioEngine } from "../audio.js";
import { CornerBrackets } from "./Vintage.jsx";
import { normalizePortrait } from "../utils/nail.js";

// ─── CARMELO LOG BOX ─────────────────────────────────────────
// Extracts plain text from a message (string or array of segments)
export function msgPlainText(msg) {
  if (Array.isArray(msg)) return msg.map(s => s.t).join("");
  return msg;
}

// Renders a message with optional colored segments (full or partial up to charCount)
export function MsgRender({ msg, color, style = {}, charCount = Infinity }) {
  if (!Array.isArray(msg)) {
    const txt = typeof msg === "string" ? msg.slice(0, charCount) : String(msg).slice(0, charCount);
    return <span style={{color, ...style}}>{txt}</span>;
  }
  let remaining = charCount;
  return <span style={style}>{msg.map((seg, i) => {
    if (remaining <= 0) return null;
    const txt = seg.t.slice(0, remaining);
    remaining -= seg.t.length;
    return <span key={i} style={{color: seg.c || color}}>{txt}</span>;
  })}</span>;
}

export function CarmeloLogBox({ npc, name, color, messages, footer, height="170px" }) {
  const portrait = SPR_BIG[npc];
  const scrollRef = useRef(null);
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(true);
  // Mostra SOLO l'ultimo messaggio — no accumulo di prevMsgs
  const latest = messages.length > 0 ? messages[messages.length - 1] : "";
  const latestPlain = msgPlainText(latest);

  useEffect(() => {
    if (!latest) return;
    setTypedText(""); setTypingDone(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    let i = 0;
    const iv = setInterval(() => {
      if (i >= latestPlain.length) { clearInterval(iv); setTypingDone(true); return; }
      setTypedText(latestPlain.slice(0, i + 1));
      if (i % 3 === 0 && latestPlain[i] !== ' ' && latestPlain[i] !== '"') AudioEngine.dialogueTick();
      i++;
    }, 28);
    return () => clearInterval(iv);
  }, [latestPlain]);

  // Segui il cursore: ogni volta che il testo cresce scrolla in fondo
  useEffect(() => {
    if (scrollRef.current && !typingDone) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [typedText, typingDone]);

  const skip = () => { setTypedText(latestPlain); setTypingDone(true); };

  return (
    <div onClick={skip} style={{
      display:"flex", cursor:"pointer",
      border:`2px solid ${color}66`,
      boxShadow:`0 0 30px ${color}22, inset 0 0 60px ${color}08`,
      background:"#04040e", animation:"dialogueIn 0.3s ease-out", height, flexShrink:0,
      position:"relative",
    }}>
      <CornerBrackets color={color} size={13} inset={-3} thickness={2} glow />
      <div style={{
        flexShrink:0, width:"110px", borderRight:`1px solid ${color}44`,
        background:`linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:"10px 6px", overflow:"hidden",
      }}>
        <div style={{
          display:"inline-block", background: color, color:"#000",
          fontSize:"7px", fontWeight:"bold", letterSpacing:"1.5px",
          padding:"2px 5px", marginBottom:"8px",
          boxShadow:`0 0 8px ${color}aa`,
          whiteSpace:"nowrap", maxWidth:"96px",
          overflow:"hidden", textOverflow:"ellipsis",
        }}>★ {name.toUpperCase()} ★</div>
        {portrait && (
          <pre style={{color:color+"cc", fontSize:"7px", lineHeight:"1.3", margin:0,
            fontFamily:FONT, textShadow:`0 0 6px ${color}55`, overflow:"hidden",
          }}>{normalizePortrait(portrait).join("\n")}</pre>
        )}
      </div>
      <div style={{flex:1, padding:"12px 14px", display:"flex", flexDirection:"column", minHeight:0}}>
        <div style={{color, fontSize:"12px", fontWeight:"bold", letterSpacing:"1.5px",
          marginBottom:"10px",
          textShadow:`0 0 10px ${color}, 0 0 18px ${color}55`,
          borderBottom:`1px solid ${color}33`, paddingBottom:"6px", flexShrink:0,
          fontFamily:FONT, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>⬡ {name} ⬡</div>
        <div ref={scrollRef} style={{
          flex:1, overflowY:"auto", minHeight:0,
          scrollbarWidth:"thin", scrollbarColor:`${color}33 transparent`,
        }}>
          {latest && (
            <div style={{fontSize:"13px", fontStyle:"italic",
              lineHeight:"1.8", whiteSpace:"pre-wrap", color:"#e0e0e0",
            }}>
              <span style={{color, opacity:0.7}}>"</span>
              <MsgRender msg={latest} color="#e0e0e0"
                charCount={typingDone ? Infinity : typedText.length} />
              {!typingDone && <span style={{color, animation:"dialogueCursor 0.5s step-start infinite"}}>▌</span>}
              {typingDone && <span style={{color, opacity:0.7}}>"</span>}
            </div>
          )}
        </div>
        {footer && <div style={{marginTop:"12px", flexShrink:0}}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── CARMELO SCRATCH STRIP ──────────────────────────────────
// Striscia compatta (44px): typewriter lettera per lettera + scroll
// che segue il cursore (overflow a sinistra mentre si scrive).
// Dopo la fine: scorre indietro lentamente per rileggere dall'inizio.
export function CarmeloScratchStrip({ messages, color }) {
  const latest = messages && messages.length > 0 ? messages[messages.length - 1] : "";
  const latestPlain = msgPlainText(latest);
  const [typedText, setTypedText] = useState("");
  const [done, setDone] = useState(true);
  const scrollRef = useRef(null);

  // Nuovo messaggio: reset e riparti
  useEffect(() => {
    if (!latestPlain) return;
    setTypedText("");
    setDone(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    let i = 0;
    const iv = setInterval(() => {
      if (i >= latestPlain.length) { clearInterval(iv); setDone(true); return; }
      setTypedText(latestPlain.slice(0, i + 1));
      if (i % 3 === 0 && latestPlain[i] !== ' ' && latestPlain[i] !== '"') AudioEngine.dialogueTick();
      i++;
    }, 28);
    return () => clearInterval(iv);
  }, [latestPlain]);

  // Segui il cursore: scrolla in basso durante il typing
  useEffect(() => {
    if (scrollRef.current && !done) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [typedText, done]);

  // Dopo la fine: torna in cima lentamente per rileggere
  useEffect(() => {
    if (!done || !scrollRef.current) return;
    const el = scrollRef.current;
    if (el.scrollTop < 4) return;
    const t = setTimeout(() => {
      el.style.scrollBehavior = "smooth";
      el.scrollTop = 0;
      setTimeout(() => { if (el) el.style.scrollBehavior = ""; }, 1600);
    }, 900);
    return () => clearTimeout(t);
  }, [done]);

  const skip = () => { setTypedText(latestPlain); setDone(true); };

  if (!latest) return null;
  return (
    <div onClick={skip} style={{
      flexShrink:0, height:"96px",
      display:"flex", alignItems:"stretch",
      background:"#030308",
      borderTop:`1px solid ${color}44`,
      overflow:"hidden",
      boxShadow:`0 -4px 20px #00000088`,
      cursor:"pointer",
    }}>
      {/* Badge NPC fisso — allineato in alto */}
      <div style={{
        flexShrink:0, width:"46px",
        display:"flex", alignItems:"flex-start", justifyContent:"center",
        paddingTop:"12px",
        borderRight:`1px solid ${color}22`,
        background:`${color}08`,
        fontSize:"22px", lineHeight:1,
      }}>🧓</div>
      {/* Area testo — multi-riga, scroll verticale, fade in basso */}
      <div ref={scrollRef} style={{
        flex:1, overflowY:"auto", overflowX:"hidden",
        padding:"10px 12px 10px 10px",
        scrollbarWidth:"none",
        maskImage:"linear-gradient(to bottom, black 75%, transparent 100%)",
        WebkitMaskImage:"linear-gradient(to bottom, black 75%, transparent 100%)",
      }}>
        <div style={{
          color: color+"cc", fontSize:"12px", fontStyle:"italic",
          textShadow:`0 0 8px ${color}33`,
          letterSpacing:"0.3px",
          lineHeight:"1.6",
          whiteSpace:"pre-wrap",
          wordBreak:"break-word",
        }}>
          {typedText}
          {!done && (
            <span style={{color, animation:"dialogueCursor 0.5s step-start infinite"}}>▌</span>
          )}
        </div>
      </div>
    </div>
  );
}
