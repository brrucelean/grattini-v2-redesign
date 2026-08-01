import { C, D, E } from "../data/theme.js";

// ─── ANIMAZIONI GLOBALI ──────────────────────────────────────
// Prima stavano tutte inline dentro scratchlite.jsx: ~90 blocchi @keyframes in
// un unico <style> in mezzo al JSX del componente radice. Qui sono un modulo a
// sé (stesso pattern di TICKET_NEON_KEYFRAMES in TicketHeader.jsx: stringa CSS
// esportata, iniettata da chi la usa) e le famiglie ridondanti sono generate da
// un'unica definizione invece che riscritte a mano.
//
// Esporta:
//   KEYFRAMES   → tutti gli @keyframes
//   EFFECTS_CSS → classi di effetto (.holo, .glass, .card3d, .btn-ui)
//   ANIM        → scorciatoie semantiche (`animation:` pronte all'uso)
//   LOOP        → le 3 durate dei loop d'attenzione

// ── HELPER: generatori di famiglie ──────────────────────────
const kf = (name, body) => `@keyframes ${name} ${body}`;
// Stessa curva, più nomi: evita di riscrivere N volte lo stesso corpo.
const kfAll = (names, body) => names.map(n => kf(n, body)).join("\n");

// Loop di opacità (respiro): da → a → da
const fade = (from, to) => `{ 0%,100% { opacity:${from}; } 50% { opacity:${to}; } }`;
// Scia luminosa orizzontale su un background-size allargato
const sweepX = (from, to) => `{ 0% { background-position: ${from} 0; } 100% { background-position: ${to} 0; } }`;
// Entrata da sotto/sopra con dissolvenza
const enterY = dy => `{ 0% { opacity:0; transform:translateY(${dy}); } 100% { opacity:1; transform:translateY(0); } }`;
// Entrata laterale (pannelli che scorrono dentro dal bordo)
const enterX = dx => `{ 0% { transform:translateX(${dx}); opacity:0; } 100% { transform:translateX(0); opacity:1; } }`;
// Comparsa "pop": entra sotto scala, supera di poco, si assesta
const pop = (from, over, overAt, withOpacity = true) =>
  `{ 0% { ${withOpacity ? "opacity:0; " : ""}transform:scale(${from}); } ` +
  `${overAt}% { transform:scale(${over}); } ` +
  `100% { ${withOpacity ? "opacity:1; " : ""}transform:scale(1); } }`;

// Particelle scintillanti: 6 traiettorie diverse, una sola struttura.
// [scalaIniziale, [t%, opacità, dx, dy, scala] × 2, [dxFinale, dyFinale]]
const GLITTER = {
  glitA: [0.3,  [40, 1,    9, -14, 1.2], [70, 0.6,  16,  -8, 0.8], [  6, -22]],
  glitB: [0.3,  [40, 1,  -11,  10, 1.3], [70, 0.5, -18,   4, 0.9], [ -8,  18]],
  glitC: [0.4,  [35, 1,    7,  12, 1.1], [65, 0.7,  -4,  20, 0.7], [  2,  26]],
  glitD: [0.3,  [45, 1,   -8, -16, 1.4], [75, 0.4, -14,  -6, 0.8], [ -4, -24]],
  glitE: [0.35, [50, 1,   14,   6, 1.2], [80, 0.5,  20,  -4, 0.7], [ 10, -14]],
  glitF: [0.4,  [40, 0.9, -6,  14, 1.1], [60, 1,   -12,   8, 1.3], [-20,  -6]],
};
const glitterCss = Object.entries(GLITTER).map(([name, [s0, mid, late, [ex, ey]]]) =>
  kf(name, `{ 0% { opacity:0; transform:translate(0,0) scale(${s0}); }` +
    ` ${mid[0]}% { opacity:${mid[1]}; transform:translate(${mid[2]}px,${mid[3]}px) scale(${mid[4]}); }` +
    ` ${late[0]}% { opacity:${late[1]}; transform:translate(${late[2]}px,${late[3]}px) scale(${late[4]}); }` +
    ` 100% { opacity:0; transform:translate(${ex}px,${ey}px) scale(0.3); } }`)
).join("\n");

