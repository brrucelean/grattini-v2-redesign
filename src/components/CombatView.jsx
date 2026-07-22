import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import {
  COMBAT_CARD_H, CAT_EMOJI_MAP, CAT_BG,
  ENEMY_STATS, DEFAULT_ENEMY_STATS, EFFECT_DAMAGE,
} from "../data/combat.js";
import { roll, pick } from "../utils/random.js";
import { makeNailCursor } from "../utils/nail.js";
import { generateCombatHand, generateCombatCard, CARD_VARIANTS } from "../utils/combat.js";
import { AudioEngine, ParticleSystem } from "../audio.js";
import { Btn } from "./Btn.jsx";
import { NailDisplay } from "./NailDisplay.jsx";

// Nomi categoria abbreviati — COMBATTIMENTO è troppo lungo per le card strette
const CAT_SHORT = { COMBATTIMENTO: "ATTACCO", DIFESA: "DIFESA", DENARO: "DENARO" };


// ─── COMBAT CARD SCRATCH ─────────────────────────────────────
export function CombatCardScratch({ cell, onRevealed, catColors, disabled, nailState = "sana" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const revealed = useRef(false);
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
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ParticleSystem.spawn(clientX, clientY, 14, false);
    // Suono della grattata — throttled a ogni 80ms per non spammare
    const now = Date.now();
    if (now - lastScratchSound.current > 80) {
      AudioEngine.scratch();
      lastScratchSound.current = now;
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 100) transparent++;
    if (transparent / (canvas.width * canvas.height) > 0.32 && !revealed.current) {
      revealed.current = true;
      AudioEngine.scratch();
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

      {/* Canvas oro — completamente opaco, copre tutto */}
      {!disabled && (
        <canvas ref={canvasRef} width={220} height={160}
          style={{
            position:"absolute", inset:0, width:"100%", height:"100%",
            display:"block", cursor: nailCursor, touchAction:"none",
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
      const dmg = Math.round(val * 0.8);
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
      return { block: true, log: `🛡 ${c.name}: scudo — pari gli attacchi di questo turno!` };
    case "fortress":
      return { block: true, loot: -(c.cost || 0), log: `🏰 ${c.name}: scudo totale (−€${c.cost || 0})` };
    case "dodge":
      return { dodge: 1, log: `💨 ${c.name}: schivata pronta` };
    default:
      return { log: `${c.name}` };
  }
}


// ─── COMBAT COMPONENT — DUELLO HP ────────────────────────────
export function CombatView({ enemy, player, onEnd, onNailDamage, onNailHeal, onCellScratch, playerWallet = 0, onCombo, onVariantRevealed }) {
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
  const [enemyIntent, setEnemyIntent] = useState(null); // "ATTACCA" | "SCUDO" | "CURA"
  const [enemyHitFlash, setEnemyHitFlash] = useState(0);
  const [painFlash, setPainFlash] = useState(0);
  const [coins, setCoins] = useState([]); // monete che volano
  const coinId = useRef(0);
  const logScrollRef = useRef(null);
  const dead = useRef(false);

  const nailCol = C.red;

  // ── Deal: inizio turno, pesca 9 carte (griglia 3x3) + prepara il piano nemico ──
  // Come l'originale: gratti 3 delle 9 carte; quelle 3 sono le mosse giocate.
  const dealTurn = () => {
    setHand(generateCombatHand(9));
    setRevealedIdxs([]);
    const plan = generateCombatCard(false, enemy.name).cells;
    setEnemyPlan(plan);
    // Telegrafo intento: categoria dominante nel piano nemico
    const cats = plan.map(c => c.category);
    const nAtk = cats.filter(c => c === "COMBATTIMENTO").length;
    const nDef = cats.filter(c => c === "DIFESA").length;
    setEnemyIntent(nAtk >= nDef && nAtk > 0 ? "ATTACCA" : nDef > 0 ? "SCUDO" : "CURA");
  };

  const startCombat = () => { setPhase("player"); dealTurn(); };

  // ── Reveal di una carta del player (max 3) ──
  const onCellRevealed = (idx) => {
    setRevealedIdxs(prev => {
      if (prev.includes(idx) || prev.length >= 3) return prev; // già giocata / mano piena
      onCellScratch?.(false); // grattatore assorbe/consuma se equipaggiato
      const cell = hand[idx];
      if (cell?.variant && onVariantRevealed) onVariantRevealed(cell.variant);
      return [...prev, idx];
    });
  };

  // Quando hai grattato 3 carte → risolvi il turno
  useEffect(() => {
    if (phase !== "player" || revealedIdxs.length < 3) return;
    const t = setTimeout(() => resolveTurn(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedIdxs.length, phase]);

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

  const resolveTurn = () => {
    if (dead.current) return;
    const newLog = [];
    const push = (text, color = C.dim) => newLog.push({ text, color });

    // ── 1) OFFENSIVA PLAYER (solo le 3 carte grattate) ──
    const played = revealedIdxs.map(i => hand[i]).filter(Boolean);
    let dmg = 0, deltaLoot = 0, heals = 0, selfDeg = 0, playerBlock = false, playerDodges = 0;
    let bonusEnemyShield = 0;
    const damagedNails = player.nails.some(n => n.state !== "sana" && n.state !== "kawaii" && n.state !== "morta" && n.state !== "piede");
    const allAttack = played.length === 3 && played.every(c => c.category === "COMBATTIMENTO");

    played.forEach(c => {
      const r = resolvePlayerCell(c);
      if (r.dmg) dmg += r.dmg;
      if (r.loot) deltaLoot += r.loot;
      if (r.self) selfDeg += r.self;
      if (r.block) playerBlock = true;
      if (r.dodge) playerDodges += r.dodge;
      if (r.enemyShield) bonusEnemyShield += r.enemyShield;
      // adrenaline: cura se hai unghie danneggiate, altrimenti bottino
      if (r.heals) { if (c.effect === "adrenaline" && !damagedNails) deltaLoot += r.altLoot || 0; else heals += r.heals; }
      push(r.log, CAT_COLORS[c.category] || C.dim);
    });

    // Combo: 3 attacchi = danno bonus
    if (allAttack && dmg > 0) {
      const bonus = Math.round(dmg * 0.5);
      dmg += bonus;
      push(`🔥 COMBO ATTACCO! +${bonus} danni!`, C.magenta);
      onCombo?.();
    }

    // Applica danno al nemico (scudo prima, poi HP)
    let remaining = dmg;
    let newShield = enemyShield;
    let newHp = enemyHp;
    if (remaining > 0) {
      if (newShield > 0) {
        const absorbed = Math.min(newShield, remaining);
        newShield -= absorbed; remaining -= absorbed;
        if (absorbed > 0) push(`🛡 Scudo nemico assorbe ${absorbed}`, C.blue);
      }
      newHp = Math.max(0, newHp - remaining);
      if (remaining > 0) { AudioEngine.scratch(); setEnemyHitFlash(1); setTimeout(() => setEnemyHitFlash(0), 350); }
    }

    // Bottino + monete che volano
    if (deltaLoot !== 0) {
      setLoot(l => Math.max(0, l + deltaLoot));
      if (deltaLoot > 0) flyCoins(Math.ceil(deltaLoot / 6));
    }
    if (dmg > 0) flyCoins(2);

    // Auto-degrado del player da berserk (self)
    if (selfDeg > 0) { onNailDamage?.(selfDeg); setPainFlash(0.35); setTimeout(() => setPainFlash(0), 400); }
    // Cure
    if (heals > 0) { onNailHeal?.(heals); push(`💚 ${heals} unghia/e curate`, C.green); }

    // ── VITTORIA se il nemico è morto: il nemico NON agisce ──
    if (newHp <= 0) {
      setEnemyShield(newShield);
      setEnemyHp(0);
      push(`💥 ${enemy.name} è al tappeto!`, C.green);
      setLog(newLog);
      setTimeout(() => setPhase("win"), 600);
      return;
    }

    // ── 2) TURNO NEMICO ──
    let nailDegrade = 0; // step di degrado da infliggere al player
    let stolen = 0;
    enemyPlan.forEach(c => {
      const cat = c.category;
      if (cat === "DIFESA") {
        newShield += stats.shieldPerDef;
        push(`${enemy.name} 🛡 ${c.name}: +${stats.shieldPerDef} scudo`, C.blue);
        return;
      }
      if (cat === "DENARO") {
        const healAmt = Math.round((c.value || 20) * 0.4);
        newHp = Math.min(enemyMaxHp, newHp + healAmt);
        push(`${enemy.name} 💰 ${c.name}: si cura +${healAmt} HP`, C.orange);
        return;
      }
      // COMBATTIMENTO — attacco: bloccato/schivato?
      const heavy = c.effect === "damageNail" || c.effect === "killNail" || c.effect === "damage";
      const stealsMoney = c.effect === "stealMoney" || c.effect === "steal";
      if (playerBlock) { push(`${enemy.name} 🗡 ${c.name}: 🛡 BLOCCATO!`, C.blue); return; }
      if (playerDodges > 0 && !stealsMoney) { playerDodges--; push(`${enemy.name} 🗡 ${c.name}: 💨 SCHIVATO!`, C.cyan); return; }
      if (stealsMoney) {
        stolen += (c.value || 15);
        push(`${enemy.name} 🗡 ${c.name}: ti ruba €${c.value || 15}!`, C.red);
        return;
      }
      const steps = heavy ? 2 : 1;
      nailDegrade += steps;
      push(`${enemy.name} 🗡 ${c.name}: le tue unghie subiscono ${steps} danno!`, C.red);
    });

    if (stolen > 0) setLoot(l => Math.max(0, l - stolen));
    if (nailDegrade > 0) {
      onNailDamage?.(nailDegrade);
      setPainFlash(0.5); setTimeout(() => setPainFlash(0.2), 150); setTimeout(() => setPainFlash(0), 500);
      AudioEngine.painScream?.();
      // Sconfitta: il parent (onNailDamage) porta a gameOver quando tutte le unghie muoiono.
      // Qui congeliamo la UI se il colpo può azzerare le unghie ancora vive (stima prudente).
      const aliveNow = player.nails.filter(n => n.state !== "morta").length;
      if (aliveNow <= 1) dead.current = true;
    }

    setEnemyShield(newShield + bonusEnemyShield);
    setEnemyHp(newHp);
    setLog(newLog);
    setPhase("turnEnd");
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

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div style={{
      position: "relative", flex: 1, minHeight: 0, width: "100%",
      display: "flex", flexDirection: "column", gap: "10px",
      fontFamily: FONT, color: C.text, padding: "10px", overflow: "hidden",
    }}>
      {/* Pain flash overlay */}
      {painFlash > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(255,0,0,${painFlash})`, pointerEvents: "none", zIndex: 50, transition: "background 0.1s" }} />
      )}

      {/* ── SCHEDA NEMICO ── */}
      <div style={{
        border: `2px solid ${C.red}`, borderRadius: "4px", padding: "10px 14px",
        background: "#160308", boxShadow: `0 0 18px ${C.red}44, inset 0 0 24px rgba(0,0,0,0.6)`,
        transform: enemyHitFlash ? "translateX(4px)" : "none", transition: "transform 0.1s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "15px", color: C.red, letterSpacing: "1px" }}>
            {enemy.isBoss ? "👑 " : ""}{enemy.name}
          </div>
          {enemyIntent && phase === "player" && (
            <div style={{
              fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "3px",
              color: enemyIntent === "ATTACCA" ? C.red : enemyIntent === "SCUDO" ? C.blue : C.orange,
              border: `1px solid ${enemyIntent === "ATTACCA" ? C.red : enemyIntent === "SCUDO" ? C.blue : C.orange}`,
            }}>
              {enemyIntent === "ATTACCA" ? "🗡️ ATTACCA" : enemyIntent === "SCUDO" ? "🛡 SI COPRE" : "💰 SI CURA"}
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
            <div style={{ color: C.dim, fontSize: "13px", maxWidth: "320px" }}>
              Gratta le tue carte per attaccare. Riduci gli HP del nemico a zero — ma occhio alle tue unghie!
            </div>
            <Btn variant="danger" onClick={startCombat} style={{ fontSize: "16px", padding: "12px 32px" }}>⚔️ COMBATTI!</Btn>
          </div>
        )}

        {phase === "player" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
            <div style={{ textAlign: "center", fontSize: "12px", color: C.gold, letterSpacing: "1px" }}>
              TURNO {turn} — GRATTA 3 DELLE 9 CARTE <span style={{ color: C.dim }}>({revealedIdxs.length}/3)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              {hand.map((cell, i) => {
                const isRevealed = revealedIdxs.includes(i);
                const locked = revealedIdxs.length >= 3 && !isRevealed;
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
            {/* Descrizioni delle carte giocate */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px" }}>
              {revealedIdxs.map(i => {
                const c = hand[i];
                if (!c) return null;
                return (
                  <div key={i} style={{ color: CAT_COLORS[c.category] || C.dim }}>
                    {c.emoji} <b>{c.name}</b> — {c.desc}
                  </div>
                );
              })}
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
    </div>
  );
}
