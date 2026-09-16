import { useState, useRef, useCallback } from "react";
import { C, MAX_ITEMS } from "../data/theme.js";
import { NAIL_ORDER, NAIL_INFO } from "../data/nails.js";
import { ITEM_DEFS, GRATTATORE_DEFS, makeGrattatore } from "../data/items.js";
import { healNail, healAliveNails } from "../utils/nail.js";
import { generateCard } from "../utils/card.js";

const stateLabel = (state) => NAIL_INFO[state]?.label || state;
const HEAL_ONE_STEP = { marcia: "sanguinante", sanguinante: "graffiata", graffiata: "sana" };

// ─── OGGETTI DA APPLICARE A UN'UNGHIA ────────────────────────
// Stessa logica dallo zaino e dal grattino. Prima un Cerotto o un Siero trovati
// in un grattino e applicati subito finivano in equipItemOnNail, che conosceva
// solo la Crema: l'oggetto spariva senza curare nulla (e si portava via la
// copia uguale nello zaino, se c'era).
const NAIL_ITEMS = {
  cerotto: {
    modalDesc: "Cura un'unghia di 1 stato",
    none: "Nessuna unghia da curare col cerotto.",
    canUse: n => !!HEAL_ONE_STEP[n.state],
    apply: n => ({...n, state: HEAL_ONE_STEP[n.state], scratchCount: 0}),
    result: (i, before, after) => `Unghia ${i+1}: ${stateLabel(before.state)} → ${stateLabel(after.state)}`,
    log: i => [`🩹 Cerotto applicato su unghia ${i+1}!`, C.green],
  },
  disinfettante: {
    modalDesc: "Cura un'unghia di 2 stati",
    none: "Nessuna unghia da curare col disinfettante.",
    canUse: n => !!HEAL_ONE_STEP[n.state],
    apply: n => ({...n, state: NAIL_ORDER[Math.min(NAIL_ORDER.indexOf(n.state) + 2, NAIL_ORDER.indexOf("sana"))], scratchCount: 0}),
    result: (i, before, after) => `Unghia ${i+1}: ${stateLabel(before.state)} → ${stateLabel(after.state)}!`,
    log: i => [`💧 Disinfettante su unghia ${i+1}! Curata di 2 stati!`, C.green],
  },
  sieroRicrescita: {
    modalDesc: "Ricresce un'unghia morta → Sana",
    none: "Nessuna unghia morta da ricrescere.",
    canUse: n => n.state === "morta",
    apply: n => ({...n, state: "sana", scratchCount: 0}),
    result: i => `Unghia ${i+1}: MORTA → Sana! Rinata!`,
    log: i => [`💉 Siero Ricrescita su unghia ${i+1}! Rinasce!`, C.magenta],
  },
  cremaRinforzante: {
    modalDesc: "+3 HP bianco: assorbe 3 danni",
    none: "Nessuna unghia viva su cui applicare la crema.",
    canUse: n => n.state !== "morta",
    apply: n => ({...n, cremaHP: (n.cremaHP || 0) + 3}),
    result: i => `Unghia ${i+1}: +3 HP bianco!`,
    log: i => [`🧴 Crema Rinforzante su unghia ${i+1}! +3 HP bianco!`, C.green],
  },
  smalto: {
    modalDesc: "Protegge per 3 danni + rende KAWAII ✨",
    none: "Nessuna unghia disponibile per lo smalto!",
    canUse: n => n.state !== "morta" && !(n.smalto > 0),
    // Piede e Pollice Verde valgono più di Kawaii: prendono lo smalto e basta
    apply: n => ({...n, smalto: 3, state: healNail(n.state, "kawaii"), scratchCount: 0}),
    result: i => `Unghia ${i+1}: ✨ KAWAII ✨ + protetta 3 danni!`,
    log: i => [`💅 Smalto su unghia ${i+1}! ✨KAWAII✨ + protetta 3 danni!`, C.pink],
  },
};

// Toglie UNA copia dell'oggetto dallo zaino (per id: l'indice può essere cambiato)
const withoutOneItem = (items, itemId) => {
  const idx = items.indexOf(itemId);
  if (idx < 0) return items;
  const next = [...items];
  next.splice(idx, 1);
  return next;
};

