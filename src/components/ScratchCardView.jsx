import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import { NAIL_INFO } from "../data/nails.js";
import { ITEM_DEFS, GRATTATORE_DEFS } from "../data/items.js";
import { CARD_SYMBOLS } from "../data/cards.js";
import { AudioEngine } from "../audio.js";
import { roll, pick, shuffle } from "../utils/random.js";
import { S } from "../utils/styles.js";
import { Btn } from "./Btn.jsx";
import { ScratchCell } from "./ScratchCell.jsx";
import { hasAsset, assetUrl } from "../assets/registry.js";
import { ticketLayout, inset } from "../data/ticketLayout.js";
import { TicketHeader } from "./TicketHeader.jsx";
import { ANIM } from "../styles/animations.js";

const RUOTA_SYMS = CARD_SYMBOLS.ruota;
const CANCELLED_MSG = "💀 VINCITA ANNULLATA! L'unghia ha rovinato il biglietto.";
// Meccaniche che non si vincono accoppiando simboli (niente checkWin né "Gratta tutto").
// Labirinto, Gratta & Combina e Mappa del Tesoro hanno una schermata loro: se
// questa vista le mostra comunque (galleria dev), con matchNeeded 0 la prima
// cella sarebbe già una "vincita".
const NO_MATCH_MECHANICS = new Set(["sum13", "collect", "setteemezzo", "ruota", "doppioOnulla", "labirinto", "combina", "tesoro"]);
// Solo qui la Chiave d'Ottone rivela celle: altrove (somme, accumulo) una cella
// segnata come grattata senza passare da doScratch andrebbe semplicemente persa.
const REVEAL_MECHANICS = new Set(["match", "jolly", "trap"]);
// Moltiplicatore del premio per impianto: Macellaio/Anziana = vincita garantita
// al moltiplicatore, Chirurgo = slot fissi. Unghia Sacra ×3 (Beta 5 nerf: era ×5).
const IMPLANT_PRIZE_MULT = {
  plastica: 0.5, ferro: 1.0, oro: 1.5,
  neonato: 0.5, marcione: 0.5, baddie: 1.0,
  sacra: 3.0,
};

