import { useState, useCallback } from "react";
import { C } from "../data/theme.js";
import { NAIL_ORDER } from "../data/nails.js";
import { NODE_ICONS } from "../data/map.js";
import { ITEM_DEFS, RELIC_DEFS, GRATTATORE_DEFS, MACELLAIO_IMPLANTS } from "../data/items.js";
import { BIOMES, BIOME_MODIFIERS } from "../data/biomes.js";
import { CARD_TYPES, CARD_BALANCE } from "../data/cards.js";
import { degradeNailObj, healNail } from "../utils/nail.js";
import { rng, roll, pick } from "../utils/random.js";
import { generateCard } from "../utils/card.js";
import { generateMap, generateLabirintoGrid, generateCombinaState, generateTesoroState } from "../utils/map.js";
import { AudioEngine } from "../audio.js";
import { STORAGE_KEYS, setStored } from "../utils/storage.js";

export function useNodeHandlers({
  player, currentNode, currentBiome, currentRow,
  updatePlayer, addLog, triggerNpcComment, unlockAchievement, updateAllTimeStats,
  consumeGrattatore, handleNailDamage, showItemFound,
  setScreen, setCurrentNode, setVisitedNodes, setCurrentRow, setPreScratchCount,
  setGameStats, setCardSelectMode, setReturnScreen, setScratchingCard, setSelectedCardIdx,
  setCombatEnemy, setCurrentBiome, setMap, setPlayer,
  setItemFoundModal, setDiscoveredRelics,
  setLabirintoState, setCombinaState, setTesoroState, setSpecialCardRef,
  effectiveFortune, gameStats, isAlive,
}) {
  const [dreamModal, setDreamModal] = useState(null);

  const selectNode = (node, rowIdx) => {
    setCurrentNode(node);
    setVisitedNodes(v => [...v, node.id]);
    setCurrentRow(rowIdx + 1);
    setPreScratchCount(0);
    setGameStats(s => ({...s, nodesVisited: s.nodesVisited + 1}));

    // Fortune decay
    updatePlayer(p => {
      let fort = p.fortune;
      let fTurns = p.fortuneTurns;
      if (fTurns > 0) {
        fTurns--;
        if (fTurns <= 0) { fort = 0; addLog("L'effetto fortuna è svanito.", C.dim); }
      }
      // GrattaMania decay
      let gm = p.grattaMania;
      let gmT = p.grattaManiaTurns;
      if (gm) {
        gmT++;
        if (gmT > 3) { gm = false; gmT = 0; addLog("GrattaMania finita.", C.green); }
      }
      return {...p, fortune: fort, fortuneTurns: fTurns, grattaMania: gm, grattaManiaTurns: gmT};
    });

    // Start nodes just advance to the next row
    if (node.type === "start") {
      addLog("Inizi il tuo cammino...", C.cyan);
      setScreen("map");
      return;
    }

    // Cappello Sbirro attira ladri/spacciatori: 30% chance di intercettazione
    // Plettro (silent) annulla l'intercettazione
    if (player.cappelloSbirroWorn && !player.equippedGrattatore?.silent && !["ladro","spacciatore","poliziotto","boss","miniboss"].includes(node.type) && roll(0.3)) {
      const interceptor = roll(0.5) ? "ladro" : "spacciatore";
      addLog(`🎩 Il cappello sbirro attira attenzione! ${interceptor === "ladro" ? "Un ladro" : "Uno spacciatore"} ti intercetta!`, C.red);
      node._originalType = node._originalType || node.type;
      node.type = interceptor;
    }
    if (player.cappelloSbirroWorn && player.equippedGrattatore?.silent && !["ladro","spacciatore","poliziotto","boss","miniboss"].includes(node.type) && roll(0.3)) {
      addLog("🎸 Il Plettro ti rende silenzioso — il ladro non ti ha visto!", C.cyan);
    }

    setScreen("preScratch");
    addLog(`Vai verso: ${NODE_ICONS[node.type] || ""} ${node.type}${node.elite ? " ★ELITE" : ""}`, node.elite ? C.orange : C.cyan);
  };

  const enterNode = () => {
    if (!currentNode) return;
    const type = currentNode.type;

    if (type === "tabaccaio") setScreen("shop");
    else if (type === "locanda") setScreen("locanda");
    else if (type === "boss") {
      const bossName = currentNode.bossName || "Il Broker";
      const BOSS_ENTRY = {
        "Il Broker":             { min: 200, quote: `"€${player.money}? Non sei nemmeno degno del mio tempo. Torna quando hai qualcosa da perdere — minimo €200. Arrivederci."` },
        "Il Romanaccio":         { min: 300, quote: `"Aho, co' meno de €300 manco te risponno, bello. E nun me fa' arrabbià che chiamo er taxi."` },
        "Il Napoletano":         { min: 500, quote: `"Guagliò, cu' meno 'e €500 nun te parlo manco pe' sbaglio. Torna quanno tieni 'o ccapo."` },
        "Il Drago d'Oro":        { min: 700, quote: `"🐲 龙不见穷人. Il Drago non riceve i poveri. Porta almeno €700 o brucerai prima di entrare."` },
      };
      const entry = BOSS_ENTRY[bossName];
      if (entry && player.money < entry.min) {
        addLog(`👑 ${bossName}: ${entry.quote}`, C.red);
        addLog(`❌ Rispedito all'inizio — ti serve almeno €${entry.min}.`, C.orange);
        unlockAchievement("broke");
        const shortfall = entry.min - player.money;
        // Modal esplicativo — prima di sbattere il giocatore a inizio mappa
        if (setItemFoundModal) {
          setItemFoundModal({
            emoji: "🚫",
            name: `${bossName} ti caccia via`,
            desc:
              `${entry.quote}\n\n` +
              `💰 Avevi: €${player.money}\n` +
              `🎯 Soglia minima: €${entry.min}\n` +
              `📉 Ti mancavano: €${shortfall}\n\n` +
              `Sei stato RISPEDITO all'inizio della mappa.\n` +
              `Riparti dalla riga 1 — grattini, mappa e nodi visitati azzerati.\n\n` +
              `Prossima volta porta più soldi.`,
            subtitle: "ACCESSO NEGATO",
            buttonLabel: "Torno più forte →",
          });
        }
        setCurrentRow(0);
        setVisitedNodes([]);
        setCurrentNode(null);
        setScreen("map");
        return;
      }
      // bossDebt (cedola Prestito del Broker): penale al Bioma 0 boss
      if (player.bossDebt && currentBiome === 0) {
        const debt = player.bossDebt;
        updatePlayer(p => ({...p, money: Math.max(0, p.money - debt), bossDebt: 0}));
        addLog(`🤝 Il Broker riscuote: -€${debt} di debito!`, C.red);
      }
      // Riscossione prestito Broker
      if (player.brokerLoan) {
        const loan = player.brokerLoan;
        if (player.money >= loan) {
          updatePlayer(p => ({...p, money: p.money - loan, brokerLoan: 0}));
          addLog(`🤝 Il Broker riscuote il prestito: -€${loan}!`, C.red);
        } else {
          // Non hai abbastanza — ti prende un'unghia
          updatePlayer(p => {
            const nails = [...p.nails];
            const alive = nails.findIndex(n => n.state !== "morta");
            if (alive >= 0) nails[alive] = {...nails[alive], state: "morta"};
            return {...p, money: 0, brokerLoan: 0, nails};
          });
          addLog(`🤝 Il Broker: "Non hai i soldi? Mi prendo un'UNGHIA." 💀`, C.red);
        }
      }
      AudioEngine.bossEntrance();
      setCombatEnemy({ name: bossName, isBoss: true });
      setScreen("combat");
    }
    else if (type === "miniboss") setScreen("event");
    else if (type === "stregone") setScreen("event");
    else setScreen("event");
  };

  // ─── PRE-SCRATCH (gratta prima del nodo) ───────────────────
  const handlePreScratch = () => {
    if (player.scratchCards.length === 0) {
      addLog("Non hai biglietti da grattare!", C.red);
      return;
    }
    setCardSelectMode(true);
    setReturnScreen("preScratch");
    setScreen("selectCard");
  };

  const handleSelectCard = (idx) => {
    let card = player.scratchCards[idx];
    // ── SPRINT 3: alcune carte richiedono un grattatore per essere grattate ──
    // (es. Jackpot Mix — cartone premium, ci vuole l'attrezzo)
    if (card?.requiresGrattatore && !player.equippedGrattatore) {
      addLog(`🔧 ${card.name} richiede un GRATTATORE equipaggiato. Le tue unghie non bastano!`, C.red);
      return;
    }
    setSelectedCardIdx(idx);
    // Impianti a vincita garantita (Anziana: sacra | Macellaio: neonato/marcione/baddie)
    // Se attivi, rigenera la carta come vincente — il moltiplicatore del premio verrà
    // applicato in ScratchCardView.calcPrize (vedi implantMult).
    const activeNail = player.nails[player.activeNail];
    const guaranteedImplants = ["sacra", "neonato", "marcione", "baddie"];
    if (activeNail && guaranteedImplants.includes(activeNail.implant) && (activeNail.implantUses || 0) > 0 && !card.isWinner) {
      const rebuilt = { ...generateCard(card.id, effectiveFortune, 0, true), owned: card.owned };
      updatePlayer(p => {
        const nc = [...p.scratchCards]; nc[idx] = rebuilt; return { ...p, scratchCards: nc };
      });
      card = rebuilt;
      addLog(`${activeNail.implant === "sacra" ? "✨" : "🔮"} L'impianto garantisce la vincita su questa grattata!`, C.gold);
    }
    setScratchingCard(card);
    setPreScratchCount(c => c + 1);
    // returnScreen è già stato impostato dal chiamante (handlePreScratch → "preScratch",
    // handleShopScratch → "shop"). Non sovrascriverlo qui.

    // Route special mechanic cards to dedicated screens
    if (card.mechanic === "labirinto") {
      setSpecialCardRef(card);
      // Remove from hand immediately
      updatePlayer(p => {
        const nc = [...p.scratchCards]; nc.splice(idx, 1); return {...p, scratchCards: nc};
      });
      // Generate 4x4 grid
      const grid = generateLabirintoGrid();
      setLabirintoState({ pos: [0, 0], revealed: new Set(), prize: 0, grid, done: false });
      setScreen("labirinto");
    } else if (card.mechanic === "combina") {
      setSpecialCardRef(card);
      updatePlayer(p => {
        const nc = [...p.scratchCards]; nc.splice(idx, 1); return {...p, scratchCards: nc};
      });
      const cs = generateCombinaState();
      setCombinaState(cs);
      setScreen("grattaCombina");
    } else if (card.mechanic === "tesoro") {
      setSpecialCardRef(card);
      updatePlayer(p => {
        const nc = [...p.scratchCards]; nc.splice(idx, 1); return {...p, scratchCards: nc};
      });
      const ts = generateTesoroState();
      setTesoroState(ts);
      setScreen("mappaTesor0");
    } else {
      setScreen("scratch");
    }
  };

  const handleRest = (room) => {
    if (player.money < room.cost) return;
    // Floor option: half-heal nails, 50% thief fight
    if (room.isFloor) {
      updatePlayer(p => {
        const nails = p.nails.map(n => {
          if (n.state === "morta") return n; // dead stays dead on floor
          const idx = NAIL_ORDER.indexOf(n.state);
          if (idx < 0) return n;
          // Move halfway toward "sana" (index 4)
          const sanaIdx = NAIL_ORDER.indexOf("sana");
          const steps = Math.max(1, Math.floor((sanaIdx - idx) / 2));
          const newIdx = Math.min(idx + steps, sanaIdx);
          return {...n, state: NAIL_ORDER[newIdx], scratchCount: Math.floor(n.scratchCount / 2)};
        });
        return {...p, nails, grattaMania: false, grattaManiaTurns: 0};
      });
      addLog("Dormi per terra come un barbone. Le unghie recuperano... un po'.", C.dim);
      if (roll(0.5)) {
        addLog("Un ladro ti sveglia con un calcio! Preparati a combattere!", C.red);
        const thief = { name:"Ladro Notturno", hp:3, maxHp:3, type:"Ladro", money:0 };
        setCombatEnemy(thief);
        setScreen("combat");
      } else {
        addLog("Nessuno ti ha disturbato. Miracolo.", C.green);
        setScreen("map");
      }
      return;
    }
    updatePlayer(p => {
      const nails = [...p.nails];
      // Suite: heal ALL nails (including dead) first, then kawaii
      if (room.kawaii) {
        nails.forEach((n, i) => {
          nails[i] = {...n, state: "kawaii", scratchCount: 0};
        });
      } else {
        // Non-suite: heal damaged nails first (priority: damaged > dead)
        let healed = 0;
        // First pass: heal damaged non-dead nails
        for (let i = 0; i < nails.length && healed < room.heals; i++) {
          if (nails[i].state !== "sana" && nails[i].state !== "kawaii" && nails[i].state !== "morta") {
            nails[i] = {...nails[i], state: "sana", scratchCount: 0};
            healed++;
          }
        }
        // Second pass: heal dead nails with remaining slots
        for (let i = 0; i < nails.length && healed < room.heals; i++) {
          if (nails[i].state === "morta") {
            nails[i] = {...nails[i], state: "sana", scratchCount: 0};
            healed++;
          }
        }
        // Always reset scratchCount on alive nails (so you don't degrade right after resting)
        for (let i = 0; i < nails.length; i++) {
          if (nails[i].state !== "morta") {
            nails[i] = {...nails[i], scratchCount: 0};
          }
        }
      }
      return {...p, money: p.money - room.cost, nails, grattaMania: false, grattaManiaTurns: 0};
    });

    addLog(`Hai riposato nella ${room.name}. Unghie curate!`, C.green);
    if (room.kawaii) addLog("Manicure KAWAII! Tutte le unghie sono ✨KAWAII✨!", C.pink);

    // Bettola thief risk
    if (room.risk === "ladri" && roll(0.25)) {
      addLog("Un ladro ti deruba nel sonno!", C.red);
      updatePlayer(p => {
        const items = [...p.items];
        if (items.length > 0) {
          const stolen = items.splice(Math.floor(rng()*items.length), 1)[0];
          addLog(`Ti ha rubato: ${ITEM_DEFS[stolen]?.name || "qualcosa"}!`, C.red);
        }
        return {...p, items};
      });
    }

    // ─── SOGNI ALLA LOCANDA (20% chance) ─────────────────────────
    if (roll(0.2)) {
      setGameStats(s => {
        const newCount = (s.dreamsHad || 0) + 1;
        if (newCount >= 3) unlockAchievement("dreamer");
        return {...s, dreamsHad: newCount};
      });
      const RARE_DREAM_POOL = ["boccaDrago","miliardario","tredici","ruota"];
      const dreams = [
        {
          emoji: "🌙",
          text: "Sogni di grattare una carta infinita...\nogni cella rivela un'altra cella.\nNon finisce mai.",
          effect: "+2 FORTUNA per 3 turni",
          effectColor: C.green,
          onConfirm: () => {
            updatePlayer(p => ({...p, fortune: p.fortune + 2, fortuneTurns: Math.max(p.fortuneTurns, 3)}));
            addLog("🌙 Il sogno della carta infinita... +2 Fortuna per 3 turni.", C.green);
          },
        },
        {
          emoji: "💀",
          text: "Un vecchio ti porge una carta già grattata.\nNon era vincente.\nTi sorride, senza denti.",
          effect: "Unghia attiva peggiora di 1 stato",
          effectColor: C.red,
          onConfirm: () => {
            updatePlayer(p => {
              const nails = [...p.nails];
              const active = p.activeNail;
              if (nails[active] && nails[active].state !== "morta") {
                nails[active] = degradeNailObj(nails[active], 1);
              }
              return {...p, nails};
            });
            addLog("💀 Il vecchio con la carta vuota... unghia attiva peggiorata.", C.red);
          },
        },
        {
          emoji: "👑",
          text: "'O Napoletano ti sussurra il numero vincente.\nTi svegli un istante prima di sentirlo.\nLa bocca ancora aperta.",
          effect: null,
          onConfirm: () => {
            addLog("👑 'O Napoletano ti ha sussurrato qualcosa... ma non ricordi cosa. Forse era importante.", C.magenta);
          },
        },
        {
          emoji: "💰",
          text: "Sogni di trovare €50 sotto il materasso.\nAl risveglio le mani sudano.\nSotto il cuscino: €15.",
          effect: "+€15 (il sogno lascia qualcosa)",
          effectColor: C.gold,
          onConfirm: () => {
            updatePlayer(p => ({...p, money: p.money + 15}));
            addLog("💰 Sotto il cuscino c'erano €15. Il sogno era quasi vero.", C.gold);
          },
        },
        {
          emoji: "🔮",
          text: "Una strega gratta le tue unghie mentre dormi.\nLe dita pulsano.\nTi svegli con le mani calde.",
          effect: "Unghia attiva migliora di 1 stato",
          effectColor: C.cyan,
          onConfirm: () => {
            updatePlayer(p => {
              const nails = [...p.nails];
              const active = p.activeNail;
              if (nails[active] && nails[active].state !== "kawaii") {
                const idx = NAIL_ORDER.indexOf(nails[active].state);
                if (idx >= 0 && idx < NAIL_ORDER.length - 1) {
                  nails[active] = {...nails[active], state: NAIL_ORDER[idx + 1]};
                }
              }
              return {...p, nails};
            });
            addLog("🔮 La strega del sogno... unghia attiva migliorata.", C.cyan);
          },
        },
        {
          emoji: "🃏",
          text: "Sogni una partita perduta.\nI simboli si ripetono nella testa.\nTre ceregie. Tre ceregie. Tre ceregie.",
          effect: "-1 FORTUNA (pessimo presagio)",
          effectColor: C.red,
          onConfirm: () => {
            updatePlayer(p => ({...p, fortune: Math.max(0, p.fortune - 1)}));
            addLog("🃏 Il sogno della partita perduta. -1 Fortuna.", C.red);
          },
        },
        {
          emoji: "🌊",
          text: "Il tabaccaio del futuro ti mostra carte\nche non esistono ancora.\nAl risveglio, una è rimasta nella tasca.",
          effect: "+1 carta rara misteriosa",
          effectColor: C.magenta,
          onConfirm: () => {
            const rareType = pick(RARE_DREAM_POOL);
            const rareCard = {...generateCard(rareType, 2), owned: true};
            updatePlayer(p => ({...p, scratchCards: [...p.scratchCards, rareCard]}));
            const typeDef = CARD_TYPES.find(t => t.id === rareType);
            addLog(`🌊 Il tabaccaio del futuro ti ha lasciato: "${typeDef?.name || rareType}"!`, C.magenta);
          },
        },
        {
          emoji: "⚡",
          text: "Sogni di grattare alla velocità della luce.\nLe dita sanno già dove grattare.\nIl biglietto trema.",
          effect: "+2 FORTUNA per la prossima carta",
          effectColor: C.gold,
          onConfirm: () => {
            updatePlayer(p => ({...p, fortune: p.fortune + 2, fortuneTurns: Math.max(p.fortuneTurns, 1)}));
            addLog("⚡ Le dita ricordano il sogno. +2 Fortuna per la prossima carta.", C.gold);
          },
        },
      ];
      const dream = pick(dreams);
      setDreamModal(dream);
    } else {
      setScreen("map");
    }
  };

  // ─── COMBAT HANDLERS ───────────────────────────────────────
  const handleCombatEnd = (result) => {
    setCombatEnemy(null);
    // Guanto da BOSS: si sgretola SOLO dopo un boss fight (non dopo miniboss/ladri).
    // Altrimenti resta in inventario/equipaggiato per il vero boss.
    const wasBossFight = currentNode?.type === "boss";
    if (wasBossFight) {
      if (player.guantoBossActive) {
        updatePlayer(p => ({...p, guantoBossActive: false}));
        addLog("🧤 Il Guanto da BOSS si sgretola in mille pezzi. Ha retto fino all'ultimo.", C.gold);
      }
      if (player.equippedGrattatore?.effect === "bossShield") {
        consumeGrattatore();
        addLog("🧤 Il Guanto da BOSS si sgretola in mille pezzi. Ha retto fino all'ultimo.", C.gold);
      }
    }
    if (result.won) {
      setGameStats(s => ({...s, combatsWon: (s.combatsWon || 0) + 1}));
      updatePlayer(p => {
        const nails = [...p.nails];
        // Apply heals from combat
        let healed = 0;
        for (let i = 0; i < nails.length && healed < (result.nailHeals || 0); i++) {
          if (nails[i].state !== "sana" && nails[i].state !== "kawaii" && nails[i].state !== "morta") {
            nails[i] = {...nails[i], state: healNail(nails[i].state, "sana"), scratchCount: 0};
            healed++;
          }
        }
        // WIN: guadagna un'unghia dal nemico (ripristina la prima morta)
        if (result.winNail) {
          const deadIdx = nails.findIndex(n => n.state === "morta");
          if (deadIdx >= 0) {
            nails[deadIdx] = {...nails[deadIdx], state: "sana", scratchCount: 0};
          }
        }
        const eliteMulti = currentNode?.elite ? 2 : 1;
        return {...p, money: p.money + Math.max(0, result.playerMoney) * eliteMulti, nails};
      });
      const eliteTag = currentNode?.elite ? " ★ELITE x2!" : "";
      addLog(`🏆 Vittoria! Guadagni €${Math.max(0, result.playerMoney) * (currentNode?.elite ? 2 : 1)}!${eliteTag}`, C.green);
      if (result.winNail) addLog(`✨ Hai preso un'unghia al nemico! Una tua unghia risorge.`, C.green);
      if (result.nailHeals > 0) addLog(`Cure in combattimento: ${result.nailHeals} unghie curate!`, C.green);
      // Sprint 5: Mini-boss 3-combo challenge feedback
      if (result.minibossBonus > 0) {
        addLog(`💀 SFIDA 3-COMBO: ${result.minibossCombos} combo distinti → +€${result.minibossBonus}${result.minibossHeal ? " + unghia curata" : ""}!`, C.magenta);
        setItemFoundModal({
          emoji: result.minibossCombos >= 3 ? "🔥" : "🎯",
          name: result.minibossCombos >= 3 ? "3-COMBO CHALLENGE MAX!" : "3-COMBO CHALLENGE!",
          desc: `Hai raggiunto ${result.minibossCombos} combo distinti in combat!\n\n+€${result.minibossBonus}${result.minibossHeal ? " + 1 unghia curata" : ""}`,
          subtitle: "Mini-Boss sconfitto con stile", buttonLabel: "Combo! →",
        });
      }
      // Boss defeated? Drop reliquia casuale
      if (currentNode?.type === "boss" || (currentNode?.type === "miniboss" && roll(0.25))) {
        const owned = new Set((player?.relics || []).map(r => r.id));
        const available = Object.entries(RELIC_DEFS).filter(([id]) => !owned.has(id));
        if (available.length > 0) {
          const [relicId, relicDef] = pick(available);
          updatePlayer(p => ({...p, relics: [...(p.relics || []), {id: relicId, ...relicDef}]}));
          // Salva come scoperta nella collezione meta
          setDiscoveredRelics(prev => {
            if (prev.includes(relicId)) return prev;
            const next = [...prev, relicId];
            setStored(STORAGE_KEYS.relicsDiscovered, next);
            return next;
          });
          setTimeout(() => {
            setItemFoundModal({ emoji: relicDef.emoji, name: `RELIQUIA: ${relicDef.name}`, desc: `${relicDef.desc}\n\nEffetto permanente per tutta la run!`, subtitle: "RELIQUIA TROVATA!", rarity: relicDef.rarity });
          }, 500);
          addLog(`${relicDef.emoji} RELIQUIA TROVATA: ${relicDef.name}! ${relicDef.desc}`, C.gold);
        }
      }
      // Boss defeated? Advance biome or victory
      if (currentNode?.type === "boss") {
        const nextBiome = currentBiome + 1;
        if (nextBiome < BIOMES.length) {
          // Advance to next biome
          setCurrentBiome(nextBiome);
          setMap(generateMap(nextBiome));
          setCurrentRow(0);
          setVisitedNodes([]);
          addLog(`🌍 Benvenuto a ${BIOMES[nextBiome].name}! "${BIOMES[nextBiome].desc}"`, BIOMES[nextBiome].color);
          // Applica modificatore globale del bioma (BIOME_MODIFIERS)
          const mod = BIOME_MODIFIERS[nextBiome];
          if (mod) {
            addLog(`${mod.emoji} ${mod.label} — ${mod.desc}`, BIOMES[nextBiome].color);
            if (mod.startFortune) {
              updatePlayer(p => ({
                ...p,
                fortune: (p.fortune || 0) + mod.startFortune,
                fortuneTurns: Math.max(p.fortuneTurns || 0, mod.startFortuneTurns || 3),
              }));
            }
          }
          if (nextBiome === 3) {
            AudioEngine.china();
            addLog("🏮 Lanterne rosse illuminano il cammino...", "#ff3333");
            addLog("🐲 Un ruggito lontano scuote l'aria.", "#ffcc00");
          }
          const CUTSCENE_ART = [
            `    ╔══════════════════════════╗\n    ║  ░░░ VIAGGIO AL SUD ░░░  ║\n    ╚══════════════════════════╝\n\n     ▄▄▄     ░░░░░    ▄▄▄▄▄\n    █   █   ░▒▓██▓░  █     █\n    █ N █──→░▒▓██▓░──█  C  █\n    █   █   ░▒▓██▓░  █     █\n     ▀▀▀     ░░░░░    ▀▀▀▀▀\n\n   Le luci al neon si accendono...\n   Il tabacco sa di diverso qui.`,
            `    ╔══════════════════════════╗\n    ║  ░░░ DISCESA A NAPOLI ░░░ ║\n    ╚══════════════════════════╝\n\n     ▄▄▄     ░▒▓█▓░    ▄▄▄▄▄\n    █   █   ░▒▓██▓▒░  █     █\n    █ C █──→░▒█🔥█▒░──█  N  █\n    █   █   ░▒▓██▓▒░  █  A  █\n     ▀▀▀     ░▒▓█▓░    ▀▀▀▀▀\n\n    L'aria brucia. I grattini\n    qui hanno un sapore diverso.`,
            `    ╔══════════════════════════════╗\n    ║   🏮 QUARTIERE  CINESE 🏮   ║\n    ╚══════════════════════════════╝\n\n           🏮     🏮     🏮\n            ║      ║      ║\n      ┌─────────────────────────┐\n      │    ╱╲    ╱╲    ╱╲      │\n      │   ╱龍╲  ╱金╲  ╱福╲     │\n      │  ╱────╲╱────╲╱────╲    │\n      │                        │\n      │  🐲  IL DRAGO D'ORO  🐲 │\n      │     TI  ASPETTA...     │\n      └─────────────────────────┘\n           🏮     🏮     🏮\n\n   L'aria sa di incenso e tè verde.\n   Lanterne rosse ovunque. 你好!\n   Qui le regole sono diverse.`,
          ];
          setItemFoundModal({
            emoji: "🌍",
            name: `⚡ BIOMA ${nextBiome + 1} SBLOCCATO! ⚡`,
            desc: (CUTSCENE_ART[nextBiome - 1] || "") + `\n\n${BIOMES[nextBiome].name}\n"${BIOMES[nextBiome].desc}"\n\nBoss: ${BIOMES[nextBiome].boss}`,
            subtitle: `Hai conquistato il bioma ${nextBiome}/${BIOMES.length}`,
            buttonLabel: `Entra in ${BIOMES[nextBiome].name} →`,
          });
          setScreen("map");
        } else {
          // Victory! unlock achievements
          unlockAchievement("first_win");
          setPlayer(p => {
            if (p && p.nails.every(n => n.state !== "morta" || p.nails.filter(x => x.state !== "morta").length === p.nails.length)) {
              // Check untouchable: no nails are dead
              if (p.nails.every(n => n.state !== "morta")) unlockAchievement("untouchable");
            }
            return p;
          });
          updateAllTimeStats({...gameStats, _isWin: true});
          setScreen("victory");
        }
        return;
      }
    } else {
      // Apply damage and money loss in one update to avoid stale state
      updatePlayer(p => {
        const nails = [...p.nails];
        if (result.nailDamage > 0) {
          for (let d = 0; d < result.nailDamage; d++) {
            const alive = nails.findIndex(n => n.state !== "morta");
            if (alive >= 0) nails[alive] = degradeNailObj(nails[alive], 2);
          }
        }
        // LOSE: perdi un'unghia aggiuntiva (la migliore → morta)
        if (result.loseNail) {
          const aliveIdx = nails.findIndex(n => n.state !== "morta");
          if (aliveIdx >= 0) nails[aliveIdx] = {...nails[aliveIdx], state: "morta", scratchCount: 0};
        }

        // Boss kills you
        if (currentNode?.type === "boss") {
          return {...p, nails};
        }

        // Se hai meno di €10, il nemico prende un'unghia extra come "interessi"
        if (p.money < 10) {
          const poorIdx = nails.findIndex(n => n.state !== "morta");
          if (poorIdx >= 0) nails[poorIdx] = {...nails[poorIdx], state: "morta", scratchCount: 0};
        }
        // Lose some money
        const moneyLost = Math.min(p.money, Math.abs(result.moneyGained || 10));
        return {...p, nails, money: Math.max(0, p.money - moneyLost)};
      });

      setGameStats(s => ({...s, combatsLost: (s.combatsLost || 0) + 1}));
      // screenShake is set through setScreenShake passed as dep
      if (result.nailDamage > 0) addLog(`Le tue unghie sono state danneggiate! (-${result.nailDamage})`, C.red);
      addLog(`💀 Sconfitta — il nemico ti ha strappato un'unghia!`, C.red);
      if (player.money < 10) addLog(`🦴 Eri squattrinato — interessi pagati in unghie. Perdi un'unghia extra.`, C.red);

      if (currentNode?.type === "boss") {
        setScreen("gameOver");
        return;
      }

      addLog(`Sconfitta! Perdi soldi.`, C.red);
    }

    // Check alive from fresh state
    setPlayer(p => {
      if (!isAlive(p.nails)) {
        setScreen("gameOver");
      } else {
        setScreen("map");
      }
      return p;
    });
  };

  return {
    dreamModal, setDreamModal,
    selectNode, enterNode, handlePreScratch, handleSelectCard, handleRest, handleCombatEnd,
  };
}