export const KEYFRAMES = `
/* ── RESPIRO / LAMPEGGIO — stessa curva, ampiezze diverse ── */
${kf("blink", fade(1, 0))}
${kf("pulse", fade(1, 0.5))}
${kf("biomePulse", fade(0.55, 1))}
${kf("dialogueCursor", "{ 0%,49% { opacity:1; } 50%,100% { opacity:0; } }")}
${kf("fadeOut", "{ 0% { opacity:1; } 70% { opacity:0.8; } 100% { opacity:0; } }")}
${kf("crtFlicker", "{ 0%,93%,100% { opacity:1; } 94% { opacity:0.91; } 96% { opacity:0.97; } 98% { opacity:0.93; } }")}
${kf("screenFlash", "{ 0% { opacity:1; } 40% { opacity:1; } 100% { opacity:0; } }")}

/* ── SCIE ORIZZONTALI (foil / sheen) — 2 ampiezze, 4 nomi in uso ── */
${kfAll(["variantShimmer", "goldSheen"], sweepX("-200%", "200%"))}
${kfAll(["foilShine", "holoGlide"], sweepX("-150%", "250%"))}
${kf("holoSweep", "{ 0% { background-position: 0% 0%; } 100% { background-position: 300% 300%; } }")}
${kf("newsTicker", "{ 0% { transform: translateX(0); } 100% { transform: translateX(calc(-100% - 100vw)); } }")}
${kf("lineFlow", "{ 0% { stroke-dashoffset:20; } 100% { stroke-dashoffset:0; } }")}

/* ── ENTRATE — stessa dissolvenza, distanze diverse ── */
${kf("screenIn", enterY("5px"))}
${kf("dialogueIn", enterY("8px"))}
${kf("slideUp", enterY("10px"))}
${kf("scratchTopBarIn", enterY("-10px"))}
${kf("achievementSlide", enterX("120%"))}
${kf("inventorySlideIn", enterX("100%"))}
${kf("chipIn", "{ 0% { opacity:0; transform:translateX(-6px) scale(0.9); } 100% { opacity:1; transform:translateX(0) scale(1); } }")}
${kf("screenFadeIn", "{ 0% { opacity:0; transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }")}
${kf("scratchCardSlideIn", "{ 0% { opacity:0; transform:translateY(18px) scale(0.97); } 100% { opacity:1; transform:translateY(0) scale(1); } }")}
${kf("statTileIn", "{ 0% { transform:scale(0.7) translateY(10px); opacity:0; } 100% { transform:scale(1) translateY(0); opacity:1; } }")}

/* ── POP — comparse elastiche, stessa struttura ── */
${kf("popIn", pop(0.86, 1.05, 60))}
${kf("itemFoundIn", pop(0.8, 1.04, 55))}
${kf("nodePop", pop(0.85, 1.05, 60, false))}

/* ── GLOW / NEON ── */
${kf("glow", `{ 0%,100% { text-shadow: 0 0 5px ${C.gold}; } 50% { text-shadow: 0 0 20px ${C.gold}, 0 0 40px ${C.gold}44; } }`)}
${kf("neonPulse", `{ 0%,100% { box-shadow: 0 0 5px ${C.cyan}22, 0 0 10px ${C.cyan}11; } 50% { box-shadow: 0 0 12px ${C.cyan}44, 0 0 24px ${C.cyan}22; } }`)}
${kf("slotGlow", `{ 0%,100% { box-shadow: 0 0 8px ${C.gold}33, 0 0 16px ${C.gold}18; } 50% { box-shadow: 0 0 16px ${C.gold}55, 0 0 32px ${C.gold}28; } }`)}
${kf("winFlash", `{ 0% { box-shadow: 0 0 0px ${C.green}00; } 50% { box-shadow: 0 0 30px ${C.green}88, 0 0 60px ${C.green}44; } 100% { box-shadow: 0 0 12px ${C.green}33; } }`)}
${kf("neonText", "{ 0%,100% { text-shadow: 0 0 4px currentColor; } 50% { text-shadow: 0 0 12px currentColor, 0 0 24px currentColor; } }")}
${kf("borderGlow", "{ 0%,100% { box-shadow:0 0 4px currentColor33; } 50% { box-shadow:0 0 12px currentColor66, 0 0 24px currentColor22; } }")}
${kf("bossGlow", "{ 0%,100% { box-shadow:0 0 14px #ff2244aa,0 0 28px #ff224466,0 0 2px #fff; } 50% { box-shadow:0 0 28px #ff2244ff,0 0 56px #ff224499,0 0 4px #fff; } }")}
${kf("oroGlint", "{ 0%,100% { box-shadow: 0 0 36px #ffd700ff, 0 0 64px #ffaa00aa, inset 0 0 36px #ffaa0099; } 50% { box-shadow: 0 0 52px #ffee44ff, 0 0 96px #ffcc00dd, inset 0 0 48px #ffcc00cc; } }")}
${kf("moneyBling", `{ 0% { text-shadow: none; box-shadow: 0 0 6px ${C.gold}44; } 25% { text-shadow: 0 0 14px ${C.gold}, 0 0 28px ${C.gold}99; box-shadow: 0 0 22px ${C.gold}88, inset 0 0 10px ${C.gold}33; } 60% { text-shadow: 0 0 8px ${C.gold}; box-shadow: 0 0 12px ${C.gold}55; } 100% { text-shadow: none; box-shadow: 0 0 6px ${C.gold}44; } }`)}
${kf("asciiFlicker", "{ 0%,100% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } 47% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } 48% { text-shadow: 0 0 2px currentColor, 0 0 6px currentColor44; } 52% { text-shadow: 0 0 2px currentColor, 0 0 6px currentColor44; } 53% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } }")}
${kf("foilHue", "{ 0%,100% { filter: hue-rotate(0deg) saturate(1); } 50% { filter: hue-rotate(18deg) saturate(1.3); } }")}
${kf("itemGlowRing", "{ 0%,100% { opacity:0.55; transform:scale(0.94); } 50% { opacity:1; transform:scale(1.08); } }")}
${kf("titleBlink", `{ 0%,100% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } 48% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } 50% { text-shadow: 0 0 40px ${C.gold}, 0 0 80px ${C.gold}aa, 0 0 120px ${C.gold}55; opacity:0.7; } 52% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } }`)}

/* ── TRASFORMAZIONI / IMPATTI ── */
${kf("stampIn", "{ 0% { transform: rotate(-12deg) scale(3); opacity:0; } 50% { transform: rotate(-12deg) scale(0.9); opacity:1; } 70% { transform: rotate(-12deg) scale(1.1); } 100% { transform: rotate(-12deg) scale(1.2); opacity:1; } }")}
${kf("screenShake", "{ 0% { transform: translate(0,0); } 10% { transform: translate(-4px,2px); } 20% { transform: translate(4px,-2px); } 30% { transform: translate(-3px,-3px); } 40% { transform: translate(3px,3px); } 50% { transform: translate(-2px,1px); } 60% { transform: translate(2px,-1px); } 70% { transform: translate(-1px,2px); } 80% { transform: translate(1px,-1px); } 90% { transform: translate(-1px,0); } 100% { transform: translate(0,0); } }")}
${kf("telePulse", "{ 0%,100% { transform:scale(1); filter:brightness(1); } 50% { transform:scale(1.08); filter:brightness(1.35); } }")}
${kf("nailCrit", "{ 0% { transform:scale(1); } 20% { transform:scale(1.18); filter:brightness(1.6); } 50% { transform:scale(0.94); } 100% { transform:scale(1); filter:brightness(1); } }")}
${kf("comboPulse", "{ 0% { transform:translateX(-50%) scale(1); box-shadow:0 0 30px #ffaa0088,0 0 60px #ffaa0044; } 100% { transform:translateX(-50%) scale(1.06); box-shadow:0 0 50px #ffaa00cc,0 0 100px #ffaa0066; } }")}
${kf("variantReveal", "{ 0% { transform: scale(0.7) rotate(-8deg); filter: brightness(3) saturate(2); } 40% { transform: scale(1.15) rotate(2deg); filter: brightness(2) saturate(1.8); } 70% { transform: scale(0.96) rotate(-1deg); } 100% { transform: scale(1) rotate(0); filter: brightness(1) saturate(1); } }")}
${kf("variantPulse", "{ 0%,100% { filter: brightness(1) saturate(1); } 50% { filter: brightness(1.35) saturate(1.4); } }")}
${kf("variantSparkle", "{ 0% { opacity: 0; transform: scale(0.3) rotate(0); } 40% { opacity: 1; transform: scale(1.2) rotate(120deg); } 100% { opacity: 0; transform: scale(0.4) rotate(240deg); } }")}
${kf("titleGlitter", "{ 0% { opacity:0; transform:scale(0.4) translateY(0); } 25% { opacity:1; transform:scale(1.3) translateY(-3px); } 60% { opacity:0.5; transform:scale(0.9) translateY(-7px); } 100% { opacity:0; transform:scale(0.3) translateY(-14px); } }")}

/* ── PARTICELLE ── */
${glitterCss}
${kf("floatUp", "{ 0% { transform:translateY(0) scale(1); opacity:0.7; } 100% { transform:translateY(-18px) scale(0.5); opacity:0; } }")}
${kf("coinFly", "{ 0% { transform:translate(0,0) rotate(0deg); opacity:1; } 100% { transform:translate(var(--dx,0), var(--dy,-60px)) rotate(var(--rot,0deg)); opacity:0; } }")}
${kf("combatFloat", "{ 0% { transform:translate(-50%, 0) scale(0.6); opacity:0; } 18% { transform:translate(-50%, -6px) scale(1.15); opacity:1; } 100% { transform:translate(-50%, -46px) scale(1); opacity:0; } }")}
${kf("confettiDrop", "{ 0% { transform:translateY(-20px) rotate(0deg); opacity:1; } 100% { transform:translateY(120px) rotate(720deg); opacity:0; } }")}
${kf("smokeRise", `{
  0%   { transform: translateY(0) translateX(0) scale(1); opacity:0; }
  12%  { opacity:0.45; }
  70%  { opacity:0.18; }
  100% { transform: translateY(-78vh) translateX(36px) scale(2.1); opacity:0; }
}`)}
${kf("neonFlickerT", `{
  0%,100% { opacity:1; }
  3%  { opacity:0.55; } 4%  { opacity:1; }
  7%  { opacity:0.8; }  8%  { opacity:1; }
  42% { opacity:1; }    43% { opacity:0.5; }
  44% { opacity:1; }    71% { opacity:1; }
  72% { opacity:0.75; } 73% { opacity:1; }
}`)}

/* ── FINALI: GAME OVER / VITTORIA ── */
${kf("gameOverFlicker", `{
  0%,100% { opacity:1; text-shadow: 0 0 16px #ff0022cc, 0 0 40px #ff002288; }
  8%  { opacity:0.7; text-shadow: 0 0 4px #ff002244; }
  10% { opacity:1; text-shadow: 0 0 24px #ff0022ff, 0 0 60px #ff002299; }
  55% { opacity:1; text-shadow: 0 0 16px #ff0022cc, 0 0 40px #ff002288; }
  56% { opacity:0.5; }
  57% { opacity:1; text-shadow: 0 0 40px #ff0022ff; }
}`)}
${kf("gameOverBorder", `{
  0%,100% { box-shadow: 0 0 28px #ff002277, inset 0 0 32px #ff002214; }
  50%     { box-shadow: 0 0 60px #ff0022bb, inset 0 0 60px #ff002230; }
}`)}
${kf("gameOverSkull", "{ 0% { transform:translateY(0) scale(1); } 10% { transform:translateY(-6px) scale(1.08); } 25% { transform:translateY(2px) scale(0.96); } 100% { transform:translateY(0) scale(1); } }")}
${kf("victoryGoldPulse", "{ 0%,100% { text-shadow: 0 0 12px #ffd700bb, 0 0 40px #ffd70066; } 50% { text-shadow: 0 0 30px #ffd700ff, 0 0 80px #ffd700aa, 0 0 120px #ffcc0055; } }")}

/* ── LAYER HOLO ── */
${kf("holoBreath", `{
  0%,100% { transform: perspective(700px) rotateX(1.4deg) rotateY(-2.2deg) translateY(0); }
  50%     { transform: perspective(700px) rotateX(-1.4deg) rotateY(2.2deg) translateY(-3px); }
}`)}
${kf("holoTitleHue", `{
  0%,100% { filter: hue-rotate(-12deg) saturate(1.1); }
  50%     { filter: hue-rotate(28deg) saturate(1.5) brightness(1.1); }
}`)}

/* ── FEEDBACK COMBATTIMENTO / GRATTATA (fase 2 dell'audit) ── */
/* Shake leggero — colpi subiti "normali". Lo screenShake pieno resta
   riservato ai colpi pesanti e all'ingresso in FURIA. */
${kf("screenShakeLight", `{
  0% { transform: translate(0,0); } 20% { transform: translate(-2px,1px); }
  40% { transform: translate(2px,-1px); } 60% { transform: translate(-1px,-1px); }
  80% { transform: translate(1px,1px); } 100% { transform: translate(0,0); }
}`)}
/* Colpo PERFETTO: lo sprite nemico sbianca e scatta in scala */
${kf("perfectHitFlash", `{
  0% { transform:scale(1); filter:brightness(1); }
  12% { transform:scale(1.10); filter:brightness(3.2) saturate(0.2); }
  45% { transform:scale(1.06); filter:brightness(1.8) saturate(0.7); }
  100% { transform:scale(1); filter:brightness(1) saturate(1); }
}`)}
${kf("perfectRing", "{ 0% { opacity:0.95; transform:scale(0.75); } 100% { opacity:0; transform:scale(1.5); } }")}
/* Coriandoli localizzati sulla cella vincente del grattino */
${kf("cellBurst", `{
  0% { transform:translate(-50%,-50%) scale(0.3) rotate(0deg); opacity:0; }
  15% { opacity:1; }
  55% { transform:translate(calc(-50% + var(--dx,0px) * 0.75), calc(-50% + var(--dy,0px) * 0.75)) scale(1.15) rotate(var(--rot,180deg)); opacity:1; }
  100% { transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px) + 14px)) scale(0.5) rotate(calc(var(--rot,180deg) * 2)); opacity:0; }
}`)}
`;

// ─── CLASSI DI EFFETTO ───────────────────────────────────────
// .holo        → overlay arcobaleno iridescente + sweep di luce diagonale
// .holo-strong → variante più intensa (title screen, card leggendarie)
// .glass       → pannello traslucido con blur (vince sugli inline style)
// .card3d      → respiro prospettico 3D continuo, delay sfalsati
// .btn-ui      → stato :active dei bottoni condivisi (vedi Btn.jsx)
export const EFFECTS_CSS = `
/* .foil-ascii::after rimosso — il shimmer diagonale con mix-blend-mode:screen
   creava un "contorno brillante" deformato sulle lettere box-drawing del titolo.
   Il class resta no-op per back-compat; il titolo ora si affida solo al gold
   base + text-shadow + asciiFlicker. */
.foil-ascii { position: relative; display: inline-block; animation: crtFlicker 14s ease-in-out infinite; }

.holo { position: relative; isolation: isolate; }
.holo::before {
  content:""; position:absolute; inset:0; z-index:4; pointer-events:none;
  background: linear-gradient(115deg,
    rgba(255,0,80,0.30) 0%, rgba(255,160,0,0.24) 14%, rgba(255,240,0,0.20) 28%,
    rgba(0,255,140,0.20) 42%, rgba(0,220,255,0.28) 56%, rgba(80,80,255,0.26) 70%,
    rgba(220,0,255,0.28) 84%, rgba(255,0,80,0.30) 100%);
  background-size: 320% 320%;
  mix-blend-mode: screen;
  opacity: 0.26;
  animation: holoSweep 6s linear infinite;
}
.holo::after {
  content:""; position:absolute; inset:0; z-index:5; pointer-events:none;
  background: linear-gradient(100deg, transparent 36%, rgba(255,255,255,0.30) 47%, rgba(255,255,255,0.06) 53%, transparent 64%);
  background-size: 260% 100%;
  mix-blend-mode: screen;
  animation: holoGlide 3.4s linear infinite;
}
.holo-strong::before { opacity: 0.45; }
.holo-strong::after  { animation-duration: 2.6s; }
.glass {
  background: rgba(8,10,24,0.55) !important;
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
}
.card3d { transform-style: preserve-3d; animation: holoBreath 7s ease-in-out infinite; will-change: transform; }
.card3d:nth-child(2) { animation-delay: -1.8s; }
.card3d:nth-child(3) { animation-delay: -3.5s; }
.card3d:nth-child(4) { animation-delay: -5.2s; }
.holo-title { animation: holoTitleHue 9s ease-in-out infinite; }

/* Bottoni condivisi: il premuto va sentito. Il transform sta qui e non nella
   transition inline apposta — deve scattare secco, non dissolvere. */
.btn-ui:active { transform: scale(0.96); }
.btn-ui:disabled:active { transform: none; }

.map-snap-scroll { scroll-snap-type: y mandatory; }

@media (prefers-reduced-motion: reduce) {
  .holo::before, .holo::after, .card3d, .holo-title { animation: none !important; }
}
`;

// ─── LOOP D'ATTENZIONE ───────────────────────────────────────
// Il blink di opacità (`pulse`) girava a 11 durate diverse sparse per il
// codice — 0.4s, 0.5s, 0.6s, 0.8s, 1s, 1.2s, 1.4s, 1.5s, 1.8s, 2s, 2.4s —
// senza che la differenza volesse dire niente. Restano 3 velocità, ognuna con
// un ruolo dichiarato: chi le legge sa cosa sta guardando.
export const LOOP = {
  urgent:  "600ms",   // "agisci ORA" — vite in rosso, timer, pericolo
  active:  "1200ms",  // "questo è selezionabile / vivo" — target, slot liberi
  ambient: "2400ms",  // decorativo — respiro di fondo, nulla da fare
};

// Curva simmetrica: un respiro deve andare e tornare allo stesso modo.
// (E.out / E.impact sono per le transizioni di stato, non per i loop.)
const LOOP_EASE = "ease-in-out";

export const ANIM = {
  pulseUrgent:  `pulse ${LOOP.urgent} ${LOOP_EASE} infinite`,
  pulseActive:  `pulse ${LOOP.active} ${LOOP_EASE} infinite`,
  pulseAmbient: `pulse ${LOOP.ambient} ${LOOP_EASE} infinite`,
  // Lampeggio singolo di conferma, non un loop.
  pulseOnce:    `pulse ${D.emphatic} ${E.out}`,
  // Entrate standard.
  enter:        `screenIn ${D.base} ${E.out}`,
  popIn:        `popIn ${D.base} ${E.impact}`,
};
