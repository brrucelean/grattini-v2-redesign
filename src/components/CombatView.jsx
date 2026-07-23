import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import {
  COMBAT_CARD_H, CAT_EMOJI_MAP, CAT_BG,
  ENEMY_STATS, DEFAULT_ENEMY_STATS, EFFECT_DAMAGE,
} from "../data/combat.js";
import { roll, pick } from "../utils/random.js";
import { makeNailCursor } from "../utils/nail.js";
import { generateCombatHand, generateCombatCard, CARD_VARIANTS } from "../utils/combat.js";
import { SPR_BIG } from "../data/art.js";
import { AudioEngine, ParticleSystem } from "../audio.js";
import { hasRelic } from "../utils/hasRelic.js";
import { Btn } from "./Btn.jsx";
import { NailDisplay } from "./NailDisplay.jsx";

// Nomi categoria abbreviati — COMBATTIMENTO è troppo lungo per le card strette
const CAT_SHORT = { COMBATTIMENTO: "ATTACCO", DIFESA: "DIFESA", DENARO: "DENARO" };

// Sprite ASCII del nemico (schermo "mostro" sopra le barre — come da bozza)
function enemySpriteKey(enemy) {
  const n = enemy?.name;
  if (n === "Il Drago d'Oro") return "drago";
  if (n === "Ladro" || n === "Ladro Nascosto") return "ladro";
  if (enemy?.isBoss) return "boss";
  return "miniboss";
}


