import { useState, useCallback } from "react";
import { C, MAX_ITEMS } from "../data/theme.js";
import { CARD_BALANCE } from "../data/cards.js";
import { BIOME_MODIFIERS } from "../data/biomes.js";
import { roundMoney } from "../utils/money.js";
import { degradeNailObj } from "../utils/nail.js";
import { rng, roll } from "../utils/random.js";
import { AudioEngine } from "../audio.js";
import { generateMap } from "../utils/map.js";
import { STORAGE_KEYS, getStoredNumber, setStoredNumber } from "../utils/storage.js";

export function useScratchHandlers({
  player, scratchingCard, returnScreen, currentNode, currentRow, currentBiome,
  updatePlayer, addLog, triggerNpcComment, consumeGrattatore, unlockAchievement,
  setGameStats, setScratchingCard, setReturnScreen, setCardSelectMode, setSelectedCardIdx,
  setScreen, setIntroCardsLeft, setIntroPrizes, setItemFoundModal,
  setMap, setCurrentRow, setVisitedNodes, setCurrentNode, setCurrentBiome,
  setPlayer, isAlive,
}) {
  const [doppioONulla, setDoppioONulla] = useState(null);

  const handleScratchDone = useCallback((result) => {
    // ─── SPRINT 4: BLUFF DEL SPACCIATORE ─────────────────────────
    // Il "vincente garantito" venduto dallo spacciatore ha 40% di chance
    // di rivelarsi una fregatura: premio azzerato + danno unghia.
    let bluffBusted = false;
    if (scratchingCard?.bluffCard && result.win && result.prize > 0 && roll(0.40)) {
      bluffBusted = true;
      result = { ...result, win: false, prize: 0, applyNailMalus: true, malusAmount: 1 };
      addLog(`🤡 "VINCENTE GARANTITO"... ERA UNA FREGATURA! Premio annullato.`, C.red);
      setItemFoundModal({
        emoji: "🤡", name: "Bluff dello Spacciatore!",
        desc: "Il biglietto 'garantito' era taroccato.\nI simboli si cancellano davanti ai tuoi occhi.\n\n€0 in tasca + unghia rotta.",
        subtitle: "Truffato",
        buttonLabel: "Bastardo... →",
      });
    }
    setGameStats(s => ({
      ...s,
      cardsScratched: s.cardsScratched + 1,
      scratchWins: s.scratchWins + (result.win && result.prize > 0 ? 1 : 0),
      scratchLosses: s.scratchLosses + (!result.win || result.prize <= 0 ? 1 : 0),
    }));
    // Scratcher achievement: total lifetime scratches
    const totalScratch = getStoredNumber(STORAGE_KEYS.totalScratches, 0) + 1;
    setStoredNumber(STORAGE_KEYS.totalScratches, totalScratch);
    if (totalScratch >= 50) unlockAchievement("scratcher");

    // ─── SPRINT 2: TICK SIGARETTA / ERBA → UNGHIA NERA / POLLICE VERDE ───
    // Ogni grattata decrementa i tick. Quando il contatore raggiunge 0,
    // l'unghia attiva muta nello stato speciale corrispondente.
    {
      const hasSig = (player?.sigarettaTicks || 0) > 0;
      const hasErba = (player?.erbaTicks || 0) > 0;
      if (hasSig || hasErba) {
        updatePlayer(p => {
          const nails = [...p.nails];
          const active = p.activeNail ?? 0;
          const nail = nails[active];
          let sig = p.sigarettaTicks || 0;
          let erba = p.erbaTicks || 0;
          if (sig > 0) sig -= 1;
          if (erba > 0) erba -= 1;
          // Se entrambi vanno a 0 nella stessa grattata, priorità a Pollice Verde (buff vince)
          if (nail && nail.state !== "morta") {
            if (erba === 0 && (p.erbaTicks || 0) > 0) {
              nails[active] = {...nail, state: "polliceVerde", scratchCount: 0};
              addLog(`🌿 L'erba fa effetto — l'unghia attiva diventa POLLICE VERDE! (×2.5 premi al prossimo danno)`, C.green);
            } else if (sig === 0 && (p.sigarettaTicks || 0) > 0) {
              nails[active] = {...nail, state: "unghiaNera", scratchCount: 0};
              addLog(`🖤 Troppo fumo — l'unghia attiva diventa UNGHIA NERA! (×0.4 premi, rischio annullo)`, C.red);
            }
          }
          return {...p, nails, sigarettaTicks: sig, erbaTicks: erba};
        });
      }
    }

    // ─── IMPIANTI A USI LIMITATI ─────────────────────────────────
    // Anziana (sacra): a esaurimento torna "sana".
    // Macellaio (neonato/marcione/baddie): a esaurimento muore.
    // Chirurgo (plastica/ferro/oro): NON sanguinano ma hanno slot fissi —
    //   ogni grattata consuma 1 slot; a 0 slot si spezzano (morta).
    {
      const IMPLANT_ON_EXHAUST = {
        sacra: "sana",
        neonato: "morta", marcione: "morta", baddie: "morta",
        plastica: "morta", ferro: "morta", oro: "morta",
      };
      const active = player?.activeNail ?? 0;
      const nail = player?.nails?.[active];
      if (nail && IMPLANT_ON_EXHAUST[nail.implant] && (nail.implantUses || 0) > 0) {
        updatePlayer(p => {
          const nails = [...p.nails];
          const n = {...nails[active]};
          n.implantUses = (n.implantUses || 0) - 1;
          if (n.implantUses <= 0) {
            const exhaustState = IMPLANT_ON_EXHAUST[n.implant];
            const implName = n.implant;
            n.implant = null; n.implantUses = 0; n.state = exhaustState; n.scratchCount = 0;
            const isChirurgo = implName === "plastica" || implName === "ferro" || implName === "oro";
            addLog(
              exhaustState === "sana"
                ? `✨ L'Unghia Sacra si è consumata. L'unghia torna Sana.`
                : isChirurgo
                  ? `💥 L'unghia di ${implName} si è spezzata! Slot esauriti.`
                  : `💀 L'impianto "${implName}" è esaurito — l'unghia muore.`,
              exhaustState === "sana" ? C.gold : C.red
            );
          }
          nails[active] = n;
          // Se l'unghia attiva è morta, passa alla prossima viva
          let newActive = active;
          if (n.state === "morta") {
            const next = nails.findIndex((x, i) => i !== active && x.state !== "morta");
            if (next >= 0) newActive = next;
          }
          return {...p, nails, activeNail: newActive};
        });
      }
    }

    // For intro cards: capture prize, don't add to budget yet (player will choose which to keep)
    if (returnScreen === "introScratch") {
      const prizeAmt = result.win && result.prize > 0 ? result.prize : 0;
      const cardKey = scratchingCard; // object identity — guard against double-fire on same card
      setIntroPrizes(prev => {
        // Defensive: if this exact card object was already recorded, skip (double-fire of onDone).
        if (prev.some(p => p._cardRef === cardKey)) return prev;
        return [...prev, { prize: prizeAmt, cardName: scratchingCard?.name || "Biglietto", _cardRef: cardKey }];
      });
      if (prizeAmt > 0) { addLog(`Biglietto: €${prizeAmt} — scegli quale intascare!`, C.gold); triggerNpcComment(prizeAmt >= 5 ? "win_big" : "win_small"); }
      else { addLog(`Nessuna vincita su questo biglietto.`, C.dim); triggerNpcComment("lose"); }
    } else if (scratchingCard?.isContrabbando) {
      // Contrabbando: "vince" sempre ma il premio è... schiaffi!
      const schiaffi = Math.round(100 + rng() * 900); // 100-1000 schiaffi
      setItemFoundModal({
        emoji: "👋", name: `HAI VINTO ${schiaffi} SCHIAFFI!`,
        desc: `Complimenti! Il biglietto contrabbandato era una fregatura!\n\n${schiaffi} schiaffi virtuali.\n€0 reali.\n\nLo spacciatore sta ridendo da qualche parte.`,
        subtitle: "TRUFFATO!"
      });
      addLog(`👋 Contrabbando: HAI VINTO ${schiaffi} SCHIAFFI! €0 in tasca.`, C.red);
      // Danno unghia per lo shock
      updatePlayer(p => {
        const nails = [...p.nails];
        nails[p.activeNail] = degradeNailObj(nails[p.activeNail]);
        return {...p, nails, consecutiveWins: 0};
      });
    } else if (result.win && result.prize > 0) {
      const hasClipVirale = player?.clipViraleActive;
      const isStreamerLive = returnScreen === "streamerMap";
      // Bonus streamer in diretta: x1.5 sulla vincita base
      const streamerMultiplied = isStreamerLive ? Math.round(result.prize * 1.5) : result.prize;
      const preBiomePrize = hasClipVirale ? streamerMultiplied * 2 : streamerMultiplied;
      // Modificatore bioma 2 (Grattanapoli): +10% sulle vincite grattate
      const biomePrizeBoost = BIOME_MODIFIERS[currentBiome]?.prizeBoost || 0;
      let basePrize = biomePrizeBoost > 0
        ? Math.round(preBiomePrize * (1 + biomePrizeBoost))
        : preBiomePrize;
      if (biomePrizeBoost > 0 && basePrize > preBiomePrize) {
        addLog(`🌋 Vento del Vesuvio: +€${basePrize - preBiomePrize} bonus bioma!`, BIOME_MODIFIERS[currentBiome]?.emoji ? "#ff8800" : C.gold);
      }
      // Cedola Monopolio: biglietti tier-1 danno ×tier1PrizeBoostMeta
      {
        const _cid = scratchingCard?.id || scratchingCard?.typeId;
        const t1Boost = player.tier1PrizeBoostMeta || 1;
        if (t1Boost > 1 && CARD_BALANCE[_cid]?.tier === 1) {
          const boosted = Math.round(basePrize * t1Boost);
          addLog(`💸 MONOPOLIO: biglietto tier-1 ×${t1Boost}! +€${boosted - basePrize} bonus cedola`, C.gold);
          basePrize = boosted;
        }
      }
      if (isStreamerLive) {
        addLog(`🔥 CLIP VIRALE! La chat impazzisce! €${result.prize} → €${streamerMultiplied} (x1.5 LIVE)!`, C.gold);
        // Aggiungi clipVirale item (moltiplicatore x2 prossima vincita) se c'è spazio
        updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, "clipVirale"]}));
        // Sprint 4: followers aumentano su vincita live → donazioni dinamiche in combat
        const newFollowers = result.prize >= 20 ? 2 : 1;
        updatePlayer(p => ({...p, streamerFollowers: (p.streamerFollowers || 0) + newFollowers}));
        addLog(`📈 +${newFollowers} follower! La tua community cresce...`, C.cyan);
        setItemFoundModal({ emoji:"🎬", name:"Clip Virale!", desc:`La prossima vincita sarà x2!\n\n+${newFollowers} follower: ti invieranno donazioni in combat!`, subtitle:"Streamer Scratch" });
      }
      if (hasClipVirale) {
        updatePlayer(p => ({...p, clipViraleActive: false}));
        addLog(`🎬 CLIP VIRALE! Vincita RIPRESA e x2! €${streamerMultiplied} → €${basePrize}!`, C.gold);
        setItemFoundModal({ emoji:"🎬", name:`CLIP VIRALE! €${streamerMultiplied} → €${basePrize}!`, desc:`La tua vincita di €${streamerMultiplied} è stata RIPRESA e RADDOPPIATA!\n\n€${streamerMultiplied} × 2 = €${basePrize}`, subtitle:"Vincita x2!" });
      }
      updatePlayer(p => {
        let newConsec = p.consecutiveWins + 1;
        let isGM = p.grattaMania;
        // Win-streak bonus: +10% prize per streak of 3
        const streakBonus = Math.floor(newConsec / 3) * 0.1;
        const finalPrize = streakBonus > 0 ? Math.round(basePrize * (1 + streakBonus)) : basePrize;
        if (newConsec >= 3 && !isGM && !p._grattaManiaOffered) {
          // Non attivare automaticamente — offri scelta al giocatore
          setTimeout(() => {
            setItemFoundModal({
              emoji: "⚡", name: "GRATTAMANIA!",
              desc: "3 vittorie di fila! Vuoi attivare GrattaMania?\n\n✅ x2 PREMI su tutto!\n❌ Ogni cella grattata danneggia 1 unghia random!",
              subtitle: "Rischi o rinunci?",
              choices: [
                { label: "⚡ ACCETTA — x2 premi!", action: () => { updatePlayer(pp => ({...pp, grattaMania: true, grattaManiaTurns: 0, _grattaManiaOffered: false})); addLog("⚡ GRATTAMANIA ATTIVATA! Vincite x2!", C.red); }},
                { label: "🚫 No grazie — reset streak", action: () => { updatePlayer(pp => ({...pp, consecutiveWins: 0, _grattaManiaOffered: false})); addLog("Hai rifiutato GrattaMania. Streak azzerata.", C.dim); }},
              ]
            });
          }, 300);
          const newMoney = roundMoney(p.money + finalPrize);
          return {...p, money: newMoney, consecutiveWins: newConsec, lastWonPrize: finalPrize, _grattaManiaOffered: true};
        }
        if (streakBonus > 0) addLog(`🔥 Streak x${newConsec}! Bonus +${Math.round(streakBonus*100)}%`, C.gold);
        const newMoney = roundMoney(p.money + finalPrize);
        // Rico / Paperone achievements
        if (newMoney >= 1000) unlockAchievement("paperone");
        else if (newMoney >= 500) unlockAchievement("rico");
        return {
          ...p,
          money: newMoney,
          consecutiveWins: newConsec,
          grattaMania: isGM,
          lastWonPrize: finalPrize, // track for Doppio o Nulla x2
        };
      });
      // Grattatore x5teleport (Moneta Cinese): teleport al Quartiere Cinese (bioma 3)
      if (player?.equippedGrattatore?.effect === "x5teleport" && currentBiome !== 3) {
        addLog(`🀄 MONETA CINESE! Vincita x5!`, C.gold);
        AudioEngine.china();
        setTimeout(() => {
          setMap(generateMap(3));
          setCurrentRow(0);
          setVisitedNodes([]);
          setCurrentNode(null);
          setCurrentBiome(3);
          addLog(`🀄 TELETRASPORTO IN CINA! 🇨🇳 你好!`, "#ff3333");
          setItemFoundModal({ emoji: "🀄", name: "Teletrasporto in Cina! 🇨🇳", desc: "La Moneta Cinese ti ha teletrasportato nel Quartiere Cinese!\n你好! Lanterne rosse e grattini con ideogrammi.", subtitle: "你好!", buttonLabel: "进入! (Entra!) →" });
          setScreen("map");
        }, 500);
      }
      // Grattatore healAll (Gettone Autolavaggio): cura tutte dopo grattata
      if (player?.equippedGrattatore?.effect === "healAll") {
        updatePlayer(p => ({
          ...p,
          nails: p.nails.map(n => n.state !== "morta" ? {...n, state: "sana", scratchCount: 0} : n),
          grattaMania: false, grattaManiaTurns: 0, consecutiveWins: 0,
        }));
        addLog("🪙 Gettone Autolavaggio! Tutte le unghie curate + GrattaMania rimossa!", C.cyan);
      }
      // Use base prize for stats tracking
      setGameStats(s => ({...s, moneyEarned: s.moneyEarned + basePrize, bestPrize: Math.max(s.bestPrize || 0, basePrize)}));
      addLog(`Hai vinto €${basePrize}! (${result.cellsScratched} celle grattate)`, C.green);
      triggerNpcComment(basePrize >= 10 ? "win_big" : "win_small");
    } else {
      const isStreamerLive = returnScreen === "streamerMap";
      // Penalità streamer: cringe in diretta → -€10 di donazioni perse dalla chat
      const streamerPenalty = isStreamerLive ? 10 : 0;
      updatePlayer(p => ({
        ...p,
        money: Math.max(0, p.money + (result.prize || 0) - streamerPenalty),
        consecutiveWins: 0,
      }));
      if (result.prize < 0) addLog(`Hai perso €${Math.abs(result.prize)}!`, C.red);
      if (isStreamerLive) {
        addLog(`😬 Cringe totale... -€10 (donazioni perse dalla chat)`, C.red);
        // Sprint 4: anche gli hater fanno follower → più donazioni-negative in combat
        updatePlayer(p => ({...p, streamerFollowers: (p.streamerFollowers || 0) + 1}));
        addLog(`📉 +1 hater ti segue per ridere delle tue disgrazie...`, C.orange);
      }
      triggerNpcComment("lose");
    }

    // Apply card malus (nail damage type) — scaled by map row
    if (result.applyNailMalus) {
      updatePlayer(p => {
        const nails = [...p.nails];
        let nail = {...nails[p.activeNail]};
        // Scale malus by progression: row 0-3: -1, row 4-6: -2, row 7+: -3
        const baseMalus = result.malusAmount || 1;
        const scaledMalus = currentRow <= 3 ? Math.min(baseMalus, 1) : currentRow <= 6 ? Math.min(baseMalus, 2) : baseMalus;
        nail = degradeNailObj(nail, scaledMalus);
        nails[p.activeNail] = nail;
        return {...p, nails};
      });
      addLog("L'unghia si è danneggiata per il malus!", C.red);
    }

    // Porta-Chiavi SCRATCH-LITE: track consecutive losses, break after 3
    if (player?.equippedGrattatore?.effect === "portaChiavi") {
      if (result.win && result.prize > 0) {
        updatePlayer(p => {
          if (!p.equippedGrattatore) return p;
          const idx = p.equippedGrattatore.inventoryIdx;
          const grattatori = [...p.grattatori];
          grattatori[idx] = {...grattatori[idx], consecutiveLosses: 0};
          return {...p, grattatori, equippedGrattatore: {...p.equippedGrattatore, consecutiveLosses: 0}};
        });
      } else {
        const losses = (player.equippedGrattatore.consecutiveLosses || 0) + 1;
        if (losses >= 3) {
          updatePlayer(p => {
            const idx = p.equippedGrattatore.inventoryIdx;
            const grattatori = [...p.grattatori];
            grattatori.splice(idx, 1);
            addLog("🔐💥 Il Porta-Chiavi SCRATCH-LITE si è ROTTO! 3 perdite di fila!", C.red);
            setItemFoundModal({ emoji: "💥", name: "Porta-Chiavi ROTTO!", desc: "Troppi grattini perdenti di fila... il leggendario Porta-Chiavi si è spezzato!", subtitle: "Oggetto Distrutto", buttonLabel: "Merda... →" });
            return {...p, grattatori, equippedGrattatore: null};
          });
          setScratchingCard(null);
          // Skip normal grattatore consumption
          updatePlayer(p => {
            const idx = p.scratchCards.findIndex(c => c === scratchingCard);
            if (idx >= 0) { const nc = [...p.scratchCards]; nc.splice(idx, 1); return {...p, scratchCards: nc}; }
            return p;
          });
          setTimeout(() => {
            setPlayer(p => {
              if (!isAlive(p.nails)) { setScreen("gameOver"); return p; }
              if (returnScreen === "shop") setScreen("shop");
              else if (currentNode) setScreen("preScratch");
              else setScreen("map");
              return p;
            });
          }, 100);
          return; // skip rest of handler
        } else {
          updatePlayer(p => {
            if (!p.equippedGrattatore) return p;
            const idx = p.equippedGrattatore.inventoryIdx;
            const grattatori = [...p.grattatori];
            grattatori[idx] = {...grattatori[idx], consecutiveLosses: losses};
            addLog(`🔐 Porta-Chiavi: ${losses}/3 perdite consecutive...`, C.orange);
            return {...p, grattatori, equippedGrattatore: {...p.equippedGrattatore, consecutiveLosses: losses}};
          });
        }
      }
    }

    // Consume grattatore use (skip for portaChiavi which has its own logic,
    // e bossShield che va speso SOLO dentro la boss-fight, mai su grattini normali)
    const gEff = player?.equippedGrattatore?.effect;
    if (gEff !== "portaChiavi" && gEff !== "bossShield") consumeGrattatore();

    // Traccia la carta grattata per il Bambino Collezionista (storico)
    if (scratchingCard && returnScreen !== "introScratch") {
      const cardId = scratchingCard.id || scratchingCard.typeId;
      updatePlayer(p => ({...p, grattedCards: [...(p.grattedCards||[]), {
        typeId: cardId,
        tier: CARD_BALANCE[cardId]?.tier || 1,
        isWinner: result.win && result.prize > 0,
        prize: result.prize || 0,
        name: scratchingCard.name,
      }]}));
    }

    setScratchingCard(null);

    // Remove card from hand
    updatePlayer(p => {
      const idx = p.scratchCards.findIndex(c => c === scratchingCard);
      if (idx >= 0) {
        const newCards = [...p.scratchCards];
        newCards.splice(idx, 1);
        return {...p, scratchCards: newCards};
      }
      return p;
    });

    // Check alive from fresh state and navigate back
    setTimeout(() => {
      setPlayer(p => {
        if (!isAlive(p.nails)) {
          setScreen("gameOver");
          return p;
        }

        // Offer Doppio o Nulla randomly on wins (not intro, not streamer-live, prize >= €2, 30% chance, not for doppioOnulla cards)
        if (returnScreen !== "introScratch" && returnScreen !== "streamerMap" && result.win && result.prize >= 2 && Math.random() < 0.3 && scratchingCard?.mechanic !== "doppioOnulla") {
          setDoppioONulla({ prize: result.prize });
          setScreen("doppioONulla");
          setReturnScreen(null);
          return p;
        }

        if (returnScreen === "introScratch") {
          setIntroCardsLeft(l => {
            const next = l - 1;
            if (next === 0) setTimeout(() => triggerNpcComment("intro_done"), 400);
            return next;
          });
          setScratchingCard(null);
          setScreen("introScratch");
        } else if (returnScreen === "streamerMap") {
          // Dopo la grattata in diretta si torna sulla mappa (nodo streamer consumato)
          setCardSelectMode(false);
          setSelectedCardIdx(null);
          setScreen("map");
        } else if (returnScreen === "shop") {
          // Grattata fatta dentro al Tabaccaio: resta nello shop
          setCardSelectMode(false);
          setSelectedCardIdx(null);
          setScreen("shop");
        } else {
          setCardSelectMode(false);
          setSelectedCardIdx(null);
          if (currentNode) {
            setScreen("preScratch");
          } else {
            setScreen("map");
          }
        }
        setReturnScreen(null);
        return p;
      });
    }, 100);
  }, [scratchingCard, returnScreen, currentNode, consumeGrattatore, updatePlayer, addLog, triggerNpcComment]);

  // ─── DOPPIO O NULLA ──────────────────────────────────────────
  const handleDoppioDecline = useCallback(() => {
    addLog("Hai intascato la vincita. Scelta saggia!", C.green);
    setDoppioONulla(null);
    setCardSelectMode(false);
    setSelectedCardIdx(null);
    if (returnScreen === "shop") setScreen("shop");
    else if (currentNode) setScreen("preScratch");
    else setScreen("map");
  }, [currentNode, returnScreen, addLog]);

  const handleDoppioResult = useCallback((won) => {
    if (!doppioONulla) return;
    const prize = doppioONulla.prize;
    if (won) {
      updatePlayer(p => ({...p, money: p.money + prize}));
      setGameStats(s => ({...s, moneyEarned: s.moneyEarned + prize}));
      addLog(`🎰 DOPPIO O NULLA: HAI VINTO! +€${prize}! (totale vincita: €${prize * 2})`, C.gold);
    } else {
      updatePlayer(p => ({...p, money: Math.max(0, p.money - prize)}));
      addLog(`🎰 DOPPIO O NULLA: Hai perso tutto! -€${prize}`, C.red);
    }
    setDoppioONulla(null);
    setTimeout(() => {
      setCardSelectMode(false);
      setSelectedCardIdx(null);
      if (returnScreen === "shop") setScreen("shop");
      else if (currentNode) setScreen("preScratch");
      else setScreen("map");
    }, 1500);
  }, [doppioONulla, currentNode, returnScreen, updatePlayer, addLog]);

  return { doppioONulla, setDoppioONulla, handleScratchDone, handleDoppioDecline, handleDoppioResult };
}
