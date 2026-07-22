import { useState, useRef, useCallback } from "react";
import { C, MAX_ITEMS } from "../data/theme.js";
import { NAIL_ORDER, NAIL_INFO } from "../data/nails.js";
import { ITEM_DEFS, MACELLAIO_IMPLANTS, GRATTATORE_DEFS } from "../data/items.js";
import { degradeNailObj } from "../utils/nail.js";

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

  // Applica item su una nail specifica (item consumato, lascia effetto permanente)
  const equipItemOnNail = useCallback((itemId, nailIdx) => {
    const itemDef = ITEM_DEFS[itemId];
    const implDef = MACELLAIO_IMPLANTS.find(im => im.id === itemId);
    const def = itemDef || implDef;
    const boost = def?.statBoost || {};
    updatePlayer(p => {
      const nails = [...p.nails];
      const nail = {...nails[nailIdx]};
      // Crema: aggiunge HP bianco extra
      if (def?.cremaEquip) {
        nail.cremaHP = (nail.cremaHP || 0) + 3;
      } else {
        // Boost stat permanente (altri item nailEquip)
        nail.stats = {
          fortuna: (nail.stats?.fortuna || 0) + (boost.fortuna || 0),
          potenza: (nail.stats?.potenza || 0) + (boost.potenza || 0),
          resilienza: (nail.stats?.resilienza || 0) + (boost.resilienza || 0),
        };
      }
      nails[nailIdx] = nail;
      let items = [...p.items];
      // Consuma oggetto dallo zaino
      const removeIdx = items.indexOf(itemId);
      if (removeIdx >= 0) items.splice(removeIdx, 1);
      return {...p, nails, items};
    });
    addLog(`✨ ${def?.emoji||"📎"} ${def?.name||itemId} usato su unghia ${nailIdx+1}!`, C.magenta);
  }, [updatePlayer, addLog]);

  // Oggetto trovato dentro un grattino
  const handleCardItemFound = useCallback((itemId) => {
    const grDef = GRATTATORE_DEFS[itemId];
    const itemDef = ITEM_DEFS[itemId];
    const def = grDef || itemDef;
    if (!def) return;
    if (grDef) {
      // Grattatori → inventario grattatori
      updatePlayer(p => ({...p, grattatori: [...(p.grattatori||[]), { id:itemId, ...grDef, usesLeft:grDef.maxUses||1 }]}));
      setItemFoundModal({ emoji: def.emoji, name: def.name, desc: def.desc, subtitle: "TROVATO NEL GRATTINO!" });
    } else if (itemDef?.extraTile) {
      // Tile extra (es. monetaCinese) → appare come cella extra nel grattino corrente
      updatePlayer(p => ({...p, extraTiles: [...(p.extraTiles||[]), itemId]}));
      setItemFoundModal({ emoji: def.emoji, name: def.name, desc: def.desc, subtitle: "TILE EXTRA NEL GRATTINO!" });
    } else if (itemDef?.global) {
      // Oggetti globali (cappello, sigarette, etc.) → zaino
      updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, itemId]}));
      setItemFoundModal({ emoji: def.emoji, name: def.name, desc: def.desc, subtitle: "TROVATO NEL GRATTINO!" });
    } else {
      // Oggetti per-unghia (nailEquip) → modale selezione unghia
      setNailEquipModal({ itemId, emoji: def.emoji, name: def.name, desc: def.desc });
    }
  }, [updatePlayer]);

  const handleSmoke = useCallback((itemType) => {
    const isCanna = itemType === "sigarettaErba";
    const fortBonus = isCanna ? 2 : 1;
    const fortTurns = isCanna ? 4 : 4; // Beta 5 rebalance: sigaretta 3->4 turni
    // Sprint 2: ticks risk/reward — sigaretta rapida e rischiosa, erba lenta ma benefica
    const tickCount = isCanna ? 4 : 3; // Beta 5 rebalance: sigaretta 2->3 grattate prima del malus
    setSmokeChoiceModal(null);
    setShowSmokeEffect(true);
    setTimeout(() => setShowSmokeEffect(false), 2500);
    updatePlayer(p => {
      const newSmokes = (p.smokesTotal || 0) + 1;
      const getTumore = !p.tumore && newSmokes >= 5;
      // Cura unghia attiva se è la canna
      const nails = isCanna ? p.nails.map((n, i) =>
        i === p.activeNail && n.state !== "morta" ? {...n, state: "sana", scratchCount: 0} : n
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

  const useItem = (itemIdx) => {
    const itemId = player.items[itemIdx];
    const item = ITEM_DEFS[itemId];
    if (!item) return;
    let used = false;

    switch (itemId) {
      case "cerotto": {
        // Selezione unghia: cura 1 stato (marcia→sanguinante, sanguinante→graffiata, graffiata→sana)
        const healable = player.nails.some(n => ["marcia","sanguinante","graffiata"].includes(n.state));
        if (!healable) { addLog("Nessuna unghia da curare col cerotto.", C.dim); break; }
        nailEquipCallbackRef.current = {
          nailFilter: n => ["marcia","sanguinante","graffiata"].includes(n.state),
          resultText: (i, n) => { const cur = n.state; const next = cur === "marcia" ? "Sanguinante" : cur === "sanguinante" ? "Graffiata" : "Sana"; return `Unghia ${i+1}: ${NAIL_INFO[cur]?.label} → ${next}`; },
          onNailSelect: (nailIdx) => {
            updatePlayer(p => {
              const nails = [...p.nails]; const cur = nails[nailIdx].state;
              const next = cur === "marcia" ? "sanguinante" : cur === "sanguinante" ? "graffiata" : "sana";
              nails[nailIdx] = {...nails[nailIdx], state: next, scratchCount: 0};
              const items = [...p.items]; items.splice(itemIdx, 1);
              return {...p, nails, items};
            });
            addLog(`🩹 Cerotto applicato su unghia ${nailIdx+1}!`, C.green);
          }
        };
        setNailEquipModal({ itemId: "cerotto", emoji: "🩹", name: "Cerotto", desc: "Cura un'unghia di 1 stato", fromZaino: true });
        break;
      }
      case "disinfettante": {
        const healable2 = player.nails.some(n => ["graffiata","sanguinante","marcia"].includes(n.state));
        if (!healable2) { addLog("Nessuna unghia da curare col disinfettante.", C.dim); break; }
        nailEquipCallbackRef.current = {
          nailFilter: n => ["graffiata","sanguinante","marcia"].includes(n.state),
          resultText: (i, n) => {
            const cur = n.state; const idx = NAIL_ORDER.indexOf(cur);
            const next = NAIL_ORDER[Math.min(idx + 2, NAIL_ORDER.indexOf("sana"))];
            return `Unghia ${i+1}: ${NAIL_INFO[cur]?.label} → ${NAIL_INFO[next]?.label}!`;
          },
          onNailSelect: (nailIdx) => {
            updatePlayer(p => {
              const nails = [...p.nails];
              const cur = nails[nailIdx].state;
              const idx = NAIL_ORDER.indexOf(cur);
              const next = NAIL_ORDER[Math.min(idx + 2, NAIL_ORDER.indexOf("sana"))];
              nails[nailIdx] = {...nails[nailIdx], state: next, scratchCount: 0};
              const items = [...p.items]; items.splice(itemIdx, 1);
              return {...p, nails, items};
            });
            addLog(`💧 Disinfettante su unghia ${nailIdx+1}! Curata di 2 stati!`, C.green);
          }
        };
        setNailEquipModal({ itemId: "disinfettante", emoji: "💧", name: "Disinfettante", desc: "Cura un'unghia grave → Sana", fromZaino: true });
        break;
      }
      case "sigaretta": {
        setSmokeChoiceModal({ itemType: "sigaretta" });
        used = true;
        break;
      }
      case "sigarettaErba": {
        setSmokeChoiceModal({ itemType: "sigarettaErba" });
        used = true;
        break;
      }
      case "sieroRicrescita": {
        const hasDead = player.nails.some(n => n.state === "morta");
        if (!hasDead) { addLog("Nessuna unghia morta da ricrescere.", C.dim); break; }
        nailEquipCallbackRef.current = {
          nailFilter: n => n.state === "morta",
          resultText: (i) => `Unghia ${i+1}: MORTA → Sana! Rinata!`,
          onNailSelect: (nailIdx) => {
            updatePlayer(p => {
              const nails = [...p.nails];
              nails[nailIdx] = {...nails[nailIdx], state: "sana", scratchCount: 0};
              const items = [...p.items]; items.splice(itemIdx, 1);
              return {...p, nails, items};
            });
            addLog(`💉 Siero Ricrescita su unghia ${nailIdx+1}! Rinasce!`, C.magenta);
          }
        };
        setNailEquipModal({ itemId: "sieroRicrescita", emoji: "💉", name: "Siero Ricrescita", desc: "Ricresce un'unghia morta → Sana", fromZaino: true });
        break;
      }
      case "cremaRinforzante": {
        const hasAlive2 = player.nails.some(n => n.state !== "morta");
        if (!hasAlive2) { addLog("Nessuna unghia viva su cui applicare la crema.", C.dim); break; }
        nailEquipCallbackRef.current = {
          nailFilter: n => n.state !== "morta",
          resultText: (i) => `Unghia ${i+1}: +3 HP bianco!`,
          onNailSelect: (nailIdx) => {
            updatePlayer(p => {
              const nails = [...p.nails];
              nails[nailIdx] = {...nails[nailIdx], cremaHP: (nails[nailIdx].cremaHP || 0) + 3};
              const items = [...p.items]; items.splice(itemIdx, 1);
              return {...p, nails, items};
            });
            addLog(`🧴 Crema Rinforzante su unghia ${nailIdx+1}! +3 HP bianco!`, C.green);
          }
        };
        setNailEquipModal({ itemId: "cremaRinforzante", emoji: "🧴", name: "Crema Rinforzante", desc: "+1 HP bianco extra (assorbe 1 danno)", fromZaino: true });
        break;
      }
      case "cappelloSbirro": {
        const nowWorn = !player.cappelloSbirroWorn;
        updatePlayer(p => ({...p, cappelloSbirroWorn: nowWorn}));
        used = false;
        addLog(
          nowWorn
            ? "🎩 Cappello Sbirro INDOSSATO! Funziona 1 volta col poliziotto, poi si consuma!"
            : "🎩 Cappello Sbirro TOLTO. Sei di nuovo un civile qualunque.",
          nowWorn ? C.gold : C.dim
        );
        break;
      }
      case "smalto": {
        const canSmalto = player.nails.some(n => n.state !== "morta" && !(n.smalto > 0));
        if (!canSmalto) { addLog("Nessuna unghia disponibile per lo smalto!", C.dim); break; }
        nailEquipCallbackRef.current = {
          nailFilter: n => n.state !== "morta" && !(n.smalto > 0),
          resultText: (i) => `Unghia ${i+1}: ✨ KAWAII ✨ + protetta 3 danni!`,
          onNailSelect: (nailIdx) => {
            updatePlayer(p => {
              const nails = [...p.nails];
              nails[nailIdx] = {...nails[nailIdx], smalto: 3, state: "kawaii", scratchCount: 0};
              const items = [...p.items]; items.splice(itemIdx, 1);
              return {...p, nails, items};
            });
            addLog(`💅 Smalto su unghia ${nailIdx+1}! ✨KAWAII✨ + protetta 3 danni!`, C.pink);
          }
        };
        setNailEquipModal({ itemId: "smalto", emoji: "💅", name: "Smalto", desc: "Protegge per 3 danni + rende KAWAII ✨", fromZaino: true });
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
          updatePlayer(p => ({
            ...p,
            scratchCards: p.scratchCards.map(c => ({...c, isWinner: true, prize: Math.max(c.prize || 10, c.maxPrize || 50)})),
          }));
          used = true;
          addLog(`🏆 TIMBRO VINCENTE! Tutti i ${player.scratchCards.length} grattini sono ora VINCENTI!`, C.gold);
          setStampOverlay({ text:"🏆 W I N 🏆", color:C.gold });
          setTimeout(() => setStampOverlay(null), 2500);
        }
        break;
      }
      case "manoProtesica": {
        updatePlayer(p => ({
          ...p,
          nails: p.nails.map(n => n.state !== "morta" ? {...n, state: "sana", scratchCount: 0} : n),
        }));
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
      updatePlayer(p => {
        const items = [...p.items];
        items.splice(itemIdx, 1);
        return {...p, items};
      });
    }
  };

  return {
    itemFoundModal, setItemFoundModal,
    nailEquipModal, setNailEquipModal,
    nailEquipCallbackRef,
    nailEquipResult, setNailEquipResult,
    smokeChoiceModal, setSmokeChoiceModal,
    showSmokeEffect, setShowSmokeEffect,
    showInventoryPanel, setShowInventoryPanel,
    stampOverlay, setStampOverlay,
    showItemFound,
    equipItemOnNail,
    handleCardItemFound,
    handleSmoke,
    handleSaveSmoke,
    useItem,
  };
}