export function useItemHandlers({ player, updatePlayer, addLog }) {
  const [itemFoundModal, setItemFoundModal] = useState(null);
  const [nailEquipModal, setNailEquipModal] = useState(null);
  const nailEquipCallbackRef = useRef(null);
  const [nailEquipResult, setNailEquipResult] = useState(null);
  const [smokeChoiceModal, setSmokeChoiceModal] = useState(null);
  const [showSmokeEffect, setShowSmokeEffect] = useState(false);
  const [showInventoryPanel, setShowInventoryPanel] = useState(false);
  const [stampOverlay, setStampOverlay] = useState(null);

  const showItemFound = (emoji, name, desc, subtitle) => {
    setItemFoundModal({ emoji, name, desc, subtitle });
  };

  // Apre la scelta dell'unghia. fromZaino: l'oggetto va tolto dallo zaino quando
  // lo si applica; altrimenti (trovato in un grattino) si può anche conservarlo.
  const openNailPicker = (itemId, fromZaino) => {
    const def = NAIL_ITEMS[itemId];
    const item = ITEM_DEFS[itemId];
    nailEquipCallbackRef.current = {
      nailFilter: def.canUse,
      resultText: (i, n) => def.result(i, n, def.apply(n)),
      onNailSelect: (nailIdx) => {
        updatePlayer(p => {
          const nails = [...p.nails];
          nails[nailIdx] = def.apply(nails[nailIdx]);
          return {...p, nails, items: fromZaino ? withoutOneItem(p.items, itemId) : p.items};
        });
        addLog(...def.log(nailIdx));
      },
    };
    setNailEquipModal({ itemId, emoji: item.emoji, name: item.name, desc: def.modalDesc, fromZaino });
  };

  // Oggetto trovato dentro un grattino
  const handleCardItemFound = (itemId) => {
    const grDef = GRATTATORE_DEFS[itemId];
    const itemDef = ITEM_DEFS[itemId];
    if (grDef) {
      // Grattatori → inventario grattatori
      updatePlayer(p => ({...p, grattatori: [...(p.grattatori||[]), makeGrattatore(itemId)]}));
      setItemFoundModal({ emoji: grDef.emoji, name: grDef.name, desc: grDef.desc, subtitle: "TROVATO NEL GRATTINO!" });
    } else if (NAIL_ITEMS[itemId]) {
      // Oggetti per-unghia → scelta dell'unghia (o zaino)
      openNailPicker(itemId, false);
    } else if (itemDef) {
      // Oggetti globali (cappello, sigarette, etc.) → zaino
      updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, itemId]}));
      setItemFoundModal({ emoji: itemDef.emoji, name: itemDef.name, desc: itemDef.desc, subtitle: "TROVATO NEL GRATTINO!" });
    }
  };

  const handleSmoke = useCallback((itemType) => {
    const isCanna = itemType === "sigarettaErba";
    const fortBonus = isCanna ? 2 : 1;
    const fortTurns = 4; // Beta 5 rebalance: sigaretta 3->4 turni
    // Sprint 2: ticks risk/reward — sigaretta rapida e rischiosa, erba lenta ma benefica
    const tickCount = isCanna ? 4 : 3; // Beta 5 rebalance: sigaretta 2->3 grattate prima del malus
    setSmokeChoiceModal(null);
    setShowSmokeEffect(true);
    setTimeout(() => setShowSmokeEffect(false), 2500);
    updatePlayer(p => {
      const newSmokes = (p.smokesTotal || 0) + 1;
      const getTumore = !p.tumore && newSmokes >= 5;
      // La canna cura l'unghia attiva (senza declassarla)
      const nails = isCanna ? p.nails.map((n, i) =>
        i === p.activeNail && n.state !== "morta" ? {...n, state: healNail(n.state, "sana"), scratchCount: 0} : n
      ) : p.nails;
      return {
        ...p, nails,
        fortune: getTumore ? (p.fortune - 5) : (p.fortune + fortBonus),
        fortuneTurns: getTumore ? 9999 : Math.max(p.fortuneTurns, fortTurns),
        smokesTotal: newSmokes,
        tumore: getTumore || p.tumore,
        // Accumula ticks — se ne fumi un'altra dello stesso tipo, si somma
        sigarettaTicks: isCanna ? (p.sigarettaTicks || 0) : (p.sigarettaTicks || 0) + tickCount,
        erbaTicks:      isCanna ? (p.erbaTicks || 0) + tickCount : (p.erbaTicks || 0),
      };
    });
    addLog(isCanna
      ? `🌿 Tiri una canna... +${fortBonus} Fortuna per ${fortTurns} turni. Tra ${tickCount} grattate: 🌿 POLLICE VERDE.`
      : `🚬 Una fumata veloce. +${fortBonus} Fortuna per ${fortTurns} turni. Tra ${tickCount} grattate: 🖤 UNGHIA NERA.`,
      C.green);
  }, [updatePlayer, addLog]);

  const handleSaveSmoke = useCallback((itemType) => {
    setSmokeChoiceModal(null);
    updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, itemType]}));
    addLog(itemType === "sigarettaErba" ? "🌿 Canna conservata nello zaino." : "🚬 Sigaretta conservata nello zaino.", C.dim);
  }, [updatePlayer, addLog]);

  const handleUseItem = (itemIdx) => {
    const itemId = player.items[itemIdx];
    const item = ITEM_DEFS[itemId];
    if (!item) return;
    let used = false;

    if (NAIL_ITEMS[itemId]) {
      if (player.nails.some(NAIL_ITEMS[itemId].canUse)) openNailPicker(itemId, true);
      else addLog(NAIL_ITEMS[itemId].none, C.dim);
      return;
    }

    switch (itemId) {
      case "sigaretta":
      case "sigarettaErba": {
        setSmokeChoiceModal({ itemType: itemId });
        used = true;
        break;
      }
      case "cappelloSbirro": {
        const nowWorn = !player.cappelloSbirroWorn;
        updatePlayer(p => ({...p, cappelloSbirroWorn: nowWorn}));
        addLog(
          nowWorn
            ? "🎩 Cappello Sbirro INDOSSATO! Funziona 1 volta col poliziotto, poi si consuma!"
            : "🎩 Cappello Sbirro TOLTO. Sei di nuovo un civile qualunque.",
          nowWorn ? C.gold : C.dim
        );
        break;
      }
      case "clipVirale": {
        if (player.clipViraleActive) {
          addLog("🎬 Clip Virale già attiva!", C.dim);
        } else {
          updatePlayer(p => ({...p, clipViraleActive: true}));
          used = true;
          addLog("🎬 CLIP VIRALE ATTIVATA! La prossima vincita sarà RIPRESA e x2!", C.gold);
          setStampOverlay({ text:"● R E C", color:C.red });
          setTimeout(() => setStampOverlay(null), 1500);
        }
        break;
      }
      case "timbroVincente": {
        if (player.scratchCards.length === 0) {
          addLog("🏆 Non hai grattini da timbrare!", C.dim);
        } else {
          // Rigenerate come vincenti: cambiare solo isWinner/prize lasciava le
          // celle perdenti, e la vista paga solo le combinazioni che si vedono.
          updatePlayer(p => ({
            ...p,
            scratchCards: p.scratchCards.map(c => {
              const won = generateCard(c.id, 0, 0, true);
              const prize = Math.max(won.prize || 10, c.maxPrize || 50);
              return {
                ...won, name: c.name, owned: c.owned, prize,
                ...(won.doppioStake !== undefined && { doppioStake: prize }),
              };
            }),
          }));
          used = true;
          addLog(`🏆 TIMBRO VINCENTE! Tutti i ${player.scratchCards.length} grattini sono ora VINCENTI!`, C.gold);
          setStampOverlay({ text:"🏆 W I N 🏆", color:C.gold });
          setTimeout(() => setStampOverlay(null), 2500);
        }
        break;
      }
      case "manoProtesica": {
        // Tutte le vive almeno Sane (Kawaii/Piede/Pollice Verde restano)
        updatePlayer(p => ({...p, nails: healAliveNails(p.nails)}));
        used = true;
        addLog("🦾 Mano Protesica applicata! TUTTE le unghie vive tornano Sane!", C.green);
        break;
      }
      case "tesseraVIP": {
        updatePlayer(p => ({...p, hasVIP: true}));
        used = true;
        addLog("🎫 Tessera VIP attivata! Nuove zone segrete disponibili nei tabacchini!", C.gold);
        break;
      }
      // Sprint 5: Giornaletto porno — fortune boost + tracking per Poliziotto
      case "giornalettoPorno": {
        updatePlayer(p => ({
          ...p,
          fortune: (p.fortune || 0) + 3,
          fortuneTurns: Math.max(p.fortuneTurns || 0, 6),
          giornalettoRead: true, // flag persiste fino a prossimo Poliziotto
          giornalettoTicks: 6,
        }));
        used = true;
        const quotes = [
          "📖 Sfogli il giornaletto. +3 Fortuna — e qualche palpitazione.",
          "📖 Pagina centrale pieghevole... +3 Fortuna per 6 grattate!",
          "📖 \"Lettere dai lettori\" — roba forte. Fortuna sale.",
          "📖 Ti nascondi dietro un chiosco... +3 Fortuna.",
        ];
        addLog(quotes[Math.floor(Math.random() * quotes.length)], C.magenta);
        setStampOverlay({ text:"📖 ... 💭 ...", color: C.magenta });
        setTimeout(() => setStampOverlay(null), 1800);
        break;
      }
      default:
        addLog(`${item.name} non può essere usato ora.`, C.dim);
    }

    if (used) {
      updatePlayer(p => ({...p, items: withoutOneItem(p.items, itemId)}));
    }
  };

  return {
    itemFoundModal, setItemFoundModal,
    nailEquipModal, setNailEquipModal,
    nailEquipCallbackRef,
    nailEquipResult, setNailEquipResult,
    smokeChoiceModal, setSmokeChoiceModal,
    showSmokeEffect,
    showInventoryPanel, setShowInventoryPanel,
    stampOverlay,
    showItemFound,
    handleCardItemFound,
    handleSmoke,
    handleSaveSmoke,
    handleUseItem,
  };
}
