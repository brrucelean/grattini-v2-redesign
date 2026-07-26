// ─── DEV-ONLY: editor visuale dell'impaginazione biglietti ──────────────────
// Sovrappone al biglietto due riquadri trascinabili:
//   PLAY   → dove va la griglia delle celle grattabili
//   HEADER → dove vanno titolo e badge costo/max
// Si trascina il corpo per spostare, le maniglie per ridimensionare. SALVA fa
// POST a /__ticket-layout e il plugin Vite riscrive src/data/ticketLayout.js.
import { useState, useRef, useEffect } from "react";
import { C, FONT } from "../data/theme.js";
import { TICKET_LAYOUT, TICKET_LAYOUT_FALLBACK } from "../data/ticketLayout.js";

const HANDLES = ["n", "s", "w", "e", "nw", "ne", "sw", "se"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = v => Math.round(v * 10) / 10;

// rect {top,left,right,bottom} in % → box {x,y,w,h} in %
const toBox = r => ({ x: r.left, y: r.top, w: 100 - r.left - r.right, h: 100 - r.top - r.bottom });
const toRect = b => ({ top: r1(b.y), left: r1(b.x), right: r1(100 - b.x - b.w), bottom: r1(100 - b.y - b.h) });

export function TicketLayoutEditor({ cardId, onChange, children }) {
  const wrapRef = useRef(null);
  // I riquadri devono coprire la FACCIA del biglietto (il box 4:3), non tutto il
  // componente: la si trova col data-attribute e la si insegue mentre il layout
  // cambia, così le percentuali corrispondono davvero a quelle del CSS.
  // La galleria applica un CSS `zoom` al contenitore: getBoundingClientRect
  // restituisce pixel GIÀ zoomati, ma l'overlay vive dentro lo stesso zoom e li
  // scalerebbe una seconda volta. Si misura quindi il fattore e si riportano le
  // misure a pixel di layout (per il CSS); il drag resta in pixel visivi,
  // perché e.clientX lo è.
  const [face, setFace] = useState(null);
  const scaleRef = useRef(1);
  const [layout, setLayout] = useState(() => {
    const base = TICKET_LAYOUT[cardId] || TICKET_LAYOUT_FALLBACK;
    return { play: { ...base.play }, header: { ...base.header } };
  });
  const [active, setActive] = useState("play");
  const [status, setStatus] = useState(null);
  const drag = useRef(null);

  // cambiando carta si riparte dal layout salvato di quella carta
  useEffect(() => {
    const base = TICKET_LAYOUT[cardId] || TICKET_LAYOUT_FALLBACK;
    setLayout({ play: { ...base.play }, header: { ...base.header } });
    setStatus(null);
  }, [cardId]);

  // anteprima dal vivo: il biglietto si reimpagina mentre trascini
  useEffect(() => { onChange?.(layout); }, [layout, onChange]);

  // segue posizione/dimensione della faccia del biglietto
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const measure = () => {
      const el = wrap.querySelector("[data-ticket-face]");
      if (!el) return setFace(null);
      const w = wrap.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const scale = wrap.offsetWidth > 0 ? w.width / wrap.offsetWidth : 1;
      scaleRef.current = scale || 1;
      setFace({
        left: (r.left - w.left) / scaleRef.current,
        top: (r.top - w.top) / scaleRef.current,
        width: r.width / scaleRef.current,
        height: r.height / scaleRef.current,
      });
    };
    measure();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    ro.observe(wrap);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [cardId]);

  const onPointerDown = (e, key, handle) => {
    e.preventDefault();
    e.stopPropagation();
    if (!face) return;
    // face è in px di layout, e.clientX in px visivi: si riscala per il delta
    const s = scaleRef.current || 1;
    const host = { width: face.width * s, height: face.height * s };
    setActive(key);
    drag.current = { key, handle, host, startX: e.clientX, startY: e.clientY, box: toBox(layout[key]) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = e => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / d.host.width) * 100;
    const dy = ((e.clientY - d.startY) / d.host.height) * 100;
    const b = { ...d.box };
    const MIN = 4;

    if (!d.handle) {
      b.x = clamp(b.x + dx, -20, 100 - b.w + 20);
      b.y = clamp(b.y + dy, -20, 100 - b.h + 20);
    } else {
      if (d.handle.includes("w")) { const nx = Math.min(b.x + dx, b.x + b.w - MIN); b.w += b.x - nx; b.x = nx; }
      if (d.handle.includes("e")) { b.w = Math.max(MIN, b.w + dx); }
      if (d.handle.includes("n")) { const ny = Math.min(b.y + dy, b.y + b.h - MIN); b.h += b.y - ny; b.y = ny; }
      if (d.handle.includes("s")) { b.h = Math.max(MIN, b.h + dy); }
    }
    setLayout(l => ({ ...l, [d.key]: { ...l[d.key], ...toRect(b) } }));
  };

  const endDrag = () => { drag.current = null; };

  // frecce = nudge di 0.5% (shift = 2%) sul riquadro attivo
  useEffect(() => {
    const onKey = e => {
      const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const mv = map[e.key];
      if (!mv) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      e.preventDefault();
      const step = (e.shiftKey ? 2 : 0.5);
      setLayout(l => {
        const b = toBox(l[active]);
        b.x += mv[0] * step; b.y += mv[1] * step;
        return { ...l, [active]: { ...l[active], ...toRect(b) } };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const save = async () => {
    setStatus("salvo…");
    try {
      const all = { ...TICKET_LAYOUT, [cardId]: layout };
      const res = await fetch("/__ticket-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all),
      });
      const json = await res.json();
      setStatus(json.ok ? `✓ salvato — ${json.saved}` : `✗ ${json.error}`);
    } catch (err) {
      setStatus(`✗ ${err.message}`);
    }
  };

  const reset = () => {
    const base = TICKET_LAYOUT[cardId] || TICKET_LAYOUT_FALLBACK;
    setLayout({ play: { ...base.play }, header: { ...base.header } });
    setStatus("ripristinato dal file");
  };

  const box = (key, color, label) => {
    const b = toBox(layout[key]);
    const on = active === key;
    return (
      <div
        onPointerDown={e => onPointerDown(e, key, null)}
        style={{
          position: "absolute",
          left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`,
          border: `2px ${on ? "solid" : "dashed"} ${color}`,
          background: on ? `${color}22` : `${color}0d`,
          boxShadow: on ? `0 0 14px ${color}88, inset 0 0 20px ${color}22` : "none",
          cursor: "move", zIndex: on ? 61 : 60, touchAction: "none",
        }}>
        <span style={{
          position: "absolute", top: "-9px", left: "4px",
          background: color, color: "#000", fontFamily: FONT,
          fontSize: "9px", fontWeight: "bold", padding: "1px 5px", letterSpacing: "1px",
        }}>{label}</span>
        {HANDLES.map(h => (
          <div key={h}
            onPointerDown={e => onPointerDown(e, key, h)}
            style={{
              position: "absolute", width: "11px", height: "11px",
              background: color, border: "1px solid #000", touchAction: "none",
              ...(h.includes("n") ? { top: "-6px" } : h.includes("s") ? { bottom: "-6px" } : { top: "calc(50% - 6px)" }),
              ...(h.includes("w") ? { left: "-6px" } : h.includes("e") ? { right: "-6px" } : { left: "calc(50% - 6px)" }),
              cursor: `${h}-resize`,
            }}/>
        ))}
      </div>
    );
  };

  const readout = key => {
    const r = layout[key];
    return `top:${r.top} left:${r.left} right:${r.right} bottom:${r.bottom}`;
  };

  const btn = (onClick, label, color) => (
    <button onClick={onClick} style={{
      fontFamily: FONT, fontSize: "11px", cursor: "pointer", padding: "4px 10px",
      background: "#111", color, border: `1px solid ${color}`, fontWeight: "bold",
    }}>{label}</button>
  );

  return (
    <div onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        {children}
        {face && (
          <div style={{
            position: "absolute",
            left: face.left, top: face.top, width: face.width, height: face.height,
            zIndex: 60, pointerEvents: "none",
          }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
              {box("play", C.cyan, "PLAY — celle")}
              {box("header", C.magenta, "HEADER — titolo + badge")}
            </div>
          </div>
        )}
      </div>

      <div style={{
        marginTop: "10px", padding: "8px 10px", fontFamily: FONT, fontSize: "11px",
        color: C.text, background: "#0a0a14", border: `1px solid ${C.dim}`,
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: C.gold }}>{cardId}</strong>
          {btn(() => setActive("play"), active === "play" ? "▸ PLAY" : "PLAY", C.cyan)}
          {btn(() => setActive("header"), active === "header" ? "▸ HEADER" : "HEADER", C.magenta)}
          <label style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            dir:
            <select value={layout.header.dir}
              onChange={e => setLayout(l => ({ ...l, header: { ...l.header, dir: e.target.value } }))}
              style={{ fontFamily: FONT, fontSize: "11px", background: "#111", color: C.text, border: `1px solid ${C.dim}` }}>
              <option value="col">col</option>
              <option value="row">row</option>
            </select>
          </label>
          {btn(save, "💾 SALVA", C.green)}
          {btn(reset, "↺ ANNULLA", C.dim)}
        </div>
        <div style={{ color: C.cyan }}>PLAY&nbsp;&nbsp; {readout("play")}</div>
        <div style={{ color: C.magenta }}>HEADER {readout("header")} dir:{layout.header.dir}</div>
        <div style={{ color: C.dim, fontSize: "10px" }}>
          trascina il riquadro per spostarlo · maniglie per ridimensionare · frecce = 0,5% (shift = 2%)
        </div>
        {status && <div style={{ color: status.startsWith("✓") ? C.green : status.startsWith("✗") ? C.red : C.gold }}>{status}</div>}
      </div>
    </div>
  );
}
