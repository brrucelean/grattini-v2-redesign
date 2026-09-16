import { useState } from "react";
import { C } from "../data/theme.js";
import { NAIL_ORDER } from "../data/nails.js";
import { NODE_ICONS } from "../data/map.js";
import { ITEM_DEFS } from "../data/items.js";
import { BIOMES, BIOME_MODIFIERS, BOSS_MIN_MONEY, CEDOLE } from "../data/biomes.js";
import { CARD_TYPES } from "../data/cards.js";
import { degradeNailObj, healNail, healDamagedNails, isDamagedNail } from "../utils/nail.js";
import { roundMoney, fmtMoney } from "../utils/money.js";
import { roll, pick, shuffle } from "../utils/random.js";
import { generateCard } from "../utils/card.js";
import { generateMap, generateLabirintoGrid, generateCombinaState, generateTesoroState } from "../utils/map.js";
import { AudioEngine } from "../audio.js";
import { pickNewRelic } from "../utils/hasRelic.js";

// Carte con una schermata dedicata al posto del grattino (meccanica → schermata)
const MINIGAMES = { labirinto: "labirinto", combina: "grattaCombina", tesoro: "mappaTesor0" };

export function useNodeHandlers({
  player, currentNode, currentBiome,
  updatePlayer, addLog, unlockAchievement, updateAllTimeStats,
  consumeGrattatore,
  setScreen, setCurrentNode, setVisitedNodes, setCurrentRow, setPreScratchCount,
  setGameStats, setCardSelectMode, setReturnScreen, setScratchingCard, setSelectedCardIdx,
  setCombatEnemy, setCurrentBiome, setMap, setPlayer,
  setItemFoundModal, discoverRelic, activeCedola, setPendingCedoleOffer,
  setLabirintoState, setCombinaState, setTesoroState,
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
    const interceptable = !node.secret && !["ladro","spacciatore","poliziotto","boss","miniboss"].includes(node.type);
    if (player.cappelloSbirroWorn && !player.equippedGrattatore?.silent && interceptable && roll(0.3)) {
      const interceptor = roll(0.5) ? "ladro" : "spacciatore";
      addLog(`🎩 Il cappello sbirro attira attenzione! ${interceptor === "ladro" ? "Un ladro" : "Uno spacciatore"} ti intercetta!`, C.red);
      node._originalType = node._originalType || node.type;
      node.type = interceptor;
    }
    if (player.cappelloSbirroWorn && player.equippedGrattatore?.silent && interceptable && roll(0.3)) {
      addLog("🎸 Il Plettro ti rende silenzioso — il ladro non ti ha visto!", C.cyan);
    }

    setScreen("preScratch");
    const nodeLabel = node.secret ? "🔮 nodo segreto" : `${NODE_ICONS[node.type] || ""} ${node.type}`;
    addLog(`Vai verso: ${nodeLabel}${node.elite ? " ★ELITE" : ""}`, node.elite ? C.orange : C.cyan);
  };

  const enterNode = () => {
    if (!currentNode) return;
    const type = currentNode.type;

    if (type === "tabaccaio") setScreen("shop");
    else if (type === "locanda") setScreen("locanda");
    else if (type === "boss") {
      const bossName = currentNode.bossName || "Il Broker";
      const min = BOSS_MIN_MONEY[bossName];
      const money = fmtMoney(player.money);
      const BOSS_QUOTES = {
        "Il Broker":      `"€${money}? Non sei nemmeno degno del mio tempo. Torna quando hai qualcosa da perdere — minimo €${min}. Arrivederci."`,
        "Il Romanaccio":  `"Aho, co' meno de €${min} manco te risponno, bello. E nun me fa' arrabbià che chiamo er taxi."`,
        "Il Napoletano":  `"Guagliò, cu' meno 'e €${min} nun te parlo manco pe' sbaglio. Torna quanno tieni 'o ccapo."`,
        "Il Drago d'Oro": `"🐲 龙不见穷人. Il Drago non riceve i poveri. Porta almeno €${min} o brucerai prima di entrare."`,
      };
      const entry = min !== undefined && { min, quote: BOSS_QUOTES[bossName] };
      if (entry && player.money < entry.min) {
        addLog(`👑 ${bossName}: ${entry.quote}`, C.red);
        addLog(`❌ Rispedito all'inizio — ti serve almeno €${entry.min}.`, C.orange);
        unlockAchievement("broke");
        const shortfall = fmtMoney(entry.min - player.money);
        // Modal esplicativo — prima di sbattere il giocatore a inizio mappa
        if (setItemFoundModal) {
          setItemFoundModal({
            emoji: "🚫",
            name: `${bossName} ti caccia via`,
            desc:
              `${entry.quote}\n\n` +
              `💰 Avevi: €${money}\n` +
              `🎯 Soglia minima: €${entry.min}\n` +
              `📉 Ti mancavano: €${shortfall}\n\n` +
              `Sei stato RISPEDITO all'inizio della mappa.\n` +
              `Riparti dalla riga 1: il percorso è azzerato, grattini e soldi restano.\n\n` +
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
    setPreScratchCount(c => c + 1);
    // returnScreen è già stato impostato dal chiamante (handlePreScratch → "preScratch",
    // handleShopScratch → "shop"). Non sovrascriverlo qui.

    // Labirinto, Gratta & Combina e Mappa del Tesoro hanno una schermata loro e
    // NON passano da scratchingCard: quello apre il grattino a tutto schermo, che
    // copriva il minigioco e, con matchNeeded 0, vinceva alla prima cella.
    const minigame = MINIGAMES[card.mechanic];
    if (minigame) {
      if (card.mechanic === "labirinto") setLabirintoState({ pos: [0, 0], revealed: new Set(), prize: 0, grid: generateLabirintoGrid(), done: false });
      else if (card.mechanic === "combina") setCombinaState(generateCombinaState());
      else setTesoroState(generateTesoroState());
      updatePlayer(p => {
        const nc = [...p.scratchCards]; nc.splice(idx, 1); return {...p, scratchCards: nc};
      });
      setScreen(minigame);
      return;
    }

    // Impianti a vincita garantita (Anziana: sacra | Macellaio: neonato/marcione/baddie)
    // Se attivi, rigenera la carta come vincente — il moltiplicatore del premio verrà
    // applicato in ScratchCardView (IMPLANT_PRIZE_MULT).
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
    setScreen("scratch");
  };

  const handleRest = (room) => {
    if (player.money < room.cost) return;
    // Floor option: half-heal nails, 50% thief fight
    if (room.isFloor) {
      const sanaIdx = NAIL_ORDER.indexOf("sana");
      updatePlayer(p => {
        const nails = p.nails.map(n => {
          const idx = NAIL_ORDER.indexOf(n.state);
          // Le morte restano morte; Sana, Kawaii e gli stati fuori catena restano
          // com'erano (prima una Kawaii dormendo per terra tornava Sana).
          if (n.state === "morta" || idx < 0 || idx >= sanaIdx) return n;
          // A metà strada verso Sana
          const steps = Math.max(1, Math.floor((sanaIdx - idx) / 2));
          return {...n, state: NAIL_ORDER[Math.min(idx + steps, sanaIdx)], scratchCount: Math.floor(n.scratchCount / 2)};
        });
        return {...p, nails, grattaMania: false, grattaManiaTurns: 0};
      });
      addLog("Dormi per terra come un barbone. Le unghie recuperano... un po'.", C.dim);
      if (roll(0.5)) {
        addLog("Un ladro ti sveglia con un calcio! Preparati a combattere!", C.red);
        // "Ladro" (non "Ladro Notturno"): deve matchare ENEMY_STATS/ENEMY_COMBAT_POOLS
        // per avere HP e mosse reali invece del fallback generico.
        const thief = { name:"Ladro", isBoss:false, isMiniboss:false, isElite:false };
        setCombatEnemy(thief);
        setScreen("combat");
      } else {
        addLog("Nessuno ti ha disturbato. Miracolo.", C.green);
        setScreen("map");
      }
      return;
    }
    updatePlayer(p => {
      let nails;
      if (room.kawaii) {
        // Manicure: tutte (anche le morte) almeno Kawaii — Piede e Pollice Verde valgono di più e restano
        nails = p.nails.map(n => ({...n, state: n.state === "morta" ? "kawaii" : healNail(n.state, "kawaii"), scratchCount: 0}));
      } else {
        // Prima le danneggiate, poi con gli slot rimasti le morte
        const damaged = p.nails.filter(isDamagedNail).length;
        let revives = Math.max(0, room.heals - damaged);
        nails = healDamagedNails(p.nails, room.heals).map(n => {
          if (n.state !== "morta") return {...n, scratchCount: 0}; // appena riposate: niente degrado immediato
          if (revives <= 0) return n;
          revives--;
          return {...n, state: "sana", scratchCount: 0};
        });
      }
      return {...p, money: roundMoney(p.money - room.cost), nails, grattaMania: false, grattaManiaTurns: 0};
    });

    addLog(`Hai riposato nella ${room.name}. Unghie curate!`, C.green);
    if (room.kawaii) addLog("Manicure KAWAII! Tutte le unghie sono ✨KAWAII✨!", C.pink);

    // Bettola thief risk
    if (room.risk === "ladri" && roll(0.25)) {
      addLog("Un ladro ti deruba nel sonno!", C.red);
      if (player.items.length > 0) {
        const stolen = pick(player.items);
        updatePlayer(p => {
          const items = [...p.items];
          const idx = items.indexOf(stolen);
          if (idx >= 0) items.splice(idx, 1);
          return {...p, items};
        });
        addLog(`Ti ha rubato: ${ITEM_DEFS[stolen]?.name || "qualcosa"}!`, C.red);
      }
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
        const nails = healDamagedNails(p.nails, result.nailHeals || 0);
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
      // Boss defeated? Drop reliquia casuale.
      // foundRelic resta accessibile più sotto: prima il popup della reliquia
      // partiva con 500ms di ritardo (setTimeout) mentre quello di "bioma
      // sbloccato" scattava subito, nello stesso identico slot di popup —
      // quello della reliquia arrivava dopo e lo sovrascriveva prima che si
      // riuscisse a leggerlo. Ora, quando capitano insieme (boss + reliquia +
      // nuovo bioma), li uniamo in un solo popup invece di farli gareggiare.
      let foundRelic = null;
      if (currentNode?.type === "boss" || (currentNode?.type === "miniboss" && roll(0.25))) {
        const relicDef = pickNewRelic(player);
        if (relicDef) {
          updatePlayer(p => ({...p, relics: [...(p.relics || []), relicDef]}));
          discoverRelic(relicDef.id);  // collezione meta
          foundRelic = relicDef;
          addLog(`${relicDef.emoji} RELIQUIA TROVATA: ${relicDef.name}! ${relicDef.desc}`, C.gold);
          // Miniboss: nessun bioma da sbloccare dopo, quindi il popup della
          // reliquia resta da solo — lo mostriamo subito, non c'è più nulla
          // che possa sovrascriverlo.
          if (currentNode?.type !== "boss") {
            setItemFoundModal({ emoji: relicDef.emoji, name: `RELIQUIA: ${relicDef.name}`, desc: `${relicDef.desc}\n\nEffetto permanente per tutta la run!`, subtitle: "RELIQUIA TROVATA!", rarity: relicDef.rarity });
          }
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
            emoji: foundRelic ? foundRelic.emoji : "🌍",
            name: `⚡ BIOMA ${nextBiome + 1} SBLOCCATO! ⚡`,
            // Reliquia (se trovata) in cima, poi lo sblocco bioma — un solo
            // popup invece di due che si sovrascrivono a vicenda.
            desc: (foundRelic
              ? `🏆 RELIQUIA TROVATA: ${foundRelic.name}\n${foundRelic.desc}\nEffetto permanente per tutta la run!\n\n${"─".repeat(28)}\n\n`
              : "") + (CUTSCENE_ART[nextBiome - 1] || "") + `\n\n${BIOMES[nextBiome].name}\n"${BIOMES[nextBiome].desc}"\n\nBoss: ${BIOMES[nextBiome].boss}`,
            subtitle: `Hai conquistato il bioma ${nextBiome}/${BIOMES.length}`,
            buttonLabel: `Entra in ${BIOMES[nextBiome].name} →`,
          });
          setScreen("map");
        } else {
          // Vittoria finale: se una reliquia è appena stata trovata sull'ultimo
          // boss, mostrala prima della schermata di vittoria — prima veniva
          // messa in coda con 500ms di ritardo e rischiava di sparire dietro
          // il cambio schermo, ora è sincrona e precede la transizione.
          if (foundRelic) {
            setItemFoundModal({ emoji: foundRelic.emoji, name: `RELIQUIA: ${foundRelic.name}`, desc: `${foundRelic.desc}\n\nEffetto permanente per tutta la run!`, subtitle: "RELIQUIA TROVATA!", rarity: foundRelic.rarity });
          }
          // Victory! unlock achievements
          unlockAchievement("first_win");
          // Intoccabile: nessuna unghia morta a fine run
          if (player.nails.every(n => n.state !== "morta")) unlockAchievement("untouchable");
          updateAllTimeStats({...gameStats, _isWin: true});
          // Il Broker offre 3 cedole per la prossima run (la schermata esisteva
          // ma non veniva mai aperta: la meta-progressione era irraggiungibile)
          setPendingCedoleOffer(shuffle(CEDOLE.filter(c => c.id !== activeCedola)).slice(0, 3));
          setScreen("cedole");
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
