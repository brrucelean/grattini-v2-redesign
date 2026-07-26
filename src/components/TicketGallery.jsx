// ─── DEV-ONLY: galleria biglietti ────────────────────────────
// Serve a rivedere e impaginare i 17 grattini senza comprarli uno a uno dal
// tabaccaio. Non finisce in produzione: scratchlite.jsx la monta dietro
// `import.meta.env.DEV`.
//
//   ?ticket=<cardId>   apre la galleria su quella carta
//   &zoom=1.8          ingrandisce solo la resa, per ispezionare i dettagli
//   &edit=1            editor visuale: trascini i riquadri e salvi su disco
//   #puzzle / #puzzle@2  cambia carta e zoom via hash (pilotabile da console)
import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import { CARD_TYPES } from "../data/cards.js";
import { generateCard } from "../utils/card.js";
import { ScratchCardView } from "./ScratchCardView.jsx";
import { TicketLayoutEditor } from "./TicketLayoutEditor.jsx";

export function TicketGallery({ initialId }) {
  const ids = CARD_TYPES.map(t => t.id);
  const hashId = window.location.hash.slice(1);
  const start = ids.includes(hashId) ? hashId : ids.includes(initialId) ? initialId : ids[0];
  const [id, setId] = useState(start);
  const [seed, setSeed] = useState(0);
  const card = generateCard(id);
  // ?zoom=N ingrandisce solo la resa (il layout resta quello reale) per ispezione.
  const [zoom, setZoom] = useState(
    Number(new URLSearchParams(window.location.search).get("zoom")) || 1
  );
  // ?edit=1 accende l'editor visuale dell'impaginazione
  const edit = new URLSearchParams(window.location.search).get("edit") === "1";
  const [override, setOverride] = useState(null);

  // Il biglietto (più i controlli sotto, e il pannello dell'editor) è più alto
  // del viewport: senza adattamento resta tagliato e non si impagina. Si misura
  // l'altezza NATURALE del contenuto — offsetHeight è in px di layout, quindi
  // non cambia quando applichiamo lo zoom sopra e non innesca un loop — e si
  // ricava il fattore che lo fa stare tutto dentro. Lo zoom da URL può solo
  // rimpicciolire: ingrandire rimetterebbe il biglietto fuori schermo.
  const barRef = useRef(null);
  const fitRef = useRef(null);
  const [autoFit, setAutoFit] = useState(1);

  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const natural = el.offsetHeight;
      if (!natural) return;
      const bar = barRef.current?.offsetHeight || 0;
      const avail = window.innerHeight - bar - 24;
      setAutoFit(Math.min(1, avail / natural));
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [id, edit]);

  const fitZoom = Math.min(zoom, autoFit);

  // il biglietto si rimonta solo al cambio carta/seed: trascinando l'editor si
  // aggiorna via layoutOverride, senza rigenerare le celle sotto le mani.
  const ticketView = (
    <ScratchCardView
      key={id + seed}
      card={card}
      nailState="sana"
      fortune={0}
      grattaMania={0}
      equippedGrattatore={null}
      onCellScratch={() => {}}
      onDone={() => setSeed(s => s + 1)}
      showFirstWarning={false}
      layoutOverride={edit ? override : null}
    />
  );

  // La carta si sceglie anche con l'hash (#puzzle) e lo zoom con #puzzle@1.8:
  // pilotabile da console/JS senza dipendere dai click sul pannello preview.
  useEffect(() => {
    const apply = () => {
      const [rawId, rawZoom] = window.location.hash.slice(1).split("@");
      if (ids.includes(rawId)) { setId(rawId); setSeed(s => s + 1); }
      if (rawZoom) setZoom(Number(rawZoom) || 1);
    };
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div ref={barRef} style={{
        display: "flex", flexWrap: "wrap", gap: "4px",
        padding: "6px", borderBottom: `1px solid ${C.dim}`, background: "#000",
      }}>
        {ids.map(x => (
          <button key={x} onClick={() => { setId(x); setSeed(s => s + 1); }} style={{
            fontFamily: FONT, fontSize: "10px", cursor: "pointer",
            padding: "3px 6px",
            background: x === id ? C.gold : "#111",
            color: x === id ? "#000" : C.text,
            border: `1px solid ${x === id ? C.gold : C.dim}`,
          }}>{x}</button>
        ))}
        <button onClick={() => setSeed(s => s + 1)} style={{
          fontFamily: FONT, fontSize: "10px", cursor: "pointer", padding: "3px 6px",
          background: "#111", color: C.cyan, border: `1px solid ${C.cyan}`,
        }}>↻ rigenera</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "8px", zoom: fitZoom }}>
        <div ref={fitRef} style={{ width: "100%", maxWidth: "700px" }}>
          {edit ? (
            <TicketLayoutEditor cardId={id} onChange={setOverride}>{ticketView}</TicketLayoutEditor>
          ) : ticketView}
        </div>
      </div>
    </div>
  );
}