// ─── SCRATCH CARD COMPONENT (per-cell nail damage + early stop) ───
export function ScratchCardView({ card, onDone, nailState, nailImplant=null, grattaMania, equippedGrattatore, onCellScratch, onNailDamage=null, onItemFound=null, showFirstWarning, ambidestri=false, onCardActivate=null, lastWonPrize=0, extraTiles=[], onExtraTileUsed=null, relicEffects=[], onAdviceShown=null, layoutOverride=null }) {
  // null, non l'id della carta montata: la vista si monta a ogni grattino, e con
  // l'id già impostato l'effetto di preparazione qui sotto non partiva mai
  // (Malocchio, Chiave d'Ottone e maledizione del Maledetto non si attivavano).
  const cardId = useRef(null);
  const [cells, setCells] = useState(card.cells.map(c => ({...c})));
  const [scratched, setScratched] = useState(0);
  const [finished, setFinished] = useState(false);
  // Ref-based guard to prevent double-fire of onDone from rapid clicks / spacebar spam
  // (React state updates are async: two clicks in the same tick both see finished=false).
  const finishedRef = useRef(false);
  // Real-time win detection
  const [winFound, setWinFound] = useState(false);
  const [winSymbol, setWinSymbol] = useState(null);
  const [winPrize, setWinPrize] = useState(0);
  const [winPrizeFull, setWinPrizeFull] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [nailAdviceDismissed, setNailAdviceDismissed] = useState(false);
  const [deadNailWarn, setDeadNailWarn] = useState(false);
  const deadNailTimer = useRef(null);
  const warnDeadNail = () => {
    setDeadNailWarn(true);
    clearTimeout(deadNailTimer.current);
    deadNailTimer.current = setTimeout(() => setDeadNailWarn(false), 2000);
  };
  const scratchedWhileMarcia = useRef(false);
  // Celle "sporcate di sangue" — set di indici grattati con unghia marcia/sanguinante.
  // Usato per renderizzare macchie rosse persistenti sulla schedina.
  const [bloodyCells, setBloodyCells] = useState(() => new Set());
  const firstHitUsed = useRef(false); // Reliquia Occhio di Tigre
  // Mechanic-specific state
  const runningSumRef = useRef(0);
  const [runningSum, setRunningSum] = useState(0);
  const [busted, setBusted] = useState(false);
  const collectedRef = useRef(0);
  const [collected, setCollected] = useState(0);
  const [hitStop, setHitStop] = useState(false);
  const [showNoWin, setShowNoWin] = useState(false);
  const [revealMsg, setRevealMsg] = useState(null); // "🔑 2 celle rivelate!" or "💿 x2!"
  const [nearWin, setNearWin] = useState(false); // quasi-vincita: 1 symbol away from winning
  const winBoxRef = useRef(null); // ref per scroll-into-view al momento della vincita
  // Premio "nominale" della vincita in sospeso, prima dei moltiplicatori: serve a
  // ricalcolarla se l'unghia cambia stato mentre si continua a grattare.
  const winBaseRef = useRef(0);
  // Carta chiusa: sballo / STOP / nessuna vincita, oppure vincita già decisa su
  // una carta a somma o accumulo (continuare potrebbe solo farla perdere).
  const locked = finished || showNoWin || busted || hitStop
    || (winFound && NO_MATCH_MECHANICS.has(card.mechanic));
  // Doppio o Nulla (carta): raddoppia l'ultimo premio, ma mai oltre il premio
  // in palio sul biglietto (CARD_BALANCE). Senza tetto una vincita da €1400
  // trasformava ogni carta da €20 in €2800, e ogni raddoppio alimentava il
  // successivo. Senza un premio precedente vale il premio in palio.
  const doppioStake = card.doppioStake ?? card.prize;
  const doppioPrize = lastWonPrize > 0 ? Math.min(lastWonPrize * 2, doppioStake) : doppioStake;

  // ── La Ruota: rulli in spin prima del click ──────────────────
  const [reelSpinSyms, setReelSpinSyms] = useState(() =>
    card.mechanic === "ruota"
      ? [pick(RUOTA_SYMS), pick(RUOTA_SYMS), pick(RUOTA_SYMS)]
      : []
  );
  useEffect(() => {
    if (card.mechanic !== "ruota" || finished) return;
    const id = setInterval(() => {
      setReelSpinSyms(prev =>
        prev.map((s, i) => cells[i]?.scratched ? s : pick(RUOTA_SYMS))
      );
    }, 100);
    return () => clearInterval(id);
  }, [card.mechanic, finished, cells]);

  const totalCells = cells.length;

  // Spacebar: gratta prossima cella o incassa vincita (ref pattern — no stale closure)
  const scratchSpaceRef = useRef(null);
  scratchSpaceRef.current = () => {
    if (finished) return;
    if (winFound) { handleFinish(true); return; }
    if (showNoWin) { handleFinish(false); return; }
    const nextIdx = cells.findIndex(c => !c.scratched);
    if (nextIdx >= 0) doScratch(nextIdx);
  };
  useEffect(() => {
    const onKey = (e) => { if (e.code !== "Space") { return; } e.preventDefault(); scratchSpaceRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ricalcola winPrize live se nailState cambia mentre c'è una vincita in sospeso
  useEffect(() => {
    if (winFound && !finished) declareWin(winBaseRef.current, winSymbol);
  }, [nailState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolla la win box in vista quando compare (carte alte come Puzzle la spingono fuori viewport)
  useEffect(() => {
    if (winFound && !finished && winBoxRef.current) {
      setTimeout(() => {
        winBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80); // piccolo delay per assicurarsi che React abbia renderizzato il box
    }
  }, [winFound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const newId = card.name + card.prize + card.symbols?.join("");
    if (newId !== cardId.current) {
      cardId.current = newId;
      const newCells = card.cells.map(c => ({...c}));
      // Reliquia Malocchio: trappole 🔥 → jolly ✨
      if (relicEffects.includes("trapToJolly")) {
        newCells.forEach((c, i) => { if (c.isTrap) newCells[i] = {...c, isTrap: false, isJolly: true, symbol: "✨"}; });
      }
      // Chiave d'Ottone: rivela 2 celle-simbolo sui grattini tier 3+ (mai un
      // oggetto nascosto: segnato come grattato senza doScratch andrebbe perso)
      if (equippedGrattatore?.effect === "revealPath" && card.tier >= 3 && REVEAL_MECHANICS.has(card.mechanic)) {
        const hidden = newCells.map((c,i) => ({c,i})).filter(x => !x.c.scratched && !x.c.isItem);
        const toReveal = shuffle(hidden).slice(0, 2);
        toReveal.forEach(x => { newCells[x.i] = {...newCells[x.i], scratched: true}; });
        if (toReveal.length > 0) {
          setRevealMsg(`🔑 Chiave d'Ottone: ${toReveal.length} celle rivelate!`);
          setTimeout(() => setRevealMsg(null), 2500);
        }
      }
      if (card.id === "maledetto" && onCardActivate) {
        onCardActivate("maledetto_curse");
      }
      setCells(newCells);
      setScratched(newCells.filter(c => c.scratched).length);
      finishedRef.current = false;
      setFinished(false);
      setBloodyCells(new Set());
      scratchedWhileMarcia.current = false;
      setWinFound(false); setWinSymbol(null); setWinPrize(0); setWinPrizeFull(0); setCancelled(false);
      runningSumRef.current = 0; setRunningSum(0); setBusted(false);
      collectedRef.current = 0; setCollected(0); setHitStop(false); setShowNoWin(false);
    }
  }, [card]); // eslint-disable-line react-hooks/exhaustive-deps -- una volta per carta

  // Check for winning combo among revealed cells
  const checkWin = (newCells) => {
    if (NO_MATCH_MECHANICS.has(card.mechanic)) return null;
    const counts = {};
    newCells.filter(c => c.scratched && !c.isTrap && !c.isItem && !c.isJolly && !c.isStop).forEach(c => {
      counts[c.symbol] = (counts[c.symbol] || 0) + 1;
    });
    const jollyCount = newCells.filter(c => c.scratched && c.isJolly).length;
    for (const [sym, count] of Object.entries(counts)) {
      if (count + jollyCount >= card.matchNeeded) return sym;
    }
    return null;
  };

  // Moltiplicatore-unghia per lo stato corrente (NAIL_INFO: vale per qualsiasi
  // stato). Se l'unghia era marcia mentre grattavi e poi è guarita, la schedina
  // resta "sporca": il 25% vale comunque (coerente con isDirty nell'UI).
  const getNailMult = (usingGrattatore) => {
    const effMarcia = !usingGrattatore && (nailState === "marcia" || scratchedWhileMarcia.current);
    const nailInfo = NAIL_INFO[nailState] || NAIL_INFO.sana;
    const rawMult = usingGrattatore ? Math.max(nailInfo.mult, 1.0) : nailInfo.mult;
    return effMarcia ? Math.min(rawMult, 0.25) : rawMult;
  };

  // Moltiplicatori che valgono su QUALSIASI vincita: impianto, grattatore,
  // GrattaMania, Maneki Neko. Prima gli incassi anticipati (Sette e Mezzo,
  // Miliardario) ne applicavano solo una parte: con l'Unghia Sacra un incasso
  // anticipato pagava ×1 invece di ×3, con la Plastica ×1 invece di ×0,5.
  const boostPrize = (amount) => {
    let p = amount * (IMPLANT_PRIZE_MULT[nailImplant] ?? 1);
    switch (equippedGrattatore?.effect) {
      case "doublePrize": p *= 2; break;
      case "quadPrize":   p *= 4; break;
      case "x5teleport":  p *= 5; break;
      case "bonusChance": p *= 1 + (equippedGrattatore.value || 0.1); break;
      default: break;
    }
    if (grattaMania) p *= 2;
    if (relicEffects.includes("globalWinBoost")) p *= 1.10;
    return Math.round(p);
  };

  // Premio effettivo (con l'unghia) e pieno (senza) a partire dal premio
  // nominale. Una vincita vera non scende sotto €1 per arrotondamento.
  const calcPrize = (base) => {
    const nailInfo = NAIL_INFO[nailState] || NAIL_INFO.sana;
    if (base <= 0 || (nailInfo.cancelChance > 0 && roll(nailInfo.cancelChance))) {
      return { prize: 0, fullPrize: 0, cancelled: base > 0 };
    }
    // Piede: moltiplicatore ×3 su un premio nominale di al massimo €500
    const capped = nailState === "piede" ? Math.min(base, 500) : base;
    const nailMult = getNailMult(!!equippedGrattatore);
    return {
      prize: Math.max(1, boostPrize(Math.round(capped * nailMult))),
      fullPrize: Math.max(1, boostPrize(base)),
      cancelled: false,
    };
  };

  // Dichiara (o ricalcola) la vincita partendo dal premio nominale.
  const declareWin = (base, symbol = null) => {
    winBaseRef.current = base;
    const { prize, fullPrize, cancelled: wc } = calcPrize(base);
    setWinFound(true); setWinSymbol(symbol);
    setWinPrize(prize); setWinPrizeFull(fullPrize); setCancelled(wc);
  };

  // Sconfitta a carta non finita (sballo, STOP, ❌) o carta finita senza
  // vincita: resta a schermo col motivo e un OK. Prima sballo/STOP/❌ chiudevano
  // la carta da soli dopo 700ms e il messaggio non arrivava mai al giocatore
  // ("sette e mezzo dopo due grattate si chiude e bugga").
  const stopWithLoss = () => {
    AudioEngine.lose();
    setNearWin(false);
    setShowNoWin(true);
  };

  const lossReason = () => {
    if (card.mechanic === "doppioOnulla") return "🎲 DOPPIO O NULLA: ❌ niente raddoppio.";
    if (busted) return card.mechanic === "setteemezzo" ? "💥 SBALLATO! Hai superato 7½." : "💥 BUST! Sei andato oltre 13.";
    if (hitStop) return "🛑 STOP! Hai perso l'accumulato.";
    if (scratched >= totalCells) return "Niente… prossima volta!";
    return "Hai abbandonato il gratta.";
  };

  // La Ruota a rulli fermi: tris = premio, coppia = consolazione, altrimenti niente
  const resolveRuota = (newCells) => {
    const [a, b, c] = newCells.map(cell => cell.symbol);
    if (a === b && b === c) { declareWin(card.prize, a); AudioEngine.win(); }
    else if (card.prize > 0 && (a === b || b === c || a === c)) {
      // Quasi-vincita: consolazione (card.prize = costo × 1.3, vedi card.js)
      setNearWin(true);
      AudioEngine.lose();
      setTimeout(() => { setNearWin(false); declareWin(card.prize); AudioEngine.win(); }, 1200);
    } else stopWithLoss();
  };

  // Reliquia Occhio di Tigre: il primo danno da trappola è assorbito gratis.
  const shieldTraps = (count) => {
    if (count === 0 || firstHitUsed.current || !relicEffects.includes("firstHitShield")) return count;
    firstHitUsed.current = true;
    setRevealMsg("🐯 Occhio di Tigre: danno assorbito!");
    setTimeout(() => setRevealMsg(null), 1500);
    return count - 1;
  };

  const doScratch = (idx) => {
    if (cells[idx].scratched || locked) return;
    // Stesso blocco delle celle (ScratchCell `blocked`), che però spazio e
    // "Gratta tutto" scavalcavano: con l'unghia morta non si gratta.
    if (nailState === "morta") { warnDeadNail(); return; }
    if (!equippedGrattatore && nailState === "marcia") scratchedWhileMarcia.current = true;
    // Macchia visiva: SOLO con unghia marcia (rosso) e senza grattatore.
    // Sanguinante (arancione) è uno stato "dolore" — fa male ma il premio resta
    // intero, e non sporca ancora visivamente la schedina. Solo marcia penalizza
    // il premio (25%) e macchia davvero la carta.
    if (!equippedGrattatore && nailState === "marcia") {
      setBloodyCells(prev => { if (prev.has(idx)) return prev; const next = new Set(prev); next.add(idx); return next; });
    }

    // ── Item cell: dagli l'oggetto, non conta per win/nail ──────
    if (cells[idx].isItem) {
      const newCells = [...cells];
      newCells[idx] = {...newCells[idx], scratched: true};
      setCells(newCells);
      setScratched(scratched + 1);
      onItemFound?.(cells[idx].itemId);
      // Se l'oggetto era l'ultima cella la carta va chiusa comunque: prima
      // restava aperta per sempre (niente esito, spazio inerte, solo
      // "Abbandona" con il malus).
      if (scratched + 1 >= totalCells && !winFound) {
        if (card.mechanic === "ruota") resolveRuota(newCells);
        else stopWithLoss();
      }
      return;
    }

    // Disco Rotto: 2 celle per click (non su Tredici: la somma esatta va scelta)
    const indicesToScratch = [idx];
    if (equippedGrattatore?.effect === "doubleCell" && card.mechanic !== "sum13" && card.mechanic !== "doppioOnulla") {
      const unscratched = cells.map((c,i) => ({c,i})).filter(x => !x.c.scratched && x.i !== idx && !x.c.isItem);
      if (unscratched.length > 0) {
        indicesToScratch.push(pick(unscratched).i);
        setRevealMsg("💿 x2!");
        setTimeout(() => setRevealMsg(null), 800);
      }
    }

    const newCells = [...cells];
    indicesToScratch.forEach(i => { newCells[i] = {...newCells[i], scratched: true}; });
    setCells(newCells);
    const newScratched = scratched + indicesToScratch.length;
    setScratched(newScratched);
    const revealedNow = indicesToScratch.map(i => newCells[i]);

    // ── Trappole fuoco (boccaDrago): danno all'unghia, poi si prosegue come match
    const trapHits = shieldTraps(revealedNow.filter(c => c.isTrap).length);
    for (let t = 0; t < trapHits; t++) { onNailDamage?.(); AudioEngine.scratch(); }
    revealedNow.filter(c => !c.isTrap).forEach(() => onCellScratch(!!equippedGrattatore));

    // ── sum13 mechanic ────────────────────────────────────────────
    if (card.mechanic === "sum13") {
      const newSum = runningSumRef.current + (revealedNow[0].value || parseInt(revealedNow[0].symbol) || 0);
      runningSumRef.current = newSum;
      setRunningSum(newSum);
      if (newSum === 13) { declareWin(card.prize); AudioEngine.win(); }
      else if (newSum > 13) { setBusted(true); onNailDamage?.(); stopWithLoss(); }
      return;
    }

    // ── collect mechanic ──────────────────────────────────────────
    if (card.mechanic === "collect") {
      if (revealedNow.some(c => c.isStop)) { setHitStop(true); stopWithLoss(); return; }
      const newCollected = collectedRef.current + revealedNow.reduce((s, c) => s + (c.value || 0), 0);
      collectedRef.current = newCollected;
      setCollected(newCollected);
      if (newCells.every(c => c.scratched || c.isStop)) { declareWin(newCollected); AudioEngine.win(); }
      return;
    }

    // ── setteemezzo mechanic ──────────────────────────────────────
    if (card.mechanic === "setteemezzo") {
      // Valori tutti positivi: se il totale non sballa, nessun parziale ha sballato
      const gained = revealedNow.reduce((s, c) => s + (c.value || 0), 0);
      const newSum = Math.round((runningSumRef.current + gained) * 10) / 10;
      runningSumRef.current = newSum;
      setRunningSum(newSum);
      if (newSum > 7.5) { setBusted(true); onNailDamage?.(); stopWithLoss(); }
      else if (newScratched >= totalCells) {
        if (newSum > (card.bancoTotal || 0)) { declareWin(card.prize); AudioEngine.win(); }
        else stopWithLoss();
      }
      return;
    }

    // ── ruota mechanic ─────────────────────────────────────────────
    if (card.mechanic === "ruota") {
      AudioEngine.scratch();
      if (newScratched >= totalCells) {
        resolveRuota(newCells);
      } else if (newScratched === 2) {
        const [first, second] = newCells.filter(c => c.scratched);
        if (first.symbol === second.symbol) setNearWin(true);
      }
      return;
    }

    // ── doppioOnulla mechanic ─────────────────────────────────────
    if (card.mechanic === "doppioOnulla") {
      if (revealedNow[0].isDoppioWin) { declareWin(doppioPrize); AudioEngine.win(); }
      else stopWithLoss();
      return;
    }

    // ── Normal match / jolly / trap ───────────────────────────────
    const sym = checkWin(newCells);
    if (sym && !winFound) {
      declareWin(card.prize, sym);
      setNearWin(false);
      AudioEngine.win();
    } else if (!sym && !winFound && card.matchNeeded) {
      const counts = {};
      newCells.filter(c => c.scratched && !c.isTrap && !c.isItem && !c.isJolly && !c.isStop).forEach(c => {
        counts[c.symbol] = (counts[c.symbol] || 0) + 1;
      });
      const jollyCount = newCells.filter(c => c.scratched && c.isJolly).length;
      const isNear = Object.values(counts).some(c => c + jollyCount === card.matchNeeded - 1);
      if (isNear && !nearWin) setNearWin(true);
    }
    if (newScratched >= totalCells && !sym && !winFound) stopWithLoss();
  };

  const scratchAll = () => {
    if (NO_MATCH_MECHANICS.has(card.mechanic) || locked) return;
    if (nailState === "morta") { warnDeadNail(); return; }
    const newCells = cells.map(c => ({...c, scratched: true}));
    const fresh = newCells.filter((c, i) => !cells[i].scratched);
    setCells(newCells);
    if (!equippedGrattatore && nailState === "marcia") scratchedWhileMarcia.current = true;
    // Macchia TUTTE le celle appena grattate SOLO se l'unghia è marcia (rosso).
    // Sanguinante (arancione) non sporca la carta visivamente.
    if (!equippedGrattatore && nailState === "marcia") {
      setBloodyCells(prev => {
        const next = new Set(prev);
        cells.forEach((c, i) => { if (!c.scratched) next.add(i); });
        return next;
      });
    }
    fresh.filter(c => c.isItem).forEach(c => onItemFound?.(c.itemId));
    const trapHits = shieldTraps(fresh.filter(c => c.isTrap).length);
    for (let t = 0; t < trapHits; t++) onNailDamage?.();
    fresh.filter(c => !c.isTrap && !c.isItem).forEach(() => { AudioEngine.scratch(); onCellScratch(!!equippedGrattatore); });
    setScratched(newCells.length);
    const sym = checkWin(newCells);
    if (sym && !winFound) { declareWin(card.prize, sym); AudioEngine.win(); }
    else if (!sym && !winFound) stopWithLoss();
  };

  const handleFinish = (claiming) => {
    if (finished || finishedRef.current) return;

    // Sette e Mezzo, "INCASSA LA VINCITA": il pulsante compare solo quando la
    // somma batte il banco, e una mano perdente non può mai batterlo (card.js),
    // quindi card.prize è sempre il premio vero.
    if (card.mechanic === "setteemezzo" && claiming && !winFound) {
      declareWin(card.prize);
      AudioEngine.win();
      return;
    }

    finishedRef.current = true;
    setFinished(true);

    // Miliardario, "INCASSA ORA" prima di finire la carta: si incassa
    // l'accumulato con gli stessi moltiplicatori di ogni altra vincita.
    if (card.mechanic === "collect" && claiming && !winFound) {
      const { prize, cancelled: wc } = calcPrize(collectedRef.current);
      onDone({ win: prize > 0, prize, cellsScratched: scratched, message: wc ? CANCELLED_MSG : undefined });
      return;
    }

    if (claiming && winFound) {
      onDone({
        win: !cancelled && winPrize > 0, prize: cancelled ? 0 : winPrize,
        cellsScratched: scratched, message: cancelled ? CANCELLED_MSG : undefined,
      });
      return;
    }

    // Sconfitta o abbandono. Sballo e STOP hanno già il loro castigo
    // (danno all'unghia / accumulato perso): niente malus in più.
    let msg = lossReason();
    const hasBullone = equippedGrattatore?.effect === "ignoreMalus";
    const bulloneSuccess = hasBullone && roll(0.8);
    const ignoreMalus = winFound || bulloneSuccess || hitStop || busted;
    if (hasBullone && !hitStop && !busted && card.malus) {
      msg += bulloneSuccess
        ? " 🔩 Il Bullone ha protetto dal malus!"
        : " 🔩💥 Hai perso persino con un bullone! (20% sfortuna)";
    }
    const malusType = ignoreMalus ? null : card.malus?.type;
    if (malusType === "payExtra" || malusType === "nailDamage") msg += ` ${card.malus.desc}`;
    onDone({
      win: false,
      prize: malusType === "payExtra" ? -card.malus.amount : 0,
      message: msg, cellsScratched: scratched,
      applyNailMalus: malusType === "nailDamage",
      malusAmount: card.malus?.amount || 0,
    });
  };

  // ── Tier / accent resolution ──────────────────────────────────
  // Preserves `card.theme?.border` (used by special mechanic cards: labirinto, combina, tesoro).
  const TIER_META = {
    // COMUNE grigio-blu neutro, non verde: allineato al colore usato per la
    // stessa rarità in ShopView.jsx (rarityAccent → "#7a8aaa"). Prima erano
    // due sistemi scollegati — la stessa rarità "comune" cambiava colore a
    // seconda che la si vedesse nel negozio o sulla carta grattino — e il
    // verde qui collideva col significato di "vincita/salute" usato altrove.
    1: { label: "COMUNE",      color: "#7a8aaa", emoji: "🎫" },
    2: { label: "MEDIA",       color: C.cyan,    emoji: "🎟️" },
    3: { label: "RARA",        color: C.magenta, emoji: "💎" },
    4: { label: "LEGGENDARIA", color: C.gold,    emoji: "👑" },
  };
  const tier = Math.min(4, Math.max(1, card.tier || 1));
  const tierMeta = TIER_META[tier];
  const accent = card.theme?.border || tierMeta.color;

  // Count matching symbols for highlighting
  const revealedCounts = {};
  cells.filter(c => c.scratched).forEach(c => {
    revealedCounts[c.symbol] = (revealedCounts[c.symbol] || 0) + 1;
  });

  // Corner brackets helper (JSX fragment, not component — keeps the rest simple)
  const cornerBrackets = (color, size = 12, inset = 6, glow = true) =>
    ["tl","tr","bl","br"].map(pos => {
      const [v, h] = pos.split("");
      return (
        <div key={pos} style={{
          position: "absolute",
          [v === "t" ? "top" : "bottom"]: `${inset}px`,
          [h === "l" ? "left" : "right"]: `${inset}px`,
          width: `${size}px`, height: `${size}px`,
          borderTop: v === "t" ? `2px solid ${color}` : "none",
          borderBottom: v === "b" ? `2px solid ${color}` : "none",
          borderLeft: h === "l" ? `2px solid ${color}` : "none",
          borderRight: h === "r" ? `2px solid ${color}` : "none",
          boxShadow: glow ? `0 0 8px ${color}88` : "none",
          pointerEvents: "none",
        }}/>
      );
    });

  const panelBorder = winFound ? C.green : accent;

  // ── Biglietto AI: se esiste ticket-<id> uso l'immagine come faccia del biglietto
  //    (proporzione 4:3 fissa) con griglia in overlay; altrimenti layout classico.
  const hasTicket = hasAsset(`ticket-${card.id}`);
  const ticketUrl = hasTicket ? assetUrl(`ticket-${card.id}`) : null;
  // layoutOverride = anteprima dal vivo dell'editor dev (?edit=1)
  const layout = layoutOverride || ticketLayout(card.id);
  // Griglia che RIEMPIE il pannello scuro dell'arte: righe e colonne in frazioni
  // uguali, le celle si stirano per occuparlo tutto. Niente fasce vuote, e ogni
  // biglietto detta la forma delle sue celle. Solo le griglie minuscole (1 cella)
  // vengono limitate, altrimenti diventerebbero enormi.
  const GRID_COLS = card.cols || 1;
  const gridRows = Math.max(1, Math.ceil(cells.length / GRID_COLS));
  const gridSize = cells.length <= 1 ? "52%" : "100%";

  // ── Contenuto "zona-gioco" (griglia celle-argento o display meccanica) ──
  // Estratto in una const così viene renderizzato UNA sola volta: in overlay
  // sul biglietto AI (hasTicket) oppure nel flusso classico (fallback).
  const playContent = card.mechanic === "ruota" ? (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", margin:"10px auto 12px"}}>
      <div style={{color:C.gold, fontSize:"11px", letterSpacing:"3px", fontFamily:FONT}}>
        ★ FERMA I RULLI ★
      </div>
      <div style={{
        display:"flex", justifyContent:"center", gap:"8px",
        border:`2px solid ${C.dim}`, padding:"8px 12px", background:"#000000",
      }}>
        {cells.map((cell, idx) => {
          const allScratched = cells.every(c => c.scratched);
          const isMatch = allScratched && winFound;
          const spinning = !cell.scratched && !finished;
          const displaySym = cell.scratched ? cell.symbol : (reelSpinSyms[idx] || "?");
          return (
            <div key={idx}
              onClick={() => !cell.scratched && !finished && doScratch(idx)}
              style={{
                // sul biglietto AI i rulli crescono col pannello (container query)
                width: hasTicket ? "clamp(72px, 24cqw, 150px)" : "80px",
                height: hasTicket ? "clamp(82px, 42cqh, 175px)" : "90px",
                border:`2px solid ${cell.scratched ? (isMatch ? C.gold : C.cyan) : C.text}`,
                background: cell.scratched ? (isMatch ? "#555500" : "#080808") : "#111",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                cursor: spinning ? "pointer" : "default",
                userSelect:"none", gap:"4px",
                animation: isMatch ? "winFlash 0.6s infinite" : "none",
              }}>
              <div style={{fontSize: hasTicket ? "clamp(30px, 16cqh, 60px)" : "32px", lineHeight:1}}>{displaySym}</div>
              <div style={{
                fontSize:"10px", letterSpacing:"1px",
                color: cell.scratched ? (isMatch ? C.gold : C.dim) : C.text,
              }}>
                {cell.scratched ? (isMatch ? "STOP!" : "STOP") : "▶ CLICK"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:"10px", color:C.dim, letterSpacing:"1px"}}>
        {cells.filter(c=>c.scratched).length === 0 && "Clicca per fermare ogni rullo"}
        {cells.filter(c=>c.scratched).length === 1 && "2 rulli ancora in giro..."}
        {cells.filter(c=>c.scratched).length === 2 && (nearWin ? `⚡ QUASI! Ferma l'ultimo!` : "Ultimo rullo — dai!")}
        {cells.every(c=>c.scratched) && (winFound ? "🎰 JACKPOT!" : "Niente...")}
      </div>
    </div>
  ) : (
    <>
      {deadNailWarn && (
        <div style={{
          margin:"0 auto 8px", maxWidth:"min(340px, 94vw)", padding:"8px 12px", textAlign:"center",
          border:`2px solid ${C.red}`, background:"#1a0005", color:C.red, fontWeight:"bold",
          fontSize:"12px", letterSpacing:"0.5px", boxShadow:`0 0 14px ${C.red}88, inset 0 0 10px ${C.red}22`,
          animation:ANIM.pulseUrgent,
        }}>
          ✝ UNGHIA MORTA — seleziona un'unghia sana per grattare
        </div>
      )}
      <div style={{
        display:"grid", gridTemplateColumns:`repeat(${card.cols}, 1fr)`,
        ...(hasTicket ? {
          // Overlay sul biglietto AI: la griglia riempie il pannello scuro dell'arte.
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          gap: "2.4%",
          width: gridSize, height: gridSize, margin: "auto",
        } : {
          gap: "4px", maxWidth: "min(340px, 94vw)", width: "100%", margin: "6px auto 8px",
        }),
        padding: (bloodyCells.size > 0 || scratchedWhileMarcia.current) ? "4px" : 0,
        background: (bloodyCells.size > 0 || scratchedWhileMarcia.current)
          ? "radial-gradient(circle at 30% 40%, rgba(170,0,15,0.18), transparent 60%), radial-gradient(circle at 70% 70%, rgba(120,0,10,0.14), transparent 55%)"
          : "transparent",
        transition: "background 0.4s",
      }}>
        {cells.map((cell, idx) => {
          const matchCount = revealedCounts[cell.symbol] || 0;
          const isWinSymbol = cell.scratched && winFound && cell.symbol === winSymbol;
          const isPartialMatch = cell.scratched && !winFound && matchCount >= 2 && matchCount < card.matchNeeded;
          return (
            <ScratchCell key={idx} cell={cell} idx={idx}
              onScratch={doScratch} finished={locked}
              isWinSymbol={isWinSymbol} isPartialMatch={isPartialMatch}
              bloodMode={nailState === "marcia"}
              isBloody={bloodyCells.has(idx)}
              blocked={nailState === "morta"} onBlockedAttempt={warnDeadNail}
              ambidestri={ambidestri} themeColor={card.theme?.border} fill={hasTicket}
              /* Scala la festa dei coriandoli col valore del biglietto:
                 la LEGGENDARIA merita più della COMUNE. */
              winTier={tier} />
          );
        })}
      </div>
    </>
  );

  // ── Header del biglietto (nome / costo / max) — overlay dentro il cartiglio ──
  // Impaginazione condivisa con l'anteprima (TicketThumb): vedi TicketHeader.jsx
  const ticketHeaderOverlay = (
    <TicketHeader card={card} accent={accent} layout={layout} />
  );

  return (
    <div className={tier >= 3 && !hasTicket ? "holo" : undefined} style={{
      ...S.panel, textAlign:"center",
      maxWidth: hasTicket ? "620px" : "440px", margin:"8px auto",
      position: "relative",
      // Con biglietto AI: nessuna cornice CSS (la fornisce l'immagine); solo contenitore trasparente.
      border: hasTicket ? "none" : `2px solid ${panelBorder}`,
      background: hasTicket ? "transparent" : `linear-gradient(180deg, ${panelBorder}08 0%, #05050b 18%)`,
      boxShadow: hasTicket ? "none" : `0 0 28px ${panelBorder}33, inset 0 0 32px ${panelBorder}0a, 4px 4px 0 #000`,
      padding: hasTicket ? "0" : undefined,
      animation: winFound ? "winFlash 1.5s ease-out" : "screenIn 0.25s ease-out",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      {/* Respiro neon dell'insegna — definito qui così vale anche fuori dal gioco. */}
      <style>{`
        @keyframes ticketNeon {
          0%, 100% { filter: brightness(1); }
          45%      { filter: brightness(1.16); }
          52%      { filter: brightness(0.97); }
        }
      `}</style>
      {!hasTicket && cornerBrackets(panelBorder, 12, 6, true)}

      {/* ═══ BIGLIETTO AI — faccia 4:3 con header + griglia in overlay ═══ */}
      {hasTicket && (
        <div data-ticket-face={card.id} style={{
          position: "relative", width: "100%",
          aspectRatio: "4 / 3",
          isolation: "isolate",
          maxHeight: "62vh",
          margin: "0 auto 8px",
          backgroundImage: `url(${ticketUrl})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          filter: winFound ? `drop-shadow(0 0 18px ${C.green}66)` : "none",
          transition: "filter 0.3s",
        }}>
          {ticketHeaderOverlay}
          {/* AREA-GIOCO — nessun box grigio: solo una cornice neon sul rettangolo
              scuro già presente nell'arte, e dentro la griglia che lo riempie. */}
          <div style={{
            position: "absolute", inset: inset(layout.play), zIndex: 2,
            containerType: "size",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${winFound ? C.green : accent}55`,
            boxShadow: `0 0 12px ${winFound ? C.green : accent}44, inset 0 0 22px ${winFound ? C.green : accent}22`,
            animation: "ticketNeon 3.2s ease-in-out infinite",
          }}>
            {playContent}
          </div>
        </div>
      )}

      {<>
      {/* ═══ CARD HEADER — Vintage neon title + tier badge + meta pills ═══ */}
      {/* Nascosto col biglietto AI: il nome/costo/max sono in overlay sul ticket. */}
      {!hasTicket && (
      <div style={{
        position: "relative",
        paddingBottom: "8px", marginBottom: "8px",
        borderBottom: `1px solid ${accent}33`,
        background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
      }}>
        {/* Sparkle for legendary */}
        {tier >= 4 && (
          <>
            <div style={{
              position: "absolute", top: "-4px", left: "8px",
              fontSize: "11px", color: accent,
              animation: "variantSparkle 2.4s ease-in-out infinite",
            }}>✦</div>
            <div style={{
              position: "absolute", top: "-4px", right: "8px",
              fontSize: "11px", color: accent,
              animation: "variantSparkle 2.4s ease-in-out infinite",
              animationDelay: "1.2s",
            }}>✦</div>
          </>
        )}

        {/* Tier badge */}
        <div style={{
          display: "inline-block",
          background: accent, color: "#000",
          padding: "2px 7px", fontSize: "10px", fontWeight: "bold",
          letterSpacing: "2px", marginBottom: "4px",
          boxShadow: `0 0 8px ${accent}aa`,
        }}>
          ★ {card.emoji || tierMeta.emoji} {tierMeta.label} ★
        </div>

        {/* Name */}
        <div style={{
          color: accent, fontWeight: "bold", fontSize: "17px",
          letterSpacing: "2px", marginBottom: "4px",
          textShadow: `0 0 10px ${accent}aa, 0 0 22px ${accent}44`,
          fontFamily: FONT,
        }}>
          {card.name}
        </div>

        {/* Description */}
        {card.desc && (
          <div style={{
            color: C.text, fontSize: "10px",
            lineHeight: 1.4, marginBottom: "6px",
            fontStyle: "italic",
            padding: "0 8px",
          }}>
            {card.desc}
          </div>
        )}

        {/* Cost / Max pills */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "5px",
          flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: "10px", color: C.gold, fontWeight: "bold",
            background: `${C.gold}14`,
            border: `1px solid ${C.gold}66`,
            padding: "2px 7px", letterSpacing: "1px",
          }}>COSTO €{card.cost}</span>
          <span style={{
            fontSize: "10px", color: C.green, fontWeight: "bold",
            background: `${C.green}14`,
            border: `1px solid ${C.green}66`,
            padding: "2px 7px", letterSpacing: "1px",
          }}>MAX €{card.maxPrize}</span>
        </div>
      </div>
      )}

      {/* 🎲 DoppioOnulla banner — Vintage */}
      {card.mechanic === "doppioOnulla" && (
        <div style={{
          position: "relative",
          background: "#1a0018", border: `2px solid ${C.magenta}`,
          padding: "10px 14px", marginBottom: "8px",
          boxShadow: `0 0 14px ${C.magenta}55, inset 0 0 16px ${C.magenta}14`,
          animation: ANIM.pulseAmbient,
        }}>
          {cornerBrackets(C.magenta, 10, 4, false)}
          <div style={{
            display: "inline-block",
            background: C.magenta, color: "#000",
            padding: "2px 8px", fontSize: "10px", fontWeight: "bold",
            letterSpacing: "2px", marginBottom: "5px",
            boxShadow: `0 0 8px ${C.magenta}aa`,
          }}>
            ★ 🎲 DOPPIO O NULLA ★
          </div>
          <div style={{color: C.text, fontSize: "10px", lineHeight: 1.5, marginBottom: lastWonPrize > 0 ? "4px" : 0}}>
            {lastWonPrize > 0
              ? `Gratta e raddoppia il tuo ultimo premio — fino a €${doppioStake}!`
              : `Nessun premio da raddoppiare: in palio €${doppioStake}.`}
          </div>
          {lastWonPrize > 0 && (
            <div style={{
              display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap",
              fontSize: "10px", marginTop: "4px",
            }}>
              <span style={{color: C.dim, padding: "1px 6px"}}>€{lastWonPrize}</span>
              <span style={{color: C.magenta}}>→</span>
              <span style={{color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}66`, padding: "1px 6px"}}>VINCI €{doppioPrize}</span>
              <span style={{color: C.dim}}>/</span>
              <span style={{color: C.red, background: `${C.red}14`, border: `1px solid ${C.red}66`, padding: "1px 6px"}}>PERDI €0</span>
            </div>
          )}
        </div>
      )}

      {card.malus && card.malus.type !== "nailBleed" && (
        <div style={{
          color: C.red, fontSize: "10px", marginBottom: "6px",
          background: "#0a0004", border: `1px dashed ${C.red}66`,
          padding: "3px 8px", display: "inline-block",
          letterSpacing: "0.5px",
        }}>
          ⚠ {card.malus.desc}
        </div>
      )}

      {/* ⚠ Avviso unghia danneggiata — Vintage.
          Solo "marcia" riduce il premio (25%): sanguinante fa male ma il
          premio resta intero, quindi non genera più questo avviso. */}
      {nailState === "marcia" && !finished && scratched === 0 && (() => {
        const warnCol = C.red;
        return (
          <div style={{
            position: "relative",
            background: "#1a0000",
            border: `2px solid ${warnCol}`,
            padding: "10px 14px", marginBottom: "8px",
            boxShadow: `0 0 16px ${warnCol}55, inset 0 0 16px ${warnCol}18`,
            animation: ANIM.pulseActive,
          }}>
            {cornerBrackets(warnCol, 10, 4, false)}
            <div style={{
              display: "inline-block",
              background: warnCol, color: "#000",
              padding: "2px 8px", fontSize: "10px", fontWeight: "bold",
              letterSpacing: "2px", marginBottom: "5px",
              boxShadow: `0 0 8px ${warnCol}aa`,
            }}>
              ★ 🩸 UNGHIA MARCIA ★
            </div>
            <div style={{color: C.text, fontSize: "10px", lineHeight: 1.5}}>
              Premi ridotti al <strong style={{color: C.gold}}>25%</strong> del valore nominale. Cambia unghia o curati prima.
            </div>
          </div>
        );
      })()}

      {/* ⚡ Avviso GrattaMania — Vintage */}
      {grattaMania && !finished && (
        <div style={{
          position: "relative",
          background: "#1a0011", border: `2px solid ${C.red}`,
          padding: "10px 14px", marginBottom: "8px",
          boxShadow: `0 0 16px ${C.red}55, inset 0 0 16px ${C.red}18`,
        }}>
          {cornerBrackets(C.red, 10, 4, false)}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            justifyContent: "center", marginBottom: "4px",
          }}>
            <span style={{fontSize: "18px", animation: ANIM.pulseUrgent, filter: `drop-shadow(0 0 6px ${C.red})`}}>⚡</span>
            <div style={{
              display: "inline-block",
              background: C.red, color: "#000",
              padding: "2px 8px", fontSize: "10px", fontWeight: "bold",
              letterSpacing: "2px",
              boxShadow: `0 0 8px ${C.red}aa`,
            }}>
              ★ GRATTAMANIA ATTIVA ★
            </div>
          </div>
          <div style={{color: C.text, fontSize: "10px", textAlign: "center"}}>
            Premio <strong style={{color: C.gold}}>x2</strong> · ogni cella grattata logora <strong style={{color: C.red}}>un'unghia a caso</strong>
          </div>
        </div>
      )}

      {/* ── Meccanica: Sette e Mezzo — pannello BANCO ── */}
      {card.mechanic === "setteemezzo" && (
        <div style={{
          background:"#1a1400", border:`2px solid #ccaa00`,
          borderRadius:"0", padding:"8px 12px", marginBottom:"8px",
        }}>
          <div style={{color:"#ccaa00", fontSize:"10px", letterSpacing:"2px", marginBottom:"6px"}}>🏦 IL BANCO</div>
          <div style={{display:"flex", gap:"6px", justifyContent:"center", marginBottom:"6px"}}>
            {card.bancoCards?.map((c,i) => (
              <div key={i} style={{
                background:"#f5f0e0", borderRadius:"0", padding:"4px 8px",
                fontFamily:FONT, fontWeight:"bold", fontSize:"18px",
                color: c.isRed ? "#cc1111" : "#111",
                boxShadow:"none", minWidth:"36px", textAlign:"center",
              }}>
                {c.symbol}
              </div>
            ))}
          </div>
          <div style={{color:"#ccaa00", fontSize:"12px"}}>
            Punteggio: <strong>{card.bancoTotal?.toFixed(1)}</strong>
            <span style={{color:"#666", fontSize:"10px", marginLeft:"6px"}}>
              (J/Q/K=½ · A=1 · 2-7=faccia)
            </span>
          </div>
        </div>
      )}
      {/* ── Sette e Mezzo — punteggio live ── */}
      {card.mechanic === "setteemezzo" && !finished && scratched > 0 && (
        <div style={{
          background:"#0d0a00", border:`2px solid ${busted ? C.red : runningSum > (card.bancoTotal||0) ? C.green : "#555"}`,
          borderRadius:"0", padding:"6px 14px", marginBottom:"8px",
          display:"flex", alignItems:"center", justifyContent:"center", gap:"12px",
        }}>
          <span style={{color:"#888", fontSize:"10px"}}>TUO PUNTEGGIO</span>
          <span style={{
            fontSize:"26px", fontWeight:"bold",
            color: busted ? C.red : runningSum > 7 ? C.orange : runningSum > (card.bancoTotal||0) ? C.green : C.bright,
            textShadow: runningSum > (card.bancoTotal||0) && !busted ? `0 0 10px ${C.green}` : "none",
          }}>
            {runningSum.toFixed(1)}
          </span>
          {busted && <span style={{color:C.red, fontWeight:"bold"}}>💥 SBALLATO!</span>}
          {!busted && runningSum > (card.bancoTotal||0) && <span style={{color:C.green, fontSize:"11px"}}>✓ stai vincendo</span>}
        </div>
      )}

      {/* ── Trap hint ── */}
      {card.mechanic === "trap" && !finished && (
        <div style={{color:"#ff8800", fontSize:"10px", marginBottom:"4px", letterSpacing:"0.5px"}}>
          🔥 Alcune celle nascondono trappole — ogni 🔥 grattata danneggia l'unghia!
        </div>
      )}
      {/* ── Jolly hint ── */}
      {card.mechanic === "jolly" && !finished && (
        <div style={{color:"#ccaa00", fontSize:"10px", marginBottom:"4px"}}>
          ✨ C'è un JOLLY nascosto — vale qualsiasi simbolo!
        </div>
      )}
      {/* ── sum13 counter ── */}
      {card.mechanic === "sum13" && !finished && (
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:"10px",
          background:"#1a0000", border:`2px solid ${runningSum >= 12 ? "#ff4444" : runningSum >= 8 ? C.orange : "#444"}`,
          borderRadius:"0", padding:"6px 16px", marginBottom:"8px",
        }}>
          <span style={{color:C.dim, fontSize:"10px", letterSpacing:"1px"}}>SOMMA</span>
          <span style={{
            fontSize:"30px", fontWeight:"bold", lineHeight:1,
            color: busted ? C.red : runningSum >= 12 ? "#ff4444" : runningSum >= 9 ? C.orange : runningSum >= 5 ? C.gold : C.green,
            textShadow: runningSum >= 10 ? `0 0 12px currentColor` : "none",
            transition:"color 0.3s",
          }}>{runningSum}</span>
          <span style={{color:C.dim, fontSize:"16px"}}>/13</span>
          {busted && <span style={{color:C.red, fontWeight:"bold", fontSize:"13px"}}>💥 BUST!</span>}
          {runningSum === 13 && !busted && <span style={{color:C.green, fontSize:"13px"}}>🎯 TREDICI!</span>}
        </div>
      )}
      {/* ── collect accumulator ── */}
      {card.mechanic === "collect" && !finished && (
        <div style={{
          background:"#141100", border:`2px solid ${hitStop ? C.red : collected >= 200 ? C.green : "#ccaa00"}`,
          borderRadius:"0", padding:"8px 16px", marginBottom:"8px",
          display:"flex", flexDirection:"column", alignItems:"center", gap:"6px",
        }}>
          <div style={{display:"flex", alignItems:"baseline", gap:"6px"}}>
            <span style={{color:C.dim, fontSize:"10px"}}>ACCUMULATO</span>
            <span style={{
              fontSize:"26px", fontWeight:"bold",
              color: hitStop ? C.red : collected >= 200 ? C.green : collected >= 100 ? C.gold : C.bright,
              transition:"color 0.3s",
            }}>€{collected}</span>
            {collected >= 200 && !hitStop && <span style={{color:C.green, fontSize:"11px"}}>✓ obiettivo!</span>}
          </div>
          {hitStop && <div style={{color:C.red, fontWeight:"bold"}}>🛑 STOP! Perdi tutto!</div>}
          {!hitStop && !winFound && collected > 0 && (
            <Btn variant="gold" onClick={() => handleFinish(true)} style={{fontSize:"12px", padding:"5px 18px"}}>
              💰 INCASSA ORA €{collected}
            </Btn>
          )}
        </div>
      )}

      {/* Grattatore indicator — Vintage tile */}
      {equippedGrattatore && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "#001a22",
          border: `2px solid ${C.cyan}88`,
          boxShadow: `0 0 10px ${C.cyan}44, inset 0 0 12px ${C.cyan}14`,
          padding: "4px 10px", marginBottom: "6px",
        }}>
          <span style={{
            fontSize: "18px",
            textShadow: `0 0 8px ${C.cyan}`,
            filter: `drop-shadow(0 0 4px ${C.cyan}aa)`,
          }}>
            {GRATTATORE_DEFS[equippedGrattatore.id]?.emoji || "🔧"}
          </span>
          <span style={{
            display: "inline-block",
            background: C.cyan, color: "#000",
            padding: "1px 6px", fontSize: "10px", fontWeight: "bold",
            letterSpacing: "2px",
            boxShadow: `0 0 6px ${C.cyan}88`,
          }}>
            ★ GRATTATORE ★
          </span>
          <span style={{color: C.bright, fontSize: "10px", fontWeight: "bold"}}>
            {equippedGrattatore.name}
          </span>
          <span style={{
            color: C.cyan, fontSize: "10px",
            background: `${C.cyan}14`,
            border: `1px solid ${C.cyan}66`,
            padding: "1px 5px",
          }}>
            {equippedGrattatore.usesLeft} usi
          </span>
        </div>
      )}

      {/* Grid — celle-argento (nel flusso classico; col biglietto AI è in overlay) */}
      {!hasTicket && playContent}

      {/* Extra tiles */}
      {extraTiles.length > 0 && (
        <div style={{display:"flex", gap:"6px", justifyContent:"center", margin:"4px 0 8px", flexWrap:"wrap"}}>
          {extraTiles.map((tileItemId, ti) => {
            const tileDef = ITEM_DEFS[tileItemId];
            return (
              <div key={ti}
                onClick={() => onExtraTileUsed?.(tileItemId, ti)}
                style={{
                  // 52px stavano stretti al nome a 10px (prima era 7px): la
                  // tessera cresce, l'etichetta resta leggibile.
                  width:"64px", height:"64px",
                  background:"#111",
                  border:"2px solid #888",
                  borderRadius:"0",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", fontSize:"22px",
                  transition:"border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#888"; }}
                title={tileDef?.name || tileItemId}
              >
                {tileDef?.emoji || "❓"}
                <span style={{fontSize:"10px", color:C.dim, marginTop:"2px"}}>{tileDef?.name?.slice(0,8)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Status — progress bar + hint */}
      <div style={{margin: "6px auto 10px", maxWidth: "300px"}}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "10px", marginBottom: "3px", letterSpacing: "1px",
        }}>
          <span style={{color: C.dim}}>
            GRATTATE <strong style={{color: C.bright}}>{scratched}</strong>/{totalCells}
          </span>
          {!equippedGrattatore
            ? <span style={{color: C.orange}}>🖐 TRASCINA PER GRATTARE</span>
            : <span style={{color: C.cyan}}>🛡️ UNGHIA PROTETTA</span>
          }
        </div>
        <div style={{
          height: "7px", background: "#0a0a14",
          border: `1px solid ${accent}55`,
          position: "relative", overflow: "hidden",
          boxShadow: `inset 0 0 6px #00000088`,
        }}>
          <div style={{
            width: `${totalCells > 0 ? (scratched / totalCells) * 100 : 0}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${accent}77, ${accent}ee, ${accent}aa)`,
            boxShadow: `0 0 10px ${accent}99, 0 0 4px ${accent}`,
            transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "relative", overflow: "hidden",
          }}>
            {scratched > 0 && scratched < totalCells && (
              <div style={{
                position:"absolute", inset:0,
                background:"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.32) 50%, transparent 100%)",
                backgroundSize:"200% 100%",
                animation:"goldSheen 1.4s linear infinite",
              }}/>
            )}
          </div>
        </div>
      </div>

      {revealMsg && (
        <div style={{color:C.cyan, fontSize:"12px", textAlign:"center", margin:"4px 0", fontWeight:"bold",
          animation:ANIM.pulseOnce}}>{revealMsg}</div>
      )}

      {/* Consiglio unghia sanguinante — MODAL centrato che blocca interazione */}
      {!finished && !winFound && !nailAdviceDismissed && !showFirstWarning &&
        (nailState === "marcia" || scratchedWhileMarcia.current) &&
        Object.values(revealedCounts).some(v => v >= 2) && (
        <div style={{
          position:"fixed", inset:0, zIndex:9500,
          background:"rgba(0,0,0,0.82)",
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:"20px",
          backdropFilter:"blur(2px)",
        }}>
          <div style={{
            background:"#120000",
            border:`2px solid ${C.red}`,
            boxShadow:`0 0 40px ${C.red}66, inset 0 0 30px ${C.red}0a`,
            padding:"24px 20px",
            maxWidth:"360px", width:"100%",
            animation:"dialogueIn 0.2s ease-out",
          }}>
            {/* Header */}
            <div style={{
              color:C.red, fontWeight:"bold", fontSize:"15px",
              letterSpacing:"1px", marginBottom:"14px", textAlign:"center",
              textShadow:`0 0 12px ${C.red}88`,
              fontFamily:FONT,
            }}>
              🩸 Consiglio: abbandona ora!
            </div>
            {/* Corpo */}
            <div style={{
              color:C.text, fontSize:"12px", lineHeight:"1.7",
              marginBottom:"18px", textAlign:"center",
            }}>
              L'unghia <span style={{color:C.orange, fontWeight:"bold"}}>insanguinata</span> sporca la schedina:<br/>
              vinci solo il <strong style={{color:C.red}}>25%</strong> del premio.<br/>
              <br/>
              Abbandona, curati con disinfettante o cambia unghia.<br/>
              <span style={{color:C.dim, fontSize:"11px"}}>Continua solo se vuoi rischiare.</span>
            </div>
            {/* Bottoni */}
            <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
              <Btn variant="danger" onClick={() => handleFinish(false)}
                style={{fontSize:"13px", padding:"12px", width:"100%", letterSpacing:"0.5px"}}>
                ✗ Abbandona e cambia unghia
              </Btn>
              <Btn onClick={() => { onAdviceShown?.(); setNailAdviceDismissed(true); }}
                style={{fontSize:"12px", padding:"10px", width:"100%", opacity:0.75, borderColor:"#333"}}>
                ⚠️ Rischio lo stesso — continua
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Gratta tutto */}
      {!locked && !winFound && scratched < totalCells && !NO_MATCH_MECHANICS.has(card.mechanic) && (
        <div style={{marginBottom:"6px"}}>
          <Btn onClick={scratchAll} style={{fontSize:"11px", background:"#1a1a00", color:C.gold, borderColor:C.dim}}>
            ⚡ Gratta Tutto in Una Volta
          </Btn>
        </div>
      )}
      </>}

      {/* WIN FOUND - CLAIM BUTTON — Vintage */}
      {winFound && !finished && (() => {
        // Prima guardava solo "marcia": una vincita scontata per unghia
        // sanguinante (-50%) veniva mostrata come una vincita pulita, senza
        // il badge "VINCITA SPORCA" né lo strikethrough del prezzo pieno.
        // winPrize < winPrizeFull è la condizione reale (vale per qualsiasi
        // stato che scala il moltiplicatore: marcia, sanguinante, unghiaNera).
        const isDirty = !cancelled && winPrize < winPrizeFull;
        const borderCol = cancelled ? C.red : isDirty ? C.red : C.green;
        const prizeCol  = cancelled ? C.red : isDirty ? C.orange : C.green;
        const badgeLabel = cancelled ? "VINCITA ANNULLATA"
          : isDirty ? "VINCITA SPORCA"
          : "VINCITA!";
        return (
          <div ref={winBoxRef} style={{
            position: "relative",
            background: isDirty ? "#1a0000" : cancelled ? "#1a0000" : "#001a0a",
            border: `2px solid ${borderCol}`,
            padding: "12px 14px", marginBottom: "8px",
            boxShadow: `0 0 18px ${borderCol}66, inset 0 0 16px ${borderCol}18`,
            animation: ANIM.pulseActive,
            textAlign: "center",
          }}>
            {cornerBrackets(borderCol, 10, 4, false)}
            <div style={{
              display: "inline-block",
              background: borderCol, color: "#000",
              padding: "3px 10px", fontSize: "10px", fontWeight: "bold",
              letterSpacing: "3px", marginBottom: "8px",
              boxShadow: `0 0 10px ${borderCol}aa`,
            }}>
              ★ {cancelled ? "💀" : isDirty ? "🩸" : "💰"} {badgeLabel} ★
            </div>
            {isDirty && (
              <div style={{color: C.red, fontSize: "10px", marginBottom: "6px", letterSpacing: "0.5px", fontStyle: "italic"}}>
                L'unghia rovinata ha sporcato la schedina — vinci solo il {Math.round(winPrize / winPrizeFull * 100)}%
              </div>
            )}
            <div style={{color: prizeCol, fontSize:"20px", fontWeight:"bold", marginBottom:"6px",
              textShadow: cancelled ? "none" : `0 0 15px ${prizeCol}`,
              letterSpacing: "1px",
              fontFamily: FONT,
            }}>
              {(() => {
                if (cancelled) return "€0";
                if (isDirty) return <span><span style={{textDecoration:"line-through", color:C.dim, fontSize:"15px"}}>€{winPrizeFull}</span>{" → "}🩸 €{winPrize}</span>;
                const eff = equippedGrattatore?.effect;
                const base = eff === "doublePrize" ? Math.round(winPrize / 2)
                  : eff === "quadPrize" ? Math.round(winPrize / 4)
                  : eff === "x5teleport" ? Math.round(winPrize / 5)
                  : eff === "bonusChance" ? Math.round(winPrize / (1 + (equippedGrattatore.value || 0.1)))
                  : winPrize;
                const showBase = equippedGrattatore && base !== winPrize;
                const displayP = showBase ? base : winPrize;
                if (card.mechanic === "sum13") return `🎯 TREDICI ESATTO! €${displayP}`;
                if (card.mechanic === "collect") return `💰 TUTTO ACCUMULATO: €${displayP}!`;
                if (card.mechanic === "setteemezzo") return `🃏 BANCO BATTUTO! €${displayP}`;
                return `€${displayP}`;
              })()}
            </div>
            {equippedGrattatore && !cancelled && winPrize > 0 && (() => {
              const eff = equippedGrattatore.effect;
              const basePrize = eff === "doublePrize" ? Math.round(winPrize / 2)
                : eff === "quadPrize" ? Math.round(winPrize / 4)
                : eff === "x5teleport" ? Math.round(winPrize / 5)
                : eff === "bonusChance" ? Math.round(winPrize / (1 + (equippedGrattatore.value || 0.1)))
                : null;
              if (basePrize === null || basePrize === winPrize) return null;
              return (
                <div style={{color:C.cyan, fontSize:"11px", marginBottom:"6px"}}>
                  {equippedGrattatore.emoji} {equippedGrattatore.name}: €{basePrize} → €{winPrize}
                  {eff === "doublePrize" && " (x2!)"}
                  {eff === "quadPrize" && " (x4!)"}
                  {eff === "bonusChance" && ` (+${Math.round((equippedGrattatore.value || 0.1) * 100)}%)`}
                  {eff === "x5teleport" && " (x5!)"}
                </div>
              );
            })()}
            <div style={{display:"flex", justifyContent:"center", gap:"8px"}}>
              <Btn variant={isDirty ? "danger" : "gold"} onClick={() => handleFinish(true)} style={{fontSize:"14px"}}>
                {cancelled ? "Chiudi" : isDirty ? `🩸 RITIRA €${winPrize} (di €${winPrizeFull})` : card.mechanic === "collect" ? `✓ CONFERMA €${winPrize}` : `✓ RITIRA €${winPrize}`}
              </Btn>
              {!cancelled && scratched < totalCells && !locked && (
                <span style={{color:C.dim, fontSize:"11px", alignSelf:"center"}}>o continua a grattare →</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* 🩸 Promemoria persistente unghia danneggiata — resta visibile anche dopo
          la prima grattata, proprio quando compaiono i bottoni di decisione
          (prima spariva subito dopo scratched===0, nascondendo lo sconto nel
          momento in cui l'unico dato mostrato era il RITIRA/INCASSA).
          Solo "marcia" riduce il premio: sanguinante non lo tocca più. */}
      {!finished && scratched > 0
        && (nailState === "marcia" || scratchedWhileMarcia.current) && (() => {
        const warnCol = C.red;
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            color: warnCol, fontSize: "10px", fontWeight: "bold",
            background: `${warnCol}14`, border: `1px solid ${warnCol}66`,
            padding: "3px 10px", marginBottom: "8px", letterSpacing: "0.3px",
          }}>
            🩸 Premio ridotto al 25%
          </div>
        );
      })()}

      {/* NOT YET WON - abandon (o INCASSA per setteemezzo quando stai vincendo) */}
      {!winFound && !finished && !showNoWin && scratched > 0
        && !(
          !nailAdviceDismissed && !showFirstWarning
          && (nailState === "marcia" || scratchedWhileMarcia.current)
          && Object.values(revealedCounts).some(v => v >= 2)
        ) && (
        <div style={{display:"flex", justifyContent:"center", gap:"8px"}}>
          {card.mechanic === "setteemezzo" && !busted
            && scratched < totalCells
            && runningSum > (card.bancoTotal||0) && runningSum <= 7.5 ? (
            <button
              onClick={() => { AudioEngine.click(); handleFinish(true); }}
              style={{
                background: C.green,
                color: "#000",
                border: `2px solid ${C.green}`,
                padding: "10px 22px",
                fontFamily: "inherit",
                fontSize: "14px",
                fontWeight: "bold",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: `0 0 18px ${C.green}99, 0 0 36px ${C.green}44`,
                animation: ANIM.pulseActive,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 0 24px ${C.green}, 0 0 48px ${C.green}77`;
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = `0 0 18px ${C.green}99, 0 0 36px ${C.green}44`;
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              ✓ INCASSA LA VINCITA — {runningSum.toFixed(1)} vs {card.bancoTotal?.toFixed(1)}
            </button>
          ) : (
            <Btn variant="danger" onClick={() => handleFinish(false)} style={{fontSize:"11px"}}>
              ✗ Abbandona
            </Btn>
          )}
        </div>
      )}

      {/* QUASI-VINCITA */}
      {nearWin && !winFound && !finished && !showNoWin && (
        <div style={{
          marginTop:"8px", padding:"8px 12px", borderRadius:"0",
          border:`1px solid ${C.gold}88`, background:"#1a1200",
          textAlign:"center",
          animation:ANIM.pulseUrgent,
          boxShadow:`0 0 18px ${C.gold}aa, 0 0 44px ${C.gold}44, inset 0 0 12px ${C.gold}22`,
        }}>
          <span style={{color:C.gold, fontSize:"13px", fontWeight:"bold", textShadow:`0 0 6px ${C.gold}88`}}>
            ✨ QUASI VINCITA! Manca solo 1 simbolo! ✨
          </span>
        </div>
      )}

      {/* NO WIN — Vintage */}
      {showNoWin && !finished && (
        <div style={{
          position: "relative",
          marginTop: "6px", padding: "10px 14px",
          border: `2px solid ${C.red}`, background: "#1a0000",
          display: "flex", alignItems: "center", gap: "12px",
          boxShadow: `0 0 14px ${C.red}55, inset 0 0 16px ${C.red}18`,
        }}>
          {cornerBrackets(C.red, 10, 4, false)}
          <div style={{fontSize: "28px", flexShrink: 0, filter: `drop-shadow(0 0 6px ${C.red}aa)`}}>😔</div>
          <div style={{flex: 1, textAlign: "left"}}>
            <div style={{
              display: "inline-block",
              background: C.red, color: "#000",
              padding: "2px 8px", fontSize: "10px", fontWeight: "bold",
              letterSpacing: "2px", marginBottom: "4px",
              boxShadow: `0 0 8px ${C.red}aa`,
            }}>
              ★ NESSUNA VINCITA ★
            </div>
            <div style={{color: C.dim, fontSize: "10px", fontStyle: "italic"}}>
              {lossReason()}
            </div>
          </div>
          <Btn variant="default" onClick={() => handleFinish(false)}
            style={{fontSize: "11px", padding: "5px 14px", flexShrink: 0}}>
            OK →
          </Btn>
        </div>
      )}

      {/* FINISHED RESULT — Vintage hero */}
      {finished && (() => {
        const didWin = winFound && !cancelled;
        const resultCol = didWin ? C.green : C.red;
        const label = didWin ? `HAI VINTO €${winPrize}!`
          : winFound && cancelled ? "VINCITA ANNULLATA DALL'UNGHIA"
          : scratched >= totalCells ? "NIENTE… PROSSIMA VOLTA!"
          : "BIGLIETTO ABBANDONATO";
        return (
          <div style={{marginTop: "8px", textAlign: "center"}}>
            <div style={{
              display: "inline-block",
              background: resultCol, color: "#000",
              padding: "4px 14px", fontSize: "11px", fontWeight: "bold",
              letterSpacing: "3px",
              boxShadow: `0 0 14px ${resultCol}aa`,
              textShadow: "none",
            }}>
              ★ {didWin ? "🎉" : "💀"} {label} ★
            </div>
          </div>
        );
      })()}
    </div>
  );
}
