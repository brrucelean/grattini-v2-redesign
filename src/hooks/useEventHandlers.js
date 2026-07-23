import { C, MAX_ITEMS } from "../data/theme.js";
import { ITEM_DEFS, MACELLAIO_IMPLANTS, RELIC_DEFS, GRATTATORE_DEFS } from "../data/items.js";
import { CARD_TYPES } from "../data/cards.js";
import { degradeNailObj, healNail, findWorstNailIdx, findWorstAliveIdx } from "../utils/nail.js";
import { rng, roll, pick } from "../utils/random.js";
import { generateCard } from "../utils/card.js";
import { AudioEngine } from "../audio.js";

export function useEventHandlers({
  player, currentNode, currentBiome = 0, effectiveFortune = 0,
  updatePlayer, addLog, unlockAchievement, showItemFound,
  setScreen, setCombatEnemy, setGameStats, setCellaProgress,
  setItemFoundModal, setSmokeChoiceModal,
  setScratchingCard, setReturnScreen,
}) {
  const handleEventChoice = (action) => {
    // Handle streamer live card selection (action = "streamerLive_N")
    // Apre la vista scratch reale — il bonus "in diretta" (x1.5 + clipVirale / -€10 in cringe)
    // viene applicato in useScratchHandlers quando returnScreen === "streamerMap".
    if (action.startsWith("streamerLive_")) {
      const cardIdx = parseInt(action.replace("streamerLive_", ""), 10);
      const card = player.scratchCards[cardIdx];
      if (!card) { setScreen("map"); return; }
      addLog(`🔴 LIVE! Stai grattando "${card.name}" davanti a migliaia di persone!`, C.magenta);
      if (setScratchingCard && setReturnScreen) {
        setReturnScreen("streamerMap");
        setScratchingCard(card);
        setScreen("scratch");
      } else {
        // Fallback di sicurezza se i setter non sono collegati
        setScreen("map");
      }
      return;
    }
    switch (action) {
      case "fight": {
        const isMiniboss = currentNode.type === "miniboss";
        const MINIBOSS_NAMES = ["Enzo il Tabaccaio Rinnegato","Carmela la Grattona","Don Pasquale del Gratta","Mamma Rosaria","Franco il Cinquina"];
        const SFIDANTE_NAMES = ["Gennaro del Bar Sport","Tonino Tre Gratta","Peppe il Fortunello","Salvatore con la Sigaretta","Concetta la Scaltra","Mimmo Sfidante","Il Cognato di Tutti"];
        const LADRO_NAMES = ["il Borseggiatore di Porta Nuova","il Ladro dei Gratta","il Finto Turista","lo Scippatore del Lungomare"];
        const enemyName = isMiniboss
          ? MINIBOSS_NAMES[Math.floor(rng() * MINIBOSS_NAMES.length)]
          : currentNode.type === "ladro"
            ? LADRO_NAMES[Math.floor(rng() * LADRO_NAMES.length)]
            : SFIDANTE_NAMES[Math.floor(rng() * SFIDANTE_NAMES.length)];
        setCombatEnemy({ name: enemyName, isBoss: false, isMiniboss, isElite: !!currentNode.elite });
        setScreen("combat");
        break;
      }
      case "flee": {
        // Impianto "baddie" (Macellaio): i ladri se ne innamorano, non ti rubano nulla
        const hasBaddie = player.nails?.some(n => n.implant === "baddie" && (n.implantUses || 0) > 0);
        if (hasBaddie) {
          addLog("💋 Il ladro ti guarda l'unghia da Baddie... si innamora perdutamente! Si gira e se ne va senza toccarti.", C.magenta);
          setScreen("map");
          break;
        }
        if (roll(0.5)) {
          addLog("Sei scappato!", C.green);
          setScreen("map");
        } else {
          addLog("Non sei riuscito a scappare! Il ladro ti ruba un oggetto!", C.red);
          updatePlayer(p => {
            const items = [...p.items];
            if (items.length > 0) items.splice(Math.floor(rng()*items.length), 1);
            return {...p, items};
          });
          setScreen("map");
        }
        break;
      }
      case "payLadro": {
        updatePlayer(p => ({...p, money: Math.max(0, p.money - 10)}));
        addLog("Paghi €10 di pizzo. Il ladro sparisce.", C.red);
        setScreen("map");
        break;
      }
      // ── NPC VOLATILI: bribe/fuga per spacciatore e poliziotto arrabbiati ──
      case "bribeSpacciatore": {
        updatePlayer(p => ({...p, money: Math.max(0, p.money - 15)}));
        addLog("🕊️ Paghi €15. Lo spacciatore si calma e si allontana borbottando.", C.green);
        setScreen("map");
        break;
      }
      case "bribePoliziotto": {
        updatePlayer(p => ({...p, money: Math.max(0, p.money - 25)}));
        addLog("🕊️ €25 \"per il disturbo\". Il poliziotto se li intasca e ti lascia andare.", C.green);
        setScreen("map");
        break;
      }
      case "fleeAngry": {
        if (roll(0.6)) {
          addLog("Sei riuscito a filartela prima che la situazione degenerasse.", C.green);
          setScreen("map");
        } else {
          addLog("Non sei stato abbastanza veloce. Si scaglia contro di te!", C.red);
          setCombatEnemy({ name: "Spacciatore", isBoss: false, isMiniboss: false, isElite: false });
          setScreen("combat");
        }
        break;
      }
      case "defyPoliziotto": {
        // Sfida scriptata: rifiuti di pagare/scusarti — 45% il poliziotto lascia
        // perdere (non vuole grane), 55% attacca per davvero.
        if (roll(0.45)) {
          addLog("😤 Lo guardi dritto negli occhi. Non ha voglia di grane oggi — se ne va scuotendo la testa.", C.green);
          setScreen("map");
        } else {
          addLog("🚔 \"Ah sì? Allora facciamo a modo mio.\" Il poliziotto ti si scaglia contro!", C.red);
          setCombatEnemy({ name: "Poliziotto", isBoss: false, isMiniboss: false, isElite: false });
          setScreen("combat");
        }
        break;
      }
      case "giveItem": {
        updatePlayer(p => {
          const items = [...p.items];
          const removed = items.splice(Math.floor(rng()*items.length), 1);
          addLog(`Hai ceduto: ${ITEM_DEFS[removed[0]]?.name || "un oggetto"}`, C.orange);
          return {...p, items};
        });
        setScreen("map");
        break;
      }
      case "buyHerb": {
        updatePlayer(p => ({...p, money: p.money - 8}));
        setSmokeChoiceModal({ itemType: "sigarettaErba" });
        setScreen("map");
        break;
      }
      case "buyContra": {
        const card = generateCard("portaFortuna", 3);
        card.name = "Contrabbando";
        card.isWinner = true;
        card.maxPrize = 0;
        card.prize = 0;
        card.isContrabbando = true;
        card.owned = true;
        updatePlayer(p => ({...p, money: p.money - 25, scratchCards: [...p.scratchCards, card]}));
        addLog("Hai comprato un gratta di contrabbando! Attento alla polizia...", C.orange);
        setScreen("map");
        break;
      }
      case "buyFalsoVincente": {
        // Sprint 4 — Bluff: lo spacciatore lo vende come "vincita garantita".
        // Carta generata come vincente (forceWin) ma col flag bluffCard.
        // In handleScratchDone il bluff ha 40% chance di nullificare il premio + danno unghia.
        const card = { ...generateCard("fintoMilionario", 2, 0, true), owned: true, bluffCard: true, name: "\"VINCENTE\" (Contrabbando)" };
        updatePlayer(p => ({
          ...p,
          money: p.money - 15,
          scratchCards: [...p.scratchCards, card],
          bluffsBought: (p.bluffsBought || 0) + 1,
        }));
        addLog("🤝 \"Vedrai vedrai, 'sta volta è ORO.\" Hai in mano un biglietto 'garantito'.", C.orange);
        setScreen("map");
        break;
      }
      case "snitchSpacciatore": {
        // Sprint 4 — Snitch: +€30 subito, ma lo spacciatore lo scopre.
        updatePlayer(p => ({...p, money: p.money + 30, snitchedOn: true}));
        addLog("🕵️ \"Bravo, cittadino modello.\" Il poliziotto ti passa €30 in contanti e ti lascia andare.", C.gold);
        setItemFoundModal({
          emoji: "🕵️",
          name: "+€30 — Informatore",
          desc: "Hai denunciato lo spacciatore. La polizia ti ringrazia.\n\n⚠ Se incontri di nuovo lo spacciatore... ti aspetta.",
          subtitle: "Tensione Psicologica",
          buttonLabel: "Ok capo →",
        });
        setScreen("map");
        break;
      }
      case "implant_plastica": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const worst = findWorstNailIdx(nails);
          nails[worst] = {...nails[worst], state:"sana", implant:"plastica", implantUses:2, scratchCount:0};
          return {...p, money: p.money - 10, nails};
        });
        setGameStats(s => { const n = (s._chirurgoUses || 0) + 1; if (n >= 3) unlockAchievement("surgeon"); return {...s, _chirurgoUses: n}; });
        addLog("Unghia di Plastica impiantata! 2 slot, 50% premio. Non sanguina.", C.cyan);
        setScreen("map");
        break;
      }
      case "implant_ferro": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const worst = findWorstNailIdx(nails);
          nails[worst] = {...nails[worst], state:"sana", implant:"ferro", implantUses:4, scratchCount:0};
          return {...p, money: p.money - 25, nails};
        });
        setGameStats(s => { const n = (s._chirurgoUses || 0) + 1; if (n >= 3) unlockAchievement("surgeon"); return {...s, _chirurgoUses: n}; });
        addLog("Unghia di Ferro impiantata! 4 slot, 100% premio. Non sanguina. Attira ladri!", C.cyan);
        setScreen("map");
        break;
      }
      case "implant_oro": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const worst = findWorstNailIdx(nails);
          nails[worst] = {...nails[worst], state:"sana", implant:"oro", implantUses:5, scratchCount:0};
          return {...p, money: p.money - 50, nails};
        });
        setGameStats(s => { const n = (s._chirurgoUses || 0) + 1; if (n >= 3) unlockAchievement("surgeon"); return {...s, _chirurgoUses: n}; });
        addLog("Unghia d'Oro impiantata! 5 slot, 150% premio. Non sanguina. ALTO PERICOLO LADRI!", C.gold);
        setScreen("map");
        break;
      }
      case "barattoGrat_bottone": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const idx = nails.findIndex(n => n.state !== "morta");
          if (idx >= 0) nails[idx] = {...nails[idx], state: "morta", scratchCount: 0};
          const def = GRATTATORE_DEFS["bottone"];
          const newGrat = { id:"bottone", name:def.name, emoji:def.emoji, effect:def.effect, value:def.value, usesLeft:def.maxUses };
          return {...p, nails, grattatori:[...p.grattatori, newGrat]};
        });
        addLog("🦴 Hai pagato con un'unghia. Il Mendicante ti consegna il Bottone Magico.", C.cyan);
        {
          const def = GRATTATORE_DEFS["bottone"];
          setItemFoundModal({
            emoji: def.emoji, name: def.name,
            desc: `${def.desc}\nPagato con un'unghia al Mendicante.`,
            subtitle: "Baratto completato",
          });
        }
        setScreen("map"); break;
      }
      case "buyGrat_bottone":
      case "buyGrat_bullone":
      case "buyGrat_discoRotto": {
        const gratId = action.replace("buyGrat_", "");
        const def = GRATTATORE_DEFS[gratId];
        if (def && player.money >= def.cost) {
          const newGrat = { id: gratId, name: def.name, emoji: def.emoji, effect: def.effect, value: def.value, usesLeft: def.maxUses };
          updatePlayer(p => ({...p, money: p.money - def.cost, grattatori: [...p.grattatori, newGrat]}));
          addLog(`Comprato grattatore: ${def.emoji} ${def.name}!`, C.cyan);
          setItemFoundModal({
            emoji: def.emoji, name: def.name,
            desc: `${def.desc}\nPagato €${def.cost}.`,
            subtitle: "Grattatore acquistato",
          });
        }
        setScreen("map");
        break;
      }
      case "openBag": {
        if (roll(0.15)) {
          addLog("ERA UNA TRAPPOLA! Un ladro esce dallo zaino!", C.red);
          setCombatEnemy({ name: "Ladro Nascosto", isBoss: false });
          setScreen("combat");
        } else if (roll(0.4)) {
          const gratId = pick(["bottone","bullone","unghiaFinta"]);
          const def = GRATTATORE_DEFS[gratId];
          const newGrat = { id: gratId, name: def.name, emoji: def.emoji, effect: def.effect, value: def.value, usesLeft: def.maxUses };
          updatePlayer(p => ({...p, grattatori: [...p.grattatori, newGrat]}));
          addLog(`Hai trovato un grattatore: ${def.emoji} ${def.name}!`, C.cyan);
          setItemFoundModal({ emoji: def.emoji, name: def.name, desc: def.desc, subtitle: "Grattatore trovato", rarity: def.rarity });
          setScreen("map");
        } else {
          const loot = pick(["cerotto","disinfettante","sigaretta","cremaRinforzante"]);
          updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, loot]}));
          addLog(`Hai trovato: ${ITEM_DEFS[loot]?.emoji} ${ITEM_DEFS[loot]?.name}!`, C.green);
          let bonusLine = null;
          if (roll(0.3)) {
            const bonusMoney = Math.round(5 + rng() * 15);
            updatePlayer(p => ({...p, money: p.money + bonusMoney}));
            addLog(`E anche €${bonusMoney} in contanti!`, C.gold);
            bonusLine = `+€${bonusMoney} trovati insieme.`;
          }
          const lootDef = ITEM_DEFS[loot];
          setItemFoundModal({
            emoji: lootDef.emoji, name: lootDef.name,
            desc: lootDef.desc + (bonusLine ? `\n${bonusLine}` : ""),
            subtitle: "Trovato nello zaino",
            rarity: lootDef.rarity,
          });
          setScreen("map");
        }
        break;
      }
      case "acceptEvent": {
        // ── 8 esiti generici + 1 esito bioma-specifico (peso 30% bioma) ──
        const genericOutcomes = [
          "blessing", "ratto", "specchio", "vortice",
          "carta", "patto", "luna", "scintille",
        ];
        const biomeOutcome = ["rolex", "tassista", "ziaCarmela", "monaco"][currentBiome] || null;
        const outcome = biomeOutcome && roll(0.30) ? biomeOutcome : pick(genericOutcomes);

        if (outcome === "blessing") {
          // ⭐ Benedizione classica
          updatePlayer(p => ({...p, fortune: p.fortune + 2, fortuneTurns: Math.max(p.fortuneTurns, 4)}));
          addLog("⭐ Una luce calda ti avvolge. Le stelle sorridono. +2 FORTUNA per 4 turni.", C.magenta);
          setItemFoundModal({ emoji: "⭐", name: "Benedizione Stellata", desc: "+2 FORTUNA per 4 turni. Le prossime carte ti sorridono di più.", subtitle: "Evento Misterioso" });
        } else if (outcome === "ratto") {
          // 🐀 Ratto Profeta — soldi piccoli ma sicuri + log narrativo
          const tip = Math.round(8 + rng() * 18);
          updatePlayer(p => ({...p, money: p.money + tip}));
          addLog(`🐀 Un ratto bianco esce dal tombino, ti guarda fisso e sputa €${tip} ai tuoi piedi. Poi sparisce.`, C.gold);
          setItemFoundModal({ emoji: "🐀", name: `Il Ratto Profeta`, desc: `"Tieni, umano." Ti lascia €${tip} e sussurra qualcosa sui numeri del lotto prima di sparire nella fogna.`, subtitle: "Evento Misterioso" });
        } else if (outcome === "specchio") {
          // 🪞 Specchio incrinato — cura tutte le unghie peggiori di "graffiata"
          let healed = 0;
          updatePlayer(p => {
            const nails = p.nails.map(n => {
              if (n.state === "sanguinante" || n.state === "marcia") {
                healed++;
                return {...n, state: healNail(n.state, "graffiata")};
              }
              return n;
            });
            return {...p, nails};
          });
          if (healed > 0) {
            addLog(`🪞 Specchio incrinato sul muro. Il tuo riflesso sanguina al posto tuo. ${healed} unghia/e curata/e.`, C.cyan);
            setItemFoundModal({ emoji: "🪞", name: "Specchio del Sacrificio", desc: `Il tuo riflesso assorbe il dolore. ${healed} unghia/e tornano graffiate. Lo specchio ora ha una crepa rossa.`, subtitle: "Evento Misterioso" });
          } else {
            // fallback: niente da curare → piccolo bonus monete
            const fallback = Math.round(10 + rng() * 15);
            updatePlayer(p => ({...p, money: p.money + fallback}));
            addLog(`🪞 Lo specchio non aveva nulla da curare. Ti lascia €${fallback} come scusa.`, C.gold);
            setItemFoundModal({ emoji: "🪞", name: "Specchio Confuso", desc: `Niente da curare. Lo specchio si arrende e ti regala €${fallback}.`, subtitle: "Evento Misterioso" });
          }
        } else if (outcome === "vortice") {
          // 🌀 Vortice temporale — raddoppia fortuneTurns esistenti, o piccola fortuna se 0
          if (player.fortuneTurns > 0) {
            updatePlayer(p => ({...p, fortuneTurns: p.fortuneTurns * 2}));
            addLog(`🌀 Vortice temporale! La fortuna ti dura il doppio (${player.fortuneTurns} → ${player.fortuneTurns*2} turni).`, C.cyan);
            setItemFoundModal({ emoji: "🌀", name: "Vortice Temporale", desc: `Il tempo si piega. I turni di FORTUNA rimanenti raddoppiano: ${player.fortuneTurns} → ${player.fortuneTurns*2}.`, subtitle: "Evento Misterioso" });
          } else {
            updatePlayer(p => ({...p, fortune: p.fortune + 1, fortuneTurns: 6}));
            addLog("🌀 Vortice temporale! +1 FORTUNA per 6 turni (più lungo del solito).", C.cyan);
            setItemFoundModal({ emoji: "🌀", name: "Vortice Temporale", desc: "+1 FORTUNA per 6 turni — più lungo del normale. Il tempo è bizzarro qui.", subtitle: "Evento Misterioso" });
          }
        } else if (outcome === "carta") {
          // 🎴 Carta fantasma — regala un gratta tier 1-2 gratis
          const candidates = CARD_TYPES.filter(c => c.cost > 0 && c.cost <= 5);
          const chosen = pick(candidates);
          if (chosen) {
            const newCard = {...generateCard(chosen.id, effectiveFortune || 0, 0), owned: true};
            updatePlayer(p => ({...p, scratchCards: [...p.scratchCards, newCard]}));
            addLog(`🎴 Un vecchio appare dal nulla, ti mette in mano "${chosen.name}" e svanisce.`, C.magenta);
            setItemFoundModal({ emoji: chosen.emoji || "🎴", name: chosen.name, desc: `Un grattino fantasma — gratuito. "${chosen.desc}"`, subtitle: "Carta Misteriosa" });
          } else {
            updatePlayer(p => ({...p, money: p.money + 20}));
            addLog("🎴 Una mano invisibile ti lascia €20 in tasca.", C.gold);
          }
        } else if (outcome === "patto") {
          // 💀 Patto col diavolo — €50 ma -1 unghia degradata
          const aliveIdx = player.nails.findIndex(n => n.state !== "morta");
          if (aliveIdx >= 0) {
            updatePlayer(p => {
              const nails = [...p.nails];
              nails[aliveIdx] = degradeNailObj(nails[aliveIdx]);
              return {...p, nails, money: p.money + 50};
            });
            addLog("💀 Una mano gelata ti stringe il dito. Un'unghia si scurisce — ma trovi €50 nel taschino.", C.red);
            setItemFoundModal({ emoji: "💀", name: "Patto della Periferia", desc: "+€50 in cambio di un'unghia degradata. Non hai firmato niente. Non ti serve firmare.", subtitle: "Evento Misterioso" });
          } else {
            // fallback se solo morta: solo €
            updatePlayer(p => ({...p, money: p.money + 25}));
            addLog("💀 La mano gelata ti tocca ma le tue unghie sono già morte. Solo €25.", C.gold);
          }
        } else if (outcome === "luna") {
          // 🌙 Benedizione Lunare — +3 Fortuna 8 turni (forte)
          updatePlayer(p => ({...p, fortune: p.fortune + 3, fortuneTurns: Math.max(p.fortuneTurns, 8)}));
          addLog("🌙 La luna piena ti fissa. Senti il sangue caldo nelle dita. +3 FORTUNA per 8 turni.", C.magenta);
          setItemFoundModal({ emoji: "🌙", name: "Benedizione Lunare", desc: "+3 FORTUNA per 8 turni. La luna ti ha scelto, stanotte.", subtitle: "Evento Misterioso" });
        } else if (outcome === "scintille") {
          // ✨ Esplosione di scintille — +1 uso a TUTTI i grattatori
          if (player.grattatori && player.grattatori.length > 0) {
            updatePlayer(p => ({
              ...p,
              grattatori: p.grattatori.map(g => ({...g, usesLeft: g.usesLeft + 2})),
            }));
            addLog(`✨ Una pioggia di scintille ravviva i tuoi ${player.grattatori.length} grattatori. +2 usi ciascuno!`, C.cyan);
            setItemFoundModal({ emoji: "✨", name: "Pioggia di Scintille", desc: `+2 usi a tutti i tuoi grattatori (${player.grattatori.length}). I metalli brillano come nuovi.`, subtitle: "Evento Misterioso" });
          } else {
            // fallback se non hai grattatori: piccolo bonus monete
            const tip = Math.round(15 + rng() * 25);
            updatePlayer(p => ({...p, money: p.money + tip}));
            addLog(`✨ Le scintille cercano un grattatore. Non ne trovi. Si trasformano in €${tip}.`, C.gold);
            setItemFoundModal({ emoji: "✨", name: "Scintille Vagabonde", desc: `Niente grattatori da ricaricare. Le scintille diventano €${tip}.`, subtitle: "Evento Misterioso" });
          }
        } else if (outcome === "rolex") {
          // ⌚ Bioma 0 — Il Tipo coi Rolex Falsi (periferia Nord)
          // Ti vende €30 per una stretta di mano. Stretta = grattatore casuale comune.
          const sgrats = ["bottone","bullone","unghiaFinta"];
          const gratId = pick(sgrats);
          const def = GRATTATORE_DEFS[gratId];
          if (def && player.money >= 0) {
            const newGrat = { id: gratId, name: def.name, emoji: def.emoji, effect: def.effect, value: def.value, usesLeft: def.maxUses };
            updatePlayer(p => ({...p, money: p.money + 30, grattatori: [...p.grattatori, newGrat]}));
            addLog(`⌚ Un tipo in giacca lurida ti afferra la mano: "Senti che bel Rolex?". È un fake. Ma ti lascia €30 e ${def.emoji} ${def.name}.`, C.gold);
            setItemFoundModal({ emoji: "⌚", name: "Il Tipo coi Rolex Falsi", desc: `+€30 in tasca\n+${def.emoji} ${def.name} (grattatore)\n\n"Te lo dico io, fratè: di sti tempi solo i fake sono onesti."`, subtitle: "Periferia Nord" });
          } else {
            updatePlayer(p => ({...p, money: p.money + 25}));
            addLog(`⌚ Il tipo ti molla €25 e scappa.`, C.gold);
          }
        } else if (outcome === "tassista") {
          // 🚕 Bioma 1 — Tassista Romano Strozzino (Centro Slot)
          // Doppia faccia: +€40 ma -1 stato unghia attiva (corsa veloce e spericolata)
          updatePlayer(p => {
            const nails = [...p.nails];
            if (nails[p.activeNail].state !== "morta") {
              nails[p.activeNail] = degradeNailObj(nails[p.activeNail]);
            }
            return {...p, nails, money: p.money + 40};
          });
          addLog("🚕 \"Aoh, tu de fortuna! Te porto io ai casinò, ce facciamo 'na corsa!\" +€40 — ma l'unghia attiva se ne risente.", C.orange);
          setItemFoundModal({ emoji: "🚕", name: "Il Tassista Strozzino", desc: "+€40 (mancia per la corsa)\n-1 stato unghia attiva\n\n\"Ma che frena, anvedi che curva! Tieniti forte!\"", subtitle: "Centro Slot(Unico)" });
        } else if (outcome === "ziaCarmela") {
          // 🥐 Bioma 2 — Zia Carmela coi Cornetti (Grattanapoli)
          // Cura tutte le unghie peggiori di "graffiata" + €15 in tasca (cornetto rosso fortuna)
          let healed = 0;
          updatePlayer(p => {
            const nails = p.nails.map(n => {
              if (n.state === "sanguinante" || n.state === "marcia") {
                healed++;
                return {...n, state: healNail(n.state, "graffiata")};
              }
              return n;
            });
            return {...p, nails, money: p.money + 15, fortune: (p.fortune||0) + 1, fortuneTurns: Math.max(p.fortuneTurns||0, 5)};
          });
          addLog(`🥐 Zia Carmela ti mette in mano un cornetto: "Tie', guagliò, ros' fa bbene!" ${healed > 0 ? `${healed} unghia/e curata/e ·` : ""} +€15 · +1 Fortuna 5t.`, C.gold);
          setItemFoundModal({ emoji: "🥐", name: "Zia Carmela coi Cornetti", desc: `${healed > 0 ? `${healed} unghia/e curata/e\n` : ""}+€15 in tasca\n+1 Fortuna per 5 turni\n\n"E nun pensà a niente, guagliò. 'O cornetto fa o' miracolo."`, subtitle: "Grattanapoli" });
        } else if (outcome === "monaco") {
          // 🧘 Bioma 3 — Monaco Shaolin (Quartiere Cinese)
          // Cura unghia attiva + +3 fortuna 6 turni (forte: in linea con il flavor del bioma raro)
          updatePlayer(p => {
            const nails = [...p.nails];
            if (nails[p.activeNail].state !== "morta") {
              nails[p.activeNail] = {...nails[p.activeNail], state: "sana", scratchCount: 0};
            }
            return {...p, nails, fortune: (p.fortune||0) + 3, fortuneTurns: Math.max(p.fortuneTurns||0, 6)};
          });
          addLog("🧘 Un monaco silenzioso ti tocca la mano. L'unghia attiva diventa Sana. +3 Fortuna 6 turni.", C.cyan);
          setItemFoundModal({ emoji: "🧘", name: "Il Monaco Shaolin", desc: "Unghia attiva → Sana\n+3 Fortuna per 6 turni\n\n\"对 — il dito che gratta è il dito che ascolta.\"", subtitle: "Quartiere Cinese" });
        }
        setScreen("map"); break;
      }
      case "acceptEventPaid": {
        updatePlayer(p => ({...p, money: p.money - 10, fortune: p.fortune + 2, fortuneTurns: 4}));
        addLog("Lettura accurata! +2 FORTUNA per 4 turni.", C.magenta);
        setItemFoundModal({ emoji: "🔮", name: "Lettura Garantita", desc: "+2 FORTUNA per 4 turni. Hai pagato bene.", subtitle: "Evento" });
        setScreen("map"); break;
      }
      case "acceptEventNail": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const idx = nails.findIndex(n => n.state !== "morta" && n.state !== "sana");
          const target = idx >= 0 ? idx : nails.findIndex(n => n.state === "sana");
          if (target >= 0) nails[target] = degradeNailObj(nails[target]);
          return {...p, nails, fortune: p.fortune + 2, fortuneTurns: 5};
        });
        addLog("Hai offerto sangue. +2 FORTUNA per 5 turni — ma un'unghia peggiora.", C.magenta);
        setItemFoundModal({ emoji: "🩸", name: "Patto di Sangue", desc: "+2 FORTUNA per 5 turni. Un'unghia si degrada. Le stelle ricordano.", subtitle: "Evento", buttonLabel: "Accetto... →" });
        setScreen("map"); break;
      }
      case "useCappello": {
        updatePlayer(p => ({...p, items: p.items.filter(i => i !== "cappelloSbirro"), cappelloSbirroWorn: false}));
        addLog("🎩 Il cappello funziona! Il poliziotto ti saluta militarmente e sparisce.", C.green);
        setScreen("map"); break;
      }
      case "pagaMulta": {
        // Sprint 5: multa doppia se beccato col Giornaletto — e sequestro!
        const busted = !!player.giornalettoRead;
        const amount = busted ? 40 : 20;
        updatePlayer(p => ({
          ...p,
          money: p.money - amount,
          // Sequestra il giornaletto: rimuove flag + rimuove item se ancora in inventario
          giornalettoRead: false,
          items: busted ? p.items.filter(i => i !== "giornalettoPorno") : p.items,
        }));
        if (busted) addLog(`📖🚔 Multa DOPPIA: €${amount}. Il Poliziotto sequestra il giornaletto scuotendo la testa.`, C.red);
        else addLog(`Paghi €${amount} di multa. "Prossima volta si fa i fatti suoi."`, C.red);
        setScreen("map"); break;
      }
      case "multaNail": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const idx = nails.findIndex(n => n.state !== "morta");
          if (idx >= 0) nails[idx] = {...nails[idx], state: "morta", scratchCount: 0};
          return {...p, nails};
        });
        addLog("🦴 Il poliziotto storce il naso ma accetta. Un'unghia come garanzia. \"Non si faccia vedere.\"", C.orange);
        setScreen("map"); break;
      }
      case "manganellata": {
        updatePlayer(p => {
          const nails = [...p.nails];
          for (let dmg = 0; dmg < 2; dmg++) {
            const i = nails.findIndex(n => n.state !== "morta");
            if (i >= 0) nails[i] = degradeNailObj(nails[i]);
          }
          return {...p, nails};
        });
        addLog("🚔 Il poliziotto ti manganella! Perdi 2 stati di unghia.", C.red);
        setScreen("map"); break;
      }
      case "fintotonto": {
        if (roll(0.20)) {
          addLog("\"Uhh... grattini? Cosa sono?\" Il poliziotto ti guarda storto ma ti lascia andare.", C.green);
          setScreen("map");
        } else {
          addLog("🚔 Il poliziotto non ci crede! Ti insegue per strada... SEI ARRESTATO!", C.red);
          addLog("Finisci in cella. L'unica via d'uscita: grattare il muro con le dita.", C.orange);
          setCellaProgress(0);
          setScreen("cella");
        }
        break;
      }
      case "anzianaTocca": {
        updatePlayer(p => ({...p, anzianaVisits: (p.anzianaVisits || 0) + 1}));
        if (roll(0.5)) {
          updatePlayer(p => ({
            ...p,
            nails: p.nails.map(n => {
              if (n.state === "morta") return n;
              if (n.state === "marcia") return {...n, state: "sanguinante"};
              if (n.state === "sanguinante") return {...n, state: "graffiata"};
              return {...n, state: "sana"};
            }),
          }));
          addLog("👵 Le sue dita fredde... guariscono! Tutte le unghie migliorano di 1 stato.", C.green);
          showItemFound("👵", "Benedizione dell'Anziana", "Tutte le unghie risalgono di 1 stato grazie alla sua magia.", "Guarigione");
        } else {
          updatePlayer(p => ({
            ...p,
            nails: p.nails.map((n, i) => i === p.activeNail && n.state !== "morta" ? {...n, state: "marcia"} : n),
          }));
          addLog("👵 \"Ah... la vedo la maledizione su di te.\" Unghia attiva → MARCIA!", C.red);
          setItemFoundModal({ emoji:"🩸", name:"Maledizione!", desc:"L'anziana ha toccato l'unghia sbagliata. La tua unghia attiva è ora MARCIA.", subtitle:"Evento", buttonLabel:"Mannaggia... →" });
        }
        break;
      }
      case "anzianaStrappaGelosia": {
        updatePlayer(p => {
          const nails = [...p.nails];
          let ripped = 0;
          for (let i = 0; i < nails.length && ripped < 2; i++) {
            if (nails[i].state !== "morta") { nails[i] = {...nails[i], state: "morta"}; ripped++; }
          }
          return {...p, nails, anzianaVisits: (p.anzianaVisits || 0) + 1};
        });
        addLog("👵 L'anziana ti strappa 2 unghie per GELOSIA! \"Troppo belle per uno come te!\"", C.red);
        setItemFoundModal({ emoji:"💀", name:"Gelosia dell'Anziana!", desc:"\"Che belle mani... troppo belle per un grattatore come te!\" Ti ha strappato 2 unghie!", subtitle:"Evento", buttonLabel:"No... →" });
        break;
      }
      case "anzianaSacra": {
        // Spec: l'Anziana trasforma un dito in Unghia Sacra (1 uso = vincita x5 garantita).
        // Una sola volta per run (flag anzianaSacraGiven).
        updatePlayer(p => {
          const nails = [...p.nails];
          const active = p.activeNail;
          if (nails[active].state === "morta") {
            // fallback: trova la prima viva
            const alt = nails.findIndex(n => n.state !== "morta");
            if (alt < 0) return p;
            nails[alt] = {...nails[alt], state:"sana", implant:"sacra", implantUses:1, scratchCount:0};
          } else {
            nails[active] = {...nails[active], state:"sana", implant:"sacra", implantUses:1, scratchCount:0};
          }
          return {...p, money: p.money - 40, nails, anzianaSacraGiven: true, anzianaVisits: (p.anzianaVisits || 0) + 1};
        });
        addLog("👵✨ \"Che la Madonna ti accompagni, figliolo.\" Un calore antico ti invade il dito. UNGHIA SACRA impiantata!", C.gold);
        setItemFoundModal({
          emoji:"✨", name:"Unghia Sacra",
          desc:"La tua unghia attiva è diventata SACRA.\nLa prossima grattata = vincita GARANTITA × 3.\nDopo, torna Sana.",
          subtitle:"Benedizione dell'Anziana",
          buttonLabel:"Grazie nonna 🙏",
          rarity:"rarissima",
        });
        break;
      }
      case "anzianaRegala": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const deadIdx = nails.findIndex(n => n.state === "morta");
          if (deadIdx >= 0) nails[deadIdx] = {...nails[deadIdx], state: "graffiata", scratchCount: 0};
          return {...p, nails, anzianaVisits: (p.anzianaVisits || 0) + 1};
        });
        addLog("👵 \"Poverino... tieni, prendi questa.\" Un'unghia morta rinasce come Graffiata!", C.green);
        showItemFound("👵", "Pietà dell'Anziana", "\"In che stato che sei...\" L'anziana ti regala un'unghia. Rinasce come Graffiata.", "Guarigione");
        break;
      }
      case "dona5": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const active = p.activeNail;
          if (nails[active].state !== "morta") nails[active] = {...nails[active], smalto: (nails[active].smalto || 0) + 3};
          return {...p, money: p.money - 5, fortune: p.fortune + 1, fortuneTurns: 3, nails};
        });
        addLog("⛪ +FORTUNA + unghia attiva protetta 3 turni! \"La fede protegge, figliolo.\"", C.magenta);
        showItemFound("⛪", "Benedizione", "FORTUNA +1 per 3 turni + unghia protetta da 3 danni.", "Sacerdote della Fortuna");
        break;
      }
      case "dona15": {
        updatePlayer(p => {
          const nails = [...p.nails];
          let protected2 = 0;
          for (let i = 0; i < nails.length && protected2 < 2; i++) {
            if (nails[i].state !== "morta" && !(nails[i].smalto > 0)) {
              nails[i] = {...nails[i], smalto: (nails[i].smalto || 0) + 3}; protected2++;
            }
          }
          return {...p, money: p.money - 15, fortune: p.fortune + 2, fortuneTurns: 5, nails};
        });
        addLog("⛪ +2 FORTUNA + 2 unghie protette! \"La Provvidenza ti guarda.\"", C.magenta);
        showItemFound("⛪", "Grande Benedizione", "FORTUNA +2 per 5 turni + 2 unghie protette da 3 danni.", "Sacerdote della Fortuna");
        break;
      }
      case "dona30": {
        updatePlayer(p => {
          const nails = [...p.nails];
          for (let i = 0; i < nails.length; i++) {
            if (nails[i].state !== "morta") nails[i] = {...nails[i], smalto: (nails[i].smalto || 0) + 3};
          }
          return {...p, money: p.money - 30, fortune: p.fortune + 3, fortuneTurns: 8, nails};
        });
        addLog("⛪ +3 FORTUNA + TUTTE le unghie protette! \"La grazia scende su di te!\"", C.gold);
        showItemFound("⛪", "Grazia Divina", "FORTUNA +3 per 8 turni + TUTTE le unghie protette da 3 danni!", "Sacerdote della Fortuna");
        break;
      }
      case "teVerde": {
        updatePlayer(p => {
          const nails = [...p.nails];
          const worst = findWorstAliveIdx(nails);
          if (nails[worst].state !== "morta") nails[worst] = {...nails[worst], state: healNail(nails[worst].state, "sana")};
          return {...p, money: p.money - 5, fortune: p.fortune + 1, fortuneTurns: 3, nails};
        });
        addLog("🍵 Tè Verde! Unghia curata + Fortune +1 per 3 turni.", C.green);
        showItemFound("🍵", "Tè Verde", "Una tazza calma e rigenerante.\nCura 1 unghia + Fortune +1 (3 turni)", "Maestro del Tè");
        setScreen("map"); break;
      }
      case "teDrago": {
        updatePlayer(p => {
          const nails = [...p.nails];
          let healed = 0;
          for (let i = 0; i < nails.length && healed < 2; i++) {
            if (nails[i].state !== "morta" && nails[i].state !== "sana" && nails[i].state !== "kawaii") {
              nails[i] = {...nails[i], state: "sana", scratchCount: 0}; healed++;
            }
          }
          return {...p, money: p.money - 15, fortune: p.fortune + 2, fortuneTurns: 5, nails};
        });
        addLog("🍵🐲 Tè del Drago! 2 unghie curate + Fortune +2 per 5 turni!", C.gold);
        showItemFound("🐲", "Tè del Drago", "Brucia in gola ma rigenera.\nCura 2 unghie + Fortune +2 (5 turni)", "Maestro del Tè");
        setScreen("map"); break;
      }
      case "teOro": {
        updatePlayer(p => {
          const nails = [...p.nails];
          for (let i = 0; i < nails.length; i++) {
            if (nails[i].state !== "morta") nails[i] = {...nails[i], state: "sana", scratchCount: 0};
          }
          nails[p.activeNail] = {...nails[p.activeNail], smalto: (nails[p.activeNail].smalto || 0) + 3};
          return {...p, money: p.money - 40, nails};
        });
        addLog("🍵👑 Tè d'Oro Imperiale! TUTTE le unghie sane + smalto su unghia attiva!", C.gold);
        showItemFound("👑", "Tè d'Oro Imperiale", "Solo per l'imperatore.\nTutte le unghie → Sane + 3 smalto sull'attiva", "Maestro del Tè");
        setScreen("map"); break;
      }
      case "dragoLore": {
        const loreTexts = [
          "Il Drago soffia fuoco ogni 2 round. Solo le carte DIFESA possono fermarlo. Pesca difese o brucerai.",
          "Il Drago d'Oro accumula forza. Nei round pari scatena il Fiato — ruba soldi o brucia unghie.",
          "Chi affronta il Drago senza difese perde tutto. Porta Cerotti e Crema — ti serviranno dopo.",
          "Il tè del drago dà fortuna... ma il Drago stesso odia chi beve il suo tè. Preparati.",
        ];
        const lore = loreTexts[Math.floor(Math.random() * loreTexts.length)];
        addLog(`🐲 ${lore}`, "#ff3333");
        showItemFound("🐲", "Sapienza del Drago", lore, "Maestro del Tè");
        AudioEngine.china();
        break;
      }
      case "learnAmbidestri": {
        if (player.skills?.includes("ambidestri")) break;
        if (player.money < 200) { addLog("Non hai abbastanza soldi!", C.red); break; }
        updatePlayer(p => ({
          ...p,
          money: p.money - 200,
          skills: [...(p.skills||[]), "ambidestri"],
          nails: [
            ...p.nails,
            ...Array(5).fill(null).map(() => ({ state: "graffiata", scratchCount: 0, implant: null, implantUses: 0 })),
          ],
        }));
        addLog("🙌 DOPPIA MANO appresa! Gratti con due mani simultaneamente!", C.magenta);
        addLog("La musica cambia... qualcosa è cambiato in te.", C.cyan);
        setItemFoundModal({ emoji: "🙌", name: "Doppia Mano", desc: "Hai imparato a grattare con entrambe le mani! +5 dita della mano sinistra — ma partono tutte graffiata: meno allenate.", subtitle: "Abilità appresa" });
        break;
      }
      case "unghiaPiede": {
        if (player.money < 100) { addLog("Non hai abbastanza soldi!", C.red); break; }
        updatePlayer(p => ({
          ...p,
          money: p.money - 100,
          nails: [...p.nails, { state: "piede", scratchCount: 0, implant: null, implantUses: 0 }],
        }));
        unlockAchievement("piede");
        addLog("🦶 L'UNGHIA DEL PIEDE! Disgustosa, gialla, orrenda... ma x5 moltiplicatore!", C.gold);
        setItemFoundModal({
          emoji: "🦶", name: "Unghia del Piede",
          desc: "Fa schifo. Puzza. È gialla e spessa. Ma moltiplica i premi x5. Si degrada a Graffiata al primo danno.",
          subtitle: "Segreto sbloccato"
        });
        break;
      }
      case "bambinoSwap1": {
        const RARE_POOL = ["boccaDrago","miliardario","tredici","ruota"];
        const rareType = pick(RARE_POOL);
        const rareCard = generateCard(rareType, 2);
        updatePlayer(p => {
          const cards = [...p.scratchCards];
          cards.splice(Math.floor(rng() * cards.length), 1);
          cards.push(rareCard);
          return {...p, scratchCards: cards};
        });
        const typeDef = CARD_TYPES.find(t => t.id === rareType);
        addLog(`👦 "${typeDef.name}"! Fuori produzione! Un pezzo da collezione!`, C.gold);
        setItemFoundModal({ emoji: "🔄", name: typeDef.name, desc: `Il bambino ti ha dato un "${typeDef.name}" raro dalla sua collezione!`, subtitle: "Scambio con il Collezionista" });
        setScreen("map"); break;
      }
      case "bambinoSwap2": {
        const legendCard = generateCard("maledetto", 3);
        legendCard.name = "Edizione Limitata ✨";
        legendCard.prize = legendCard.isWinner ? Math.round(legendCard.prize * 1.5) : 0;
        updatePlayer(p => {
          const cards = [...p.scratchCards];
          cards.splice(Math.floor(rng() * cards.length), 1);
          if (cards.length > 0) cards.splice(Math.floor(rng() * cards.length), 1);
          cards.push(legendCard);
          return {...p, scratchCards: cards};
        });
        addLog("👦 \"Questo è LEGGENDARIO! Edizione Limitata! Non ne trovi più!\"", C.gold);
        setItemFoundModal({ emoji: "✨", name: "Edizione Limitata", desc: "Il bambino ti consegna un grattino leggendario, fuori produzione. Premi potenziati x1.5!", subtitle: "Scambio Leggendario" });
        setScreen("map"); break;
      }
      case "bambinoBuy": {
        const RARE_POOL2 = ["boccaDrago","miliardario","tredici","ruota"];
        const rareType2 = pick(RARE_POOL2);
        const rareCard2 = {...generateCard(rareType2, 2), owned: true};
        updatePlayer(p => ({...p, money: p.money - 30, scratchCards: [...p.scratchCards, rareCard2]}));
        const typeDef2 = CARD_TYPES.find(t => t.id === rareType2);
        addLog(`👦 "Per te, signore!" Comprato "${typeDef2.name}" raro per €30.`, C.gold);
        setItemFoundModal({ emoji: "👦", name: typeDef2.name, desc: `Il bambino tira fuori dalla tasca un "${typeDef2.name}" raro. "Ce l'ho doppio!"`, subtitle: "Acquisto dal Collezionista" });
        setScreen("map"); break;
      }
      case "bambinoVendiTutte": {
        const cards = player.grattedCards || [];
        const TIER_PRICE = { 1:3, 2:10, 3:25, 4:65 };
        let total = 0;
        cards.forEach(c => {
          const base = TIER_PRICE[c.tier] || 3;
          const isTriple = roll(0.1);
          total += (c.isWinner ? base * 2 : base) * (isTriple ? 3 : 1);
        });
        updatePlayer(p => ({...p, money: p.money + total, grattedCards: []}));
        addLog(`👦 Il bambino compra tutto! Ricevi €${total}!`, C.gold);
        setScreen("map"); break;
      }
      case "bambinoVendiUna": {
        const cards2 = player.grattedCards || [];
        if (cards2.length === 0) { setScreen("map"); break; }
        const c2 = cards2[0];
        const TIER_PRICE2 = { 1:3, 2:10, 3:25, 4:65 };
        const base2 = TIER_PRICE2[c2.tier] || 3;
        const isTriple2 = roll(0.1);
        const isWow = isTriple2;
        const price2 = (c2.isWinner ? base2 * 2 : base2) * (isTriple2 ? 3 : 1);
        if (isWow) addLog(`👦 "WOW UNA RARA!" Prezzo triplicato! +€${price2}!`, C.gold);
        else addLog(`👦 Ti dà €${price2} per "${c2.name}"!`, C.cyan);
        updatePlayer(p => ({...p, money: p.money + price2, grattedCards: p.grattedCards.slice(1)}));
        setScreen("map"); break;
      }
      case "streamerSkip": {
        addLog('"Boring..." — lo streamer cambia canale.', C.dim);
        setScreen("map"); break;
      }
      case "macellaio_neonato":
      case "macellaio_marcione":
      case "macellaio_baddie": {
        const implId = action.replace("macellaio_", "");
        const impl = MACELLAIO_IMPLANTS.find(x => x.id === implId);
        if (!impl || player.money < impl.cost) { setScreen("map"); break; }
        if (roll(0.25)) {
          updatePlayer(p => {
            const nails = [...p.nails];
            nails[p.activeNail] = {...nails[p.activeNail], state: "morta", scratchCount: 0};
            const nextActive = nails.findIndex((n,i) => i !== p.activeNail && n.state !== "morta");
            return {...p, money: p.money - impl.cost, nails, activeNail: nextActive >= 0 ? nextActive : p.activeNail};
          });
          addLog(`💀 L'operazione è andata storta! L'unghia attiva è morta!`, C.red);
          setItemFoundModal({ emoji:"💀", name:"Operazione Fallita!", desc:`Il Macellaio ha sbagliato. La tua unghia attiva è morta. -€${impl.cost} comunque.`, subtitle:"Chirurgo Macellaio", buttonLabel:"Ahi..." });
        } else {
          updatePlayer(p => {
            const nails = [...p.nails];
            nails[p.activeNail] = {...nails[p.activeNail], state:"sana", implant: implId, implantUses: impl.uses, scratchCount: 0};
            return {...p, money: p.money - impl.cost, nails};
          });
          addLog(`${impl.emoji} Impianto "${impl.name}" installato sull'unghia attiva! ${impl.uses} usi garantiti.`, C.cyan);
          setItemFoundModal({ emoji: impl.emoji, name: impl.name, desc: impl.desc, subtitle:"Chirurgo Macellaio", rarity: impl.rarity });
        }
        setScreen("map"); break;
      }
      case "silentBypass": {
        addLog("🎸 Ti muovi in silenzio... il ladro non ti ha notato!", C.cyan);
        setScreen("map"); break;
      }
      case "cappelloVsLadro": {
        updatePlayer(p => ({...p, items: p.items.filter(i => i !== "cappelloSbirro"), cappelloSbirroWorn: false}));
        addLog("🎩 Il ladro scappa vedendo il cappello! Ma il cappello si consuma.", C.green);
        setScreen("map"); break;
      }
      case "vecchio_ascolta":
        updatePlayer(p => ({...p, vecchioVisits: (p.vecchioVisits || 0) + 1, fortune: p.fortune + 1, fortuneTurns: p.fortuneTurns + 3}));
        addLog("🧓 Il Vecchio ti legge le unghie. +1 Fortuna per 3 turni.", C.gold);
        setScreen("map"); break;
      case "vecchio_dono":
        updatePlayer(p => {
          const visits = (p.vecchioVisits || 0) + 1;
          const nails = [...p.nails];
          const damaged = nails.findIndex(n => n.state !== "sana" && n.state !== "kawaii" && n.state !== "morta");
          if (damaged >= 0) nails[damaged] = {...nails[damaged], state: "sana", scratchCount: 0};
          return {...p, vecchioVisits: visits, nails};
        });
        addLog("🧓 Il Vecchio cura un'unghia con un tocco. \"Ricordati di me.\"", C.green);
        setScreen("map"); break;
      case "vecchio_lore":
        updatePlayer(p => ({...p, vecchioVisits: (p.vecchioVisits || 0) + 1}));
        addLog("🧓 \"Le unghie sono l'ultima cosa che resta di chi eravamo. Ogni grattata è una preghiera... o una bestemmia.\"", C.gold);
        setScreen("map"); break;
      case "vecchio_luce":
        updatePlayer(p => {
          const nails = [...p.nails];
          for (let i = 0; i < nails.length; i++) {
            if (nails[i].state !== "morta") nails[i] = {...nails[i], state: "sana", scratchCount: 0};
          }
          return {...p, vecchioVisits: 3, nails, fortune: p.fortune + 3, fortuneTurns: p.fortuneTurns + 5};
        });
        addLog("🌟 Una luce dorata avvolge le tue mani. Tutte le unghie risplendono. +3 Fortuna permanente!", C.gold);
        unlockAchievement("vecchio_luce");
        setScreen("map"); break;
      case "buyGuantoBoss": {
        const def = GRATTATORE_DEFS["guantoBoss"];
        if (!def || player.money < 60) { setScreen("map"); break; }
        const newGrat = { id: "guantoBoss", name: def.name, emoji: def.emoji, effect: def.effect, usesLeft: def.maxUses };
        updatePlayer(p => ({...p, money: p.money - 60, grattatori: [...p.grattatori, newGrat]}));
        addLog(`🧤 Hai comprato il ${def.name}! Protezione garantita contro il boss del bioma.`, C.gold);
        setItemFoundModal({
          emoji: def.emoji, name: def.name,
          desc: `${def.desc}\n\nPagato €60 al Guantaio.\n\n⚠️ Attivo SOLO contro il BOSS — su miniboss/ladri/poliziotti non fa nulla (resta in mano).`,
          subtitle: "Guanto acquistato",
        });
        setScreen("map"); break;
      }
      case "barattoGuantoBoss": {
        const def = GRATTATORE_DEFS["guantoBoss"];
        if (!def) { setScreen("map"); break; }
        updatePlayer(p => {
          const nails = [...p.nails];
          const idx = nails.findIndex(n => n.state !== "morta");
          if (idx >= 0) nails[idx] = {...nails[idx], state: "morta", scratchCount: 0};
          const newGrat = { id: "guantoBoss", name: def.name, emoji: def.emoji, effect: def.effect, usesLeft: def.maxUses };
          return {...p, money: p.money - 20, nails, grattatori: [...p.grattatori, newGrat]};
        });
        addLog(`🦴 Hai ceduto un'unghia + €20. Il Guantaio ti consegna il ${def.name}.`, C.cyan);
        setItemFoundModal({
          emoji: def.emoji, name: def.name,
          desc: `${def.desc}\n\nPagato con 1 unghia + €20.\n\n⚠️ Attivo SOLO contro il BOSS — su miniboss/ladri/poliziotti non fa nulla (resta in mano).`,
          subtitle: "Baratto col Guantaio",
        });
        setScreen("map"); break;
      }
      case "vecchio_ombra":
        updatePlayer(p => {
          const nails = [...p.nails];
          const sacrifice = nails.findIndex(n => n.state !== "morta");
          if (sacrifice >= 0) nails[sacrifice] = {...nails[sacrifice], state: "morta"};
          for (let i = 0; i < nails.length; i++) {
            if (nails[i].state !== "morta" && i !== sacrifice) nails[i] = {...nails[i], state: "kawaii"};
          }
          return {...p, vecchioVisits: 3, nails, money: p.money + 200};
        });
        addLog("🌑 L'ombra divora un'unghia... ma le altre brillano KAWAII. +€200!", C.magenta);
        unlockAchievement("vecchio_ombra");
        setScreen("map"); break;

      case "leave":
      default:
        setScreen("map");
        break;
    }
  };

  return { handleEventChoice };
}
