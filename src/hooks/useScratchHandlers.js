import { useState } from "react";
import { C, MAX_ITEMS } from "../data/theme.js";
import { CARD_BALANCE } from "../data/cards.js";
import { BIOME_MODIFIERS } from "../data/biomes.js";
import { CHIRURGO_IMPLANT_IDS } from "../data/items.js";
import { roundMoney } from "../utils/money.js";
import { degradeNailObj, healNail } from "../utils/nail.js";
import { rng, roll } from "../utils/random.js";
import { AudioEngine } from "../audio.js";
import { generateMap } from "../utils/map.js";
import { STORAGE_KEYS, getStoredNumber, setStoredNumber } from "../utils/storage.js";

// Impianti a usi limitati: stato dell'unghia quando gli usi finiscono.
// Anziana (sacra) torna Sana; Macellaio e Chirurgo (slot fissi) muoiono.
const IMPLANT_ON_EXHAUST = {
  sacra: "sana",
  neonato: "morta", marcione: "morta", baddie: "morta",
  plastica: "morta", ferro: "morta", oro: "morta",
};

// Funzioni semplici e non useCallback: con le dipendenze incomplete di prima
// handleScratchDone leggeva il `player` di inizio grattata (grattatore cambiato
// dalla fiancata, unghia attiva morta nel frattempo...). Nessun consumatore è
// memoizzato, quindi ricrearle a ogni render non costa nulla.
export function useScratchHandlers({
  player, scratchingCard, returnScreen, currentNode, currentRow, currentBiome,
  updatePlayer, addLog, triggerNpcComment, consumeGrattatore, unlockAchievement,
  setGameStats, setScratchingCard, setReturnScreen, setCardSelectMode, setSelectedCardIdx,
  setScreen, setIntroCardsLeft, setIntroPrizes, setItemFoundModal,
  setMap, setCurrentRow, setVisitedNodes, setCurrentNode, setCurrentBiome,
  setPlayer, isAlive,
}) {
  // { prize, returnTo }: returnTo è la schermata da cui si stava grattando.
  // Prima il Doppio o Nulla azzerava returnScreen e, rifiutando o giocando,
  // da una grattata nel Tabaccaio si finiva sull'anteprima del nodo.
  const [doppioONulla, setDoppioONulla] = useState(null);

  const goBack = (returnTo) => {
    setCardSelectMode(false);
    setSelectedCardIdx(null);
    if (returnTo === "shop") setScreen("shop");               // grattata dentro al Tabaccaio
    else if (returnTo === "streamerMap") setScreen("map");    // nodo streamer consumato
    else if (currentNode) setScreen("preScratch");
    else setScreen("map");
  };

  const handleScratchDone = (result) => {
    const card = scratchingCard;
    const grattatore = player?.equippedGrattatore;
    const isIntro = returnScreen === "introScratch";
    const isStreamerLive = returnScreen === "streamerMap";

    // ─── SPRINT 4: BLUFF DEL SPACCIATORE ─────────────────────────
    // Il "vincente garantito" venduto dallo spacciatore ha 40% di chance
    // di rivelarsi una fregatura: premio azzerato + danno unghia.
    if (card?.bluffCard && result.win && result.prize > 0 && roll(0.40)) {
      result = { ...result, win: false, prize: 0, applyNailMalus: true, malusAmount: 1 };
      addLog(`🤡 "VINCENTE GARANTITO"... ERA UNA FREGATURA! Premio annullato.`, C.red);
      setItemFoundModal({
        emoji: "🤡", name: "Bluff dello Spacciatore!",
        desc: "Il biglietto 'garantito' era taroccato.\nI simboli si cancellano davanti ai tuoi occhi.\n\n€0 in tasca + unghia rotta.",
        subtitle: "Truffato",
        buttonLabel: "Bastardo... →",
      });
    }
    const won = result.win && result.prize > 0;
    setGameStats(s => ({
      ...s,
      cardsScratched: s.cardsScratched + 1,
      scratchWins: s.scratchWins + (won ? 1 : 0),
      scratchLosses: s.scratchLosses + (won ? 0 : 1),
    }));
    // Scratcher achievement: total lifetime scratches
    const totalScratch = getStoredNumber(STORAGE_KEYS.totalScratches, 0) + 1;
    setStoredNumber(STORAGE_KEYS.totalScratches, totalScratch);
    if (totalScratch >= 50) unlockAchievement("scratcher");

    // ─── SPRINT 2: TICK SIGARETTA / ERBA → UNGHIA NERA / POLLICE VERDE ───
    // Ogni grattata decrementa i tick. Quando il contatore raggiunge 0,
    // l'unghia attiva muta nello stato speciale corrispondente.
    if ((player?.sigarettaTicks || 0) > 0 || (player?.erbaTicks || 0) > 0) {
      updatePlayer(p => {
        const nails = [...p.nails];
        const active = p.activeNail ?? 0;
        const nail = nails[active];
        const sig = Math.max(0, (p.sigarettaTicks || 0) - 1);
        const erba = Math.max(0, (p.erbaTicks || 0) - 1);
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

    // ─── IMPIANTI A USI LIMITATI ─────────────────────────────────
    // Si consuma l'impianto dell'unghia attiva, la stessa il cui moltiplicatore
    // ha pagato il premio. Se l'unghia è morta, l'impianto è andato con lei:
    // consumarlo avrebbe fatto risorgere "sana" un'unghia morta con la Sacra.
    const usedNail = player?.nails?.[player.activeNail ?? 0];
    if (usedNail && usedNail.state !== "morta" && IMPLANT_ON_EXHAUST[usedNail.implant] && usedNail.implantUses > 0) {
      const implant = usedNail.implant;
      if (usedNail.implantUses <= 1) {
        addLog(
          implant === "sacra" ? `✨ L'Unghia Sacra si è consumata. L'unghia torna Sana.`
            : CHIRURGO_IMPLANT_IDS.has(implant) ? `💥 L'unghia di ${implant} si è spezzata! Slot esauriti.`
            : `💀 L'impianto "${implant}" è esaurito — l'unghia muore.`,
          implant === "sacra" ? C.gold : C.red
        );
      }
      updatePlayer(p => {
        const active = p.activeNail ?? 0;
        const nail = p.nails[active];
        if (!nail || nail.state === "morta" || nail.implant !== implant || !(nail.implantUses > 0)) return p;
        const nails = [...p.nails];
        const uses = nail.implantUses - 1;
        nails[active] = uses > 0
          ? {...nail, implantUses: uses}
          : {...nail, implant: null, implantUses: 0, state: IMPLANT_ON_EXHAUST[implant], scratchCount: 0};
        let activeNail = active;
        if (nails[active].state === "morta") {
          const next = nails.findIndex((x, i) => i !== active && x.state !== "morta");
          if (next >= 0) activeNail = next;
        }
        return {...p, nails, activeNail};
      });
    }

    // ─── ESITO ───────────────────────────────────────────────────
    // Moneta Cinese: vincita x5 (in ScratchCardView) + teletrasporto in Cina
    const teleport = won && grattatore?.effect === "x5teleport" && currentBiome !== 3;
    let credited = false;
    if (isIntro) {
      // Biglietti di Nonno Carmelo: il premio si sceglie alla fine, non si incassa ora
      const prizeAmt = won ? result.prize : 0;
      setIntroPrizes(prev => {
        // Defensive: if this exact card object was already recorded, skip (double-fire of onDone).
        if (prev.some(p => p._cardRef === card)) return prev;
        return [...prev, { prize: prizeAmt, cardName: card?.name || "Biglietto", _cardRef: card }];
      });
      if (prizeAmt > 0) { addLog(`Biglietto: €${prizeAmt} — scegli quale intascare!`, C.gold); triggerNpcComment(prizeAmt >= 5 ? "win_big" : "win_small"); }
      else { addLog(`Nessuna vincita su questo biglietto.`, C.dim); triggerNpcComment("lose"); }
    } else if (card?.isContrabbando) {
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
    } else if (won) {
      credited = true;
      const hasClipVirale = player?.clipViraleActive;
      // Bonus streamer in diretta: x1.5 sulla vincita base
      const streamerMultiplied = isStreamerLive ? Math.round(result.prize * 1.5) : result.prize;
      const preBiomePrize = hasClipVirale ? streamerMultiplied * 2 : streamerMultiplied;
      // Modificatore bioma 2 (Grattanapoli): +10% sulle vincite grattate
      const biomePrizeBoost = BIOME_MODIFIERS[currentBiome]?.prizeBoost || 0;
      let basePrize = Math.round(preBiomePrize * (1 + biomePrizeBoost));
      if (basePrize > preBiomePrize) {
        addLog(`🌋 Vento del Vesuvio: +€${basePrize - preBiomePrize} bonus bioma!`, "#ff8800");
      }
      // Cedola Monopolio: biglietti tier-1 danno ×tier1PrizeBoostMeta
      const t1Boost = player.tier1PrizeBoostMeta || 1;
      if (t1Boost > 1 && CARD_BALANCE[card?.id]?.tier === 1) {
        const boosted = Math.round(basePrize * t1Boost);
        addLog(`💸 MONOPOLIO: biglietto tier-1 ×${t1Boost}! +€${boosted - basePrize} bonus cedola`, C.gold);
        basePrize = boosted;
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
        const newConsec = p.consecutiveWins + 1;
        // Win-streak bonus: +10% prize per streak of 3
        const streakBonus = Math.floor(newConsec / 3) * 0.1;
        const finalPrize = streakBonus > 0 ? Math.round(basePrize * (1 + streakBonus)) : basePrize;
        const newMoney = roundMoney(p.money + finalPrize);
        if (newConsec >= 3 && !p.grattaMania && !p._grattaManiaOffered) {
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
          return {...p, money: newMoney, consecutiveWins: newConsec, lastWonPrize: finalPrize, _grattaManiaOffered: true};
        }
        if (streakBonus > 0) addLog(`🔥 Streak x${newConsec}! Bonus +${Math.round(streakBonus*100)}%`, C.gold);
        // Rico / Paperone achievements
        if (newMoney >= 1000) unlockAchievement("paperone");
        else if (newMoney >= 500) unlockAchievement("rico");
        // lastWonPrize: premio da raddoppiare col Doppio o Nulla
        return {...p, money: newMoney, consecutiveWins: newConsec, lastWonPrize: finalPrize};
      });
      if (teleport) {
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
      // Use base prize for stats tracking
      setGameStats(s => ({...s, moneyEarned: s.moneyEarned + basePrize, bestPrize: Math.max(s.bestPrize || 0, basePrize)}));
      addLog(`Hai vinto €${basePrize}! (${result.cellsScratched} celle grattate)`, C.green);
      triggerNpcComment(basePrize >= 10 ? "win_big" : "win_small");
    } else {
      // Penalità streamer: cringe in diretta → -€10 di donazioni perse dalla chat
      const streamerPenalty = isStreamerLive ? 10 : 0;
      updatePlayer(p => ({
        ...p,
        money: roundMoney(Math.max(0, p.money + (result.prize || 0) - streamerPenalty)),
        consecutiveWins: 0,
      }));
      // Il motivo della sconfitta (sballo, STOP, malus, Bullone...) arriva da
      // ScratchCardView: prima veniva scritto e mai mostrato.
      if (result.message) addLog(result.message, C.red);
      if (isStreamerLive) {
        addLog(`😬 Cringe totale... -€10 (donazioni perse dalla chat)`, C.red);
        // Sprint 4: anche gli hater fanno follower → più donazioni-negative in combat
        updatePlayer(p => ({...p, streamerFollowers: (p.streamerFollowers || 0) + 1}));
        addLog(`📉 +1 hater ti segue per ridere delle tue disgrazie...`, C.orange);
      }
      triggerNpcComment("lose");
    }

    // Gettone Autolavaggio: dopo la grattata, vinta o persa (prima curava solo
    // sulle vincite ma si consumava sempre), cura le unghie vive senza
    // declassare Kawaii/Piede/Pollice Verde, e spegne la GrattaMania.
    if (grattatore?.effect === "healAll") {
      updatePlayer(p => ({
        ...p,
        nails: p.nails.map(n => n.state === "morta" ? n : {...n, state: healNail(n.state, "sana"), scratchCount: 0}),
        grattaMania: false, grattaManiaTurns: 0, consecutiveWins: 0,
      }));
      addLog("🪙 Gettone Autolavaggio! Tutte le unghie curate + GrattaMania rimossa!", C.cyan);
    }

    // Apply card malus (nail damage type) — scaled by map row
    if (result.applyNailMalus) {
      updatePlayer(p => {
        const nails = [...p.nails];
        // Scale malus by progression: row 0-3: -1, row 4-6: -2, row 7+: -3
        const baseMalus = result.malusAmount || 1;
        const scaledMalus = currentRow <= 3 ? Math.min(baseMalus, 1) : currentRow <= 6 ? Math.min(baseMalus, 2) : baseMalus;
        nails[p.activeNail] = degradeNailObj(nails[p.activeNail], scaledMalus);
        return {...p, nails};
      });
      addLog("L'unghia si è danneggiata per il malus!", C.red);
    }

    // Porta-Chiavi SCRATCH-LITE: si rompe dopo 3 perdite consecutive
    if (grattatore?.effect === "portaChiavi") {
      const losses = won ? 0 : (grattatore.consecutiveLosses || 0) + 1;
      if (losses >= 3) {
        addLog("🔐💥 Il Porta-Chiavi SCRATCH-LITE si è ROTTO! 3 perdite di fila!", C.red);
        setItemFoundModal({ emoji: "💥", name: "Porta-Chiavi ROTTO!", desc: "Troppi grattini perdenti di fila... il leggendario Porta-Chiavi si è spezzato!", subtitle: "Oggetto Distrutto", buttonLabel: "Merda... →" });
      } else if (losses > 0) {
        addLog(`🔐 Porta-Chiavi: ${losses}/3 perdite consecutive...`, C.orange);
      }
      updatePlayer(p => {
        if (!p.equippedGrattatore) return p;
        const idx = p.equippedGrattatore.inventoryIdx;
        const grattatori = [...p.grattatori];
        if (losses >= 3) {
          grattatori.splice(idx, 1);
          return {...p, grattatori, equippedGrattatore: null};
        }
        grattatori[idx] = {...grattatori[idx], consecutiveLosses: losses};
        return {...p, grattatori, equippedGrattatore: {...p.equippedGrattatore, consecutiveLosses: losses}};
      });
    }

    // Consume grattatore use (skip for portaChiavi which has its own logic,
    // e bossShield che va speso SOLO dentro la boss-fight, mai su grattini normali)
    const gEff = grattatore?.effect;
    if (gEff !== "portaChiavi" && gEff !== "bossShield") consumeGrattatore();

    // Traccia la carta grattata per il Bambino Collezionista (storico)
    if (card && !isIntro) {
      updatePlayer(p => ({...p, grattedCards: [...(p.grattedCards||[]), {
        typeId: card.id,
        tier: CARD_BALANCE[card.id]?.tier || 1,
        isWinner: won,
        prize: result.prize || 0,
        name: card.name,
      }]}));
    }

    setScratchingCard(null);

    // Remove card from hand
    updatePlayer(p => {
      const idx = p.scratchCards.findIndex(c => c === card);
      if (idx < 0) return p;
      const newCards = [...p.scratchCards];
      newCards.splice(idx, 1);
      return {...p, scratchCards: newCards};
    });

    // Doppio o Nulla dopo una vincita (30%): solo se QUESTA grattata ha
    // accreditato un premio — contrabbando e vincite a €0 rimettevano in gioco
    // un lastWonPrize vecchio — e mai durante il teletrasporto in Cina.
    // Il tiro sta fuori dall'updater: in StrictMode gli updater girano due volte.
    const offerDoppio = credited && !teleport && !isStreamerLive
      && card?.mechanic !== "doppioOnulla" && Math.random() < 0.3;

    // Check alive from fresh state and navigate back
    setTimeout(() => {
      setPlayer(p => {
        if (!isAlive(p.nails)) {
          setScreen("gameOver");
          return p;
        }
        // Si rischia il premio EFFETTIVAMENTE accreditato (p.lastWonPrize, che include
        // clip virale, bonus bioma, streak e cedola), non `result.prize` grezzo.
        if (offerDoppio && (p.lastWonPrize || 0) >= 2) {
          setDoppioONulla({ prize: p.lastWonPrize, returnTo: returnScreen });
          setScreen("doppioONulla");
        } else if (isIntro) {
          setIntroCardsLeft(l => {
            const next = l - 1;
            if (next === 0) setTimeout(() => triggerNpcComment("intro_done"), 400);
            return next;
          });
          setScreen("introScratch");
        } else if (!teleport) {
          goBack(returnScreen);
        }
        setReturnScreen(null);
        return p;
      });
    }, 100);
  };

  // ─── DOPPIO O NULLA ──────────────────────────────────────────
  const handleDoppioDecline = () => {
    addLog("Hai intascato la vincita. Scelta saggia!", C.green);
    const returnTo = doppioONulla?.returnTo;
    setDoppioONulla(null);
    goBack(returnTo);
  };

  // La vista mostra l'esito per 1,4s prima di chiamare onResult: si torna subito
  // indietro (prima c'era un'altra attesa di 1,5s su una schermata vuota).
  const handleDoppioResult = (wonDoppio) => {
    if (!doppioONulla) return;
    const { prize, returnTo } = doppioONulla;
    if (wonDoppio) {
      updatePlayer(p => ({...p, money: roundMoney(p.money + prize)}));
      setGameStats(s => ({...s, moneyEarned: s.moneyEarned + prize}));
      addLog(`🎰 DOPPIO O NULLA: HAI VINTO! +€${prize}! (totale vincita: €${prize * 2})`, C.gold);
    } else {
      updatePlayer(p => ({...p, money: roundMoney(Math.max(0, p.money - prize))}));
      addLog(`🎰 DOPPIO O NULLA: Hai perso tutto! -€${prize}`, C.red);
    }
    setDoppioONulla(null);
    goBack(returnTo);
  };

  return { doppioONulla, handleScratchDone, handleDoppioDecline, handleDoppioResult };
}
