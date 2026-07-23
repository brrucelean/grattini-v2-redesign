import { useMemo, useCallback } from "react";
import { C } from "../data/theme.js";
import { degradeNailObj } from "../utils/nail.js";
import { hasRelic } from "../utils/hasRelic.js";

export function useNailHandlers({ player, updatePlayer, triggerNpcComment, scratchingCard, setScreen, addLog }) {
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

  const handleCombatCellScratch = useCallback(() => {
    updatePlayer(p => {
      // ── GRATTATORE EQUIPAGGIATO: gratti con l'attrezzo, non con l'unghia ──
      // Con un grattatore equipaggiato l'unghia attiva NON si logora — MA il grattatore
      // non è infinito: si consuma come sui grattini veri.
      const eff = p.equippedGrattatore?.effect;
      if (p.equippedGrattatore) {
        // Grattatori da COMBATTIMENTO (atkBoost/widePerfect/guaranteedParry) e Guanto
        // da BOSS (bossShield): proteggono l'unghia ma NON si consumano per-cella —
        // il loro uso si spende quando l'effetto scatta (onGrattatoreConsumed in
        // CombatView) o a fine boss-fight (handleCombatEnd). Altrimenti un Coltello da
        // 1 uso sparirebbe sulla prima cella, prima ancora di colpire.
        const isPureCombatGrattatore = eff === "atkBoost" || eff === "widePerfect" || eff === "guaranteedParry";
        if (isPureCombatGrattatore || eff === "bossShield") {
          return p;
        }
        // Grattatore "normale" (Bullone/Moneta/Unghia Finta/...): protegge l'unghia e
        // consuma 1 uso per cella grattata, esattamente come sui grattini. A esaurimento
        // viene rimosso: da lì in poi l'unghia torna a logorarsi.
        const idx = p.equippedGrattatore.inventoryIdx;
        const grattatori = [...(p.grattatori || [])];
        if (grattatori[idx]) {
          const g = {...grattatori[idx]};
          g.usesLeft -= 1;
          if (g.usesLeft <= 0) {
            grattatori.splice(idx, 1);
            setTimeout(() => addLog(`${g.name} consumato!`, C.dim), 0);
            return {...p, grattatori, equippedGrattatore: null};
          }
          grattatori[idx] = g;
          return {...p, grattatori, equippedGrattatore: {...p.equippedGrattatore, usesLeft: g.usesLeft}};
        }
        return p; // indice non valido: niente logorio comunque
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
      // GAY OVER immediato se tutte le unghie finiscono durante il combattimento
      if (!nails.some(n => n.state !== "morta")) {
        setTimeout(() => setScreen("gameOver"), 600);
      }
      return {...p, nails, activeNail: newActive};
    });
  }, [updatePlayer, setScreen, addLog]);

  // Consuma esplicitamente 1 uso del grattatore da combattimento equipaggiato,
  // chiamato da CombatView SOLO quando il suo effetto scatta davvero (non ad
  // ogni carta grattata). Rimuove il grattatore se esaurisce gli usi.
  const consumeGrattatoreUse = useCallback(() => {
    updatePlayer(p => {
      if (!p.equippedGrattatore) return p;
      const idx = p.equippedGrattatore.inventoryIdx;
      const grattatori = [...(p.grattatori || [])];
      if (!grattatori[idx]) return p;
      const g = {...grattatori[idx]};
      g.usesLeft -= 1;
      if (g.usesLeft <= 0) {
        grattatori.splice(idx, 1);
        setTimeout(() => addLog(`${g.name} consumato!`, C.dim), 0);
        return {...p, grattatori, equippedGrattatore: null};
      }
      grattatori[idx] = g;
      return {...p, grattatori, equippedGrattatore: {...p.equippedGrattatore, usesLeft: g.usesLeft}};
    });
  }, [updatePlayer, addLog]);

  return {
    playerRelicEffects,
    effectiveFortune,
    getActiveNailState,
    handleCellScratch,
    handleNailDamage,
    handleCombatCellScratch,
    consumeGrattatoreUse,
  };
}
