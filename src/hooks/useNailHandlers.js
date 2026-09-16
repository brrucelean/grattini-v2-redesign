import { useMemo, useCallback } from "react";
import { C } from "../data/theme.js";
import { degradeNailObj } from "../utils/nail.js";
import { hasRelic } from "../utils/hasRelic.js";
import { spendGrattatoreUse, grattatoreAtLastUse, COMBAT_ONLY_EFFECTS } from "../utils/grattatore.js";

export function useNailHandlers({ player, updatePlayer, triggerNpcComment, scratchingCard, addLog }) {
  // Reliquie: lista effetti attivi per passare ai componenti figli
  const playerRelicEffects = useMemo(() => (player?.relics || []).map(r => r.effect), [player?.relics]);
  const effectiveFortune = useMemo(() => {
    const base = player?.fortune || 0;
    return hasRelic(player, "minFortune1") ? Math.max(base, 1) : base;
  }, [player?.fortune, player?.relics]);

  const getActiveNailState = () => {
    if (!player) return "sana";
    return player.nails[player.activeNail].state;
  };

  // Called for EACH individual cell scratch
  const handleCellScratch = useCallback((isProtected) => {
    if (isProtected) return; // Grattatore protects nail

    updatePlayer(p => {
      const nails = [...p.nails];
      const active = p.activeNail;

      if (p.grattaMania) {
        // GrattaMania: each cell scratch damages 1 RANDOM alive nail (not all)
        const aliveIdxs = nails.map((n,i) => n.state !== "morta" ? i : -1).filter(i => i >= 0);
        if (aliveIdxs.length === 0) return p;
        const targetIdx = aliveIdxs[Math.floor(Math.random() * aliveIdxs.length)];
        const newNails = [...nails];
        let target = {...newNails[targetIdx]};
        target.scratchCount += 1;
        if (target.scratchCount >= 3) {
          target = degradeNailObj(target);
          target.scratchCount = 0;
        }
        newNails[targetIdx] = target;
        let newActive = active;
        if (newNails[active].state === "morta") {
          const next = newNails.findIndex((n, i) => i !== active && n.state !== "morta");
          if (next >= 0) newActive = next;
        }
        return {...p, nails: newNails, activeNail: newActive};
      }

      // Normal: each cell scratch adds 1 to active nail counter
      // Threshold scala col tier della carta: tier 1-2 = 4, tier 3 = 3, tier 4 = 2
      const cardTier = scratchingCard?.tier || 2;
      const baseDegradeThresh = cardTier >= 4 ? 2 : cardTier >= 3 ? 3 : 4;
      const degradeThresh = p.fastNailDegradeMeta ? Math.max(baseDegradeThresh - 1, 1) : baseDegradeThresh;
      let nail = {...nails[active]};
      nail.scratchCount += 1;
      if (nail.scratchCount >= degradeThresh) {
        nail = degradeNailObj(nail);
        nail.scratchCount = 0;
      }
      nails[active] = nail;
      // Piede: degrada dopo 5 grattate (non è eterno)
      if (nail.state === "piede") {
        nail.piedeUses = (nail.piedeUses || 0) + 1;
        if (nail.piedeUses >= 5) {
          nail = {...nail, state: "graffiata", piedeUses: 0};
        }
        nails[active] = nail;
      }

      let newActive = active;
      if (nail.state === "morta") {
        const next = nails.findIndex((n, i) => i !== active && n.state !== "morta");
        if (next >= 0) newActive = next;
        setTimeout(() => triggerNpcComment("nail_morta"), 200);
      } else if (nail.scratchCount === 0 && nail.state !== "sana" && nail.state !== "kawaii") {
        // appena degradata
        const cat = nail.state === "sanguinante" ? "nail_sanguinante" : "nail_graffiata";
        setTimeout(() => triggerNpcComment(cat), 200);
      }
      return {...p, nails, activeNail: newActive};
    });
  }, [updatePlayer, triggerNpcComment, scratchingCard]);

  // Danno diretto all'unghia attiva (trappole boccaDrago, bust Tredici)
  const handleNailDamage = useCallback(() => {
    updatePlayer(p => {
      const nails = [...p.nails];
      const active = p.activeNail;
      let nail = {...nails[active]};
      nail = degradeNailObj(nail);
      nail.scratchCount = 0;
      nails[active] = nail;
      let newActive = active;
      if (nail.state === "morta") {
        const next = nails.findIndex((n,i) => i !== active && n.state !== "morta");
        if (next >= 0) newActive = next;
      }
      return {...p, nails, activeNail: newActive};
    });
    addLog("💢 Unghia danneggiata direttamente!", C.red);
    triggerNpcComment("nail_sanguinante");
  }, [updatePlayer, addLog, triggerNpcComment]);

  // Consuma 1 uso del grattatore equipaggiato (grattini, fine boss-fight, e
  // CombatView quando l'effetto di un grattatore da combattimento scatta)
  const consumeGrattatore = useCallback(() => {
    const spent = grattatoreAtLastUse(player);
    if (spent) addLog(`${spent.name} consumato!`, C.dim);
    updatePlayer(spendGrattatoreUse);
  }, [player, updatePlayer, addLog]);

  const handleCombatCellScratch = useCallback(() => {
    // ── GRATTATORE EQUIPAGGIATO: gratti con l'attrezzo, non con l'unghia ──
    // L'unghia non si logora, il grattatore "normale" (Bullone/Moneta/Unghia
    // Finta/...) perde 1 uso per carta come sui grattini. Quelli da combattimento
    // e il Guanto da BOSS no: il loro uso si spende quando l'effetto scatta
    // (onGrattatoreConsumed) o a fine boss-fight, altrimenti un Coltello da 1 uso
    // sparirebbe sulla prima carta, prima ancora di colpire.
    const eq = player?.equippedGrattatore;
    if (eq && !COMBAT_ONLY_EFFECTS.has(eq.effect)) {
      const spent = grattatoreAtLastUse(player);
      if (spent) addLog(`${spent.name} consumato!`, C.dim);
    }
    updatePlayer(p => {
      if (p.equippedGrattatore) {
        return COMBAT_ONLY_EFFECTS.has(p.equippedGrattatore.effect) ? p : spendGrattatoreUse(p);
      }

      // ── Nessun grattatore: danno normale all'unghia attiva ──
      const nails = [...p.nails];
      const active = p.activeNail;
      let nail = {...nails[active]};
      nail.scratchCount += 1;
      if (nail.scratchCount >= 3) {
        nail = degradeNailObj(nail);
        nail.scratchCount = 0;
      }
      nails[active] = nail;
      let newActive = active;
      if (nail.state === "morta") {
        const next = nails.findIndex((n, i) => i !== active && n.state !== "morta");
        if (next >= 0) newActive = next;
      }
      // Il game over in combattimento lo decide un effect in scratchlite
      return {...p, nails, activeNail: newActive};
    });
  }, [player, updatePlayer, addLog]);

  return {
    playerRelicEffects,
    effectiveFortune,
    getActiveNailState,
    handleCellScratch,
    handleNailDamage,
    handleCombatCellScratch,
    consumeGrattatore,
  };
}