// ─── COMBAT CARD SCRATCH ─────────────────────────────────────
export function CombatCardScratch({ cell, onRevealed, catColors, disabled, nailState = "sana" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const revealed = useRef(false);
  const [isRevealed, setIsRevealed] = useState(false); // al reveal la patina sparisce del tutto
  const lastScratchSound = useRef(0); // throttle audio
  const nailCursor = makeNailCursor(nailState);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Base oro pulito — gradiente caldo, senza rumore eccessivo
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0,   "#c09008");
    grad.addColorStop(0.3, "#f0c830");
    grad.addColorStop(0.55,"#ffe066");
    grad.addColorStop(0.8, "#e8c000");
    grad.addColorStop(1,   "#a87800");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Noise leggerissimo — quasi invisibile
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    for (let i = 0; i < 55; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillRect(x, y, 1, 1);
    }
    // Strisce diagonali sottilissime — appena percettibili
    ctx.globalAlpha = 0.025;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + canvas.height, canvas.height); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Hint "GRATTA" in basso
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#3a2000";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("G R A T T A", canvas.width / 2, canvas.height - 7);
    ctx.globalAlpha = 1;
    // Bordo interno scuro
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }, []);

  const doScratch = (e) => {
    if (revealed.current || disabled) return;
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
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.fill();
    // Polverina d'oro a ogni passata
    ParticleSystem.spawn(clientX, clientY, 18, false);
    // Suono della grattata — throttled a ogni 80ms per non spammare
    const now = Date.now();
    if (now - lastScratchSound.current > 80) {
      AudioEngine.scratch();
      lastScratchSound.current = now;
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 100) transparent++;
    if (transparent / (canvas.width * canvas.height) > 0.30 && !revealed.current) {
      revealed.current = true;
      // Reveal completo: pulisci TUTTA la patina d'oro in un colpo (come i grattini originali)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Burst di polverina su tutta la carta
      for (let k = 0; k < 6; k++) {
        ParticleSystem.spawn(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height, 12, false);
      }
      AudioEngine.scratch();
      setIsRevealed(true);
      onRevealed();
    }
  };

  const evts = {
    onMouseDown: (e) => { drawing.current = true; doScratch(e); },
    onMouseMove: (e) => { if (drawing.current) doScratch(e); },
    onMouseUp:   () =>  { drawing.current = false; },
    onMouseLeave:() =>  { drawing.current = false; },
    onTouchStart:(e) => { drawing.current = true; doScratch(e); e.preventDefault(); },
    onTouchMove: (e) => { if (drawing.current) doScratch(e); e.preventDefault(); },
    onTouchEnd:  () =>  { drawing.current = false; },
  };

  return (
    <div style={{
      position:"relative", borderRadius:"0", overflow:"hidden",
      border: disabled ? `2px solid #333` : `2px solid ${C.gold}`,
      // Sfondo OPACO scuro — niente bleeding del contenuto
      background: disabled ? "#111" : CAT_BG[cell.category] || "#0a0a12",
      height:`${COMBAT_CARD_H}px`,
      boxShadow: disabled ? "none" : `0 0 14px ${C.gold}66, inset 0 0 20px rgba(0,0,0,0.5)`,
      cursor: disabled ? "default" : "crosshair",
      touchAction: "none",
    }} {...evts}>

      {/* Canvas oro — sempre montato finché non rivelata (mai smontato/rimontato:
          l'effetto di pittura gira una sola volta al mount del componente, quindi
          smontare e rimontare il <canvas> lo lascerebbe vuoto/trasparente).
          Il blocco "disabled" è puramente visivo (overlay sotto) + il check
          in doScratch, non tocca il DOM del canvas. */}
      {!isRevealed && (
        <canvas ref={canvasRef} width={220} height={160}
          style={{
            position:"absolute", inset:0, width:"100%", height:"100%",
            display:"block", cursor: disabled ? "default" : nailCursor, touchAction:"none",
            opacity: disabled ? 0.35 : 1,
            filter: disabled ? "grayscale(60%)" : "none",
          }}
        />
      )}

      {/* Badge categoria — SOPRA il canvas, sempre visibile */}
      <div style={{
        position:"absolute", inset:0,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        pointerEvents:"none", zIndex:3,
        gap:"6px",
      }}>
        {disabled ? (
          <div style={{fontSize:"24px", opacity:0.2, color:C.dim}}>✕</div>
        ) : isRevealed ? (
          <>
            {/* Carta rivelata: mostra l'EFFETTO specifico (emoji + nome) */}
            <div style={{ fontSize:"30px", lineHeight:1 }}>
              {cell.emoji || CAT_EMOJI_MAP[cell.category] || "?"}
            </div>
            <div style={{
              fontSize:"12px", fontWeight:"bold", letterSpacing:"0.5px",
              color: catColors[cell.category] || C.text,
              textShadow:`0 0 6px ${catColors[cell.category] || C.text}aa`,
              textAlign:"center", padding:"0 6px", lineHeight:1.15,
            }}>
              {cell.name}
            </div>
          </>
        ) : (
          <>
            {/* Icona stampata sull'oro — colore scuro, ombra incisa */}
            <div style={{
              fontSize:"40px", lineHeight:1,
              filter:"drop-shadow(1px 2px 0px rgba(0,0,0,0.4))",
              opacity:0.85,
            }}>
              {CAT_EMOJI_MAP[cell.category] || "?"}
            </div>
            {/* Label stampata — abbreviata per evitare overflow nelle card strette */}
            <div style={{
              fontSize:"11px", fontWeight:"900", letterSpacing:"1.8px",
              color: "#4a3000",
              textShadow:"0 1px 0 rgba(255,255,200,0.4), 0 -1px 0 rgba(0,0,0,0.3)",
              textTransform:"uppercase",
            }}>
              {CAT_SHORT[cell.category] || cell.category}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── V2: helper effetti duello HP ────────────────────────────
const CAT_COLORS = { COMBATTIMENTO: C.red, DIFESA: C.blue, DENARO: C.gold };
const FURY_TURN = 3; // dal turno 3 il nemico va in FURIA (enrage): +danno, niente cura

// Risolve UNA carta del player → produce delta {dmg, loot, heals, self, block, dodge, log}
function resolvePlayerCell(c) {
  const variantMult = CARD_VARIANTS[c.variant]?.valueMult ?? 1;
  const val = Math.round((c.value || 0) * variantMult);
  switch (c.effect) {
    case "lightDamage":
      return { dmg: EFFECT_DAMAGE.lightDamage, log: `🗡️ ${c.name}: ${EFFECT_DAMAGE.lightDamage} danni!` };
    case "damageNail":
      return { dmg: EFFECT_DAMAGE.damageNail, log: `🗡️ ${c.name}: colpo pesante ${EFFECT_DAMAGE.damageNail} danni!` };
    case "berserk":
      return { dmg: EFFECT_DAMAGE.berserk, self: 1, log: `💢 ${c.name}: ${EFFECT_DAMAGE.berserk} danni — ma degradi 1 unghia!` };
    case "stealMoney": {
      const dmg = EFFECT_DAMAGE.stealMoney;
      return { dmg, loot: val, log: `🗡️ ${c.name}: ${dmg} danni + rubi €${val}!` };
    }
    case "allIn":
      return { loot: val, enemyShield: c.cost || 0, log: `🎰 ${c.name}: +€${val} (ma il nemico si copre +${c.cost||0} scudo)` };
    case "money":
      return { loot: val, log: `💰 ${c.name}: +€${val}` };
    case "gamble":
      return roll(0.5)
        ? { loot: val, log: `🎟 ${c.name}: FORTUNA! +€${val}` }
        : { loot: -(c.cost || 0), log: `🎟 ${c.name}: sfiga −€${c.cost || 0}` };
    case "freeCard": {
      const prize = pick([0, 0, 8, 12, 20]);
      return prize > 0
        ? { loot: prize, log: `🎫 ${c.name}: grattino vinto +€${prize}!` }
        : { log: `🎫 ${c.name}: grattino... niente.` };
    }
    case "heal":
      return { heals: 1, log: `💉 ${c.name}: 1 unghia curata` };
    case "adrenaline":
      return { heals: 1, altLoot: val, log: `💉 ${c.name}: cura 1 unghia (o +€${val} se sane)` };
    case "block":
      return { block: true, log: `🛡 ${c.name}: PARATA pronta — para l'attacco in arrivo!` };
    case "fortress":
      return { guard: true, loot: -(c.cost || 0), log: `🏰 ${c.name}: FORTEZZA — blocco garantito (−€${c.cost || 0})` };
    case "dodge":
      return { dodge: 1, log: `💨 ${c.name}: PARATA pronta — schiva l'attacco!` };
    default:
      return { log: `${c.name}` };
  }
}


// ─── TIMING BAR: minigioco tempismo (attacco / parata) ───────
// Un cursore oscilla su una barra; zona verde = PERFETTO, gialla = BUONO.
// Premi (click/spazio/tap) per fermarlo. onResult riceve "perfect"|"good"|"miss".
function TimingBar({ mode = "attack", speed = 1.5, onResult, perfectWiden = 0 }) {
  const isAttack = mode === "attack";
  const accent = isAttack ? C.red : C.blue;
  // zone (0..1) — perfectWiden allarga la zona verde (Fascia da Polso)
  const PERFECT = [0.44 - perfectWiden, 0.56 + perfectWiden];
  const GOOD = [0.26, 0.74];

  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const doneRef = useRef(false);
  const rafRef = useRef(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      posRef.current += dirRef.current * speed * dt;
      if (posRef.current >= 1) { posRef.current = 1; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
      if (!doneRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed]);

  const lock = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const p = posRef.current;
    let quality = "miss";
    if (p >= PERFECT[0] && p <= PERFECT[1]) quality = "perfect";
    else if (p >= GOOD[0] && p <= GOOD[1]) quality = "good";
    AudioEngine.scratch();
    setResult(quality);
    setTimeout(() => onResult(quality), 650);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); lock(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultLabel = result === "perfect" ? (isAttack ? "COLPO PERFETTO!" : "PARATA PERFETTA!")
    : result === "good" ? (isAttack ? "BUONO!" : "PARATA PARZIALE")
    : result ? (isAttack ? "MANCATO..." : "COLPITO!") : null;
  const resultColor = result === "perfect" ? C.green : result === "good" ? C.gold : C.red;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px",
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(2px)",
    }}
      onClick={lock}
    >
      <div style={{ color: accent, fontSize: "18px", fontWeight: "bold", letterSpacing: "1px", textShadow: `0 0 12px ${accent}` }}>
        {isAttack ? "⚔️ COLPISCI AL MOMENTO GIUSTO!" : "🛡 PARA L'ATTACCO!"}
      </div>
      {/* Barra */}
      <div style={{
        position: "relative", width: "min(80%, 460px)", height: "34px",
        background: "#0a0a12", border: `2px solid ${accent}88`, borderRadius: "6px", overflow: "hidden",
        boxShadow: `0 0 18px ${accent}44, inset 0 0 18px #000`,
      }}>
        {/* zona buono */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${GOOD[0] * 100}%`, width: `${(GOOD[1] - GOOD[0]) * 100}%`, background: `${C.gold}33`, borderLeft: `1px solid ${C.gold}88`, borderRight: `1px solid ${C.gold}88` }} />
        {/* zona perfetto */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${PERFECT[0] * 100}%`, width: `${(PERFECT[1] - PERFECT[0]) * 100}%`, background: `${C.green}55`, boxShadow: `0 0 12px ${C.green}88 inset` }} />
        {/* cursore */}
        <div style={{ position: "absolute", top: "-3px", bottom: "-3px", left: `calc(${pos * 100}% - 3px)`, width: "6px", background: result ? resultColor : "#fff", boxShadow: `0 0 10px ${result ? resultColor : "#fff"}`, transition: doneRef.current ? "background 0.1s" : "none" }} />
      </div>
      {resultLabel ? (
        <div style={{ color: resultColor, fontSize: "22px", fontWeight: "bold", textShadow: `0 0 16px ${resultColor}` }}>{resultLabel}</div>
      ) : (
        <div style={{
          padding: "10px 30px", background: accent, color: "#000", fontWeight: "bold", fontSize: "16px",
          border: `2px solid ${accent}`, borderRadius: "6px", boxShadow: `0 0 18px ${accent}aa`, cursor: "pointer",
          letterSpacing: "1px",
        }}>
          {isAttack ? "COLPISCI!" : "PARA!"} <span style={{ fontSize: "11px", opacity: 0.7 }}>(spazio / tap)</span>
        </div>
      )}
    </div>
  );
}


