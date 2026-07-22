import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import { COMBAT_CARD_H, CAT_EMOJI_MAP, CAT_BG, TAUNTS } from "../data/combat.js";
import { CARD_TYPES, CARD_BALANCE } from "../data/cards.js";
import { NAIL_INFO } from "../data/nails.js";
import { rng, roll, pick } from "../utils/random.js";
import { degradeNail, makeNailCursor } from "../utils/nail.js";
import { generateCard } from "../utils/card.js";
import { generateCombatHand, generateCombatCard, CARD_VARIANTS } from "../utils/combat.js";
import { AudioEngine, ParticleSystem } from "../audio.js";
import { S } from "../utils/styles.js";
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
  const col = catColors[cell.category] || C.dim;
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

      {/* ── Sfondo categoria visibile SOLO dopo grattatura ── */}
      {/* (non mostrare niente — la sorpresa è tutto) */}

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


// ─── COMBAT COMPONENT ────────────────────────────────────────
export function CombatView({ enemy, player, onEnd, onNailDamage, onCellScratch, playerWallet=0, onCombo, onVariantRevealed }) {
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(enemy.isBoss ? 4 : 3);
  const [phase, setPhase] = useState("rules"); // rules, draw, select, resolve, end, bella
  const [bellaResult, setBellaResult] = useState(null); // { playerVal, enemyVal, playerWins }
  const [playerHand, setPlayerHand] = useState([]); // 9 carte pescate (gratti 3, quelle giochi)
  const [scratchedHandIdxs, setScratchedHandIdxs] = useState([]); // indici grattati (max 3 — sono le carte giocate)
  const [playerCells, setPlayerCells] = useState([]);
  const [enemyCells, setEnemyCells] = useState([]);
  const [enemyCard, setEnemyCard] = useState(null);
  // Wallet bonus: il player porta in combat una % del wallet. Nei boss è più generoso
  // (40% cap €250) per compensare il round extra e le carte DENARO alte del boss.
  const walletBonus = enemy.isBoss
    ? Math.min(Math.floor(playerWallet * 0.40), 250)
    : Math.min(Math.floor(playerWallet * 0.30), 150);
  const [playerMoney, setPlayerMoney] = useState(walletBonus);
  const [enemyMoney, setEnemyMoney] = useState(0);
  const [revealSeq, setRevealSeq] = useState([]); // [{flipSide:"player"|"enemy", flipIdx:n, entries:[{text,color,pTotal,eTotal}]}]
  const [revealStep, setRevealStep] = useState(0); // step corrente nella sequenza
  const [nailDamage, setNailDamage] = useState(0);
  const [playerHealsTotal, setPlayerHealsTotal] = useState(0);
  const [stolenMoney, setStolenMoney] = useState(0);
  const [resolvedPlayerCells, setResolvedPlayerCells] = useState([]);
  const [resolvedEnemyCells, setResolvedEnemyCells] = useState([]);
  const [roundPlayerDelta, setRoundPlayerDelta] = useState(0);
  const [roundEnemyDelta, setRoundEnemyDelta] = useState(0);
  const resolvedRef = useRef(false);
  const playerCellsRef = useRef([]);
  const [painFlash, setPainFlash] = useState(0);
  const [nailHitThisRound, setNailHitThisRound] = useState(0);
  const [tauntData, setTauntData] = useState(null); // { text, respond: {text, reward, risk}, ignore: {text} }
  const [dragoFireData, setDragoFireData] = useState(null); // { text, dmgType:"nail"|"money" }
  // Sprint 4: Streamer donazioni dinamiche in combat
  const [donationEvent, setDonationEvent] = useState(null); // { text, amount, type:"love"|"hate", emoji, subtitle }
  // Sprint 5: Mini-boss 3-combo challenge — traccia combo distinti raggiunti
  const [minibossCombosHit, setMinibossCombosHit] = useState([]); // array di nomi combo unici
  const [minibossBonusShown, setMinibossBonusShown] = useState(false);
  // Auto-scroll del log risoluzione combattimento (stile chat)
  const logScrollRef = useRef(null);
  // Unghie nemico: 5 vite proprio come il giocatore
  const [enemyNails, setEnemyNails] = useState(
    Array(5).fill(null).map(() => ({ state: "sana", scratchCount: 0 }))
  );

  // Spec 3 — Boss unici
  const [brokerInvestment, setBrokerInvestment] = useState(0);
  // Il Romanaccio: Taxi (passivo) + Manomissione (cheat reversibile)
  const [taxiGain, setTaxiGain] = useState(0); // € accumulati dal Romanaccio via taxi
  const [manomissioneActive, setManomissioneActive] = useState(null); // null o {amount, reverted}
  const [reTauntUsed, setReTauntUsed] = useState(false); // Provocalo! usabile 1 volta contro Il Napoletano

  // Spec 7 — Combat rework
  const [comboTracker, setComboTracker] = useState({}); // { effectType -> count } reset each combat
  const [activeCombo, setActiveCombo] = useState(null); // string name of active combo or null
  const [enemyRageMode, setEnemyRageMode] = useState(false);
  const [enemyFled, setEnemyFled] = useState(false);
  const [enemyArrogant, setEnemyArrogant] = useState(false);
  const [consecutiveWins, setConsecutiveWins] = useState(0);
  const [grattataFinaleCharges, setGrattataFinaleCharges] = useState(0);
  const [grattataFinaleActive, setGrattataFinaleActive] = useState(false); // attivata per il prossimo round
  const [reTauntMsg, setReTauntMsg] = useState(null); // messaggio risultato Provocalo! { text, isGood }

  // Colore unghia attiva del giocatore — usato per il cursore nelle combat cards
  const activeNailState = player?.nails?.[player?.activeNail ?? 0]?.state ?? "sana";
  const activeNailColor = NAIL_INFO[activeNailState]?.color ?? C.pink;

  // Premi pieni in combattimento — il rischio è già perdere soldi e danni alle unghie
  const moneyMult = 1;
  // Moltiplicatore posta: ogni round la posta aumenta, ma CAP a 1.8 per evitare
  // che al round 4 (boss-only) i valori nemici esplodano (es. IPO €120 × 2.2 = €264).
  // Ora: round1=1.0, round2=1.4, round3=1.8, round4=1.8 (stesso di round 3).
  const roundMult = Math.min(1.8, 1 + (round - 1) * 0.4);
  const catColors = { COMBATTIMENTO: C.red, DIFESA: C.blue, DENARO: C.gold };
  const enemyIcon = enemy.isBoss ? "👹" : enemy.isMiniboss ? "💀" : "🗡️";

  // Keep ref updated so effects can read fresh playerCells
  useEffect(() => { playerCellsRef.current = playerCells; }, [playerCells]);

  // Draw cards at start of each round — generate 9 per la selezione scratch-5-scegli-3
  useEffect(() => {
    if (phase !== "draw") return;
    const hand = generateCombatHand(9); // 9 carte — il giocatore ne gratta 5 poi ne sceglie 3
    const ec = generateCombatCard(false, enemy.name); // carte nemico specifiche per tipo
    setPlayerHand(hand);
    setScratchedHandIdxs([]);
    setEnemyCard(ec);
    setEnemyCells(ec.cells.map(c => ({...c, scratched: false})));
    setRevealSeq([]);
    setRevealStep(0);
    resolvedRef.current = false;
    setComboTracker({});
    setActiveCombo(null);
    setPhase("select");
  }, [phase, round]);

  // ─── SPRINT 4: Streamer donazioni dinamiche in combat ──────────
  // Ogni round, se hai follower, chance di donazione (love) o hater-troll (hate).
  // Più follower = più chance (cap 50%). Boss fight → amounts più alti.
  useEffect(() => {
    if (phase !== "select") return;
    const followers = player?.streamerFollowers || 0;
    if (followers <= 0) return;
    const chance = Math.min(0.5, 0.12 + followers * 0.06);
    if (Math.random() > chance) return;
    // Se ho molti follower, più probabili le donazioni positive (60–75% love)
    const loveChance = Math.min(0.75, 0.5 + followers * 0.02);
    const isLove = Math.random() < loveChance;
    const bossMult = enemy.isBoss ? 1.6 : 1;
    if (isLove) {
      const amount = Math.round((8 + Math.floor(Math.random() * 18)) * bossMult); // €8-26 (boss: 13-42)
      const templates = [
        `💸 "FORZA FRA' NON MOLLARE!" — +€${amount}`,
        `💸 "QUESTO È IL MIO STREAMER!" — +€${amount}`,
        `💸 "PRIME ACTIVATED!" — +€${amount}`,
        `💸 "MAMMINA DONA PER IL FIGLIO!" — +€${amount}`,
        `💸 "VAI COSÌ, LEGGENDA!" — +€${amount}`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      setPlayerMoney(m => m + amount);
      setDonationEvent({ text, amount, type: "love", emoji: "💸", subtitle: `+€${amount} dalla chat!` });
      setTimeout(() => setDonationEvent(null), 2200);
    } else {
      const amount = Math.round((4 + Math.floor(Math.random() * 10)) * bossMult); // €4-14 (boss: 6-22)
      const templates = [
        `🤬 "L1 ANDATE A LAVORARE!" — hater troll -€${amount}`,
        `🤬 "STO STREAM FA CAGARE." — -€${amount} per pubblicità saltate`,
        `🤬 "CHAT BOMBING!" — -€${amount} dai moderatori`,
        `🤬 "UNBAN MI HA COSTATO." — -€${amount}`,
        `🤬 "CHARGEBACK!" — donazione revocata -€${amount}`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      setPlayerMoney(m => Math.max(0, m - amount));
      setDonationEvent({ text, amount, type: "hate", emoji: "🤬", subtitle: `-€${amount} hater troll` });
      setTimeout(() => setDonationEvent(null), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  // Reveal sequenziale: ogni step gira una carta + fa apparire il suo log
  useEffect(() => {
    if (phase !== "resolve" && phase !== "end") return;
    if (revealStep >= revealSeq.length) return;
    const step = revealSeq[revealStep];
    const timer = setTimeout(() => {
      AudioEngine.scratch();
      // Flip carta nemica se è un passo nemico
      if (step.flipSide === "enemy") {
        setEnemyCells(prev => {
          const nc = [...prev];
          if (nc[step.flipIdx]) nc[step.flipIdx] = {...nc[step.flipIdx], scratched: true};
          return nc;
        });
        // Pain flash se contiene danno
        const hasLethal = step.entries.some(e => e.text.includes("STRAPPA") || e.text.includes("MORTA"));
        const hasDamage = hasLethal || step.entries.some(e => e.text.includes("degradata") || e.text.includes("ti ruba"));
        if (hasDamage) {
          if (hasLethal) AudioEngine.painScream();
          setPainFlash(0.5);
          setTimeout(() => setPainFlash(0.3), 120);
          setTimeout(() => setPainFlash(0.12), 300);
          setTimeout(() => setPainFlash(0), 500);
        }
      }
      // Pain flash per berserk (player perde un'unghia)
      if (step.flipSide === "player" && step.entries.some(e => e.text.includes("perdi 1 stato"))) {
        setPainFlash(0.4);
        setTimeout(() => setPainFlash(0.2), 120);
        setTimeout(() => setPainFlash(0), 400);
      }
      // Applica danni alle unghie nemico live quando la carta player viene rivelata
      if (step.enemyNailEffect) {
        const { kills, degrades } = step.enemyNailEffect;
        setEnemyNails(prev => {
          const nails = prev.map(n => ({...n}));
          for (let k = 0; k < kills; k++) {
            const alive = nails.findIndex(n => n.state !== "morta");
            if (alive >= 0) nails[alive] = { state: "morta", scratchCount: 0 };
          }
          for (let k = 0; k < degrades; k++) {
            const best = [...nails].reverse().findIndex(n => n.state !== "morta");
            const idx = best >= 0 ? nails.length - 1 - best : -1;
            if (idx >= 0) nails[idx] = { state: degradeNail(nails[idx].state), scratchCount: 0 };
          }
          return nails;
        });
      }
      setRevealStep(s => s + 1);
    }, 1100);
    return () => clearTimeout(timer);
  }, [phase, revealStep, revealSeq]);

  // Auto-risolve quando il giocatore ha grattato esattamente 3 carte
  useEffect(() => {
    if (phase !== "select" || scratchedHandIdxs.length !== 3 || !enemyCard) return;
    // Breve pausa per vedere la 3a carta rivelata prima di partire
    const timer = setTimeout(() => {
      const chosen = scratchedHandIdxs.map(i => ({...playerHand[i], scratched: true}));
      setPlayerCells(chosen);
      setResolvedPlayerCells(chosen);
      resolvedRef.current = true;
      doResolve(chosen, enemyCard.cells);
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scratchedHandIdxs.length, phase]);

  const doResolve = (pCells, eCells) => {
    // Costruisce revealSeq: ogni step = una carta che si gira + entries di log
    // Ordine interleaved: pCard0, eCard0, pCard1, eCard1, pCard2, eCard2, ...
    let pMoney = 0, eMoney = 0, nDmg = 0, sMoney = 0, playerHeals = 0;
    let pRunning = 0, eRunning = 0;
    let playerNailKills = 0, playerNailDegrades = 0;
    let enemyNailKills = 0, enemyNailDegrades = 0;

    // Il Romanaccio: Taxi (passivo +€) + Manomissione (cheat da denunciare)
    let effectiveRoundMult = roundMult;
    let romanaccioStepEntries = null;
    const isRomanaccio = enemy.isBoss && enemy.name === "Il Romanaccio";
    if (isRomanaccio) {
      const romanaccioEntries = [];
      // Taxi: il Romanaccio ti fa pagare la corsa ogni round, soldi sicuri in tasca sua
      const taxiFee = 10 + (round - 1) * 3; // r1=10, r2=13, r3=16, r4=19
      eMoney += taxiFee; eRunning += taxiFee;
      setTaxiGain(prev => prev + taxiFee);
      romanaccioEntries.push({ text: `🚕 TAXI — il Romanaccio ti porta al casinò con la strada lunga: +€${taxiFee} per lui`, color: C.orange, pTotal: 0, eTotal: 0 });
      // Manomissione: 40% prova a truccare i dadi — se il player ha denunciato, reverti
      if (roll(0.40)) {
        const cheatAmount = 20 + (round - 1) * 8; // r1=20, r2=28, r3=36, r4=44
        if (manomissioneActive && manomissioneActive.reverted) {
          // Già denunciato: segnala che ci prova di nuovo ma stavolta lo beccheremo dopo
          romanaccioEntries.push({ text: `🔧 MANOMISSIONE — prova a truccare le carte (+€${cheatAmount}) — DENUNCIA disponibile!`, color: C.red, pTotal: 0, eTotal: 0 });
        } else {
          romanaccioEntries.push({ text: `🔧 MANOMISSIONE — prova a truccare le carte (+€${cheatAmount}) — DENUNCIA disponibile!`, color: C.red, pTotal: 0, eTotal: 0 });
        }
        eMoney += cheatAmount; eRunning += cheatAmount;
        setManomissioneActive({ amount: cheatAmount, reverted: false });
      } else {
        setManomissioneActive(null);
        romanaccioEntries.push({ text: `🔧 Il Romanaccio ci prova ma stavolta gioca pulito... per ora.`, color: C.dim, pTotal: 0, eTotal: 0 });
      }
      romanaccioStepEntries = romanaccioEntries;
    }

    const pBase = playerMoney;
    const eBase = enemyMoney;

    // Difesa giocatore — pre-calcolata, usata come reazione agli attacchi
    const playerHasFullBlock = pCells.some(c => c.effect === "block" || c.effect === "fortress");
    // Guanto da BOSS: vale SOLO contro il boss (non miniboss, non ladri, non spacciatori).
    // Copre tutte le unghie per l'intera fight; si sgretola a fine combattimento (gestito in handleCombatEnd).
    const isBossFight = enemy?.isBoss === true;
    const hasGuantoBoss = isBossFight && (player.guantoBossActive === true || player.equippedGrattatore?.effect === "bossShield");
    let dodgesLeft = pCells.filter(c => c.effect === "dodge").length;
    const blockCard = pCells.find(c => c.effect === "block" || c.effect === "fortress");

    const steps = [];
    const maxLen = Math.max(pCells.length, eCells.length);

    // Inserisci step Romanaccio (Taxi + Manomissione) all'inizio
    if (romanaccioStepEntries) {
      steps.push({ flipSide: null, flipIdx: -1, entries: romanaccioStepEntries });
    }

    for (let i = 0; i < maxLen; i++) {
      // ── PLAYER CARD i ──
      if (i < pCells.length) {
        const c = pCells[i];
        const entries = [];
        let step_eNailEffect = null; // danni alle unghie nemico applicati live durante reveal
        const E = (text, color) => entries.push({ text, color, pTotal: pBase + pRunning, eTotal: eBase + eRunning });
        // Sprint 5: variant multiplier (FOIL/STRAPPATO/D'ORO/B&N/MULTI)
        const variantMult = CARD_VARIANTS[c.variant]?.valueMult ?? 1;
        if (c.variant) {
          const v = CARD_VARIANTS[c.variant];
          E(`${c.variant === "ORO" ? "✨" : c.variant === "FOIL" ? "🌈" : c.variant === "STRAPPATO" ? "🪶" : c.variant === "BN" ? "◼️" : "🎨"} ${v.label} — ${v.desc}`, v.color);
        }

        if (c.effect === "money") {
          const val = Math.round(c.value * effectiveRoundMult * variantMult);
          pMoney += val; pRunning += val;
          E(`✅ ${c.emoji} ${c.name}${effectiveRoundMult>1?` ×${effectiveRoundMult.toFixed(1)}`:""}: +€${val} → €${pBase+pRunning}`, C.green);
        }
        if (c.effect === "allIn") {
          pMoney += c.value; pRunning += c.value;
          eMoney += c.cost; eRunning += c.cost;
          E(`✅ ${c.emoji} ${c.name}: +€${c.value} a te → €${pBase+pRunning} | ma ${enemy.name} +€${c.cost}`, C.gold);
        }
        if (c.effect === "gamble") {
          if (roll(0.5)) {
            pMoney += c.value; pRunning += c.value;
            E(`✅ ${c.emoji} ${c.name}: FORTUNA! +€${c.value} → €${pBase+pRunning}`, C.green);
          } else {
            pMoney -= c.cost; pRunning -= c.cost;
            E(`❌ ${c.emoji} ${c.name}: sfiga... −€${c.cost} → €${pBase+pRunning}`, C.red);
          }
        }
        if (c.effect === "freeCard") {
          // Auto-gratta il grattino trovato — il premio va nel conteggio della lotta
          const affordable = CARD_TYPES.filter(t => t.cost <= 15);
          const freeType = pick(affordable);
          const freeCardObj = generateCard(freeType.id);
          if (freeCardObj.isWinner && freeCardObj.prize > 0) {
            const cardPrize = freeCardObj.prize;
            pMoney += cardPrize; pRunning += cardPrize;
            E(`🎫 ${c.emoji} Grattino "${freeType.name}" → VINTO €${cardPrize}! → €${pBase+pRunning}`, C.green);
          } else {
            E(`🎫 ${c.emoji} Grattino "${freeType.name}" → niente... prossima volta!`, C.dim);
          }
        }
        if (c.effect === "heal") {
          playerHeals++;
          E(`✅ ${c.emoji} ${c.name}: 1 unghia curata`, C.green);
        }
        if (c.effect === "adrenaline") {
          const hasDamaged = player.nails.some(n => n.state !== "sana" && n.state !== "morta" && n.state !== "kawaii");
          if (hasDamaged) { playerHeals++; E(`✅ ${c.emoji} ${c.name}: unghia danneggiata curata!`, C.green); }
          else { pMoney += c.value; pRunning += c.value; E(`✅ ${c.emoji} ${c.name}: tutto ok, incassi +€${c.value} → €${pBase+pRunning}`, C.gold); }
        }
        if (c.effect === "damageNail") {
          const finaleActive = grattataFinaleCharges > 0;
          if (finaleActive) {
            setGrattataFinaleCharges(ch => ch - 1);
            enemyNailKills += 3;
            const nailPenalty = 70 * 3;
            eMoney -= nailPenalty; eRunning -= nailPenalty;
            E(`⚡ GRATTATA FINALE! Strappa 3 unghie nemiche in un colpo! (nemico −€${nailPenalty})`, C.cyan);
            step_eNailEffect = { kills: 3, degrades: 0 };
          } else {
            enemyNailKills++;
            // Strappare un'unghia nemica = -€70 al nemico (COMBATTIMENTO deve valere la pena!)
            const nailPenalty = 70;
            eMoney -= nailPenalty; eRunning -= nailPenalty;
            E(`⚔️ ${c.emoji} ${c.name}: unghia nemica → 💀 MORTA! (nemico −€${nailPenalty})`, C.green);
            step_eNailEffect = { kills: 1, degrades: 0 };
          }
          // Broker: Strappa dimezza l'investimento
          if (enemy.isBoss && enemy.name === "Il Broker" && brokerInvestment > 0) {
            const stolen = Math.round(brokerInvestment * 0.5);
            setBrokerInvestment(prev => Math.max(0, prev - stolen));
            E(`📉 Strappata l'unghia — distruggi €${stolen} dell'investimento del Broker!`, C.cyan);
          }
        }
        if (c.effect === "lightDamage") {
          enemyNailDegrades++;
          // Degradare unghia nemica = -€25 al nemico
          const degradePenalty = 25;
          eMoney -= degradePenalty; eRunning -= degradePenalty;
          E(`⚔️ ${c.emoji} ${c.name}: unghia nemica degradata −€${degradePenalty}`, C.gold);
          step_eNailEffect = { kills: 0, degrades: 1 };
        }
        if (c.effect === "stealMoney") {
          const val = Math.round(c.value * effectiveRoundMult * variantMult);
          sMoney += val; pRunning += val;
          E(`⚔️ ${c.emoji} ${c.name}: rubi €${val} al nemico → tue €${pBase+pRunning}`, C.gold);
        }
        if (c.effect === "berserk") {
          enemyNailKills++; nDmg += 1;
          const berserkPenalty = 40;
          eMoney -= berserkPenalty; eRunning -= berserkPenalty;
          E(`⚔️ ${c.emoji} ${c.name}: unghia nemica MORTA (−€${berserkPenalty}) — ma perdi 1 stato tua`, C.orange);
          step_eNailEffect = { kills: 1, degrades: 0 };
        }
        if (c.effect === "block") {
          E(`🛡 ${c.emoji} ${c.name}: scudo totale attivo — blocca attacchi fisici e furti`, C.blue);
        }
        if (c.effect === "fortress") {
          pMoney -= c.cost; pRunning -= c.cost;
          E(`🏰 ${c.emoji} ${c.name}: −€${c.cost} → €${pBase+pRunning} — scudo totale attivo`, C.blue);
        }
        if (c.effect === "dodge") {
          E(`💨 ${c.emoji} ${c.name}: Schiva carica${dodgesLeft>1?` (${dodgesLeft} cariche)`:""}`, C.cyan);
        }

        if (entries.length > 0) steps.push({ flipSide: "player", flipIdx: i, entries, enemyNailEffect: step_eNailEffect });
      }

      // ── ENEMY CARD i ──
      if (i < eCells.length) {
        const c = eCells[i];
        const entries = [];
        const E = (text, color) => entries.push({ text, color, pTotal: pBase + pRunning, eTotal: eBase + eRunning });

        if (c.effect === "money") {
          const rageBoost = (enemyRageMode && enemy.name === "Mini Boss") ? 1.3 : 1;
          const val = Math.round(c.value * effectiveRoundMult * rageBoost);
          eMoney += val; eRunning += val;
          E(`${enemy.name} ${c.emoji} ${c.name}${effectiveRoundMult>1?` ×${effectiveRoundMult.toFixed(1)}`:""}: +€${val} → suo €${eBase+eRunning}`, C.orange);
        }
        if (c.effect === "damageNail") {
          if (hasGuantoBoss) {
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Strappa... 🧤 GUANTO DA BOSS blocca il danno!`, C.gold);
          } else if (playerHasFullBlock) {
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Strappa... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else if (dodgesLeft > 0) {
            dodgesLeft--;
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Strappa... 💨 SCHIVATO!${dodgesLeft>0?` (${dodgesLeft} rimaste)`:" (Schiva esaurita)"}`, C.cyan);
          } else {
            playerNailKills++;
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: ✂️ STRAPPA → tua unghia MORTA!`, C.red);
          }
        }
        if (c.effect === "lightDamage") {
          if (hasGuantoBoss) {
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Schiaffo... 🧤 GUANTO DA BOSS blocca il danno!`, C.gold);
          } else if (playerHasFullBlock) {
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Schiaffo... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else if (dodgesLeft > 0) {
            dodgesLeft--;
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: Schiaffo... 💨 SCHIVATO!${dodgesLeft>0?` (${dodgesLeft} rimaste)`:" (Schiva esaurita)"}`, C.cyan);
          } else {
            playerNailDegrades++;
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: tua unghia degradata di 1 stato`, C.orange);
          }
        }
        if (c.effect === "stealMoney") {
          if (playerHasFullBlock) {
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: tenta di rubare... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else {
            const val = Math.round(c.value * effectiveRoundMult);
            pMoney -= val; pRunning -= val;
            E(`${enemy.name} 🗡 ${c.emoji} ${c.name}: ti ruba €${val}${dodgesLeft>0?" (Schiva non ferma i furti)":""}! → tue €${pBase+pRunning}`, C.red);
          }
        }
        // Drago d'Oro: "damage" = danno diretto in € (fuoco)
        if (c.effect === "damage") {
          if (hasGuantoBoss) {
            E(`${enemy.name} 🔥 ${c.emoji} ${c.name}: fiamme... 🧤 GUANTO DA BOSS blocca!`, C.gold);
          } else if (playerHasFullBlock) {
            E(`${enemy.name} 🔥 ${c.emoji} ${c.name}: fiamme... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else {
            const val = Math.round((c.value || 20) * effectiveRoundMult);
            pMoney -= val; pRunning -= val;
            E(`${enemy.name} 🔥 ${c.emoji} ${c.name}: brucia €${val}! → tue €${pBase+pRunning}`, C.red);
          }
        }
        // Drago d'Oro: "killNail" = uccide un'unghia (alias damageNail)
        if (c.effect === "killNail") {
          if (hasGuantoBoss) {
            E(`${enemy.name} 🐲 ${c.emoji} ${c.name}: Artiglio... 🧤 GUANTO DA BOSS blocca!`, C.gold);
          } else if (playerHasFullBlock) {
            E(`${enemy.name} 🐲 ${c.emoji} ${c.name}: Artiglio... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else if (dodgesLeft > 0) {
            dodgesLeft--;
            E(`${enemy.name} 🐲 ${c.emoji} ${c.name}: Artiglio... 💨 SCHIVATO!${dodgesLeft>0?` (${dodgesLeft} rimaste)`:" (Schiva esaurita)"}`, C.cyan);
          } else {
            playerNailKills++;
            E(`${enemy.name} 🐲 ${c.emoji} ${c.name}: ✂️ ARTIGLIO → tua unghia MORTA!`, C.red);
          }
        }
        // Drago d'Oro: "steal" = ruba soldi (alias stealMoney)
        if (c.effect === "steal") {
          if (playerHasFullBlock) {
            E(`${enemy.name} 🐍 ${c.emoji} ${c.name}: Morso... 🛡 BLOCCATO da ${blockCard?.name||"Scudo"}!`, C.blue);
          } else {
            const val = Math.round((c.value || 15) * effectiveRoundMult);
            pMoney -= val; pRunning -= val;
            E(`${enemy.name} 🐍 ${c.emoji} ${c.name}: Morso Velenoso ruba €${val}! → tue €${pBase+pRunning}`, C.red);
          }
        }
        if (c.effect === "block" || c.effect === "fortress") {
          E(`${enemy.name} 🛡 ${c.emoji} ${c.name}: si protegge con uno scudo!`, C.blue);
        }
        if (c.effect === "dodge") {
          E(`${enemy.name} 💨 ${c.emoji} ${c.name}: si prepara a schivare!`, C.cyan);
        }

        if (entries.length > 0) steps.push({ flipSide: "enemy", flipIdx: i, entries });
      }
    }

    // ── SPEC 3: Boss unici ──────────────────────────────────────

    // Broker: accumula investimento cross-round
    if (enemy.isBoss && enemy.name === "Il Broker") {
      const invest = Math.round(eMoney * 0.20);
      const grown = Math.round(brokerInvestment * 0.10);
      setBrokerInvestment(prev => prev + invest + grown);
      const newInv = brokerInvestment + invest + grown;
      steps.push({ flipSide: null, flipIdx: -1, entries: [
        { text: `💼 Il Broker investe €${invest} (+ €${grown} crescita) → Portafoglio: €${newInv}`, color: C.magenta, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
      ]});
      // Round finale: incassa tutto
      if (round >= maxRounds) {
        eMoney += newInv; eRunning += newInv;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `💼 Il Broker INCASSA l'investimento: +€${newInv}! → suo €${eBase+eRunning}`, color: C.magenta, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
        setBrokerInvestment(0);
      }
    }

    // Il Napoletano: gratta una carta bonus dopo la risoluzione
    if (enemy.isBoss && enemy.name === "Il Napoletano") {
      // Cap tier 1-2: evita spike da €800+ tier 4 (tredici) che rende il boss imbattibile
      const tiers = [1, 2];
      const tier = pick(tiers);
      const reTierCards = CARD_TYPES.filter(t => {
        const cb = CARD_BALANCE[t.id];
        return cb && cb.tier === tier;
      });
      const reCardType = reTierCards.length > 0 ? pick(reTierCards) : pick(CARD_TYPES);
      const reCard = generateCard(reCardType.id);
      if (reCard.isWinner && reCard.prize > 0) {
        eMoney += reCard.prize; eRunning += reCard.prize;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🎟 'O Napoletano gratta "${reCardType.name}"... TALE E QUALE! VINCE €${reCard.prize}! → suo €${eBase+eRunning}`, color: C.orange, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      } else {
        enemyNailKills++;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🎟 'O Napoletano gratta "${reCardType.name}"... PERDE! Se strappa 'n'ogna! 💀`, color: C.green, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
    }

    // ── SPEC 7: Combo system ──────────────────────────────────────
    // Player combo — Sprint 5: MULTI conta per tutte le categorie, BN ricompensa +€5
    const categoryCounts = {};
    pCells.forEach(c => {
      if (c.variant === "MULTI") {
        ["COMBATTIMENTO", "DIFESA", "DENARO"].forEach(cat => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
      } else {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      }
    });
    // B&N bonus: +€5 per ogni B&N grattata (effetto "fotografia vintage")
    const bnCount = pCells.filter(c => c.variant === "BN").length;
    if (bnCount > 0) {
      const bnBonus = bnCount * 5;
      pMoney += bnBonus; pRunning += bnBonus;
      steps.push({ flipSide: null, flipIdx: -1, entries: [
        { text: `◼️ B&N × ${bnCount} — bonus vintage +€${bnBonus}`, color: "#cccccc", pTotal: pBase+pRunning, eTotal: eBase+eRunning }
      ]});
    }
    const comboCategory = Object.keys(categoryCounts).find(k => categoryCounts[k] >= 3);
    let comboBonus = 0;
    let comboText = null;

    if (comboCategory === "COMBATTIMENTO") {
      comboText = "⚔️ FURIA! COMBO COMBATTIMENTO — effetti potenziati +50%";
      enemyNailDegrades++;
      comboBonus = 30;
      pMoney += comboBonus; pRunning += comboBonus;
    } else if (comboCategory === "DIFESA") {
      comboText = "🛡 FORTEZZA! COMBO DIFESA — scudo attivo per 2 round!";
      comboBonus = 20;
      pMoney += comboBonus; pRunning += comboBonus;
    } else if (comboCategory === "DENARO") {
      comboBonus = 50;
      pMoney += comboBonus; pRunning += comboBonus;
      comboText = `💰 JACKPOT! COMBO DENARO — bonus €${comboBonus}!`;
    }

    if (comboText) {
      steps.push({ flipSide: null, flipIdx: -1, entries: [
        { text: comboText, color: C.gold, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
      ]});
    }

    // Enemy combo
    const eCategoryCounts = {};
    eCells.forEach(c => { eCategoryCounts[c.category] = (eCategoryCounts[c.category] || 0) + 1; });
    const eComboCategory = Object.keys(eCategoryCounts).find(k => eCategoryCounts[k] === 3);
    if (eComboCategory) {
      let eComboVal = 0;
      let eComboText = "";
      if (eComboCategory === "COMBATTIMENTO") { eComboText = `${enemy.name} — FURIA COMBO! attacchi potenziati`; playerNailDegrades++; }
      else if (eComboCategory === "DIFESA") { eComboText = `${enemy.name} — FORTEZZA COMBO! blocca tutto`; }
      else if (eComboCategory === "DENARO") { eComboVal = 40; eMoney += eComboVal; eRunning += eComboVal; eComboText = `${enemy.name} — JACKPOT COMBO! +€${eComboVal}`; }
      steps.push({ flipSide: null, flipIdx: -1, entries: [
        { text: eComboText, color: C.orange, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
      ]});
    }

    // ── COMBO SYSTEM: 3 same effect type = powered effect ─────────────────
    {
      const effectCounts = {};
      pCells.forEach(c => { effectCounts[c.effect] = (effectCounts[c.effect] || 0) + 1; });
      const altaEffects = ["boccaDrago", "maledetto", "ruota"]; // legacy, mapped from category
      const bassaCategory = pCells.filter(c => c.category === "DENARO");
      const altaCategory  = pCells.filter(c => c.category === "COMBATTIMENTO");

      let newComboName = null;

      // 3x damageNail → STRAPPA COMBO: kill one enemy nail + steal €10
      if ((effectCounts["damageNail"] || 0) >= 3) {
        newComboName = "STRAPPA COMBO";
        enemyNailKills++;
        const strappaSteali = 10;
        sMoney += strappaSteali; pRunning += strappaSteali;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🔥 COMBO! STRAPPA COMBO x3 — unghia nemica DISTRUTTA + rubi €${strappaSteali}!`, color: C.red, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
      // 3x stealMoney → FURTO COMBO: steal extra €20
      else if ((effectCounts["stealMoney"] || 0) >= 3) {
        newComboName = "FURTO COMBO";
        const furtoBon = 20;
        sMoney += furtoBon; pRunning += furtoBon;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🔥 COMBO! FURTO COMBO x3 — rubi extra €${furtoBon} al nemico!`, color: C.gold, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
      // 3x lightDamage → SCHIAFFO COMBO: enemy loses 2 nail states
      else if ((effectCounts["lightDamage"] || 0) >= 3) {
        newComboName = "SCHIAFFO COMBO";
        enemyNailDegrades += 2;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🔥 COMBO! SCHIAFFO COMBO x3 — nemico perde 2 stati unghia!`, color: C.cyan, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
      // 3x ALTA category cards → INFERNO COMBO: prize x3 this round (add 2x bonus of pMoney so far)
      else if (altaCategory.length >= 3) {
        newComboName = "INFERNO COMBO";
        const infernoBonus = Math.round(pRunning * 2); // existing pMoney × 2 = total × 3
        if (infernoBonus > 0) { pMoney += infernoBonus; pRunning += infernoBonus; }
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🔥 COMBO! INFERNO COMBO x3 — premi ×3 questo round!${infernoBonus > 0 ? ` +€${infernoBonus}` : ""}`, color: C.red, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
      // 3x BASSA category cards → GRATTA SICURO COMBO: heal 1 nail state
      else if (bassaCategory.length >= 3) {
        newComboName = "GRATTA SICURO COMBO";
        playerHeals++;
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `🔥 COMBO! GRATTA SICURO x3 — curi 1 stato unghia!`, color: C.green, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }

      // Check for 3 identical typeId (TRIPLA PERFETTA)
      if (!newComboName) {
        const typeidCounts = {};
        pCells.forEach(c => { const k = c.name; typeidCounts[k] = (typeidCounts[k] || 0) + 1; });
        const triplaKey = Object.keys(typeidCounts).find(k => typeidCounts[k] >= 3);
        if (triplaKey) {
          newComboName = "TRIPLA PERFETTA";
          const triplaBon = 30;
          pMoney += triplaBon; pRunning += triplaBon;
          steps.push({ flipSide: null, flipIdx: -1, entries: [
            { text: `🔥 TRIPLA PERFETTA! "${triplaKey}" ×3 — €${triplaBon} bonus + fortuna!`, color: C.gold, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
          ]});
        }
      }

      if (newComboName) {
        setActiveCombo(newComboName);
        setTimeout(() => setActiveCombo(null), 2200);
        if (onCombo) onCombo();
      }

      // Sprint 5: mini-boss 3-combo challenge — traccia tutti i combo unici (categoria + effetto)
      if (enemy.isMiniboss) {
        const hitNames = [];
        if (comboCategory) hitNames.push(`CAT_${comboCategory}`);
        if (newComboName) hitNames.push(newComboName);
        if (hitNames.length > 0) {
          setMinibossCombosHit(prev => {
            const next = [...prev];
            hitNames.forEach(n => { if (!next.includes(n)) next.push(n); });
            return next;
          });
        }
      }
      // Update comboTracker for display
      setComboTracker(effectCounts);
    }

    // ── SPEC 7.2: Personalità nemico ──────────────────────────────────────
    if (round === 1) {
      // Ladro: 40% chance scappa se perde round 1
      if ((enemy.name === "Ladro" || enemy.name === "Ladro Nascosto") && (pMoney + sMoney) > eMoney) {
        if (roll(0.40)) {
          steps.push({ flipSide: null, flipIdx: -1, entries: [
            { text: `🏃 ${enemy.name} SI DEMORALIZZA e scappa! Vittoria automatica con bottino ridotto!`, color: C.green, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
          ]});
          setEnemyFled(true);
        }
      }
      // Sfidante: arrogante se vince round 1
      if (enemy.name === "Sfidante" && eMoney > (pMoney + sMoney)) {
        setEnemyArrogant(true);
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `😤 Lo Sfidante è ARROGANTE — le sue carte DIFESA valgono meno!`, color: C.orange, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
    }
    // MiniBoss rabbia se ha perso molte unghie
    {
      const enemyAliveNailsCount = enemyNails.filter(n => n.state !== "morta").length;
      if (enemy.name === "Mini Boss" && enemyAliveNailsCount <= 2 && !enemyRageMode) {
        setEnemyRageMode(true);
        steps.push({ flipSide: null, flipIdx: -1, entries: [
          { text: `💢 Il Mini Boss entra in RABBIA — carte +30% valore!`, color: C.red, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
        ]});
      }
    }

    // ── SPEC 7.3: Grattata Finale ─────────────────────────────────────────
    {
      const playerWonRound = (pMoney + sMoney) > eMoney;
      if (playerWonRound) {
        setConsecutiveWins(prev => {
          const newWins = prev + 1;
          if (newWins >= 2 && newWins % 2 === 0) {
            setGrattataFinaleCharges(c => c + 1);
            steps.push({ flipSide: null, flipIdx: -1, entries: [
              { text: `⚡ GRATTATA FINALE caricata! (${Math.floor(newWins/2)} carica/e) — x3 alla prossima mossa!`, color: C.cyan, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
            ]});
          }
          return newWins;
        });
      } else {
        setConsecutiveWins(0);
      }
    }

    // ── GUANTO DA BOSS: consuma dopo combattimento ──
    if (hasGuantoBoss) {
      steps.push({ flipSide: null, flipIdx: -1, entries: [
        { text: `🧤 Guanto da BOSS consumato! Ha protetto tutte le unghie!`, color: C.gold, pTotal: pBase+pRunning, eTotal: eBase+eRunning }
      ]});
    }

    // ── APPLICA EFFETTI DI STATO (immediato, i display animano via pTotal/eTotal) ──
    // CAP: max 1 Strappa + 1 Schiaffo per round
    playerNailKills = Math.min(playerNailKills, 1);
    playerNailDegrades = Math.min(playerNailDegrades, 1);
    if (playerNailKills > 0) playerNailDegrades = 0;
    nDmg += playerNailDegrades;

    // Danni unghie nemico applicati live nel reveal useEffect via enemyNailEffect per step

    const totalNailHit = Math.floor(nDmg) + playerNailKills;
    if (totalNailHit > 0) {
      setNailHitThisRound(totalNailHit);
      if (playerNailKills > 0 && onNailDamage) onNailDamage(10);
      if (Math.floor(nDmg) > 0 && onNailDamage) onNailDamage(Math.floor(nDmg));
      // L'urlo viene emesso dalla reveal useEffect quando lo step nemico dannoso appare
    }

    // ── Macellaio Implant Effects ────────────────────────────────
    // velenosa: ogni cella grattata da player -> -€5 al nemico
    // parassita: ogni round -> -€3 nemico, +€3 player
    // esplosiva: se un'unghia con esplosiva è morta durante combat -> -€60 nemico (gestito in onNailDamage callback)
    const liveNails = player.nails.filter(n => n.state !== "morta");
    const hasVelenosa = liveNails.some(n => n.implant === "velenosa");
    const hasParassita = liveNails.some(n => n.implant === "parassita");
    if (hasVelenosa) {
      const scratchedCount = pCells.length; // carte grattate this round
      const velenDmg = scratchedCount * 5;
      eMoney -= velenDmg;
      steps.push({ flipSide: null, flipIdx: -1, entries: [{ text: `☠️ Unghia Velenosa: ${scratchedCount} grattate × €5 = −€${velenDmg} al nemico!`, color: C.red, pTotal: pBase+pRunning, eTotal: eBase+eRunning - velenDmg }] });
    }
    if (hasParassita) {
      eMoney -= 3; pMoney += 3;
      steps.push({ flipSide: null, flipIdx: -1, entries: [{ text: `🪱 Unghia Parassita: rubi €3 al nemico!`, color: C.green, pTotal: pBase+pRunning+3, eTotal: eBase+eRunning-3 }] });
    }

    setPlayerMoney(m => m + pMoney + sMoney);
    setEnemyMoney(m => m + eMoney);
    setNailDamage(d => d + totalNailHit);
    setPlayerHealsTotal(h => h + playerHeals);
    setStolenMoney(s => s + sMoney);
    setResolvedPlayerCells(pCells);
    setResolvedEnemyCells(eCells);
    setRoundPlayerDelta(pMoney + sMoney);
    setRoundEnemyDelta(eMoney);

    // Nemico: azzera celle per la reveal (partiranno face-down)
    setEnemyCells(eCells.map(c => ({...c, scratched: false})));
    setRevealSeq(steps);
    setRevealStep(0);

    if (round >= maxRounds) {
      const diff = Math.abs((playerMoney + pMoney + sMoney) - (enemyMoney + eMoney));
      setPhase(diff <= 20 ? "bella" : "end");
    } else {
      setPhase("resolve");
    }
  };

  // enemyFled: vittoria automatica con bottino ridotto
  useEffect(() => {
    if (!enemyFled) return;
    setEnemyMoney(m => Math.round(m * 0.4));
    setTimeout(() => setPhase("end"), 800);
  }, [enemyFled]);

  // Kill istantaneo: se tutte le unghie nemiche sono morte → il nemico perde subito
  useEffect(() => {
    if (enemyNails.length === 0) return;
    if (phase !== "resolve" && phase !== "end") return;
    if (!enemyNails.every(n => n.state === "morta")) return;
    // Bonus: nemico distrutto via COMBATTIMENTO — guadagno extra
    const killBonus = 120;
    setPlayerMoney(m => m + killBonus);
    setPhase("end");
  }, [enemyNails, phase]);

  // La Bella: genera i valori quando si entra nella fase
  useEffect(() => {
    if (phase !== "bella") return;
    // Valori Bella scalano col moltiplicatore finale — più alto il round, più alta la posta
    const baseVals = [20, 40, 60, 80, 100];
    const scaledVals = baseVals.map(v => Math.round(v * roundMult));
    const pv = scaledVals[Math.floor(rng() * scaledVals.length)];
    const ev = scaledVals[Math.floor(rng() * scaledVals.length)];
    setTimeout(() => setBellaResult({
      playerVal: pv, enemyVal: ev,
      playerWins: pv > ev,
      draw: pv === ev,
    }), 1800);
  }, [phase]);


  const nextRound = () => {
    setNailHitThisRound(0);
    // 🐲 Fiato del Drago — ogni round pari (2,4) il Drago soffia fuoco
    const isDrago = enemy?.name === "Il Drago d'Oro";
    const hadDefense = resolvedPlayerCells.some(c => c.cat === "DIFESA");
    if (isDrago && round % 2 === 0 && !hadDefense) {
      const dmgType = Math.random() < 0.5 ? "nail" : "money";
      const fireTexts = [
        "🔥 FIATO DEL DRAGO! 🐲",
        "🔥 Il Drago soffia fuoco! 🐲",
        "🔥 Fiamme dal cielo! 🐲",
      ];
      setDragoFireData({
        text: fireTexts[Math.floor(Math.random() * fireTexts.length)],
        dmgType,
        subtitle: dmgType === "nail"
          ? "Le fiamme bruciano la tua unghia! (-1 stato)"
          : "Il fuoco divora le tue monete! (-€20)",
      });
      if (dmgType === "nail") {
        onNailDamage(1);
        setNailDamage(d => d + 1);
      } else {
        setPlayerMoney(m => Math.max(0, m - 20));
      }
      setPhase("dragoFire");
      setTimeout(() => {
        setDragoFireData(null);
        setRound(r => r + 1);
        setPhase("draw");
      }, 2000);
      return;
    }
    // 30% chance of taunt between rounds
    if (round < maxRounds && Math.random() < 0.3) {
      const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
      setTauntData(t);
      setPhase("taunt");
    } else {
      setRound(r => r + 1);
      setPhase("draw");
    }
  };

  const handleTauntRespond = () => {
    if (!tauntData) return;
    const won = Math.random() < tauntData.winChance;
    if (won) {
      setPlayerMoney(m => m + tauntData.rewardMoney);
      setTauntData({...tauntData, result: "win"});
    } else {
      if (tauntData.riskDamage > 0) onNailDamage(tauntData.riskDamage);
      setTauntData({...tauntData, result: "lose"});
    }
    setTimeout(() => { setTauntData(null); setRound(r => r + 1); setPhase("draw"); }, 1500);
  };
  const handleTauntIgnore = () => {
    setTauntData(null);
    setRound(r => r + 1);
    setPhase("draw");
  };

  // Spec 3.3: Provocalo! — taunt per Il Napoletano (usabile 1 volta)
  const handleProvocaRe = () => {
    if (reTauntUsed) return;
    setReTauntUsed(true);
    setReTauntMsg(null);
    // 85% autodanno al Napoletano, 15% vince €500
    if (roll(0.85)) {
      // autodanno: 'O Napoletano si strappa un'unghia per la rabbia
      setEnemyNails(prev => {
        const nails = prev.map(n => ({...n}));
        const alive = nails.findIndex(n => n.state !== "morta");
        if (alive >= 0) nails[alive] = { state: "morta", scratchCount: 0 };
        return nails;
      });
      setEnemyMoney(m => Math.max(0, m - 70));
      setReTauntMsg({ text: "😈 'O Napoletano s'ncazza e se strappa 'na ogna 'a sulo! −€70 e ogna morta!", isGood: true });
    } else {
      // 'O Napoletano vince €500 extra — cattivo esito
      setEnemyMoney(m => m + 500);
      setReTauntMsg({ text: "😱 'O Napoletano ride e GRATTA 'o tagliando d'oro da €500! +€500!", isGood: false });
    }
    // Pulisci il messaggio dopo 3s
    setTimeout(() => setReTauntMsg(null), 3000);
  };

  // Romanaccio: Denuncia! — reverte la manomissione dell'ultimo round
  const handleDenunciaRomanaccio = () => {
    if (!manomissioneActive || manomissioneActive.reverted) return;
    const refund = manomissioneActive.amount;
    setEnemyMoney(m => Math.max(0, m - refund));
    setManomissioneActive({ ...manomissioneActive, reverted: true });
  };

  const finish = () => {
    const won = playerMoney > enemyMoney;
    const enemyAliveNails = enemyNails.filter(n => n.state !== "morta").length;
    // Sprint 5: mini-boss 3-combo challenge bonus
    // 2 combo distinti = +€40; 3+ = +€100 + bonus heal
    let minibossBonus = 0;
    let minibossHeal = 0;
    if (enemy.isMiniboss && won) {
      const n = minibossCombosHit.length;
      if (n >= 3) { minibossBonus = 100; minibossHeal = 1; }
      else if (n >= 2) { minibossBonus = 40; }
    }
    onEnd({
      won, playerMoney: playerMoney + minibossBonus, enemyMoney,
      nailDamage: 0, // già applicato durante il combattimento tramite onNailDamage
      nailHeals: playerHealsTotal + minibossHeal,
      moneyGained: won ? (playerMoney + minibossBonus) : -Math.abs(enemyMoney - playerMoney),
      stolenMoney,
      // Win: guadagni un'unghia (se il nemico ne ha ancora). Lose: perdi un'unghia
      winNail: won,
      loseNail: !won,
      minibossBonus, minibossHeal, minibossCombos: minibossCombosHit.length,
    });
  };

  // Spacebar in combat: prosegui fase (ref pattern — no stale closure)
  const combatSpaceRef = useRef(null);
  combatSpaceRef.current = () => {
    if (phase === "rules") { setPhase("draw"); return; }
    if (phase === "select") {
      // Spacebar: gratta prossima carta non ancora grattata (max 3)
      setScratchedHandIdxs(prev => {
        if (prev.length >= 3) return prev;
        const nextIdx = playerHand.findIndex((_, i) => !prev.includes(i));
        if (nextIdx >= 0) { AudioEngine.scratch(); return [...prev, nextIdx]; }
        return prev;
      });
      return;
    }
    if (phase === "resolve") {
      if (revealStep < revealSeq.length) {
        setRevealStep(revealSeq.length); // fast-forward: mostra tutto, resta nella schermata
      } else {
        nextRound(); // reveal già completo → prossimo round
      }
      return;
    }
    if (phase === "end") {
      if (revealStep < revealSeq.length) {
        setRevealStep(revealSeq.length); // fast-forward: mostra tutto, resta nella schermata
      } else {
        finish(); // reveal già completo → fine combattimento
      }
      return;
    }
  };
  useEffect(() => {
    const onKey = (e) => { if (e.code !== "Space") return; e.preventDefault(); combatSpaceRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-scroll del log risoluzione: ad ogni nuova entry rivelata scorre al fondo
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [revealStep, phase]);

  const won = playerMoney > enemyMoney;

  // Tutte le fasi riempiono l'altezza disponibile — il combat container in scratchlite
  // è flex:1 overflow:hidden, quindi CombatView occupa TUTTO lo spazio DESK.
  // Per resolve/end: layout flex-colonna con log flex:1 (no scroll esterno).
  // Per tutte le altre fasi: overflow:auto permette scroll interno se il contenuto è lungo.
  const isResolvingPhase = phase === "resolve" || phase === "end";

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: "flex", flexDirection: "column",
      overflow: isResolvingPhase ? "hidden" : "auto",
      WebkitOverflowScrolling: "touch",
      background: S.panel.background || C.card,
      border: `2px solid ${C.dim}`,
      boxShadow: `4px 4px 0 #000, 0 0 16px ${C.cyan}18`,
      padding: isResolvingPhase ? "8px 12px 0" : "10px 12px",
      margin: "0",
      width: "100%",
      textAlign:"center",
      boxSizing:"border-box",
      position:"relative",
    }}>
      {/* Flash rosso fullscreen danno unghia */}
      {painFlash > 0 && (
        <div style={{
          position:"fixed", top:0, left:0, width:"100%", height:"100%",
          background:`rgba(220,0,0,${painFlash})`,
          boxShadow:"none",
          zIndex:99997, pointerEvents:"none",
          transition:"background 0.12s, box-shadow 0.12s",
        }} />
      )}

      {/* COMBO flash banner */}
      {activeCombo && (
        <div style={{
          position:"fixed", top:"18%", left:"50%", transform:"translateX(-50%)",
          zIndex:99998, pointerEvents:"none",
          background:"#000000",
          border:`3px solid ${C.gold}`,
          borderRadius:"0",
          padding:"10px 28px",
          textAlign:"center",
          animation:"comboPulse 0.4s ease-in-out infinite alternate",
        }}>
          <div style={{
            fontSize:"22px", fontWeight:"bold", color:C.gold,
            letterSpacing:"2px", fontFamily:FONT,
          }}>
            🔥 COMBO! {activeCombo} 🔥
          </div>
        </div>
      )}

      {/* ── REGOLE ── */}
      {phase === "rules" && (
        <div>
          {/* Header drammatico — gradient + badge tipo */}
          <div style={{
            textAlign:"center", marginBottom:"12px",
            padding:"12px 8px 10px",
            background: enemy.isBoss
              ? `linear-gradient(180deg, #1a0000 0%, #0a0005 100%)`
              : `linear-gradient(180deg, #0d0a00 0%, #06050a 100%)`,
            border:`1px solid ${enemy.isBoss ? C.red : C.orange}44`,
            borderRadius:"0 0 4px 4px",
            position:"relative", overflow:"hidden",
          }}>
            {/* Tipo badge */}
            <div style={{
              display:"inline-block",
              background: enemy.isBoss ? C.red : enemy.isMiniboss ? C.magenta : C.orange,
              color:"#000", fontSize:"9px", fontWeight:"bold", letterSpacing:"3px",
              padding:"2px 12px", marginBottom:"8px",
              boxShadow:`0 0 12px ${enemy.isBoss ? C.red : C.orange}aa`,
            }}>
              ★ {enemy.isBoss ? "BOSS FIGHT" : enemy.isMiniboss ? "MINI BOSS" : "SFIDA"} ★
            </div>
            {/* Nome nemico */}
            <div style={{
              color: enemy.isBoss ? C.red : C.orange,
              fontWeight:"bold", fontSize:"22px",
              letterSpacing:"2px", fontFamily:FONT,
              textShadow:`0 0 14px ${enemy.isBoss ? C.red : C.orange}, 0 0 28px ${enemy.isBoss ? C.red : C.orange}44`,
              marginBottom:"2px",
            }}>
              {enemyIcon} {enemy.name}
            </div>
            {/* Sottotitolo */}
            <div style={{
              color:C.dim, fontSize:"11px", letterSpacing:"1.5px",
              textTransform:"uppercase",
            }}>
              ⚔ GRATTA &amp; LOTTA — {maxRounds} round
            </div>
            {/* Wallet bonus badge */}
            {walletBonus > 0 && (
              <div style={{
                display:"inline-block", marginTop:"8px",
                background:"#001808", border:`1px solid ${C.green}66`,
                borderRadius:"2px", padding:"3px 10px",
                color:C.green, fontSize:"10px", fontWeight:"bold",
              }}>
                💰 Porti €{walletBonus} in campo
              </div>
            )}
          </div>
          <div style={{...S.panel, textAlign:"left", background:"#050510", borderColor:C.dim+"66", padding:"12px"}}>
            <div style={{color:C.cyan, fontWeight:"bold", marginBottom:"10px", fontSize:"13px"}}>📜 Come funziona:</div>
            <div style={{color:C.text, fontSize:"12px", lineHeight:"2.1"}}>
              <span style={{color:C.gold}}>①</span> Ogni round hai <strong style={{color:C.cyan}}>9 carte coperte</strong> — grattane <span style={{color:C.red}}>esattamente 3</span><br/>
              <span style={{color:C.gold}}>②</span> <strong>Non sai cosa c'è sotto</strong> — vedi solo la categoria, il valore è a sorpresa 🎲<br/>
              <span style={{color:C.gold}}>③</span> Grattate 3, si gioca subito: tu poi <span style={{color:C.red}}>{enemy.name}</span> rivela le sue<br/>
              <span style={{color:C.gold}}>④</span> Dopo {maxRounds} round vince chi ha <span style={{color:C.gold}}>più €</span> — senza sconti
            </div>
            <div style={{marginTop:"10px", borderTop:`1px solid ${C.dim}33`, paddingTop:"10px"}}>
              <div style={{color:C.bright, fontSize:"12px", fontWeight:"bold", marginBottom:"6px"}}>Tipi di cella:</div>
              <div style={{fontSize:"11px", lineHeight:"2", color:C.text}}>
                <span style={{color:C.gold}}>💰 DENARO</span> — guadagni € pieni sul tuo totale<br/>
                <span style={{color:C.red}}>⚔ COMBATTIMENTO</span> — danneggi o rubi all'avversario<br/>
                <span style={{color:C.blue}}>🛡 DIFESA</span> — blocchi il prossimo attacco nemico<br/>
                <span style={{color:C.green}}>💊 CURA</span> — ripristini 1 unghia (solo fuori dal combattimento)
              </div>
            </div>
            <div style={{marginTop:"8px", background:"#1a0a0a", borderRadius:"0", padding:"7px 10px", fontSize:"11px", color:C.orange}}>
              ⚠ Ogni <strong>3 grattate</strong> la tua unghia si degrada.<br/>
              Sconfitta: perdi la differenza in €.
            </div>
            {enemy.isMiniboss && (
              <div style={{marginTop:"6px", background:"#1a0a1a", border:`1px solid ${C.magenta}66`, borderRadius:"0", padding:"8px 10px", fontSize:"11px", color:C.magenta}}>
                💀 <strong>SFIDA 3-COMBO</strong> — i Mini-Boss amano le combo.<br/>
                🎯 2 combo distinti durante il match → <span style={{color:C.gold}}>+€40</span><br/>
                🔥 3+ combo distinti → <span style={{color:C.gold}}>+€100 + cura 1 unghia</span>
              </div>
            )}
            {/* Punchline per-nemico */}
            {(() => {
              const ENEMY_QUOTES = {
                "Mini Boss": [
                  `"Non passi. Non oggi. Non così." — Il Mini Boss`,
                  `"Ho visto tipi come te finire in lacrime davanti a un grattino da €1." — Il Mini Boss`,
                  `"Scommetto le mie unghie che perdi. E non sono un tipo che scommette." — Il Mini Boss`,
                ],
                "Ladro": [
                  `"Le mani dove le vedo. E quelle unghie... belle. Troppo belle per restare tue." — Il Ladro`,
                  `"Non è una rapina — è una redistribuzione del patrimonio ungueale." — Il Ladro`,
                  `"Sbrigati, ho altri da incontrare. La serata è lunga." — Il Ladro`,
                ],
                "Ladro Nascosto": [
                  `"Dovevi stare alla larga dagli zaini abbandonati. Lezione appresa?" — Il Ladro Nascosto`,
                  `"Sorpresa. Il vero tesoro ero io." — Il Ladro Nascosto`,
                ],
                "Sfidante": [
                  `"Grattami contro. Se ne hai il fegato oltre che le dita." — Lo Sfidante`,
                  `"Mani veloci, testa vuota — di solito funziona. Proviamo." — Lo Sfidante`,
                  `"Non ti conosco ma già mi stai deludendo." — Lo Sfidante`,
                ],
              };
              if (enemy.isBoss) {
                let q, bossLabel, bossColor;
                if (enemy.name === "Il Broker") {
                  bossLabel = "Il Broker";
                  bossColor = C.gold;
                  q = playerWallet >= 200
                    ? `"Ah. Un avversario con delle riserve. Forse questa sarà una conversazione interessante."`
                    : playerWallet >= 50
                    ? `"Qualcosa c'è. Poco, ma c'è. Siediti — e non toccare niente sul tavolo."`
                    : `"${playerWallet}€. Sei venuto sin qui con ${playerWallet}€. Siediti lo stesso — fa pena lasciarti in piedi."`;
                } else if (enemy.name === "Il Romanaccio") {
                  bossLabel = "Il Romanaccio";
                  bossColor = C.magenta;
                  q = playerWallet >= 300
                    ? `"A' bello. Te sei portato pure li spicci. Mo te faccio vede' come se gioca a Roma."`
                    : playerWallet >= 100
                    ? `"Aho, ce poi sta' pure co' du' spicci — ma er taxi lo paghi uguale, eh."`
                    : `"Ma ndo vai co' 'sti quattro sghei? Daje, entra, che te frego lo stesso."`;
                } else if (enemy.name === "Il Napoletano") {
                  bossLabel = "Il Napoletano";
                  bossColor = C.gold;
                  q = playerWallet >= 500
                    ? `"Guagliò, tieni 'e sorde. Allora parliamo. Quattro carte, 'na mano sola — accomodati."`
                    : playerWallet >= 200
                    ? `"Staje 'mpucchiato? E vabbuò, jammo a vedé chi tene 'o core cchiù forte."`
                    : `"Guè guagliò, sì venuto cu' 'e spiccicelle? 'A jettatura la tieni già 'ncuollo."`;
                } else if (enemy.name === "Il Drago d'Oro") {
                  bossLabel = "Il Drago d'Oro 🐲";
                  bossColor = "#ff3333";
                  q = playerWallet >= 400
                    ? `"🐲 龙见勇者. Il Drago vede un guerriero. Vediamo se le tue unghie sono degne del fuoco."`
                    : playerWallet >= 150
                    ? `"你来了. Sei venuto fin qui con poco. Il fuoco non guarda il portafoglio — brucia e basta."`
                    : `"🐲 可怜. Patetico. Il Drago non si degna... ma ti brucerà comunque per sport."`;
                } else {
                  bossLabel = enemy.name;
                  bossColor = C.gold;
                  q = `"Eccoti. Ti aspettavo."`;
                }
                return (
                  <div style={{marginTop:"10px", background:"#0d0d00", border:`1px solid ${bossColor}44`,
                    borderRadius:"0", padding:"8px 12px", textAlign:"center"}}>
                    <div style={{color:bossColor, fontSize:"15px", fontStyle:"italic", marginBottom:"3px"}}>{q}</div>
                    <div style={{color:C.dim, fontSize:"10px", letterSpacing:"1px"}}>— {bossLabel}</div>
                  </div>
                );
              }
              const pool = ENEMY_QUOTES[enemy.name] || ENEMY_QUOTES["Sfidante"];
              const q = pool[Math.floor(Math.random() * pool.length)];
              return (
                <div style={{marginTop:"10px", background:"#0d0000", border:`1px solid ${C.red}44`,
                  borderRadius:"0", padding:"8px 12px", textAlign:"center"}}>
                  <div style={{color:C.orange, fontSize:"13px", fontStyle:"italic"}}>{q}</div>
                </div>
              );
            })()}

          </div>
          <div style={{marginTop:"14px"}}>
            <Btn variant="danger" onClick={() => setPhase("draw")} style={{fontSize:"14px", padding:"10px 28px"}}>
              ⚔ Combatti!
            </Btn>
          </div>
        </div>
      )}

      {/* ── GRATTA 3 DA 9 → COMBATTI ── */}
      {phase === "select" && (
        <div>
          {/* Header round — compatto, con progress dots */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:"8px",
            padding:"6px 10px",
            background:`linear-gradient(135deg, #1a0000 0%, #0a0010 100%)`,
            border:`1px solid ${C.red}44`,
            borderRadius:"4px 0 4px 0",
          }}>
            {/* Round badge */}
            <div style={{
              background:`linear-gradient(135deg, ${C.red} 0%, #8a0000 100%)`,
              color:"#fff", fontSize:"10px", fontWeight:"bold", letterSpacing:"2px",
              padding:"3px 10px",
              boxShadow:`0 0 10px ${C.red}66`,
            }}>
              ⚔ ROUND {round}/{maxRounds}
            </div>
            {/* "GRATTA LE CARTE" central */}
            <div style={{
              color:C.red, fontWeight:"bold", fontSize:"11px",
              letterSpacing:"1px", textShadow:`0 0 6px ${C.red}66`,
            }}>
              GRATTA 3
            </div>
            {/* Progress dots */}
            <div style={{display:"flex", gap:"5px", alignItems:"center"}}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:"9px", height:"9px",
                  borderRadius:"50%",
                  background: i < scratchedHandIdxs.length ? C.gold : "#2a2a2a",
                  border:`1px solid ${i < scratchedHandIdxs.length ? C.gold : "#444"}`,
                  boxShadow: i < scratchedHandIdxs.length ? `0 0 6px ${C.gold}88` : "none",
                  transition:"all 0.18s",
                }} />
              ))}
            </div>
          </div>
          <div style={{color:C.dim, fontSize:"11px", marginBottom:"10px"}}>
            <span style={{color:C.gold}}>9 carte</span> coperte — grattane{" "}
            <span style={{color:C.cyan}}>3</span>: solo quelle entrano in gioco
            {scratchedHandIdxs.length === 3 && (
              <span style={{color:C.gold, fontWeight:"bold"}}> — analisi in corso…</span>
            )}
          </div>
          {enemy.isMiniboss && (
            <div style={{
              marginBottom:"8px", padding:"4px 8px", fontSize:"10px",
              background:"#1a0a1a", border:`1px solid ${C.magenta}66`,
              color:C.magenta, display:"inline-block",
            }}>
              💀 Combo Challenge: <strong style={{color: minibossCombosHit.length >= 3 ? C.gold : minibossCombosHit.length >= 2 ? C.cyan : C.dim}}>{minibossCombosHit.length}/3</strong> distinti
              {minibossCombosHit.length >= 3 && <span style={{color:C.gold}}> 🔥 MAX!</span>}
              {minibossCombosHit.length === 2 && <span style={{color:C.cyan}}> ✔ +€40 sicuri</span>}
            </div>
          )}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(3,1fr)",
            gap:"6px", maxWidth:"480px", margin:"0 auto 10px",
          }}>
            {playerHand.map((cell, i) => {
              const isScratched = scratchedHandIdxs.includes(i);
              const exhausted = !isScratched && scratchedHandIdxs.length >= 3;
              const col = catColors[cell.category] || C.dim;
              if (isScratched) {
                // Sprint 5: variant visual overlay — DRAMATICO, le varianti sono rarissime
                const vKey = cell.variant;
                const v = vKey ? CARD_VARIANTS[vKey] : null;
                const variantBorder = v ? v.color : col;
                const variantBg = vKey === "BN"
                  ? "#1a1a1a"
                  : vKey === "ORO" ? "#2a1f00"
                  : vKey === "STRAPPATO" ? "#1a1208"
                  : vKey === "FOIL" ? "#0a1428"
                  : vKey === "MULTI" ? "#1f0a1a"
                  : CAT_BG[cell.category] || "#0a0a12";
                const variantFilter = vKey === "BN" ? "grayscale(100%) contrast(1.2)"
                  : vKey === "STRAPPATO" ? "saturate(0.55) brightness(0.82)"
                  : "none";
                // Animazione per ciascuna variante — tutte pulsano/brillano, si notano subito
                const variantAnim = vKey === "ORO" ? "oroGlint 1.4s ease-in-out infinite, variantReveal 0.6s ease-out"
                  : vKey === "FOIL" ? "variantPulse 1.4s ease-in-out infinite, variantReveal 0.6s ease-out"
                  : vKey === "MULTI" ? "variantPulse 1.2s ease-in-out infinite, variantReveal 0.6s ease-out"
                  : vKey === "BN" ? "variantReveal 0.6s ease-out"
                  : vKey === "STRAPPATO" ? "variantReveal 0.6s ease-out"
                  : "none";
                return (
                  <div key={i} style={{
                    border:`${v ? 3 : 2}px solid ${variantBorder}`,
                    borderRadius:"0",
                    background: variantBg,
                    textAlign:"center",
                    height:`${COMBAT_CARD_H}px`,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                    gap:"3px",
                    boxShadow: v ? v.glow : `0 0 12px ${col}33, inset 0 0 20px ${col}11`,
                    padding:"6px 6px",
                    position:"relative",
                    filter: variantFilter,
                    animation: variantAnim,
                    zIndex: v ? 3 : 1,
                  }}>
                    {/* Barra categoria in alto — nome abbreviato per evitare overflow */}
                    <div style={{
                      position:"absolute", top:0, left:0, right:0,
                      background:col+"22", borderBottom:`1px solid ${col}44`,
                      padding:"2px 0", fontSize:"8px", fontWeight:"bold",
                      color:col, letterSpacing:"1px", textTransform:"uppercase",
                      zIndex: 2,
                    }}>
                      {CAT_EMOJI_MAP[cell.category]} {CAT_SHORT[cell.category] || cell.category}
                    </div>
                    {/* Shimmer iridescente per FOIL/ORO/MULTI — striscia diagonale che scorre */}
                    {(vKey === "FOIL" || vKey === "ORO" || vKey === "MULTI") && (
                      <div style={{
                        position:"absolute", inset:0, pointerEvents:"none",
                        background: `linear-gradient(110deg, transparent 30%, ${v.color}55 48%, ${v.color}aa 50%, ${v.color}55 52%, transparent 70%)`,
                        backgroundSize: "200% 100%",
                        animation: "variantShimmer 2.4s linear infinite",
                        mixBlendMode: "screen",
                        zIndex: 1,
                      }} />
                    )}
                    {/* Variant badge grosso in basso — molto più visibile */}
                    {v && (
                      <div style={{
                        position:"absolute", bottom:-1, left:-1, right:-1,
                        background: v.color,
                        color: vKey === "BN" || vKey === "FOIL" ? "#000" : "#000",
                        padding:"2px 4px", fontSize:"10px", fontWeight:"bold",
                        letterSpacing:"2px", textAlign:"center",
                        boxShadow: `0 -2px 8px ${v.color}88`,
                        zIndex: 4,
                        textShadow: vKey === "ORO" ? "0 0 4px #fff8" : "none",
                      }}>
                        ★ {v.label} ★
                      </div>
                    )}
                    {/* Sparkle in alto a destra per i "positivi" */}
                    {(vKey === "ORO" || vKey === "FOIL") && (
                      <>
                        <div style={{
                          position:"absolute", top:14, right:6, fontSize:"14px",
                          color: v.color, zIndex:5,
                          animation: "variantSparkle 1.6s ease-in-out infinite",
                          textShadow: `0 0 8px ${v.color}`,
                        }}>✦</div>
                        <div style={{
                          position:"absolute", bottom:22, left:6, fontSize:"10px",
                          color: v.color, zIndex:5,
                          animation: "variantSparkle 1.8s ease-in-out infinite 0.4s",
                          textShadow: `0 0 6px ${v.color}`,
                        }}>✧</div>
                      </>
                    )}
                    {/* Strappo visivo — angolo rotto per STRAPPATO */}
                    {vKey === "STRAPPATO" && (
                      <div style={{
                        position:"absolute", top:0, right:0,
                        width:0, height:0,
                        borderTop:`24px solid #1a1208`,
                        borderLeft:`24px solid transparent`,
                        zIndex:2,
                      }} />
                    )}
                    <div style={{fontSize:"30px", lineHeight:1, marginTop:"14px", position:"relative", zIndex:2,
                      textShadow: v ? `0 0 12px ${v.color}` : "none",
                    }}>{cell.emoji}</div>
                    <div style={{
                      fontSize:"11px", color: v ? v.color : C.bright, fontWeight:"bold",
                      lineHeight:"1.2", position:"relative", zIndex:2,
                      textShadow: v ? `0 0 4px ${v.color}66` : "none",
                    }}>{cell.name}</div>
                    {cell.desc && (
                      <div style={{fontSize:"9px", color:C.text, lineHeight:"1.3", opacity:0.8, position:"relative", zIndex:2}}>
                        {cell.desc}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <CombatCardScratch key={i} cell={cell} catColors={catColors}
                  disabled={exhausted}
                  nailState={activeNailState}
                  onRevealed={() => {
                    setScratchedHandIdxs(prev => [...prev, i]);
                    onCellScratch?.(false); // se grattatore equipaggiato: assorbe danno e consuma 1 uso; altrimenti unghia attiva prende 1 punto
                    // Sprint 5: traccia varianti scoperte → Vintage Collezionabili
                    if (cell.variant && onVariantRevealed) {
                      onVariantRevealed(cell.variant);
                      // Feedback audio + flash per variante rara
                      try { AudioEngine.win(); } catch(e) {}
                      const vInfo = CARD_VARIANTS[cell.variant];
                      if (vInfo) {
                        // variante rara: la carta stessa brilla, niente overlay
                      }
                    }
                  }}
                />
              );
            })}
          </div>
          {scratchedHandIdxs.length < 3 && (
            <div style={{fontSize:"10px", color:C.dim, marginTop:"5px"}}>
              {3 - scratchedHandIdxs.length === 3
                ? "Gratta 3 carte per giocare"
                : `Ancora ${3 - scratchedHandIdxs.length} cart${3 - scratchedHandIdxs.length === 1 ? "a" : "e"}…`}
            </div>
          )}
          {scratchedHandIdxs.length === 3 && (
            <div style={{fontSize:"11px", color:C.gold, marginTop:"5px", fontWeight:"bold",
              animation:"pulse 0.6s ease-in-out infinite"}}>
              ⚡ CARTE SELEZIONATE — risoluzione in corso…
            </div>
          )}

          {/* Spec 7.3: Pulsante Grattata Finale */}
          {grattataFinaleCharges > 0 && scratchedHandIdxs.length < 3 && (
            <div style={{marginTop:"10px", background:"#0a1a1a", border:`1px solid ${C.cyan}`, borderRadius:"0", padding:"8px"}}>
              <div style={{color:C.cyan, fontSize:"11px", fontWeight:"bold", marginBottom:"5px"}}>
                ⚡ GRATTATA FINALE disponibile!
              </div>
              <div style={{color:C.dim, fontSize:"10px", marginBottom:"6px"}}>
                {grattataFinaleCharges} carica{grattataFinaleCharges > 1 ? "e" : ""} — la prossima carta "Strappa!" agisce ×3
              </div>
              <div style={{color:C.cyan, fontSize:"10px"}}>
                La carica si consuma automaticamente quando giochi "Strappa!"
              </div>
            </div>
          )}

          {/* Spec 3.3: Pulsante Provocalo! per Il Napoletano */}
          {enemy.isBoss && enemy.name === "Il Napoletano" && !reTauntUsed && scratchedHandIdxs.length < 3 && (
            <div style={{marginTop:"10px"}}>
              <Btn
                variant="danger"
                onClick={handleProvocaRe}
                style={{fontSize:"12px", padding:"6px 16px"}}
              >
                😈 Provocalo! (85% autodanno / 15% +€500 a 'O Napoletano)
              </Btn>
              <div style={{color:C.dim, fontSize:"10px", marginTop:"3px"}}>
                Una volta sola per combattimento
              </div>
            </div>
          )}
          {enemy.isBoss && enemy.name === "Il Napoletano" && reTauntUsed && !reTauntMsg && (
            <div style={{marginTop:"8px", color:C.dim, fontSize:"10px"}}>
              😈 Provocazione già usata questo scontro
            </div>
          )}
          {reTauntMsg && (
            <div style={{
              marginTop:"10px", padding:"8px 12px", borderRadius:"0",
              background: reTauntMsg.isGood ? "#001a00" : "#1a0000",
              border:`1px solid ${reTauntMsg.isGood ? C.green : C.red}`,
              color: reTauntMsg.isGood ? C.green : C.red,
              fontSize:"12px", fontWeight:"bold",
              animation:"pulse 0.5s ease-in-out",
            }}>
              {reTauntMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ── RESOLVE / END — risoluzione carta per carta ── */}
      {(phase === "resolve" || phase === "end") && (() => {
        // Calcola il log visibile: appiattisce le entries di tutti gli step completati
        const visibleEntries = revealSeq.slice(0, revealStep).flatMap(s => s.entries);
        const lastEntry = visibleEntries.length > 0 ? visibleEntries[visibleEntries.length - 1] : null;
        // Before any entries are revealed, show pre-round values (subtract this round's delta)
        const preRoundP = playerMoney - roundPlayerDelta;
        const preRoundE = enemyMoney - roundEnemyDelta;
        const dispP = lastEntry?.pTotal ?? preRoundP;
        const dispE = lastEntry?.eTotal ?? preRoundE;
        const allDone = revealStep >= revealSeq.length && revealSeq.length > 0;
        // Carte nemico flipped: quelle il cui step è già stato risolto
        // Quando allDone, rivela TUTTE le carte nemiche
        const enemyFlipped = allDone
          ? new Set(enemyCells.map((_, i) => i))
          : new Set(
              revealSeq.slice(0, revealStep).filter(s => s.flipSide === "enemy").map(s => s.flipIdx)
            );
        // Carta player attiva (passo corrente)
        const curStep = revealStep > 0 ? revealSeq[revealStep - 1] : null;
        const activePlayerIdx = curStep?.flipSide === "player" ? curStep.flipIdx : -1;
        const activeEnemyIdx  = curStep?.flipSide === "enemy"  ? curStep.flipIdx : -1;

        return (
          // Layout flex-colonna: header + carte + score fissi in alto, log cresce a riempire, bottone in fondo
          <div style={{flex:1, minHeight:0, display:"flex", flexDirection:"column"}}>
            {/* Header round risoluzione */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:"8px", padding:"5px 10px",
              background:`linear-gradient(135deg, #1a0000 0%, #0a0010 100%)`,
              border:`1px solid ${C.red}33`,
            }}>
              <div style={{
                background:`linear-gradient(135deg, ${C.red} 0%, #8a0000 100%)`,
                color:"#fff", fontSize:"10px", fontWeight:"bold", letterSpacing:"2px",
                padding:"2px 8px",
              }}>
                ⚔ ROUND {round}/{maxRounds}
              </div>
              <div style={{color:C.red, fontSize:"12px", fontWeight:"bold", letterSpacing:"1px"}}>
                RISOLUZIONE
              </div>
              {roundMult > 1 ? (
                <div style={{
                  background:"#1a0a00", border:`1px solid ${C.orange}88`,
                  padding:"2px 7px", fontSize:"10px", color:C.orange, fontWeight:"bold",
                }}>
                  ×{roundMult.toFixed(1)} POSTA
                </div>
              ) : <div style={{width:"60px"}} />}
            </div>

            {/* Carte in parallelo: player sinistra, enemy destra — flexShrink:0 per non comprimersi */}
            <div style={{display:"flex", gap:"8px", justifyContent:"center", marginBottom:"8px", flexShrink:0}}>
              {/* Player cards */}
              <div style={{flex:1, maxWidth:"140px"}}>
                <div style={{color:C.cyan, fontSize:"10px", marginBottom:"4px", textAlign:"center"}}>TU</div>
                <div style={{display:"flex", flexDirection:"column", gap:"4px"}}>
                  {resolvedPlayerCells.map((cell, idx) => {
                    const isActive = idx === activePlayerIdx;
                    return (
                      <div key={idx} style={{
                        padding:"5px 7px",
                        background: isActive ? "#0d1a2e" : "#07091a",
                        border: `2px solid ${isActive ? C.cyan : catColors[cell.category]||C.dim}`,
                        borderRadius:"0",
                        transition:"all 0.3s",
                        boxShadow: isActive ? `0 0 12px ${C.cyan}88` : "none",
                        display:"flex", alignItems:"center", gap:"5px",
                      }}>
                        <span style={{fontSize:"14px"}}>{cell.emoji}</span>
                        <div>
                          <div style={{fontSize:"9px", color:catColors[cell.category], letterSpacing:"0.5px"}}>{cell.category}</div>
                          <div style={{fontSize:"11px", color:C.bright, fontWeight:"bold", lineHeight:1.2}}>{cell.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VS divider */}
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                fontSize:"16px", color:C.dim, paddingTop:"18px"}}>⚔</div>

              {/* Enemy cards */}
              <div style={{flex:1, maxWidth:"140px"}}>
                <div style={{color:C.orange, fontSize:"10px", marginBottom:"4px", textAlign:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{enemy.name.toUpperCase()}</div>
                <div style={{display:"flex", flexDirection:"column", gap:"4px"}}>
                  {enemyCells.map((cell, idx) => {
                    const isFlipped = enemyFlipped.has(idx);
                    const isFlipping = idx === activeEnemyIdx;
                    return (
                      <div key={idx} style={{
                        padding:"5px 7px",
                        background: isFlipped ? "#1a0a0a" : "#0d0505",
                        border: `2px solid ${isFlipping ? C.red : isFlipped ? catColors[cell.category]||C.red : "#3a0808"}`,
                        borderRadius:"0",
                        transition:"all 0.3s",
                        boxShadow: isFlipping ? `0 0 14px ${C.red}99` : "none",
                        display:"flex", alignItems:"center", gap:"5px",
                        minHeight:"36px",
                      }}>
                        {isFlipped ? (
                          <>
                            <span style={{fontSize:"14px"}}>{cell.emoji}</span>
                            <div>
                              <div style={{fontSize:"9px", color:catColors[cell.category], letterSpacing:"0.5px"}}>{cell.category}</div>
                              <div style={{fontSize:"11px", color:C.bright, fontWeight:"bold", lineHeight:1.2}}>{cell.name}</div>
                            </div>
                          </>
                        ) : (
                          <div style={{width:"100%", textAlign:"center"}}>
                            {isFlipping
                              ? <span style={{color:C.red, fontSize:"16px", animation:"pulse 0.4s infinite"}}>✦</span>
                              : (() => {
                                  const riskInfo = cell.category === "COMBATTIMENTO"
                                    ? { label:"ALTA",  icon:"🔥", color:C.red,   bg:"#2a0000" }
                                    : cell.category === "DIFESA"
                                    ? { label:"MEDIA", icon:"💰", color:C.gold,  bg:"#1a1400" }
                                    : { label:"BASSA", icon:"💸", color:C.green, bg:"#001a00" };
                                  return (
                                    <div style={{
                                      display:"inline-flex", alignItems:"center", gap:"3px",
                                      background: riskInfo.bg,
                                      border:`1px solid ${riskInfo.color}88`,
                                      borderRadius:"0",
                                      padding:"2px 5px",
                                      fontSize:"9px", fontWeight:"bold",
                                      color: riskInfo.color,
                                      letterSpacing:"0.8px",
                                    }}>
                                      {riskInfo.icon} {riskInfo.label}
                                    </div>
                                  );
                                })()
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Punteggio live — flexShrink:0 per non comprimersi */}
            <div style={{
              flexShrink:0,
              display:"flex", justifyContent:"center", alignItems:"center", gap:"16px",
              background:"#0a0a1a", borderRadius:"0", padding:"6px 10px", marginBottom:"6px",
            }}>
              <div style={{textAlign:"center", minWidth:"130px"}}>
                <div style={{color:C.cyan, fontSize:"9px", letterSpacing:"2px", marginBottom:"1px"}}>TU</div>
                <div style={{color: dispP >= dispE ? C.green : C.text, fontWeight:"bold", fontSize:"24px", transition:"color 0.3s"}}>€{dispP}</div>
                <div style={{display:"flex", justifyContent:"center", marginTop:"4px", gap:"4px", alignItems:"center"}}>
                  <span style={{fontSize:"11px"}}>🖐</span>
                  <NailDisplay nails={player.nails} compact />
                </div>
                {grattataFinaleCharges > 0 && (
                  <div style={{color:C.cyan, fontSize:"11px", marginTop:"3px"}}>
                    ⚡ Grattata Finale: {grattataFinaleCharges} carica{grattataFinaleCharges > 1 ? "e" : ""}
                  </div>
                )}
              </div>
              <div style={{fontSize:"22px"}}>{dispP >= dispE ? "🏆" : "💀"}</div>
              <div style={{textAlign:"center", minWidth:"130px"}}>
                <div style={{color:C.orange, fontSize:"9px", letterSpacing:"1px", marginBottom:"1px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{enemy.name.toUpperCase()}</div>
                <div style={{color: dispE > dispP ? C.red : C.text, fontWeight:"bold", fontSize:"24px", transition:"color 0.3s"}}>€{dispE}</div>
                <div style={{display:"flex", justifyContent:"center", marginTop:"4px", gap:"4px", alignItems:"center"}}>
                  <span style={{fontSize:"11px"}}>✊</span>
                  <NailDisplay nails={enemyNails} compact />
                </div>
                {enemy.isBoss && enemy.name === "Il Broker" && brokerInvestment > 0 && (
                  <div style={{color:C.magenta, fontSize:"12px", marginTop:"3px"}}>
                    💼 Investimento: €{brokerInvestment}
                  </div>
                )}
                {enemy.isBoss && enemy.name === "Il Romanaccio" && taxiGain > 0 && (
                  <div style={{color:C.orange, fontSize:"11px", marginTop:"3px"}}>
                    🚕 Taxi: €{taxiGain}
                  </div>
                )}
                {enemy.isBoss && enemy.name === "Il Romanaccio" && manomissioneActive && !manomissioneActive.reverted && (
                  <div style={{marginTop:"4px"}}>
                    <Btn
                      variant="danger"
                      onClick={handleDenunciaRomanaccio}
                      style={{fontSize:"10px", padding:"3px 8px"}}
                    >
                      🚨 DENUNCIA! (−€{manomissioneActive.amount})
                    </Btn>
                  </div>
                )}
                {enemy.isBoss && enemy.name === "Il Romanaccio" && manomissioneActive && manomissioneActive.reverted && (
                  <div style={{color:C.green, fontSize:"10px", marginTop:"3px"}}>
                    ✅ Manomissione sventata!
                  </div>
                )}
                {enemyRageMode && enemy.name === "Mini Boss" && (
                  <div style={{color:C.red, fontSize:"11px", marginTop:"3px"}}>
                    💢 RABBIA!
                  </div>
                )}
              </div>
            </div>

            {/* Log botta e risposta — flex:1 riempie tutto lo spazio disponibile, newest sempre visibile */}
            <div ref={logScrollRef} style={{
              flex:1, minHeight:0,
              marginBottom:"6px",
              overflowY:"auto",
              background:"#050510", borderRadius:"0",
              padding:"6px 10px",
              border:`1px solid ${C.cyan}22`,
              boxShadow:"inset 0 6px 10px -6px #000c, inset 0 -6px 10px -6px #000c",
              scrollBehavior:"smooth",
              WebkitOverflowScrolling:"touch",
            }}>
              {visibleEntries.map((entry, i) => {
                const isPlayer = entry.text.startsWith("✅") || entry.text.startsWith("⚔️") ||
                  entry.text.startsWith("🛡") || entry.text.startsWith("💨") ||
                  entry.text.startsWith("🏰") || entry.text.startsWith("❌");
                return (
                  <div key={i} style={{
                    display:"flex",
                    justifyContent: isPlayer ? "flex-start" : "flex-end",
                    marginBottom:"4px",
                    animation: i === visibleEntries.length - 1 ? "fadeIn 0.25s ease" : "none",
                  }}>
                    <div style={{
                      background: isPlayer ? "#080820" : "#180808",
                      border:`1px solid ${entry.color}44`,
                      borderRadius: isPlayer ? "3px 8px 8px 8px" : "8px 3px 8px 8px",
                      padding:"4px 10px",
                      maxWidth:"85%",
                      fontSize:"11px",
                      color: entry.color,
                      lineHeight:"1.4",
                    }}>
                      {entry.text}
                    </div>
                  </div>
                );
              })}
              {!allDone && revealSeq.length > 0 && (
                <div style={{color:C.dim, fontSize:"10px", textAlign:"center", marginTop:"4px",
                  animation:"pulse 0.6s infinite"}}>···</div>
              )}
            </div>

            {/* Banner unghia colpita — flexShrink:0 per non comprimersi */}
            {allDone && nailHitThisRound > 0 && (
              <div style={{
                flexShrink:0,
                background:"#1a0000", border:`2px solid ${C.red}`,
                borderRadius:"0", padding:"6px 10px", marginBottom:"6px",
                animation:"pulse 0.8s infinite",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
              }}>
                <span style={{fontSize:"20px"}}>🩸</span>
                <div style={{textAlign:"left"}}>
                  <div style={{color:C.red, fontWeight:"bold", fontSize:"13px"}}>UNGHIA DANNEGGIATA!</div>
                  <div style={{color:C.dim, fontSize:"10px"}}>
                    {nailHitThisRound > 1 ? `${nailHitThisRound} colpi` : "colpo ricevuto"} — stato peggiorato
                  </div>
                </div>
                <span style={{fontSize:"20px"}}>🩸</span>
              </div>
            )}

            {/* Bottone continua — flexShrink:0, sempre in fondo */}
            {allDone && (
              phase === "end" ? (
                (() => {
                  const resultColor = won ? C.green : C.red;
                  return (
                    <div style={{
                      flexShrink: 0,
                      textAlign: "center",
                      maxWidth: "420px", margin: "0 auto",
                      background: won
                        ? `linear-gradient(180deg, #001208 0%, #05050b 100%)`
                        : `linear-gradient(180deg, #180000 0%, #05050b 100%)`,
                      border: `2px solid ${resultColor}`,
                      boxShadow: `0 0 22px ${resultColor}66, inset 0 0 22px ${resultColor}14`,
                      padding: "10px 14px 12px",
                      position: "relative",
                    }}>
                      {/* Sparkles ai lati (solo vittoria) */}
                      {won && (
                        <>
                          <div style={{
                            position: "absolute", top: "8px", right: "12px", fontSize: "14px", color: C.gold,
                            animation: "variantSparkle 1.8s ease-in-out infinite",
                          }}>✦</div>
                          <div style={{
                            position: "absolute", top: "18px", left: "12px", fontSize: "10px", color: C.gold,
                            animation: "variantSparkle 2.4s ease-in-out 0.4s infinite",
                          }}>✦</div>
                        </>
                      )}

                      {/* Badge risultato */}
                      <div style={{
                        display: "inline-block",
                        background: resultColor, color: "#000",
                        fontSize: "10px", fontWeight: "bold", letterSpacing: "3px",
                        padding: "3px 12px", marginBottom: "8px",
                        boxShadow: `0 0 10px ${resultColor}aa`,
                      }}>
                        ★ {won ? "VITTORIA" : "SCONFITTA"} ★
                      </div>

                      {/* Title grande */}
                      <div style={{
                        color: resultColor, fontSize: "28px", fontWeight: "bold",
                        letterSpacing: "4px", marginBottom: "6px",
                        textShadow: `0 0 16px ${resultColor}aa, 0 0 32px ${resultColor}44`,
                        animation: "pulse 1.2s ease-in-out infinite",
                      }}>
                        {won ? "🏆 HAI VINTO!" : "💀 HAI PERSO!"}
                      </div>

                      {/* Score comparison */}
                      <div style={{
                        display: "flex", justifyContent: "center", alignItems: "center", gap: "14px",
                        marginBottom: "12px",
                      }}>
                        <div style={{textAlign: "center"}}>
                          <div style={{color: C.cyan, fontSize: "9px", letterSpacing: "2px", marginBottom: "2px"}}>TU</div>
                          <div style={{
                            color: won ? C.green : C.dim, fontSize: "18px", fontWeight: "bold",
                            background: won ? `${C.green}18` : "#0f0f18",
                            border: `1px solid ${won ? C.green : C.dim}`,
                            padding: "4px 12px",
                            textShadow: won ? `0 0 10px ${C.green}88` : "none",
                          }}>€{playerMoney}</div>
                        </div>
                        <div style={{color: C.dim, fontSize: "14px", letterSpacing: "2px"}}>VS</div>
                        <div style={{textAlign: "center"}}>
                          <div style={{color: C.orange, fontSize: "9px", letterSpacing: "2px", marginBottom: "2px"}}>NEMICO</div>
                          <div style={{
                            color: !won ? C.red : C.dim, fontSize: "18px", fontWeight: "bold",
                            background: !won ? `${C.red}18` : "#0f0f18",
                            border: `1px solid ${!won ? C.red : C.dim}`,
                            padding: "4px 12px",
                            textShadow: !won ? `0 0 10px ${C.red}88` : "none",
                          }}>€{enemyMoney}</div>
                        </div>
                      </div>

                      {/* Conseguenza unghie */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px", marginBottom: "14px",
                        background: won ? "#001208" : "#180000",
                        border: `1px solid ${resultColor}66`,
                        boxShadow: `inset 0 0 10px ${resultColor}22`,
                      }}>
                        <div style={{fontSize: "22px"}}>{won ? "✨" : "💀"}</div>
                        <div style={{flex: 1, textAlign: "left"}}>
                          <div style={{color: resultColor, fontSize: "11px", fontWeight: "bold", letterSpacing: "1px", marginBottom: "2px"}}>
                            {won ? "BOTTINO UNGHIA" : "PENALITÀ UNGHIA"}
                          </div>
                          <div style={{color: C.text, fontSize: "10px", lineHeight: 1.4}}>
                            {won ? "Strappi un'unghia al nemico — una tua torna in vita." : "Ti strappano un'unghia — una muore."}
                          </div>
                        </div>
                      </div>

                      <Btn variant={won ? "gold" : "danger"} onClick={finish} style={{fontSize: "14px", padding: "10px 28px", letterSpacing: "2px"}}>
                        {won ? "💰 INCASSA IL BOTTINO" : "😔 SUBISCI LE CONSEGUENZE"}
                      </Btn>
                    </div>
                  );
                })()
              ) : (
                <div style={{flexShrink:0, textAlign:"center", paddingBottom:"8px"}}>
                  <Btn onClick={nextRound} style={{fontSize:"13px"}}>
                    Prossimo round ({round + 1}/{maxRounds}) →
                  </Btn>
                </div>
              )
            )}
          </div>
        );
      })()}

      {/* ── LA BELLA ── */}
      {phase === "bella" && (
        <div style={{textAlign:"center", padding:"10px 0"}}>
          <div style={{
            fontSize:"22px", fontWeight:"bold", color:C.red,
            letterSpacing:"3px", marginBottom:"4px",
            animation:"pulse 0.6s infinite",
          }}>🎴 BELLA! 🎴</div>
          <div style={{color:C.orange, fontSize:"12px", marginBottom:"16px"}}>
            Pareggio — una carta sola decide tutto. Chi ha il numero più alto vince l'intera posta.
          </div>

          <div style={{display:"flex", justifyContent:"center", gap:"24px", alignItems:"center", marginBottom:"20px"}}>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.cyan, fontSize:"10px", marginBottom:"6px"}}>TU</div>
              <div style={{
                width:"80px", height:"80px",
                background: bellaResult ? (bellaResult.draw ? "#111" : bellaResult.playerWins ? "#001a00" : "#1a0000") : "#0a0a1a",
                border:`2px solid ${bellaResult ? (bellaResult.draw ? C.dim : bellaResult.playerWins ? C.green : C.red) : C.dim}`,
                borderRadius:"0",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize: bellaResult ? "22px" : "32px",
                fontWeight:"bold",
                color: bellaResult ? (bellaResult.playerWins ? C.green : C.red) : C.dim,
                transition:"all 0.4s",
                boxShadow: bellaResult?.playerWins ? `0 0 20px ${C.green}88` : "none",
              }}>
                {bellaResult ? `€${bellaResult.playerVal}` : "?"}
              </div>
            </div>

            <div style={{fontSize:"24px", color:C.dim}}>VS</div>

            <div style={{textAlign:"center"}}>
              <div style={{color:C.orange, fontSize:"10px", marginBottom:"6px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"160px"}}>{enemy.name.toUpperCase()}</div>
              <div style={{
                width:"80px", height:"80px",
                background: bellaResult ? (!bellaResult.playerWins ? "#1a0000" : "#0a1a00") : "#1a0808",
                border:`2px solid ${bellaResult ? (!bellaResult.playerWins ? C.red : C.dim) : "#4a1010"}`,
                borderRadius:"0",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize: bellaResult ? "22px" : "32px",
                fontWeight:"bold",
                color: bellaResult ? (!bellaResult.playerWins ? C.red : C.dim) : "#4a1010",
                transition:"all 0.4s",
                boxShadow: bellaResult && !bellaResult.playerWins ? `0 0 20px ${C.red}88` : "none",
              }}>
                {bellaResult ? `€${bellaResult.enemyVal}` : "?"}
              </div>
            </div>
          </div>

          {!bellaResult && (
            <div style={{color:C.dim, fontSize:"12px", animation:"pulse 0.6s infinite"}}>
              Rivelazione in corso...
            </div>
          )}

          {bellaResult && (
            <div>
              <div style={{
                fontSize:"16px", fontWeight:"bold", marginBottom:"6px",
                color: bellaResult.draw ? C.dim : bellaResult.playerWins ? C.green : C.red,
              }}>
                {bellaResult.draw
                  ? "🤝 PAREGGIO ASSOLUTO — nessuno vince"
                  : bellaResult.playerWins
                    ? "🏆 HAI VINTO LA BELLA!"
                    : "💀 HAI PERSO LA BELLA!"}
              </div>
              {bellaResult.draw && (
                <div style={{color:C.dim, fontSize:"11px", marginBottom:"10px"}}>
                  Stesso numero. Entrambi pagate il prezzo del pareggio: −€15 a testa.
                </div>
              )}
              <Btn
                variant={bellaResult.draw ? "normal" : bellaResult.playerWins ? "gold" : "danger"}
                onClick={() => {
                  if (bellaResult.draw) {
                    setPlayerMoney(m => m - 15);
                    setEnemyMoney(m => m - 15);
                  } else if (bellaResult.playerWins) {
                    setPlayerMoney(m => m + 30);
                  } else {
                    setEnemyMoney(m => m + 30);
                  }
                  setPhase("end");
                }}
                style={{fontSize:"13px", padding:"10px 24px"}}>
                {bellaResult.draw
                  ? "😶 Tutti e due perdono qualcosa"
                  : bellaResult.playerWins
                    ? "💰 Incassa la vittoria"
                    : "😔 Accetta la sconfitta"}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── TAUNT ── */}
      {phase === "taunt" && tauntData && (
        <div style={{textAlign:"center", padding:"10px 0"}}>
          <div style={{
            fontSize:"16px", fontWeight:"bold", color:C.orange,
            marginBottom:"8px", animation:"pulse 0.8s infinite",
          }}>🗣️ PROVOCAZIONE!</div>
          <div style={{
            color:C.bright, fontSize:"13px", fontStyle:"italic",
            marginBottom:"16px", padding:"10px",
            background:"#1a0a00", border:`1px solid ${C.orange}44`, borderRadius:"0",
          }}>
            {tauntData.text}
          </div>

          {!tauntData.result ? (
            <div style={{display:"flex", gap:"10px", justifyContent:"center"}}>
              <Btn variant="danger" onClick={handleTauntRespond} style={{fontSize:"12px"}}>
                😤 {tauntData.respond}
              </Btn>
              <Btn onClick={handleTauntIgnore} style={{fontSize:"12px"}}>
                😶 Ignora
              </Btn>
            </div>
          ) : (
            <div style={{
              fontSize:"15px", fontWeight:"bold",
              color: tauntData.result === "win" ? C.gold : C.red,
              textShadow:"none",
              animation:"pulse 0.5s ease-in-out",
            }}>
              {tauntData.result === "win"
                ? `🔥 La tua risposta ha funzionato! +€${tauntData.rewardMoney}!`
                : `💀 Il nemico ti ha punito!${tauntData.riskDamage > 0 ? ` Unghia danneggiata!` : ""}`}
            </div>
          )}

          <div style={{color:C.dim, fontSize:"10px", marginTop:"8px"}}>
            Rispondere: {Math.round(tauntData.winChance*100)}% +€{tauntData.rewardMoney}
            {tauntData.riskDamage > 0 && ` / ${Math.round((1-tauntData.winChance)*100)}% danno unghia`}
          </div>
        </div>
      )}

      {/* 🐲 Fiato del Drago — fase speciale boss Drago d'Oro */}
      {phase === "dragoFire" && dragoFireData && (
        <div style={{textAlign:"center", padding:"20px 0"}}>
          <div style={{
            fontSize:"28px", fontWeight:"bold", color:"#ff3300",
            marginBottom:"12px", animation:"pulse 0.4s infinite",
            textShadow:"0 0 20px #ff330088, 0 0 40px #ff000044",
          }}>{dragoFireData.text}</div>
          <div style={{fontSize:"48px", marginBottom:"12px", animation:"pulse 0.6s infinite"}}>
            🐲🔥🔥🔥
          </div>
          <div style={{
            color: dragoFireData.dmgType === "nail" ? C.red : C.gold,
            fontSize:"14px", fontWeight:"bold",
            padding:"8px 16px", background:"#1a000088",
            border:`1px solid ${dragoFireData.dmgType === "nail" ? C.red : C.gold}44`,
            display:"inline-block",
          }}>
            {dragoFireData.subtitle}
          </div>
          <div style={{color:C.dim, fontSize:"10px", marginTop:"10px"}}>
            💡 Pesca carte DIFESA per bloccare il Fiato del Drago!
          </div>
        </div>
      )}

      {/* 💸 Streamer donazioni dinamiche in combat — chat live */}
      {donationEvent && (
        <div style={{
          position:"absolute", top:"12px", right:"12px",
          minWidth:"220px", maxWidth:"280px",
          background: donationEvent.type === "love" ? "#0a1f0a" : "#1f0a0a",
          border: `1px solid ${donationEvent.type === "love" ? C.green : C.red}`,
          borderRadius:"4px", padding:"8px 10px",
          boxShadow: `0 0 20px ${donationEvent.type === "love" ? "#00ff0044" : "#ff000044"}`,
          animation: "pulse 0.6s ease-out", zIndex: 50,
        }}>
          <div style={{
            fontSize:"10px", color: C.dim, marginBottom:"4px",
            textTransform:"uppercase", letterSpacing:"1px",
          }}>📺 Chat Live</div>
          <div style={{
            fontSize:"12px", fontWeight:"bold",
            color: donationEvent.type === "love" ? C.green : C.red,
            lineHeight:"1.3",
          }}>
            {donationEvent.text}
          </div>
          <div style={{color:C.dim, fontSize:"9px", marginTop:"4px"}}>
            👥 {player?.streamerFollowers || 0} follower
          </div>
        </div>
      )}

    </div>
  );
}
