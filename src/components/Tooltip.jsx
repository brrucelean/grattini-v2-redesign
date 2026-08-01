import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, FONT } from "../data/theme.js";

// Il tooltip è l'unico posto dove vivono le spiegazioni delle regole (statistiche
// unghie, nodi mappa, effetti reliquie): su touch NON può essere disattivato,
// altrimenti quelle informazioni sono irraggiungibili. Feature detection standard:
// se il device non ha hover o ha un puntatore grosso (dito) passiamo alla
// modalità tap-to-toggle; altrimenti resta l'hover classico.
const isTouchDevice =
  window.matchMedia("(hover: none)").matches ||
  window.matchMedia("(pointer: coarse)").matches;

const TIP_W = 220;   // stessa maxWidth del riquadro, serve per il clamp orizzontale
const TIP_H = 72;    // altezza stimata, solo per decidere sopra/sotto

export function Tooltip({ text, children, color }) {
  const [pos, setPos] = useState(null);
  const [shown, setShown] = useState(false); // dissolvenza in entrata
  const wrapRef = useRef(null);
  const borderCol = color || C.magenta;

  // Fade-in: montiamo a opacità 0 e passiamo a 1 al frame successivo, così la
  // transizione CSS ha un valore di partenza da cui animare.
  useEffect(() => {
    if (!pos) { setShown(false); return; }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [pos]);

  // Touch: un tap in qualsiasi altro punto chiude il tooltip aperto.
  useEffect(() => {
    if (!isTouchDevice || !pos) return;
    const onDocDown = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      setPos(null);
    };
    document.addEventListener("pointerdown", onDocDown, true);
    return () => document.removeEventListener("pointerdown", onDocDown, true);
  }, [pos]);

  const tooltipEl = pos && text
    ? createPortal(
        <div style={{
          position:"fixed", left: pos.x, top: pos.y,
          zIndex:99999,
          background:"#0a000a", border:`2px solid ${borderCol}`,
          padding:"5px 9px", fontSize:"11px", color:C.text, fontFamily:FONT,
          maxWidth:`${TIP_W}px`, pointerEvents:"none", lineHeight:"1.5",
          whiteSpace:"pre-wrap", width:"max-content",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(-3px)",
          // Movimento ridotto: il blocco @media in scratchlite.jsx azzera le
          // transition, quindi qui il tooltip compare istantaneo.
          transition:"opacity 0.13s ease-out, transform 0.13s ease-out",
        }}>{text}</div>,
        document.body
      )
    : null;

  // ── TOUCH: tap-to-toggle, ancorato al box dell'elemento ──
  if (isTouchDevice) {
    // Nota: niente preventDefault/stopPropagation — l'onClick dei children
    // (selezione unghia, acquisto, nodo mappa...) deve continuare a funzionare.
    const toggle = () => {
      if (!text) return;
      if (pos) { setPos(null); return; }
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const x = Math.max(8, Math.min(r.left + r.width / 2 - TIP_W / 2, vw - TIP_W - 8));
      const below = r.bottom + 8;
      const y = below + TIP_H > vh ? Math.max(8, r.top - TIP_H - 8) : below;
      setPos({ x, y });
    };
    // onClickCapture e non onClick: alcuni children fermano la propagazione nel
    // loro handler, in fase di cattura il tooltip si apre comunque.
    return (
      <span ref={wrapRef} style={{display:"block", cursor:"inherit"}} onClickCapture={toggle}>
        {children}
        {tooltipEl}
      </span>
    );
  }

  // ── MOUSE: hover come prima, ma il riquadro si ANCORA alla prima posizione
  //    utile invece di inseguire il cursore ad ogni mousemove ──
  return (
    <span ref={wrapRef} style={{display:"block", cursor:"inherit"}}
      onMouseMove={e => {
        e.stopPropagation();
        if (pos) return; // già ancorato: niente inseguimento
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const nearRight = e.clientX > vw - 240;
        const nearBottom = e.clientY > vh - 80;
        const x = nearRight ? e.clientX - 230 : e.clientX + 14;
        const y = nearBottom ? e.clientY - 60 : e.clientY + 18;
        setPos({ x, y });
      }}
      onMouseLeave={() => setPos(null)}>
      {children}
      {tooltipEl}
    </span>
  );
}