// ─── COMBAT COMPONENT — DUELLO HP ────────────────────────────
export function CombatView({ enemy, player, onEnd, onNailDamage, onNailHeal, onCellScratch, onGrattatoreConsumed, playerWallet = 0, onCombo, onVariantRevealed }) {
  const grEffect = player.equippedGrattatore?.effect;
  const guaranteedParryLeftRef = useRef(grEffect === "guaranteedParry"); // 1 sola volta a fight
  // Fascia da Polso (grattatore) + Maneki Neko (reliquia, "+10% vincita su TUTTE le carte"
  // → qui si traduce in zona PERFETTO più larga) si sommano.
  const perfectWiden = (grEffect === "widePerfect" ? (player.equippedGrattatore.value || 0.06) : 0)
    + (hasRelic(player, "globalWinBoost") ? 0.04 : 0);
  // Occhio di Tigre: primo colpo subito in QUESTO combattimento completamente assorbito.
  const tigerShieldLeftRef = useRef(hasRelic(player, "firstHitShield"));
  const stats = ENEMY_STATS[enemy.name] || DEFAULT_ENEMY_STATS;
  const bossMult = enemy.isBoss ? 1.0 : 1.0; // hp già tarati per boss in ENEMY_STATS

  const [enemyMaxHp] = useState(Math.round(stats.hp * bossMult));
  const [enemyHp, setEnemyHp] = useState(Math.round(stats.hp * bossMult));
  const [enemyShield, setEnemyShield] = useState(0);

  const [phase, setPhase] = useState("intro"); // intro | player | turnEnd | win
  const [turn, setTurn] = useState(1);
  const [hand, setHand] = useState([]); // 3 carte grattabili del player
  const [revealedIdxs, setRevealedIdxs] = useState([]); // indici già grattati
  const [loot, setLoot] = useState(0); // € bottino accumulato
  const [log, setLog] = useState([]); // [{text, color}]
  const [enemyPlan, setEnemyPlan] = useState([]); // carte nemico del turno
  const [enemyHitFlash, setEnemyHitFlash] = useState(0);
  const [painFlash, setPainFlash] = useState(0);
  const [activeTiming, setActiveTiming] = useState(null); // {mode, onResult} minigioco tempismo
  const [currentExchange, setCurrentExchange] = useState(-1); // scambio in corso (per telegrafo)
  const [busy, setBusy] = useState(false); // uno scambio è in risoluzione → blocca la grattata delle altre carte
  const [coins, setCoins] = useState([]); // monete che volano
  const [floaters, setFloaters] = useState([]); // numeri/testi fluttuanti {id, text, color, zone, big}
  const [shake, setShake] = useState(false); // screen shake su danno subìto
  const coinId = useRef(0);
  const floaterId = useRef(0);
  const logScrollRef = useRef(null);
  const dead = useRef(false);

  // Refs per applicazione LIVE degli effetti (accumulo sincrono, poi mirror in state)
  const hpRef = useRef(Math.round(stats.hp * bossMult));
  const shieldRef = useRef(0);
  const lootRef = useRef(0);
  const pendingParryRef = useRef(false); // true se il player ha giocato Scudo/Schiva (parata a tempo)
  const pendingGuardRef = useRef(false); // true se il player ha giocato Fortezza (blocco garantito, no minigioco)
  const atkDmgRef = useRef(0);     // danno d'attacco cumulato (per combo)
  const playedRef = useRef([]);    // indici giocati questo turno
  const turnLogRef = useRef([]);   // log del turno (cresce live)
  const resolvingRef = useRef(false);

  // ── Deal: inizio turno, pesca 9 carte (griglia 3x3) + prepara il piano nemico ──
  // Come l'originale: gratti 3 delle 9 carte; quelle 3 sono le mosse giocate.
  const dealTurn = () => {
    setHand(generateCombatHand(9));
    playedRef.current = [];
    setRevealedIdxs([]);
    pendingParryRef.current = false; pendingGuardRef.current = false; atkDmgRef.current = 0;
    turnLogRef.current = []; setLog([]);
    resolvingRef.current = false; setBusy(false);
    setCurrentExchange(-1);
    const plan = generateCombatCard(false, enemy.name).cells;
    setEnemyPlan(plan);
  };

  const startCombat = () => { setPhase("player"); dealTurn(); };

  // ── Reveal di una carta = uno SCAMBIO: player agisce, poi il nemico risponde ──
  const onCellRevealed = (idx) => {
    if (phase !== "player" || resolvingRef.current) return;
    if (playedRef.current.includes(idx) || playedRef.current.length >= 3) return;
    const exchangeIdx = playedRef.current.length; // 0,1,2
    const isLast = exchangeIdx >= 2;
    playedRef.current = [...playedRef.current, idx];
    setRevealedIdxs([...playedRef.current]);
    setCurrentExchange(exchangeIdx);
    resolvingRef.current = true; setBusy(true); // blocca lo scratch delle altre carte durante lo scambio
    pendingParryRef.current = false; pendingGuardRef.current = false; // difesa di QUESTO scambio
    onCellScratch?.(false);
    const cell = hand[idx];
    if (!cell) { resolvingRef.current = false; setBusy(false); return; }
    if (cell.variant && onVariantRevealed) onVariantRevealed(cell.variant);

    const r = resolvePlayerCell(cell);
    const isAttack = cell.category === "COMBATTIMENTO" && r.dmg > 0;

    // Effetti non-danno della carta si applicano subito
    applyPlayerImmediate(cell, r);

    if (isAttack) {
      // Minigioco di tempismo: colpisci al momento giusto
      setActiveTiming({
        mode: "attack",
        onResult: (quality) => {
          setActiveTiming(null);
          applyAttackDamage(cell, r, quality);
          proceedToEnemy(exchangeIdx, isLast);
        },
        perfectWiden,
      });
    } else {
      // Nessun attacco da temporizzare → passa direttamente al nemico
      setTimeout(() => proceedToEnemy(exchangeIdx, isLast), 450);
    }
  };

  // Danno d'attacco modulato dal tempismo
  const applyAttackDamage = (cell, r, quality) => {
    const mult = quality === "perfect" ? 1.6 : quality === "good" ? 1.0 : 0.5;
    let dmg = Math.max(1, Math.round(r.dmg * mult));
    // Coltello Affilato: +50% sulla PROSSIMA carta ATTACCO grattata, poi si consuma.
    if (player.equippedGrattatore?.effect === "atkBoost") {
      const boosted = Math.round(dmg * (1 + (player.equippedGrattatore.value || 0.5)));
      pushLog(`🔪 Coltello Affilato! ${dmg}→${boosted} danni`, C.magenta);
      dmg = boosted;
      onGrattatoreConsumed?.();
    }
    atkDmgRef.current += dmg;
    if (quality === "perfect") {
      pushLog(`⚔️ ${cell.name}: COLPO PERFETTO! ${dmg} danni (×1.6)`, C.green);
      setEnemyHitFlash(1.4);
      AudioEngine.perfectHit?.();
      spawnFloater("PERFETTO!", C.green, "enemy", true);
    } else if (quality === "good") pushLog(`⚔️ ${cell.name}: ${dmg} danni`, C.gold);
    else pushLog(`⚔️ ${cell.name}: colpo maldestro, solo ${dmg} danni`, C.dim);
    flyCoins(2);
    dealDamage(dmg);
  };

  // Dopo l'azione del player, il nemico risponde per questo scambio
  const proceedToEnemy = (exchangeIdx, isLast) => {
    // Combo: se le 3 carte giocate sono tutte attacchi → bonus
    if (isLast) {
      const played = playedRef.current.map(i => hand[i]).filter(Boolean);
      if (played.length === 3 && played.every(c => c.category === "COMBATTIMENTO") && atkDmgRef.current > 0) {
        const bonus = Math.round(atkDmgRef.current * 0.5);
        pushLog(`🔥 COMBO ATTACCO! +${bonus} danni!`, C.magenta);
        onCombo?.();
        dealDamage(bonus);
      }
    }
    if (hpRef.current <= 0) { winNow(); return; }

    const ec = enemyPlan[exchangeIdx];
    const isEnemyAttack = ec && ec.category === "COMBATTIMENTO";
    if (isEnemyAttack) {
      // FORTEZZA: blocco garantito, a prescindere dal tempismo (nessun minigioco).
      if (pendingGuardRef.current) {
        pushLog(`${enemy.name} 🗡 ${ec.name}: 🏰 FORTEZZA blocca tutto — nessun danno!`, C.blue);
        setTimeout(() => finishExchange(exchangeIdx, isLast), 450);
        return;
      }
      // Guanto di Ferro: la prima parata della fight è automaticamente PERFETTA
      // (richiede comunque una carta Scudo/Schiva per attivare la parata).
      if (pendingParryRef.current && guaranteedParryLeftRef.current) {
        guaranteedParryLeftRef.current = false;
        pushLog(`🧤 Guanto di Ferro! ${ec.name}: PARATA PERFETTA garantita`, C.magenta);
        onGrattatoreConsumed?.();
        applyEnemyAttack(ec, "perfect");
        setTimeout(() => finishExchange(exchangeIdx, isLast), 550);
        return;
      }
      // La PARATA (minigioco) parte SOLO se hai giocato Scudo/Schiva in questo scambio.
      if (pendingParryRef.current) {
        setActiveTiming({
          mode: "parry",
          onResult: (quality) => {
            setActiveTiming(null);
            applyEnemyAttack(ec, quality);
            finishExchange(exchangeIdx, isLast);
          },
          perfectWiden,
        });
      } else {
        // Nessuna difesa giocata → l'attacco colpisce pieno, senza minigioco.
        applyEnemyAttack(ec, "miss");
        setTimeout(() => finishExchange(exchangeIdx, isLast), 550);
      }
    } else {
      // Difesa/cura nemico
      if (ec) applyEnemyNonAttack(ec);
      setTimeout(() => finishExchange(exchangeIdx, isLast), 450);
    }
  };

  const applyEnemyNonAttack = (c) => {
    if (c.category === "DIFESA") {
      shieldRef.current += stats.shieldPerDef; setEnemyShield(shieldRef.current);
      pushLog(`${enemy.name} 🛡 ${c.name}: +${stats.shieldPerDef} scudo`, C.blue);
    } else if (c.category === "DENARO") {
      if (turn >= FURY_TURN) {
        // FURIA: troppo agitato per curarsi — colpo a vuoto, puoi bruciarlo
        pushLog(`${enemy.name} 🔥 ${c.name}: troppo furioso per curarsi!`, C.red);
      } else {
        const healAmt = Math.round((c.value || 20) * 0.2);
        hpRef.current = Math.min(enemyMaxHp, hpRef.current + healAmt); setEnemyHp(hpRef.current);
        pushLog(`${enemy.name} 💰 ${c.name}: si cura +${healAmt} HP`, C.orange);
      }
    } else {
      // attacco bloccato da carta scudo del player
      pushLog(`${enemy.name} 🗡 ${c.name}: 🛡 BLOCCATO dallo scudo!`, C.blue);
    }
  };

  // Attacco nemico risolto dal tempismo di parata
  const applyEnemyAttack = (c, quality) => {
    const heavy = c.effect === "damageNail" || c.effect === "killNail" || c.effect === "damage";
    const stealsMoney = c.effect === "stealMoney" || c.effect === "steal";
    const fury = Math.max(0, turn - FURY_TURN + 1); // 0 fino al turno soglia, poi cresce
    const baseSteps = (heavy ? 2 : 1) + fury;       // FURIA: attacchi sempre più pesanti
    const stealVal = (c.value || 15) + fury * 10;

    if (quality === "perfect") {
      // Annulla il danno + contrattacco
      pushLog(`${enemy.name} 🗡 ${c.name}: 🛡 PARATA PERFETTA! Nessun danno`, C.green);
      AudioEngine.parry?.();
      spawnFloater("PARATA!", C.blue, "player", true);
      const counter = 14;
      pushLog(`↩️ Contrattacco! ${counter} danni a ${enemy.name}`, C.cyan);
      dealDamage(counter);
      if (hpRef.current <= 0) { winNow(); return; }
      return;
    }
    if (quality === "good") {
      if (stealsMoney) {
        const v = Math.round(stealVal * 0.5);
        lootRef.current = Math.max(0, lootRef.current - v); setLoot(lootRef.current);
        pushLog(`${enemy.name} 🗡 ${c.name}: parata parziale — ti ruba solo €${v}`, C.gold);
        spawnFloater(`−€${v}`, C.orange, "loot");
      } else if (tigerShieldLeftRef.current) {
        // Occhio di Tigre: primo colpo del combattimento assorbito gratis.
        tigerShieldLeftRef.current = false;
        pushLog(`🐯 Occhio di Tigre! ${c.name} assorbito — nessun danno`, C.orange);
        spawnFloater("ASSORBITO!", C.orange, "player", true);
      } else {
        onNailDamage?.(1);
        AudioEngine.nailCrack?.();
        setPainFlash(0.3); setTimeout(() => setPainFlash(0), 350);
        spawnFloater("−1", C.orange, "player");
        pushLog(`${enemy.name} 🗡 ${c.name}: parata parziale — 1 danno`, C.gold);
        checkDefeat();
      }
      return;
    }
    // miss → danno pieno
    if (stealsMoney) {
      lootRef.current = Math.max(0, lootRef.current - stealVal); setLoot(lootRef.current);
      pushLog(`${enemy.name} 🗡 ${c.name}: ti ruba €${stealVal}!`, C.red);
      spawnFloater(`−€${stealVal}`, C.red, "loot");
    } else if (tigerShieldLeftRef.current) {
      // Occhio di Tigre: primo colpo del combattimento assorbito gratis.
      tigerShieldLeftRef.current = false;
      pushLog(`🐯 Occhio di Tigre! ${c.name}: colpo assorbito — nessun danno`, C.orange);
      spawnFloater("ASSORBITO!", C.orange, "player", true);
    } else {
      onNailDamage?.(baseSteps);
      setPainFlash(0.5); setTimeout(() => setPainFlash(0.2), 150); setTimeout(() => setPainFlash(0), 500);
      AudioEngine.painScream?.();
      triggerShake();
      spawnFloater(`−${baseSteps}💢`, C.red, "player", true);
      pushLog(`${enemy.name} 🗡 ${c.name}: COLPITO! ${baseSteps} danno alle unghie`, C.red);
      checkDefeat();
    }
  };

  const checkDefeat = () => {
    const aliveNow = player.nails.filter(n => n.state !== "morta").length;
    if (aliveNow <= 1) dead.current = true;
  };

  const finishExchange = (exchangeIdx, isLast) => {
    if (dead.current) { setPhase("turnEnd"); return; }
    if (isLast) {
      // Carte nemico extra (es. 4a del Napoletano) si risolvono senza parata
      for (let k = 3; k < enemyPlan.length; k++) {
        const ec = enemyPlan[k];
        if (ec.category === "COMBATTIMENTO") applyEnemyAttack(ec, "miss");
        else applyEnemyNonAttack(ec);
      }
      setTimeout(() => setPhase("turnEnd"), 400);
    } else {
      // Avanza l'evidenziazione allo scambio SUCCESSIVO (quello ancora da grattare),
      // così il player sa cosa arriva. Lo scambio appena risolto diventa ✓ fatto.
      setCurrentExchange(-1);
      resolvingRef.current = false; setBusy(false); // sblocca lo scratch per la prossima carta
    }
  };

  const flyCoins = (n) => {
    const batch = Array.from({ length: Math.min(8, Math.max(1, n)) }, () => ({
      id: coinId.current++,
      dx: (Math.random() - 0.5) * 120,
      dy: -40 - Math.random() * 80,
      rot: (Math.random() - 0.5) * 180,
    }));
    setCoins(prev => [...prev, ...batch]);
    setTimeout(() => setCoins(prev => prev.filter(c => !batch.find(b => b.id === c.id))), 1100);
  };

  // Testo/numero fluttuante ancorato a una zona: "enemy" | "player" | "loot"
  const spawnFloater = (text, color, zone = "enemy", big = false) => {
    const id = floaterId.current++;
    setFloaters(prev => [...prev, { id, text, color, zone, big }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 1100);
  };
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 380); };

  // Aggiunge una riga al log del turno (mostrato live in turnEnd)
  const pushLog = (text, color = C.dim) => {
    turnLogRef.current = [...turnLogRef.current, { text, color }];
    setLog(turnLogRef.current);
  };

  // Applica danno all'HP nemico (scudo prima, poi HP). Aggiorna gli state per il render.
  const dealDamage = (d) => {
    let remaining = d;
    if (shieldRef.current > 0) {
      const absorbed = Math.min(shieldRef.current, remaining);
      shieldRef.current -= absorbed; remaining -= absorbed;
      setEnemyShield(shieldRef.current);
      if (absorbed > 0) pushLog(`🛡 Scudo nemico assorbe ${absorbed}`, C.blue);
    }
    if (remaining > 0) {
      hpRef.current = Math.max(0, hpRef.current - remaining);
      setEnemyHp(hpRef.current);
      AudioEngine.hitEnemy?.(); // suono impatto
      setEnemyHitFlash(1); setTimeout(() => setEnemyHitFlash(0), 350);
      spawnFloater(`-${remaining}`, C.red, "enemy"); // numero danno sul nemico
    }
  };

  // Applica gli effetti NON-danno di una carta player (bottino/cura/difesa/self).
  // Il danno d'attacco è gestito a parte da applyAttackDamage (dopo il minigioco).
  const applyPlayerImmediate = (c, r) => {
    const damaged = player.nails.some(n => n.state !== "sana" && n.state !== "kawaii" && n.state !== "morta" && n.state !== "piede");
    if (r.loot) {
      lootRef.current = Math.max(0, lootRef.current + r.loot);
      setLoot(lootRef.current);
      if (r.loot > 0) { flyCoins(Math.ceil(r.loot / 6)); AudioEngine.cash?.(); spawnFloater(`+€${r.loot}`, C.gold, "loot"); }
      else { spawnFloater(`−€${Math.abs(r.loot)}`, C.red, "loot"); }
    }
    if (r.heals) {
      if (c.effect === "adrenaline" && !damaged) {
        lootRef.current += (r.altLoot || 0); setLoot(lootRef.current);
        if (r.altLoot) { flyCoins(Math.ceil(r.altLoot / 6)); AudioEngine.cash?.(); spawnFloater(`+€${r.altLoot}`, C.gold, "loot"); }
      } else {
        onNailHeal?.(r.heals);
        AudioEngine.heal?.(); spawnFloater(`+${r.heals}💚`, C.green, "player");
      }
    }
    // Scudo/Schivata → parata a tempo; Fortezza → blocco garantito (no minigioco)
    if (r.block || r.dodge) pendingParryRef.current = true;
    if (r.guard) pendingGuardRef.current = true;
    if (r.enemyShield) { shieldRef.current += r.enemyShield; setEnemyShield(shieldRef.current); }
    if (r.self) { onNailDamage?.(r.self); setPainFlash(0.35); setTimeout(() => setPainFlash(0), 400); }
    pushLog(r.log, CAT_COLORS[c.category] || C.dim);
  };

  const winNow = () => {
    setActiveTiming(null);
    pushLog(`💥 ${enemy.name} è al tappeto!`, C.green);
    AudioEngine.win?.();
    setTimeout(() => setPhase("win"), 600);
  };

  const nextTurn = () => {
    if (dead.current) return;
    setTurn(t => t + 1);
    setPhase("player");
    dealTurn();
  };

  const finishWin = () => {
    onEnd({
      won: true,
      playerMoney: loot,
      enemyMoney: 0,
      nailDamage: 0,   // già applicato live via onNailDamage
      nailHeals: 0,    // già applicate live via onNailHeal
      moneyGained: loot,
      stolenMoney: 0,
      winNail: true,
      loseNail: false,
      minibossBonus: 0, minibossHeal: 0, minibossCombos: 0,
    });
  };

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [log, phase]);

  // FURIA: suono drammatico quando il nemico entra in enrage
  useEffect(() => {
    if (turn === FURY_TURN) { AudioEngine.bossEntrance?.(); triggerShake(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  const inFury = turn >= FURY_TURN;

  // Spacebar: prosegui fasi
  const spaceRef = useRef(null);
  spaceRef.current = () => {
    if (phase === "intro") startCombat();
    else if (phase === "turnEnd") nextTurn();
    else if (phase === "win") finishWin();
  };
  useEffect(() => {
    const onKey = (e) => { if (e.code !== "Space") return; e.preventDefault(); spaceRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hpPct = Math.max(0, Math.round((enemyHp / enemyMaxHp) * 100));

  // Floater per zona (ancoraggi in % nel container combat)
  const FLOATER_ANCHOR = {
    enemy: { left: "50%", top: "20%" },
    loot: { left: "88%", top: "24%" },
    player: { left: "16%", top: "24%" },
  };

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div style={{
      position: "relative", flex: 1, minHeight: 0, width: "100%",
      display: "flex", flexDirection: "column", gap: "10px",
      fontFamily: FONT, color: C.text, padding: "10px", overflow: "hidden",
      animation: shake ? "screenShake 0.38s" : "none",
    }}>
      {/* Pain flash overlay */}
      {painFlash > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(255,0,0,${painFlash})`, pointerEvents: "none", zIndex: 50, transition: "background 0.1s" }} />
      )}

      {/* Numeri/testi fluttuanti (danno, soldi, cura, parata) */}
      {floaters.map(f => {
        const a = FLOATER_ANCHOR[f.zone] || FLOATER_ANCHOR.enemy;
        return (
          <div key={f.id} style={{
            position: "absolute", left: a.left, top: a.top, zIndex: 55,
            pointerEvents: "none", whiteSpace: "nowrap",
            color: f.color, fontWeight: "bold",
            fontSize: f.big ? "22px" : "16px",
            textShadow: `0 0 8px ${f.color}, 0 1px 2px #000`,
            animation: "combatFloat 1.1s ease-out forwards",
          }}>{f.text}</div>
        );
      })}

      {/* ── SCHEDA NEMICO ── */}
      <div style={{
        border: `2px solid ${C.red}`, borderRadius: "4px", padding: "10px 14px",
        background: "#160308", boxShadow: `0 0 18px ${C.red}44, inset 0 0 24px rgba(0,0,0,0.6)`,
        transform: enemyHitFlash ? "translateX(4px)" : "none", transition: "transform 0.1s",
      }}>
        {/* Schermo "mostro" — sprite ASCII del nemico (come da bozza) */}
        <div style={{
          margin: "0 auto 8px", maxWidth: "260px",
          background: "#0a0400", border: `2px solid ${C.red}88`, borderRadius: "4px",
          padding: "8px 6px", boxShadow: `inset 0 0 26px #000, 0 0 12px ${C.red}33`,
          overflow: "hidden",
        }}>
          <pre style={{
            margin: 0, textAlign: "center", color: "#ff6a6a", fontFamily: FONT,
            fontSize: "10px", lineHeight: "1.05", whiteSpace: "pre",
            textShadow: `0 0 6px ${C.red}aa`,
            animation: enemyHitFlash ? "none" : "neonText 2.4s infinite",
          }}>
            {(SPR_BIG[enemySpriteKey(enemy)] || SPR_BIG.miniboss).join("\n")}
          </pre>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "15px", color: C.red, letterSpacing: "1px" }}>
            {enemy.isBoss ? "👑 " : ""}{enemy.name}
          </div>
          {inFury && (
            <div style={{
              fontSize: "12px", fontWeight: "bold", padding: "2px 10px", borderRadius: "3px",
              color: "#000", background: C.orange, letterSpacing: "1px",
              boxShadow: `0 0 14px ${C.orange}, 0 0 4px ${C.red} inset`,
              animation: "telePulse 0.7s ease-in-out infinite",
            }}>
              🔥 FURIA
            </div>
          )}
        </div>
        {/* Barra HP rossa */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{ fontSize: "12px" }}>❤️</span>
          <div style={{ flex: 1, height: "14px", background: "#3a0000", borderRadius: "3px", overflow: "hidden", border: "1px solid #550000" }}>
            <div style={{ width: `${hpPct}%`, height: "100%", background: `linear-gradient(90deg, ${C.red}, #ff5555)`, transition: "width 0.4s ease", boxShadow: `0 0 8px ${C.red}` }} />
          </div>
          <span style={{ fontSize: "11px", color: C.red, minWidth: "54px", textAlign: "right" }}>{enemyHp}/{enemyMaxHp}</span>
        </div>
        {/* Barra scudo blu */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px" }}>🛡</span>
          <div style={{ flex: 1, height: "10px", background: "#001428", borderRadius: "3px", overflow: "hidden", border: "1px solid #003355" }}>
            <div style={{ width: `${Math.min(100, enemyShield)}%`, height: "100%", background: `linear-gradient(90deg, ${C.blue}, #55aaff)`, transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: "11px", color: C.blue, minWidth: "54px", textAlign: "right" }}>{enemyShield}</span>
        </div>
      </div>

      {/* ── HUD player: unghie (vita) + bottino ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: C.dim }}>UNGHIE</span>
          <NailDisplay nails={player.nails} activeNail={-1} compact />
        </div>
        <div style={{ position: "relative", fontSize: "14px", fontWeight: "bold", color: C.gold }}>
          💰 €{loot}
          {/* Monete che volano */}
          {coins.map(c => (
            <span key={c.id} style={{
              position: "absolute", left: "50%", top: "0",
              animation: "coinFly 1s ease-out forwards",
              "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--rot": `${c.rot}deg`,
              fontSize: "16px", pointerEvents: "none",
            }}>🪙</span>
          ))}
        </div>
      </div>

      {/* ── AREA CENTRALE per fase ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>

        {phase === "intro" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "40px" }}>{enemy.isBoss ? "👑" : "🗡️"}</div>
            <div style={{ color: C.red, fontSize: "20px", fontWeight: "bold" }}>{enemy.name} ti sfida!</div>
            <div style={{ color: C.dim, fontSize: "13px", maxWidth: "340px" }}>
              Gratta le tue carte per attaccare. Riduci gli HP del nemico a zero — ma occhio alle tue unghie!
              <br /><span style={{ color: C.orange }}>⚠ Dal turno {FURY_TURN} il nemico va in 🔥 FURIA: non si cura più e picchia sempre più forte. Chiudi in fretta!</span>
            </div>
            <Btn variant="danger" onClick={startCombat} style={{ fontSize: "16px", padding: "12px 32px" }}>⚔️ COMBATTI!</Btn>
          </div>
        )}

        {phase === "player" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
            <div style={{ textAlign: "center", fontSize: "12px", color: C.gold, letterSpacing: "1px" }}>
              TURNO {turn} — GRATTA 3 DELLE 9 CARTE <span style={{ color: C.dim }}>({revealedIdxs.length}/3)</span>
            </div>
            {/* Telegrafo: cosa farà il nemico ad ogni scambio (attacca / difende / cura) */}
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "11px",
              padding: "6px 8px", borderRadius: "6px",
              background: "#0c0c14", border: `1px solid ${C.dim}44`,
            }}>
              <span style={{ color: C.dim, letterSpacing: "1px", fontWeight: "bold" }}>IN ARRIVO ▸</span>
              {enemyPlan.slice(0, 3).map((ec, i) => {
                const tel = ec.category === "COMBATTIMENTO" ? { ic: "🗡️", lb: "ATTACCO", col: C.red }
                  : ec.category === "DIFESA" ? { ic: "🛡", lb: "DIFESA", col: C.blue }
                  : { ic: "💰", lb: "DENARO", col: C.orange };
                const activeEx = currentExchange >= 0 ? currentExchange : revealedIdxs.length;
                const done = i < activeEx;      // scambi già passati
                const active = i === activeEx;  // PROSSIMA mossa del nemico (evidenziata + pulsa)
                return (
                  <span key={i} style={{
                    padding: active ? "4px 12px" : "4px 9px", borderRadius: "4px",
                    border: `2px solid ${active ? tel.col : done ? "#333" : tel.col + "55"}`,
                    background: active ? tel.col + "33" : "transparent",
                    color: done ? C.dim : tel.col,
                    opacity: done ? 0.4 : 1,
                    boxShadow: active ? `0 0 14px ${tel.col}aa, 0 0 4px ${tel.col} inset` : "none",
                    fontWeight: active ? "bold" : "normal",
                    textShadow: active ? `0 0 8px ${tel.col}` : "none",
                    textDecoration: done ? "line-through" : "none",
                    animation: active ? "telePulse 1s ease-in-out infinite" : "none",
                  }}>
                    {done ? "✓ " : active ? "▸ " : ""}{tel.ic} {tel.lb}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              {hand.map((cell, i) => {
                const isRevealed = revealedIdxs.includes(i);
                // Bloccate se: hai già giocato 3 carte, OPPURE uno scambio è in
                // risoluzione (evita di grattare la carta successiva "a raffica"
                // mentre quella precedente non è ancora stata conteggiata).
                const locked = (revealedIdxs.length >= 3 || busy) && !isRevealed;
                return (
                  <CombatCardScratch
                    key={`${turn}-${i}`}
                    cell={cell}
                    catColors={CAT_COLORS}
                    onRevealed={() => onCellRevealed(i)}
                    disabled={locked}
                  />
                );
              })}
            </div>
            {/* Log live dello scambio (cresce man mano) */}
            <div ref={logScrollRef} style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px", maxHeight: "160px", overflowY: "auto" }}>
              {log.map((l, i) => (
                <div key={i} style={{ color: l.color }}>{l.text}</div>
              ))}
            </div>
          </div>
        )}

        {(phase === "turnEnd" || phase === "win") && (
          <div ref={logScrollRef} style={{
            flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px",
            background: "#0a0a12", border: `1px solid ${C.dim}44`, borderRadius: "3px", padding: "8px", fontSize: "12px",
          }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: l.color }}>{l.text}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── BARRA AZIONE INFERIORE ── */}
      {phase === "turnEnd" && (
        <Btn onClick={nextTurn} style={{ fontSize: "15px", padding: "10px 28px", alignSelf: "center" }}>
          PROSSIMO TURNO →
        </Btn>
      )}
      {phase === "win" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ color: C.green, fontSize: "22px", fontWeight: "bold", textShadow: `0 0 14px ${C.green}99` }}>🏆 HAI VINTO!</div>
          <div style={{ color: C.gold, fontSize: "14px" }}>Bottino: €{loot}</div>
          <Btn variant="success" onClick={finishWin} style={{ fontSize: "15px", padding: "10px 28px" }}>INCASSA →</Btn>
        </div>
      )}

      {/* ── OVERLAY MINIGIOCO TEMPISMO (attacco / parata) ── */}
      {activeTiming && (
        <TimingBar
          mode={activeTiming.mode}
          speed={enemy.isBoss ? 1.75 : 1.45}
          onResult={activeTiming.onResult}
          perfectWiden={activeTiming.perfectWiden || 0}
        />
      )}
    </div>
  );
}
