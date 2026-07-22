import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { C, FONT, MAX_ITEMS } from "./data/theme.js";
import { NAIL_INFO } from "./data/nails.js";
import { ACHIEVEMENTS } from "./data/achievements.js";
import { useLog } from "./hooks/useLog.js";
import { useMeta } from "./hooks/useMeta.js";
import { useAudioTheme } from "./hooks/useAudioTheme.js";
import { useVictoryCanvas } from "./hooks/useVictoryCanvas.js";
import { useNailEffects } from "./hooks/useNailEffects.js";
import { useNailHandlers } from "./hooks/useNailHandlers.js";
import { useItemHandlers } from "./hooks/useItemHandlers.js";
import { useShopHandlers } from "./hooks/useShopHandlers.js";
import { useScratchHandlers } from "./hooks/useScratchHandlers.js";
import { useNodeHandlers } from "./hooks/useNodeHandlers.js";
import { useEventHandlers } from "./hooks/useEventHandlers.js";
import { useSpacebarShortcut } from "./hooks/useSpacebarShortcut.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { NODE_ICONS } from "./data/map.js";
import { ITEM_DEFS, RELIC_DEFS, GRATTATORE_DEFS } from "./data/items.js";
import { BIOMES, CEDOLE, BIOME_PALETTE } from "./data/biomes.js";
import { MECH_RULES, CARD_TYPES } from "./data/cards.js";
import { ASCII_TITLE } from "./data/art.js";
import { AudioEngine } from "./audio.js";
import { clamp } from "./utils/random.js";
import { Haptics } from "./utils/haptics.js";
import { degradeNailObj, makeNailCursor } from "./utils/nail.js";
import { generateCard } from "./utils/card.js";
import { generateMap } from "./utils/map.js";

import { S } from "./utils/styles.js";
// uiZoom reserved for future use
import { Tooltip } from "./components/Tooltip.jsx";
import { Btn } from "./components/Btn.jsx";
import { CarmeloLogBox, CarmeloScratchStrip } from "./components/DialogueBox.jsx";
import { NewsTicker, NpcCommentStrip } from "./components/NewsTicker.jsx";
import { HUD } from "./components/HUD.jsx";
import { LogPanel, LogSidebar } from "./components/LogPanel.jsx";
import { NailSidebar } from "./components/NailSidebar.jsx";
import { InventorySidebar } from "./components/InventorySidebar.jsx";
// ScratchCell usato solo dentro ScratchCardView — non serve importarlo qui
import { CARD_VARIANTS } from "./utils/combat.js";
import { STORAGE_KEYS, getStored, setStored, removeStored } from "./utils/storage.js";

// ─── LAZY CHUNKS — ogni schermata scaricata on-demand ─────────────────────────
const ScratchCardView  = lazy(() => import("./components/ScratchCardView.jsx").then(m => ({ default: m.ScratchCardView })));
const DoppioONullaView = lazy(() => import("./components/DoppioONullaView.jsx").then(m => ({ default: m.DoppioONullaView })));
const MapView          = lazy(() => import("./components/MapView.jsx").then(m => ({ default: m.MapView })));
const ShopView         = lazy(() => import("./components/ShopView.jsx").then(m => ({ default: m.ShopView })));
const LocandaView      = lazy(() => import("./components/LocandaView.jsx").then(m => ({ default: m.LocandaView })));
const EventView        = lazy(() => import("./components/EventView.jsx").then(m => ({ default: m.EventView })));
const CombatView       = lazy(() => import("./components/CombatView.jsx").then(m => ({ default: m.CombatView })));
// ═══════════════════════════════════════════════════════════════
//  G R A T T I N I  —  Beta 5
//  A roguelike scratch card game with ASCII aesthetics
// ═══════════════════════════════════════════════════════════════


// ─── LAZY FALLBACK — schermata di attesa per i chunk on-demand ───────────────
function LazyFallback() {
  return (
    <div style={{
      flex:1, display:"flex", alignItems:"center", justifyContent:"center",
      color:"#333355", fontFamily:"monospace", fontSize:"11px", letterSpacing:"2px",
    }}>
      ░░░
    </div>
  );
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────
const hasRelic = (player, effectId) => player?.relics?.some(r => r.effect === effectId);




// ═══════════════════════════════════════════════════════════════
//  MAIN GAME COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Grattini() {
  // ─── GAME STATE ─────────────────────────────────────────────
  const [screen, setScreen] = useState("title");
  const [player, setPlayer] = useState(null);
  const [map, setMap] = useState(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [visitedNodes, setVisitedNodes] = useState([]);
  const [currentNode, setCurrentNode] = useState(null);
  // ─── HOOK: useLog ───
  const { log, setLog, carmeloLog, setCarmeloLog, addLog, triggerNpcComment } = useLog();
  const [preScratchCount, setPreScratchCount] = useState(0);
  const [scratchingCard, setScratchingCard] = useState(null);
  const [combatEnemy, setCombatEnemy] = useState(null);
  const [introCardsLeft, setIntroCardsLeft] = useState(3);
  const [introPrizes, setIntroPrizes] = useState([]); // prizes from both intro cards, not yet pocketed
  const [cardSelectMode, setCardSelectMode] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState(null);
  const [returnScreen, setReturnScreen] = useState(null); // where to go back after scratch
  const [currentBiome, setCurrentBiome] = useState(0);
  const [gameStats, setGameStats] = useState({ nodesVisited:0, moneyEarned:0, cardsScratched:0, scratchWins:0, scratchLosses:0 });
  const [firstScratchShown, setFirstScratchShown] = useState(false);
  const [hoveredIntroIdx, setHoveredIntroIdx] = useState(-1);
  const [nailSanguinanteModal, setNailSanguinanteModal] = useState(false);
  const [cellaProgress, setCellaProgress] = useState(0); // graffi al muro in cella (0-8 = evaso)
  const [tutorialPage, setTutorialPage] = useState(0); // 0 = unghie, 1 = meccaniche
  // ─── HOOK: useMeta ───
  const {
    achievements, setAchievements,
    activeCedola, setActiveCedola,
    pendingCedoleOffer, setPendingCedoleOffer,
    achievementToast, setAchievementToast,
    showTrophies, setShowTrophies,
    showReliquie, setShowReliquie,
    discoveredRelics, setDiscoveredRelics,
    enabledRelics, setEnabledRelics,
    showAllTimeStats, setShowAllTimeStats,
    unlockAchievement,
    updateAllTimeStats,
    vintageCollected, collectVintage,
  } = useMeta();
  // ─── SPECIAL MINIGAME STATES ─────────────────────────────────
  const [labirintoState, setLabirintoState] = useState(null); // {pos, revealed, prize, grid, done}
  const [showVintage, setShowVintage] = useState(false); // Sprint 5: modal collezione vintage
  const [combinaState, setCombinaState] = useState(null); // gratta & combina
  const [tesoroState, setTesoroState] = useState(null); // mappa del tesoro
  const [specialCardRef, setSpecialCardRef] = useState(null); // card that triggered the minigame
  // nessuno zoom — il contenuto riempie il frame 16:9 naturalmente

  // ─── HOOK: useAudioTheme ───
  useAudioTheme({ screen, currentNode, combatEnemy, currentBiome });


  // Commenti reattivi al cambio schermata
  useEffect(() => {
    if (!player) return;
    if (screen === "shop") triggerNpcComment("shop");
    else if (screen === "combat") triggerNpcComment("combat");
    else if (screen === "map") triggerNpcComment("map");
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Haptics al cambio schermata ──────────────────────────────
  useEffect(() => {
    if (screen === "gameOver")  Haptics.gameOver();
    if (screen === "victory")   Haptics.victory();
    if (screen === "combat")    Haptics.tap();
    if (screen === "map")       Haptics.tap();
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePlayer = useCallback((updates) => {
    setPlayer(p => {
      const next = typeof updates === "function" ? updates(p) : {...p, ...updates};
      // Ka-ching! quando il money aumenta
      if (next.money > p.money) AudioEngine.cash();
      return next;
    });
  }, []);

  // ─── GAME INITIALIZATION ───────────────────────────────────
  const startGame = () => {
    AudioEngine.init(); // sblocca AudioContext durante gesto utente
    const newPlayer = {
      money: 0,
      nails: Array(5).fill(null).map(() => ({ state: "sana", scratchCount: 0, implant: null, implantUses: 0, stats: { fortuna: 0, potenza: 0, resilienza: 0 }, heldItem: null, cremaHP: 0 })),
      activeNail: 0,
      items: [],
      grattatori: [], // { id, name, emoji, effect, usesLeft }
      equippedGrattatore: null,
      scratchCards: [
        {...generateCard("fortunaFlash"), owned: false},
        {...generateCard("setteEMezzo"), owned: false},
        {...generateCard("portaFortuna"), owned: false},
      ],
      fortune: 0,
      fortuneTurns: 0,
      smokesTotal: 0,
      tumore: false,
      // Sprint 2: tick counters per risk/reward sigarette
      sigarettaTicks: 0, // -> unghiaNera quando raggiunge 0
      erbaTicks: 0,      // -> polliceVerde quando raggiunge 0
      consecutiveWins: 0,
      grattaMania: false,
      grattaManiaTurns: 0,
      skills: [],
      anzianaVisits: 0,
      vecchioVisits: 0,
      monetaCineseActive: false,
      clipViraleActive: false,
      cappelloSbirroWorn: false, // true = indossato e attivo
      // Sprint 4: tensione psicologica
      streamerFollowers: 0, // aumenta con streamerLive → donazioni dinamiche in combat
      snitchedOn: false,    // true dopo Snitch al Poliziotto → spacciatore ostile
      bluffsBought: 0,      // quanti falsi-vincenti comprati dallo spacciatore (stat)
      // Sprint 5: Giornaletto Porno
      giornalettoRead: false, // true mentre il giornaletto è letto recentemente → Poliziotto ti becca
      giornalettoTicks: 0,    // grattate rimanenti prima che svanisca l'effetto
      // Sprint 5: Vintage Collezionabili (achievement meta)
      vintageCollection: [],  // array di id variant raccolti (FOIL/STRAPPATO/ORO/BN/MULTI)
      grattedCards: [], // storico carte grattate: [{typeId, tier, isWinner, prize, name}]
      lastWonPrize: 0, // ultimo premio vinto (per Doppio o Nulla x2)
      extraTiles: [], // tile extra nel grattino corrente (es. monetaCinese)
      relics: enabledRelics.map(id => RELIC_DEFS[id] ? {id, ...RELIC_DEFS[id]} : null).filter(Boolean), // reliquie abilitate dalla meta
    };
    // Applica cedola attiva se presente
    let finalPlayer = newPlayer;
    const cedolaId = activeCedola;
    if (cedolaId) {
      const cedolaDef = CEDOLE.find(c => c.id === cedolaId);
      if (cedolaDef) {
        finalPlayer = cedolaDef.apply(newPlayer);
        // bonusStartCard: aggiungi carta gratis al mazzo di partenza
        if (finalPlayer.bonusStartCard) {
          const bonusCard = {...generateCard(finalPlayer.bonusStartCard), owned: true};
          finalPlayer = {...finalPlayer, scratchCards: [...finalPlayer.scratchCards, bonusCard], bonusStartCard: null};
        }
        addLog(`🃏 Cedola attiva: ${cedolaDef.icon} ${cedolaDef.name}`, C.gold);
      }
    }
    setPlayer(finalPlayer);
    setCurrentBiome(0);
    setMap(generateMap(0));
    setCurrentRow(0);
    setVisitedNodes([]);
    setLog([]);
    setCarmeloLog([`Eh figliolo... settant'anni di tabaccheria e adesso non ci vedo più niente.\nHo questi tre grattini qui, me li gratti tu?\nTieniti quello che vuoi, tanto non ci vedo, e il buio è uguale vincere o perdere.`]);
    setPreScratchCount(0);
    setIntroCardsLeft(3);
    setIntroPrizes([]);
    setGameStats({ nodesVisited:0, moneyEarned:0, cardsScratched:0, scratchWins:0, scratchLosses:0, moneySpent:0, combatsWon:0, combatsLost:0, nailsLost:0, dreamsHad:0, slotPlays:0, bestPrize:0, combosFired:0, _chirurgoUses:0, _broke:false });
    setFirstScratchShown(false);
    setVictoryRevealed(false);
    setTutorialPage(0);
    setScreen("tutorialNails");
    addLog(`Benvenuto a ${BIOMES[0].name}!`, C.cyan);
    addLog("Nonno Carmelo ti ferma al bancone. Ha tre biglietti e mani che tremano. Gratti tu, scegli tu.", C.gold);
  };

  // ─── HOOK: useNailEffects ───
  const { globalPainFlash, nailDeathFlash, setNailDeathFlash, screenShake, setScreenShake, moneyBling } = useNailEffects({ player, screen, gameStats, unlockAchievement, updateAllTimeStats, addLog });

  // ─── HOOK: useVictoryCanvas ───
  const { victoryRevealed, setVictoryRevealed, victoryCanvasRef, victoryDrawing, handleVictoryScratch } = useVictoryCanvas({ screen });

  // ─── HELPER: isAlive ────────────────────────────────────────
  const isAlive = (nails) => {
    const n = nails || player?.nails;
    if (!n) return true;
    return n.some(nail => nail.state !== "morta");
  };

  // ─── HELPER: consumeGrattatore ────────────────────────────
  const consumeGrattatore = useCallback(() => {
    updatePlayer(p => {
      if (!p.equippedGrattatore) return p;
      const idx = p.equippedGrattatore.inventoryIdx;
      const grattatori = [...p.grattatori];
      const g = {...grattatori[idx]};
      g.usesLeft -= 1;
      if (g.usesLeft <= 0) {
        grattatori.splice(idx, 1);
        addLog(`${g.name} consumato!`, C.dim);
        return {...p, grattatori, equippedGrattatore: null};
      } else {
        grattatori[idx] = g;
        const newEquipped = {...p.equippedGrattatore, usesLeft: g.usesLeft};
        return {...p, grattatori, equippedGrattatore: newEquipped};
      }
    });
  }, [updatePlayer, addLog]);

  // ─── HOOK: useNailHandlers ───
  const { playerRelicEffects, effectiveFortune, getActiveNailState, handleCellScratch, handleNailDamage, handleCombatCellScratch } = useNailHandlers({
    player, updatePlayer, triggerNpcComment, scratchingCard, setScreen, addLog,
  });

  // ─── HOOK: useItemHandlers ───
  const {
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
  } = useItemHandlers({ player, updatePlayer, addLog });

  // ─── HOOK: useShopHandlers ───
  const { handleBuyCard, handleBuyItem, handleBuyGrattatore, handleSlotResult, handleShopScratch } = useShopHandlers({
    player, updatePlayer, addLog, setGameStats, setCardSelectMode, setScreen, setReturnScreen, effectiveFortune, unlockAchievement,
    setItemFoundModal, currentBiome,
  });

  // ─── HOOK: useScratchHandlers ───
  const { doppioONulla, setDoppioONulla, handleScratchDone, handleDoppioDecline, handleDoppioResult } = useScratchHandlers({
    player, scratchingCard, returnScreen, currentNode, currentRow, currentBiome,
    updatePlayer, addLog, triggerNpcComment, consumeGrattatore, unlockAchievement,
    setGameStats, setScratchingCard, setReturnScreen, setCardSelectMode, setSelectedCardIdx,
    setScreen, setIntroCardsLeft, setIntroPrizes, setItemFoundModal,
    setMap, setCurrentRow, setVisitedNodes, setCurrentNode, setCurrentBiome,
    setPlayer, isAlive,
  });

  // ─── HOOK: useNodeHandlers ───
  const { dreamModal, setDreamModal, selectNode, enterNode, handlePreScratch, handleSelectCard, handleRest, handleCombatEnd } = useNodeHandlers({
    player, currentNode, currentBiome, currentRow,
    updatePlayer, addLog, triggerNpcComment, unlockAchievement, updateAllTimeStats,
    consumeGrattatore, handleNailDamage, showItemFound,
    setScreen, setCurrentNode, setVisitedNodes, setCurrentRow, setPreScratchCount,
    setGameStats, setCardSelectMode, setReturnScreen, setScratchingCard, setSelectedCardIdx,
    setCombatEnemy, setCurrentBiome, setMap, setPlayer,
    setItemFoundModal, setDiscoveredRelics,
    setLabirintoState, setCombinaState, setTesoroState, setSpecialCardRef,
    effectiveFortune, gameStats, isAlive,
  });

  // ─── HOOK: useEventHandlers ───
  const { handleEventChoice } = useEventHandlers({
    player, currentNode, currentBiome, effectiveFortune,
    updatePlayer, addLog, unlockAchievement, showItemFound,
    setScreen, setCombatEnemy, setGameStats, setCellaProgress,
    setItemFoundModal, setSmokeChoiceModal,
    setScratchingCard, setReturnScreen,
  });

  // ─── HOOK: useSpacebarShortcut ───
  useSpacebarShortcut({ screen, startGame, handlePreScratch, enterNode, preScratchCount, player, setScreen });

  // ─── GRATTATORE EQUIP/UNEQUIP ─────────────────────────────
  const equipGrattatore = (idx) => {
    updatePlayer(p => {
      const g = p.grattatori[idx];
      return {...p, equippedGrattatore: {...g, inventoryIdx: idx}};
    });
    addLog(`Grattatore equipaggiato: ${player.grattatori[idx]?.name}`, C.cyan);
  };

  const unequipGrattatore = () => {
    updatePlayer(p => ({...p, equippedGrattatore: null}));
  };

  // ─── NAIL SELECT ──────────────────────────────────────────
  const handleSelectNail = (i) => {
    if (scratchingCard) return; // locked during scratch
    updatePlayer(p => ({...p, activeNail: i}));
    addLog(`Unghia ${i+1} selezionata come attiva.`, C.cyan);
  };

  // ─── GET REACHABLE NODES ───────────────────────────────────
  const getReachableNodes = () => {
    if (!map) return [];
    if (currentRow === 0) return map.rows[0].map(n => n.id);
    const reachable = new Set();
    map.rows[currentRow - 1]?.forEach(node => {
      if (node && visitedNodes.includes(node.id)) {
        (map.connections[node.id] || []).forEach(id => reachable.add(id));
      }
    });
    if (reachable.size === 0 && currentRow <= 1) {
      map.rows[currentRow]?.forEach(n => n && reachable.add(n.id));
    }
    return [...reachable];
  };

  // ─── RENDER ─────────────────────────────────────────────────
  // Cursore globale: mano pixel-art con unghia del colore dello stato attivo
  const globalNailState = player?.nails?.[player?.activeNail ?? 0]?.state ?? "sana";
  const globalNailCursor = makeNailCursor(screen === "gameOver" ? "scheletro" : globalNailState);

  // Neon dimming: glow effects fade when few nails alive
  const aliveCount = player?.nails?.filter(n => n.state !== "morta").length ?? 5;
  const neonDim = aliveCount <= 1 ? 0.3 : aliveCount <= 2 ? 0.5 : aliveCount <= 3 ? 0.7 : 1.0;

  const bioPal = BIOME_PALETTE[currentBiome] || BIOME_PALETTE[0];

  // iPhone/mobile: layout verticale a colonna singola invece di 3 colonne
  const { isMobile } = useIsMobile();

  return (
    /* position:fixed inset:0 — l'unico modo 100% affidabile su iOS Safari:
       non usa vh (sballato con URL bar), non usa height:100% in un flex-row
       (non risolve il % quando alignItems≠stretch), non usa absolute (può
       avere il containing block sbagliato se un ancestor ha transform).
       Il wrapper è un semplice blocco: niente flex, niente centering — così
       S.container con height:100% risolve senza ambiguità. */
    <div style={{
      position:"fixed", inset:0,
      background: bioPal.bg,
      overflow:"hidden",
    }}>
    {/* ── FRAME FLUIDO — riempie tutto il viewport, layout responsive ── */}
    {/* paddingTop/Bottom con env() per Dynamic Island e home bar */}
    <div style={{...S.container, cursor: globalNailCursor,
      width: "100%",
      height: "100%",
      paddingTop: "env(safe-area-inset-top, 0px)",
      /* paddingBottom rimosso: gestito dal DESK così il background riempie
         fino al bordo fisico dello schermo (PWA standalone mode). */
      animation: screenShake ? "screenShake 0.3s ease-in-out" : "none",
      filter: neonDim < 1 ? `saturate(${neonDim}) brightness(${0.6 + neonDim * 0.4})` : "none",
      transition: "filter 1.5s ease",
      background: bioPal.bg,
      overflow:"hidden",
      display:"flex", flexDirection:"column",
    }}>
      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes glow { 0%,100% { text-shadow: 0 0 5px ${C.gold}; } 50% { text-shadow: 0 0 20px ${C.gold}, 0 0 40px ${C.gold}44; } }
        @keyframes fadeOut { 0% { opacity:1; } 70% { opacity:0.8; } 100% { opacity:0; } }
        @keyframes neonPulse { 0%,100% { box-shadow: 0 0 5px ${C.cyan}22, 0 0 10px ${C.cyan}11; } 50% { box-shadow: 0 0 12px ${C.cyan}44, 0 0 24px ${C.cyan}22; } }
        @keyframes slotGlow { 0%,100% { box-shadow: 0 0 8px ${C.gold}33, 0 0 16px ${C.gold}18; } 50% { box-shadow: 0 0 16px ${C.gold}55, 0 0 32px ${C.gold}28; } }
        @keyframes winFlash { 0% { box-shadow: 0 0 0px ${C.green}00; } 50% { box-shadow: 0 0 30px ${C.green}88, 0 0 60px ${C.green}44; } 100% { box-shadow: 0 0 12px ${C.green}33; } }
        @keyframes neonText { 0%,100% { text-shadow: 0 0 4px currentColor; } 50% { text-shadow: 0 0 12px currentColor, 0 0 24px currentColor; } }
        @keyframes moneyBling { 0% { text-shadow: none; box-shadow: 0 0 6px ${C.gold}44; } 25% { text-shadow: 0 0 14px ${C.gold}, 0 0 28px ${C.gold}99; box-shadow: 0 0 22px ${C.gold}88, inset 0 0 10px ${C.gold}33; } 60% { text-shadow: 0 0 8px ${C.gold}; box-shadow: 0 0 12px ${C.gold}55; } 100% { text-shadow: none; box-shadow: 0 0 6px ${C.gold}44; } }
        @keyframes stampIn { 0% { transform: rotate(-12deg) scale(3); opacity:0; } 50% { transform: rotate(-12deg) scale(0.9); opacity:1; } 70% { transform: rotate(-12deg) scale(1.1); } 100% { transform: rotate(-12deg) scale(1.2); opacity:1; } }
        @keyframes screenShake { 0% { transform: translate(0,0); } 10% { transform: translate(-4px,2px); } 20% { transform: translate(4px,-2px); } 30% { transform: translate(-3px,-3px); } 40% { transform: translate(3px,3px); } 50% { transform: translate(-2px,1px); } 60% { transform: translate(2px,-1px); } 70% { transform: translate(-1px,2px); } 80% { transform: translate(1px,-1px); } 90% { transform: translate(-1px,0); } 100% { transform: translate(0,0); } }
        @keyframes glitA { 0% { opacity:0; transform:translate(0,0) scale(0.3); } 40% { opacity:1; transform:translate(9px,-14px) scale(1.2); } 70% { opacity:0.6; transform:translate(16px,-8px) scale(0.8); } 100% { opacity:0; transform:translate(6px,-22px) scale(0.3); } }
        @keyframes glitB { 0% { opacity:0; transform:translate(0,0) scale(0.3); } 40% { opacity:1; transform:translate(-11px,10px) scale(1.3); } 70% { opacity:0.5; transform:translate(-18px,4px) scale(0.9); } 100% { opacity:0; transform:translate(-8px,18px) scale(0.3); } }
        @keyframes glitC { 0% { opacity:0; transform:translate(0,0) scale(0.4); } 35% { opacity:1; transform:translate(7px,12px) scale(1.1); } 65% { opacity:0.7; transform:translate(-4px,20px) scale(0.7); } 100% { opacity:0; transform:translate(2px,26px) scale(0.3); } }
        @keyframes glitD { 0% { opacity:0; transform:translate(0,0) scale(0.3); } 45% { opacity:1; transform:translate(-8px,-16px) scale(1.4); } 75% { opacity:0.4; transform:translate(-14px,-6px) scale(0.8); } 100% { opacity:0; transform:translate(-4px,-24px) scale(0.3); } }
        @keyframes glitE { 0% { opacity:0; transform:translate(0,0) scale(0.35); } 50% { opacity:1; transform:translate(14px,6px) scale(1.2); } 80% { opacity:0.5; transform:translate(20px,-4px) scale(0.7); } 100% { opacity:0; transform:translate(10px,-14px) scale(0.3); } }
        @keyframes glitF { 0% { opacity:0; transform:translate(0,0) scale(0.4); } 40% { opacity:0.9; transform:translate(-6px,14px) scale(1.1); } 60% { opacity:1; transform:translate(-12px,8px) scale(1.3); } 100% { opacity:0; transform:translate(-20px,-6px) scale(0.3); } }
        @keyframes floatUp { 0% { transform:translateY(0) scale(1); opacity:0.7; } 100% { transform:translateY(-18px) scale(0.5); opacity:0; } }
        @keyframes achievementSlide { 0% { transform:translateX(120%); opacity:0; } 100% { transform:translateX(0); opacity:1; } }
        @keyframes nodePop { 0% { transform:scale(0.85); } 60% { transform:scale(1.05); } 100% { transform:scale(1); } }
        @keyframes lineFlow { 0% { stroke-dashoffset:20; } 100% { stroke-dashoffset:0; } }
        @keyframes newsTicker { 0% { transform: translateX(0); } 100% { transform: translateX(calc(-100% - 100vw)); } }
        @keyframes dialogueCursor { 0%,49% { opacity:1; } 50%,100% { opacity:0; } }
        @keyframes inventorySlideIn { 0% { transform:translateX(100%); opacity:0; } 100% { transform:translateX(0); opacity:1; } }
        @keyframes dialogueIn { 0% { opacity:0; transform:translateY(8px); } 100% { opacity:1; transform:translateY(0); } }
        @keyframes titleBlink { 0%,100% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } 48% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } 50% { text-shadow: 0 0 40px ${C.gold}, 0 0 80px ${C.gold}aa, 0 0 120px ${C.gold}55; opacity:0.7; } 52% { text-shadow: 0 0 10px ${C.gold}88, 0 0 30px ${C.gold}44; opacity:1; } }
        @keyframes titleGlitter { 0% { opacity:0; transform:scale(0.4) translateY(0); } 25% { opacity:1; transform:scale(1.3) translateY(-3px); } 60% { opacity:0.5; transform:scale(0.9) translateY(-7px); } 100% { opacity:0; transform:scale(0.3) translateY(-14px); } }
        @keyframes bossGlow { 0%,100% { box-shadow:0 0 14px #ff2244aa,0 0 28px #ff224466,0 0 2px #fff; } 50% { box-shadow:0 0 28px #ff2244ff,0 0 56px #ff224499,0 0 4px #fff; } }
        @keyframes comboPulse { 0% { transform:translateX(-50%) scale(1); box-shadow:0 0 30px #ffaa0088,0 0 60px #ffaa0044; } 100% { transform:translateX(-50%) scale(1.06); box-shadow:0 0 50px #ffaa00cc,0 0 100px #ffaa0066; } }
        @keyframes variantReveal { 0% { transform: scale(0.7) rotate(-8deg); filter: brightness(3) saturate(2); } 40% { transform: scale(1.15) rotate(2deg); filter: brightness(2) saturate(1.8); } 70% { transform: scale(0.96) rotate(-1deg); } 100% { transform: scale(1) rotate(0); filter: brightness(1) saturate(1); } }
        @keyframes variantShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes variantPulse { 0%,100% { filter: brightness(1) saturate(1); } 50% { filter: brightness(1.35) saturate(1.4); } }
        @keyframes variantSparkle { 0% { opacity: 0; transform: scale(0.3) rotate(0); } 40% { opacity: 1; transform: scale(1.2) rotate(120deg); } 100% { opacity: 0; transform: scale(0.4) rotate(240deg); } }
        @keyframes oroGlint { 0%,100% { box-shadow: 0 0 36px #ffd700ff, 0 0 64px #ffaa00aa, inset 0 0 36px #ffaa0099; } 50% { box-shadow: 0 0 52px #ffee44ff, 0 0 96px #ffcc00dd, inset 0 0 48px #ffcc00cc; } }
        @keyframes foilShine { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
        @keyframes foilHue { 0%,100% { filter: hue-rotate(0deg) saturate(1); } 50% { filter: hue-rotate(18deg) saturate(1.3); } }
        @keyframes asciiFlicker { 0%,100% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } 47% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } 48% { text-shadow: 0 0 2px currentColor, 0 0 6px currentColor44; } 52% { text-shadow: 0 0 2px currentColor, 0 0 6px currentColor44; } 53% { text-shadow: 0 0 14px currentColor, 0 0 40px currentColor55; } }
        @keyframes itemFoundIn { 0% { transform:scale(0.8); opacity:0; } 55% { transform:scale(1.04); } 100% { transform:scale(1); opacity:1; } }
        @keyframes itemGlowRing { 0%,100% { opacity:0.55; transform:scale(0.94); } 50% { opacity:1; transform:scale(1.08); } }
        @keyframes screenIn { 0% { opacity:0; transform:translateY(5px); } 100% { opacity:1; transform:translateY(0); } }
        @keyframes popIn { 0% { opacity:0; transform:scale(0.86); } 60% { transform:scale(1.05); } 100% { opacity:1; transform:scale(1); } }
        @keyframes crtFlicker { 0%,93%,100% { opacity:1; } 94% { opacity:0.91; } 96% { opacity:0.97; } 98% { opacity:0.93; } }
        @keyframes goldSheen { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes slideUp { 0% { opacity:0; transform:translateY(10px); } 100% { opacity:1; transform:translateY(0); } }
        @keyframes biomePulse { 0%,100% { opacity:0.55; } 50% { opacity:1; } }
        @keyframes borderGlow { 0%,100% { box-shadow:0 0 4px currentColor33; } 50% { box-shadow:0 0 12px currentColor66, 0 0 24px currentColor22; } }
        @keyframes nailCrit { 0% { transform:scale(1); } 20% { transform:scale(1.18); filter:brightness(1.6); } 50% { transform:scale(0.94); } 100% { transform:scale(1); filter:brightness(1); } }
        @keyframes chipIn { 0% { opacity:0; transform:translateX(-6px) scale(0.9); } 100% { opacity:1; transform:translateX(0) scale(1); } }
        /* .foil-ascii::after rimosso — il shimmer diagonale con mix-blend-mode:screen
           creava un "contorno brillante" deformato sulle lettere box-drawing del titolo.
           Il class resta no-op per back-compat; il titolo ora si affida solo al gold
           base + text-shadow + asciiFlicker. */
        .foil-ascii { position: relative; display: inline-block; animation: crtFlicker 14s ease-in-out infinite; }
        html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 0px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: ${C.dim}88; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.dim}; }
        /* Forza il cursore unghia su tutto — sovrascrive pointer di sistema su button/link */
        button, a, input, select, [role="button"], [tabindex] { cursor: inherit !important; }
        /* ── MOBILE / iPhone: tap target Apple HIG (min 44px) ── */
        @media (max-width: 768px) {
          button { min-height: 44px; }
          /* slider volume: pollice più grande */
          input[type="range"] { height: 28px; }
          input[type="range"]::-webkit-slider-thumb { width: 22px; height: 22px; }
          /* niente hover-stick su touch: i :hover restano attaccati dopo il tap */
          * { -webkit-touch-callout: none; }
        }
        /* ── SCREEN TRANSITION ── */
        @keyframes screenFadeIn { 0% { opacity:0; transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        /* ── MAP SNAP SCROLL ── */
        .map-snap-scroll { scroll-snap-type: y mandatory; }
        @keyframes screenFlash  { 0% { opacity:1; } 40% { opacity:1; } 100% { opacity:0; } }
        /* ── GAME OVER EPIC ── */
        @keyframes gameOverFlicker {
          0%,100% { opacity:1; text-shadow: 0 0 16px #ff0022cc, 0 0 40px #ff002288; }
          8%  { opacity:0.7; text-shadow: 0 0 4px #ff002244; }
          10% { opacity:1; text-shadow: 0 0 24px #ff0022ff, 0 0 60px #ff002299; }
          55% { opacity:1; text-shadow: 0 0 16px #ff0022cc, 0 0 40px #ff002288; }
          56% { opacity:0.5; }
          57% { opacity:1; text-shadow: 0 0 40px #ff0022ff; }
        }
        @keyframes gameOverBorder {
          0%,100% { box-shadow: 0 0 28px #ff002277, inset 0 0 32px #ff002214; }
          50%      { box-shadow: 0 0 60px #ff0022bb, inset 0 0 60px #ff002230; }
        }
        @keyframes gameOverSkull { 0% { transform:translateY(0) scale(1); } 10% { transform:translateY(-6px) scale(1.08); } 25% { transform:translateY(2px) scale(0.96); } 100% { transform:translateY(0) scale(1); } }
        /* ── VICTORY EPIC ── */
        @keyframes victoryGoldPulse { 0%,100% { text-shadow: 0 0 12px #ffd700bb, 0 0 40px #ffd70066; } 50% { text-shadow: 0 0 30px #ffd700ff, 0 0 80px #ffd700aa, 0 0 120px #ffcc0055; } }
        @keyframes confettiDrop { 0% { transform:translateY(-20px) rotate(0deg); opacity:1; } 100% { transform:translateY(120px) rotate(720deg); opacity:0; } }
        @keyframes statTileIn { 0% { transform:scale(0.7) translateY(10px); opacity:0; } 100% { transform:scale(1) translateY(0); opacity:1; } }
        @keyframes scratchCardSlideIn { 0% { opacity:0; transform:translateY(18px) scale(0.97); } 100% { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes scratchTopBarIn { 0% { opacity:0; transform:translateY(-10px); } 100% { opacity:1; transform:translateY(0); } }

        /* ══ V2 HOLO LAYER — foil olografico, glassmorphism, tilt 3D ══════════
           .holo        → overlay arcobaleno iridescente + sweep di luce diagonale
           .holo-strong → variante più intensa (title screen, card leggendarie)
           .glass       → pannello traslucido con blur (vince sugli inline style)
           .card3d      → respiro prospettico 3D continuo, delay sfalsati        */
        @keyframes holoSweep { 0% { background-position: 0% 0%; } 100% { background-position: 300% 300%; } }
        @keyframes holoGlide { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
        @keyframes holoBreath {
          0%,100% { transform: perspective(700px) rotateX(1.4deg) rotateY(-2.2deg) translateY(0); }
          50%      { transform: perspective(700px) rotateX(-1.4deg) rotateY(2.2deg) translateY(-3px); }
        }
        @keyframes holoTitleHue {
          0%,100% { filter: hue-rotate(-12deg) saturate(1.1); }
          50%      { filter: hue-rotate(28deg) saturate(1.5) brightness(1.1); }
        }
        .holo { position: relative; isolation: isolate; }
        .holo::before {
          content:""; position:absolute; inset:0; z-index:4; pointer-events:none;
          background: linear-gradient(115deg,
            rgba(255,0,80,0.30) 0%, rgba(255,160,0,0.24) 14%, rgba(255,240,0,0.20) 28%,
            rgba(0,255,140,0.20) 42%, rgba(0,220,255,0.28) 56%, rgba(80,80,255,0.26) 70%,
            rgba(220,0,255,0.28) 84%, rgba(255,0,80,0.30) 100%);
          background-size: 320% 320%;
          mix-blend-mode: screen;
          opacity: 0.26;
          animation: holoSweep 6s linear infinite;
        }
        .holo::after {
          content:""; position:absolute; inset:0; z-index:5; pointer-events:none;
          background: linear-gradient(100deg, transparent 36%, rgba(255,255,255,0.30) 47%, rgba(255,255,255,0.06) 53%, transparent 64%);
          background-size: 260% 100%;
          mix-blend-mode: screen;
          animation: holoGlide 3.4s linear infinite;
        }
        .holo-strong::before { opacity: 0.45; }
        .holo-strong::after  { animation-duration: 2.6s; }
        .glass {
          background: rgba(8,10,24,0.55) !important;
          backdrop-filter: blur(16px) saturate(1.6);
          -webkit-backdrop-filter: blur(16px) saturate(1.6);
        }
        .card3d { transform-style: preserve-3d; animation: holoBreath 7s ease-in-out infinite; will-change: transform; }
        .card3d:nth-child(2) { animation-delay: -1.8s; }
        .card3d:nth-child(3) { animation-delay: -3.5s; }
        .card3d:nth-child(4) { animation-delay: -5.2s; }
        .holo-title { animation: holoTitleHue 9s ease-in-out infinite; }
        /* ── V2.1 TABACCHERIA NOTTURNA ── */
        @keyframes neonFlickerT {
          0%,100% { opacity:1; }
          3%  { opacity:0.55; } 4%  { opacity:1; }
          7%  { opacity:0.8; }  8%  { opacity:1; }
          42% { opacity:1; }    43% { opacity:0.5; }
          44% { opacity:1; }    71% { opacity:1; }
          72% { opacity:0.75; } 73% { opacity:1; }
        }
        @keyframes smokeRise {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity:0; }
          12%  { opacity:0.45; }
          70%  { opacity:0.18; }
          100% { transform: translateY(-78vh) translateX(36px) scale(2.1); opacity:0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .holo::before, .holo::after, .card3d, .holo-title { animation: none !important; }
        }
      `}</style>

      {/* ── V2.1 GRANA PELLICOLA + VIGNETTATURA — unifica tutte le schermate ── */}
      <div aria-hidden style={{
        position:"fixed", inset:0, zIndex:90000, pointerEvents:"none",
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
        opacity:0.05, mixBlendMode:"overlay",
      }}/>
      <div aria-hidden style={{
        position:"fixed", inset:0, zIndex:90001, pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 42%, transparent 56%, rgba(0,0,0,0.40) 100%)",
      }}/>

      {/* ═══ FLASH ROSSO — UNGHIA SANGUINANTE (estetico, sparisce da solo) ═══ */}
      {globalPainFlash > 0 && (
        <div style={{
          position:"fixed", inset:0,
          background:`rgba(220,0,0,${globalPainFlash})`,
          boxShadow:"none",
          zIndex:99998, pointerEvents:"none",
        }} />
      )}

      {/* ═══ MODALE SANGUINANTE — rimane finché non clicchi ═══ */}

      {/* ═══ MODALE MORTE UNGHIA — rimane finché non clicchi ═══ */}
      {nailDeathFlash && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.94)",
          zIndex:100000,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          gap:"16px",
        }}>
          <div style={{
            fontSize:"90px", lineHeight:"1",
            animation:"pulse 0.4s infinite",
          }}>✝</div>
          <div style={{color:C.red, fontFamily:FONT, fontSize:"22px", letterSpacing:"4px", fontWeight:"bold"}}>
            UNGHIA PERSA
          </div>
          <div style={{color:C.dim, fontFamily:FONT, fontSize:"12px", textAlign:"center", lineHeight:"1.8"}}>
            Questa unghia è fuori gioco.<br/>
            Il gioco continua con le unghie rimaste.
          </div>
          <button onClick={() => setNailDeathFlash(false)} style={{
            fontFamily:FONT, background:"#111", color:"#888", border:"1px solid #444",
            padding:"10px 28px", cursor:"pointer", borderRadius:"0", fontSize:"14px",
            marginTop:"8px", letterSpacing:"1px",
          }}>Avanti →</button>
        </div>
      )}

      {/* ═══ FULL-SCREEN SCRATCH OVERLAY ═══
           Appare ogni volta che l'utente apre un grattino — copre tutta la schermata
           con z-index:500 così sia il DESK che l'intro risultano invisibili sotto. */}
      {scratchingCard && player && (
        <div style={{
          position:"fixed", inset:0, zIndex:9000,
          background: bioPal.bg,
          display:"flex", flexDirection:"column",
          overflow:"hidden",
        }}>
          {/* ── TOP BAR — paddingTop assorbe Dynamic Island (env() funziona in React inline styles) ── */}
          <div style={{
            flexShrink:0,
            paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
            paddingBottom: "10px",
            paddingLeft: "14px",
            paddingRight: "14px",
            background:"#030308",
            borderBottom:`2px solid ${scratchingCard.theme?.border || C.dim}`,
            display:"flex", alignItems:"center", gap:"10px",
            animation:"scratchTopBarIn 0.22s ease-out both",
            boxShadow:`0 2px 18px #00000088`,
          }}>
            {/* Card info */}
            <div style={{flex:1, minWidth:0}}>
              <div style={{color:C.dim, fontSize:"8px", letterSpacing:"3px", fontFamily:FONT, marginBottom:"2px"}}>
                ░ GRATTA E VINCI ░
              </div>
              <div style={{
                color: scratchingCard.theme?.border || C.gold,
                fontFamily:FONT, fontSize:"14px", fontWeight:"bold",
                letterSpacing:"1px",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                textShadow:`0 0 10px ${scratchingCard.theme?.border || C.gold}88`,
              }}>
                {scratchingCard.emoji || "🎫"} {scratchingCard.name}
              </div>
            </div>
            {/* Nail health indicators — più grandi e leggibili */}
            <div style={{display:"flex", gap:"4px", flexShrink:0, alignItems:"center"}}>
              {player.nails.map((n, i) => {
                const dotColor =
                  n.state === "morta"        ? "#1a1a1a"  :
                  n.state === "marcia"       ? "#880000"  :
                  n.state === "sanguinante"  ? "#cc3300"  :
                  n.state === "graffiata"    ? "#886600"  :
                  n.state === "piede"        ? "#006688"  :
                  C.green;
                const isActive = i === player.activeNail;
                const isDead   = n.state === "morta";
                const emoji = isDead ? "✝" :
                  n.state === "sanguinante" ? "🩸" :
                  n.state === "marcia"      ? "💀" :
                  n.state === "graffiata"   ? "⚡" : "🖐";
                return (
                  <div key={i} style={{
                    display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
                    width:"22px",
                    opacity: isDead ? 0.35 : 1,
                    flexShrink:0,
                  }}>
                    <div style={{
                      width:"22px", height:"22px",
                      background: dotColor+"33",
                      border: isActive ? `2px solid ${dotColor}` : `1px solid ${dotColor}66`,
                      boxShadow: isActive ? `0 0 8px ${dotColor}cc` : "none",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"12px", lineHeight:1,
                    }}>{emoji}</div>
                    {isActive && (
                      <div style={{
                        width:"6px", height:"3px",
                        background: dotColor,
                        boxShadow:`0 0 4px ${dotColor}`,
                      }}/>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Money */}
            <div style={{
              color:C.gold, fontFamily:FONT, fontSize:"15px", fontWeight:"bold",
              textShadow:`0 0 8px ${C.gold}88`, flexShrink:0,
              background:"#0a0800", border:`1px solid ${C.gold}44`,
              padding:"2px 8px",
            }}>
              €{player.money}
            </div>
          </div>

          {/* ── SCROLL AREA con la schedina ── */}
          <div style={{
            flex:1, overflowY:"auto", overflowX:"hidden",
            WebkitOverflowScrolling:"touch",
            display:"flex", justifyContent:"center",
            padding:"10px 4px 32px",
            backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
            backgroundAttachment:"local",
          }}>
            {/* animation wrapper */}
            <div style={{animation:"scratchCardSlideIn 0.28s ease-out both", width:"100%", display:"flex", justifyContent:"center"}}>
              <Suspense fallback={<LazyFallback />}>
              <ScratchCardView
                card={scratchingCard}
                nailState={getActiveNailState()}
                nailImplant={player.nails[player.activeNail]?.implant || null}
                fortune={effectiveFortune}
                grattaMania={player.grattaMania}
                equippedGrattatore={player.equippedGrattatore}
                relicEffects={playerRelicEffects}
                ambidestri={player.skills?.includes("ambidestri")}
                onCellScratch={handleCellScratch}
                onNailDamage={handleNailDamage}
                onItemFound={handleCardItemFound}
                onDone={(r) => { setFirstScratchShown(true); handleScratchDone(r); }}
                showFirstWarning={!firstScratchShown}
                lastWonPrize={player.lastWonPrize || 0}
                extraTiles={player.extraTiles || []}
                onExtraTileUsed={(tileId, tileIdx) => {
                  if (tileId === "monetaCinese") {
                    updatePlayer(p => {
                      const tiles = [...(p.extraTiles||[])];
                      tiles.splice(tileIdx, 1);
                      return {...p, extraTiles: tiles, monetaCineseActive: true};
                    });
                    addLog("🀄 MONETA CINESE ATTIVATA! La prossima grattata sarà x5 GARANTITA!", C.gold);
                  }
                }}
                onCardActivate={(event) => {
                  if (event === "maledetto_curse") {
                    updatePlayer(p => ({
                      ...p,
                      nails: p.nails.map(n =>
                        n.state !== "morta" && n.state !== "marcia" && n.state !== "sanguinante"
                          ? {...n, state: "sanguinante"} : n
                      ),
                    }));
                    addLog("💀 LA MALEDIZIONE SI APRE! Tutte le unghie sanguinano!", C.red);
                  }
                }}
              />
              </Suspense>
            </div>
          </div>

          {/* ── CARMELO STRIP — striscia 96px multi-riga con typewriter, visibile durante introScratch ── */}
          {returnScreen === "introScratch" && carmeloLog.length > 0 && (
            <CarmeloScratchStrip messages={carmeloLog} color={C.gold} />
          )}
        </div>
      )}

      {/* ── HUD PERSISTENTE (tutte le screen tranne title e tutorial) ── */}
      {player && !["title","tutorialNails"].includes(screen) && (
        <div style={{width:"100%", flexShrink:0, paddingTop:"6px"}}>
          <HUD player={player} onOpenInventory={() => setShowInventoryPanel(v => !v)} inventoryOpen={showInventoryPanel} moneyBling={moneyBling} currentBiome={currentBiome} />
        </div>
      )}

      {/* ── MAIN AREA — riga (desktop) / colonna (mobile) ── */}
      <div style={{flex:1, width:"100%", display:"flex", flexDirection: isMobile ? "column" : "row", overflow:"hidden", minHeight:0}}>

      {/* ── UNGHIE — colonna sinistra (desktop) / striscia orizzontale in cima (mobile) ── */}
      {player && !["title","tutorialNails"].includes(screen) && (
        <div style={isMobile ? {
          width:"100%", flexShrink:0,
          borderBottom:`2px solid ${bioPal.border}55`,
          background: bioPal.panelBg,
          overflowX:"auto", overflowY:"hidden",
          padding:"6px 8px",
          transition:"border-color 0.6s, background 0.6s",
        } : {
          width:"160px", flexShrink:0,
          borderRight:`1px solid ${bioPal.border}44`,
          background: bioPal.panelBg,
          display:"flex", flexDirection:"column",
          overflowY:"auto", overflowX:"hidden",
          padding:"8px 6px",
          transition:"border-color 0.6s, background 0.6s",
        }}>
          <NailSidebar nails={player.nails} activeNail={player.activeNail} onSelectNail={handleSelectNail} locked={!!scratchingCard} grattatori={player.grattatori||[]} equippedGrattatore={player.equippedGrattatore} onEquipGrattatore={equipGrattatore} horizontal={isMobile} />
        </div>
      )}

      {/* ── NEWS STRIP MOBILE — striscia notizie sotto le unghie (mobile only) ── */}
      {player && isMobile && !["title","tutorialNails"].includes(screen) && (
        <div style={{
          flexShrink:0, height:"22px",
          display:"flex", alignItems:"stretch", overflow:"hidden",
          background: bioPal.logBg,
          borderBottom:`1px solid ${bioPal.border}33`,
          paddingLeft:"6px", paddingRight:"6px",
          transition:"border-color 0.6s, background 0.6s",
        }}>
          <NewsTicker currentBiome={currentBiome} />
        </div>
      )}

      {/* ── DESK — area di gioco centrale, scrollabile ── */}
      {/* paddingBottom: safe-area bottom qui (non su S.container) così il background
          del DESK riempie fino al bordo fisico, evitando il buco nero in PWA mode. */}
      <div style={{flex:1, minHeight:0,
        overflowY:"auto",
        overflowX:"hidden",
        WebkitOverflowScrolling:"touch", /* momentum scroll iOS */
        display:"flex", flexDirection:"column", alignItems:"center",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        /* Scanlines CRT + ambient glow del bioma corrente */
        backgroundImage: [
          /* linee bright ogni 4px — visibili anche su sfondo nero */
          "repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)",
          `radial-gradient(ellipse 90% 55% at 50% 0%, ${bioPal.border}22 0%, transparent 100%)`,
        ].join(","),
        backgroundAttachment: "local",
        position: "relative",
        transition: "background-image 0.8s ease",
      }}>

      {/* ═══ TITLE SCREEN ═══ */}
      {["title","tutorialNails"].includes(screen) && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden",
        }}>
          {[
            {x:8,y:15,d:0,dur:2.1},{x:92,y:22,d:0.4,dur:1.8},{x:18,y:70,d:0.8,dur:2.4},
            {x:82,y:65,d:1.2,dur:1.6},{x:45,y:8,d:0.3,dur:2.8},{x:55,y:88,d:1.6,dur:2.0},
            {x:3,y:45,d:0.7,dur:1.9},{x:97,y:50,d:1.1,dur:2.3},{x:30,y:30,d:2.0,dur:1.7},
            {x:70,y:75,d:0.5,dur:2.6},{x:12,y:85,d:1.4,dur:2.2},{x:88,y:10,d:0.9,dur:1.5},
            {x:50,y:50,d:1.8,dur:2.9},{x:25,y:55,d:0.2,dur:2.0},{x:75,y:35,d:1.5,dur:1.8},
            {x:60,y:5,d:1.0,dur:2.2},{x:35,y:92,d:0.6,dur:1.9},{x:5,y:80,d:1.3,dur:2.5},
            {x:95,y:40,d:0.1,dur:1.7},{x:48,y:60,d:2.2,dur:2.1},{x:22,y:18,d:0.8,dur:2.8},
            {x:78,y:88,d:1.7,dur:1.6},{x:65,y:45,d:0.4,dur:2.3},{x:15,y:50,d:1.9,dur:2.0},
            {x:85,y:30,d:0.2,dur:1.8},{x:40,y:78,d:1.1,dur:2.6},{x:58,y:25,d:2.0,dur:1.5},
          ].map((s,i) => (
            <div key={i} style={{
              position:"absolute", left:`${s.x}%`, top:`${s.y}%`,
              color:C.gold, fontSize:`${8+Math.round(i%4)*4}px`, pointerEvents:"none",
              animation:`titleGlitter ${s.dur}s ${s.d}s infinite`,
              opacity:0, textShadow:`0 0 8px ${C.gold}`,
            }}>✦</div>
          ))}
        </div>
      )}

      {screen === "title" && (
        <div style={{
          width:"100%", flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          position:"relative", padding:"24px 12px",
        }}>

          {/* Fumo di tabaccheria — sale lento dietro al titolo */}
          {[0, 1, 2].map(i => (
            <div key={`smoke-${i}`} aria-hidden style={{
              position:"absolute", bottom:"-50px", left:`${22 + i * 24}%`,
              width:"110px", height:"110px", borderRadius:"50%",
              background:"radial-gradient(circle, #8899aa2e 0%, transparent 70%)",
              filter:"blur(16px)",
              animation:`smokeRise ${15 + i * 6}s ${i * 4.5}s linear infinite`,
              pointerEvents:"none", zIndex:0,
            }}/>
          ))}

          {/* Contenuto titolo */}
          <div style={{textAlign:"center", width:"min(95%, 440px)", position:"relative", zIndex:1}}>
            {/* Insegna neon TABACCHI — la T blu, sempre accesa, mai del tutto */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"center", gap:"12px",
              marginBottom:"20px", animation:"neonFlickerT 5s step-end infinite",
            }}>
              <div style={{
                width:"46px", height:"46px", flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"2px solid #2e7cff", background:"#020a1e",
                boxShadow:"0 0 20px #2e7cff77, inset 0 0 14px #2e7cff33",
                color:"#b8d4ff", fontSize:"32px", fontWeight:"bold", fontFamily:FONT,
                textShadow:"0 0 14px #2e7cff",
              }}>T</div>
              <div style={{textAlign:"left"}}>
                <div style={{
                  color:"#b8d4ff", fontSize:"12px", letterSpacing:"7px",
                  textShadow:"0 0 12px #2e7cffcc", fontFamily:FONT, fontWeight:"bold",
                }}>TABACCHI</div>
                <div style={{
                  color:"#ff5577", fontSize:"8px", letterSpacing:"3px",
                  textShadow:"0 0 8px #ff5577aa", marginTop:"4px", fontFamily:FONT,
                }}>SALA GRATTINI · APERTO H24</div>
              </div>
            </div>
            {/* ASCII TITLE — foil iridescente animato sopra il gold */}
            <div className="foil-ascii" style={{display:"inline-block", margin:"0 auto", padding:"8px 0"}}>
              <pre style={{...S.pre, color:C.gold,
                fontSize:"clamp(10px, 1.9vw, 19px)",
                lineHeight:"1.2", overflowX:"auto",
                textShadow:`0 0 18px ${C.gold}cc, 0 0 48px ${C.gold}55`,
                animation:"titleBlink 3s ease-in-out infinite, asciiFlicker 7s ease-in-out infinite",
                margin:0,
              }}>
                {ASCII_TITLE}
              </pre>
            </div>
            {/* Divisore oro */}
            <div style={{
              width:"80%", height:"1px", margin:"12px auto 14px",
              background:`linear-gradient(90deg, transparent, ${C.gold}99, transparent)`,
              boxShadow:`0 0 8px ${C.gold}55`,
            }}/>
            <div style={{color:C.dim, fontSize:"clamp(9px, 1.2vw, 12px)", letterSpacing:"4px",
              textShadow:`0 0 8px ${C.gold}44`,
            }}>
              ░ V2 · HOLO EDITION ░
            </div>
            <div style={{color:C.text+"aa", marginBottom:"28px", marginTop:"14px", fontSize:"clamp(11px, 1.1vw, 14px)", letterSpacing:"0.5px", textAlign:"center", lineHeight:"1.6"}}>
              Un roguelike di grattate, unghie e fortuna.
            </div>
          <Btn variant="gold" onClick={startGame} style={{
            fontSize:"clamp(13px, 1.4vw, 16px)", padding:"16px 44px", letterSpacing:"3px",
            boxShadow:`0 0 24px ${C.gold}66, 4px 4px 0 #000`,
            animation:"neonPulse 2s ease-in-out infinite",
          }}>
            ░░░ INIZIA LA RUN ░░░
          </Btn>
          <div style={{color:C.dim, fontSize:"clamp(9px, 0.9vw, 11px)", marginTop:"20px", letterSpacing:"1px", lineHeight:"1.9", opacity:0.7}}>
            5 unghie · 3 biomi · 1 destino<br/>
            Gratta con saggezza. Le unghie non ricrescono.
          </div>
          {activeCedola && (() => {
            const cd = CEDOLE.find(c => c.id === activeCedola);
            return cd ? (
              <div style={{
                marginTop:"12px", border:`2px solid ${C.gold}`, padding:"8px 14px",
                background:"#000000", display:"inline-block",
              }}>
                <div style={{color:C.gold, fontSize:"10px", letterSpacing:"2px"}}>CEDOLA ATTIVA</div>
                <div style={{color:C.text, fontSize:"12px", marginTop:"4px"}}>
                  {cd.icon} {cd.name}
                </div>
                <div style={{color:C.dim, fontSize:"9px", marginTop:"2px"}}>
                  ✚ {cd.pro} &nbsp;|&nbsp; ✖ {cd.contro}
                </div>
                <button onClick={() => {
                  removeStored(STORAGE_KEYS.cedola);
                  setActiveCedola(null);
                }} style={{
                  background:"none", border:`1px solid ${C.red}`, color:C.red,
                  fontSize:"9px", cursor:"pointer", marginTop:"6px", padding:"2px 8px",
                  fontFamily:FONT,
                }}>✖ rimuovi cedola</button>
              </div>
            ) : null;
          })()}
          {/* ─── META-PROGRESS FOIL CARDS ─── */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",
            gap:"12px", maxWidth:"720px", margin:"20px auto 0",
          }}>
            {(() => {
              const trophyCount = Object.keys(achievements).length;
              const trophyMax = ACHIEVEMENTS.length;
              const relicCount = discoveredRelics.length;
              const relicMax = Object.keys(RELIC_DEFS).length;
              const vintageCount = vintageCollected.length;
              const cards = [
                { onClick: () => setShowTrophies(true), accent: C.gold, emoji: "🏆", label: "TROFEI", count: trophyCount, max: trophyMax, shimmer: true, hasProgress: trophyCount > 0 },
                { onClick: () => setShowReliquie(true), accent: "#c060ff", emoji: "🏺", label: "RELIQUIE", count: relicCount, max: relicMax, shimmer: true, hasProgress: relicCount > 0 },
                { onClick: () => setShowVintage(true), accent: "#ffaa88", emoji: "🎨", label: "VINTAGE", count: vintageCount, max: 5, shimmer: true, hasProgress: vintageCount > 0 },
                { onClick: () => setShowAllTimeStats(true), accent: C.cyan, emoji: "📊", label: "STATS", count: null, max: null, shimmer: true, hasProgress: true },
              ];
              return cards.map((c, ci) => {
                const pct = c.max ? (c.count / c.max) : 1;
                return (
                  <div key={ci} onClick={c.onClick} className="holo holo-strong card3d" style={{
                    cursor:"pointer", userSelect:"none",
                    background:"rgba(10,10,24,0.55)",
                    backdropFilter:"blur(10px) saturate(1.5)",
                    WebkitBackdropFilter:"blur(10px) saturate(1.5)",
                    border:`2px solid ${c.accent}`,
                    boxShadow:`0 0 18px ${c.accent}44, inset 0 0 22px ${c.accent}14`,
                    display:"flex", flexDirection:"column",
                    position:"relative", overflow:"hidden",
                    transition:"box-shadow 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = `0 0 32px ${c.accent}aa, 0 6px 16px #000a, inset 0 0 26px ${c.accent}22`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = `0 0 18px ${c.accent}44, inset 0 0 22px ${c.accent}14`;
                  }}
                  >
                    {/* Preview tile — emoji + foil shimmer */}
                    <div style={{
                      position:"relative", height:"74px",
                      background: `linear-gradient(135deg, ${c.accent}15, ${c.accent}08)`,
                      borderBottom:`1px solid ${c.accent}55`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      overflow:"hidden",
                    }}>
                      {/* Corner brackets decorativi — NON si sovrappongono all'emoji */}
                      {["tl","tr","bl","br"].map(pos => {
                        const [v, h] = pos.split("");
                        return (
                          <div key={pos} style={{
                            position:"absolute",
                            [v === "t" ? "top" : "bottom"]: "5px",
                            [h === "l" ? "left" : "right"]: "5px",
                            width:"10px", height:"10px",
                            borderTop: v === "t" ? `1px solid ${c.accent}aa` : "none",
                            borderBottom: v === "b" ? `1px solid ${c.accent}aa` : "none",
                            borderLeft: h === "l" ? `1px solid ${c.accent}aa` : "none",
                            borderRight: h === "r" ? `1px solid ${c.accent}aa` : "none",
                            zIndex:1,
                          }}/>
                        );
                      })}
                      {/* Emoji centrale */}
                      <div style={{
                        fontSize:"32px", position:"relative", zIndex:2,
                        textShadow:`0 0 16px ${c.accent}`,
                        filter: c.hasProgress ? "none" : "grayscale(0.4) brightness(0.85)",
                      }}>{c.emoji}</div>
                      {/* Foil shimmer diagonale animato (solo se ha progresso) */}
                      {c.shimmer && (
                        <div style={{
                          position:"absolute", inset:0, pointerEvents:"none",
                          background:`linear-gradient(110deg, transparent 30%, ${c.accent}44 48%, ${c.accent}aa 50%, ${c.accent}44 52%, transparent 70%)`,
                          backgroundSize:"200% 100%",
                          animation:"variantShimmer 2.4s linear infinite",
                          mixBlendMode:"screen",
                        }}/>
                      )}
                      {/* Sparkle angolo */}
                      {c.shimmer && c.max && c.count >= c.max && (
                        <div style={{
                          position:"absolute", top:4, right:6, fontSize:"14px",
                          color: c.accent, zIndex:3,
                          animation:"variantSparkle 1.6s ease-in-out infinite",
                          textShadow:`0 0 8px ${c.accent}`,
                        }}>✦</div>
                      )}
                    </div>
                    {/* Badge label solid */}
                    <div style={{
                      background: c.accent, color:"#000",
                      padding:"4px 6px", fontSize:"11px", fontWeight:"bold",
                      letterSpacing:"2px", textAlign:"center",
                    }}>
                      ★ {c.label} ★
                    </div>
                    {/* Body: counter + progress bar */}
                    <div style={{padding:"8px 10px 10px", background:"#07070d"}}>
                      {c.max ? (
                        <>
                          <div style={{
                            display:"flex", justifyContent:"space-between",
                            fontSize:"9px", color:`${c.accent}bb`, letterSpacing:"1px",
                            marginBottom:"4px",
                          }}>
                            <span>SBLOCCATI</span>
                            <span style={{color:c.accent, fontWeight:"bold"}}>{c.count} / {c.max}</span>
                          </div>
                          <div style={{height:"4px", background:"#1a1a22", border:`1px solid ${c.accent}33`, position:"relative"}}>
                            <div style={{
                              height:"100%", width:`${pct*100}%`,
                              background:`linear-gradient(90deg, ${c.accent}88, ${c.accent})`,
                              boxShadow:`0 0 8px ${c.accent}`,
                              transition:"width 0.4s",
                            }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{
                          fontSize:"9px", color:`${c.accent}bb`, letterSpacing:"1px",
                          textAlign:"center", padding:"3px 0",
                        }}>▸ APRI STATS</div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          </div>
        </div>
      )}

      {/* ═══ TUTORIAL UNGHIE — paginated, no scroll ═══ */}
      {screen === "tutorialNails" && (
        <div style={{
          width:"100%", flex:1, minHeight:0, maxWidth:"520px", margin:"0 auto",
          display:"flex", flexDirection:"column", justifyContent:"center",
          padding:"10px 14px 14px", boxSizing:"border-box",
          overflowY:"auto", WebkitOverflowScrolling:"touch",
        }}>
          {/* ── Header ── */}
          <div style={{textAlign:"center", flexShrink:0, marginBottom:"10px"}}>
            <div style={{color:C.cyan, fontFamily:FONT, fontSize:"16px", fontWeight:"bold", letterSpacing:"2px", marginBottom:"2px"}}>
              🖐 LE TUE UNGHIE
            </div>
            <div style={{color:C.dim, fontSize:"9px", letterSpacing:"3px"}}>TUTORIAL — leggi, poi gratta</div>
          </div>

          {/* ── Griglia stati unghie — 2 colonne, 3 righe ── */}
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1fr",
            gap:"6px", marginBottom:"10px", flexShrink:0,
          }}>
            {[
              { label:"Sana",         color:C.green,   badge:"💚 PIENO",   desc:"Unghia intatta. Premio al 100%." },
              { label:"Graffiata",    color:C.gold,    badge:"💛 PIENO",   desc:"Usura iniziale. Premio ancora pieno." },
              { label:"Sanguinante",  color:C.orange,  badge:"🩸 −50%",    desc:"Fa male. Premio dimezzato." },
              { label:"Marcia",       color:C.red,     badge:"🦠 −75%",    desc:"Pericolosa. Solo 25% del premio." },
              { label:"Morta ✝",      color:"#555",    badge:"💀 FUORI",   desc:"Inutilizzabile. Passa alla prossima." },
              { label:"Kawaii ♡",     color:"#ff88cc", badge:"✨ ×2",      desc:"Rara. Premio raddoppiato. Usala bene." },
            ].map(({label, color, badge, desc}) => (
              <div key={label} style={{
                background:"#0c0c1a", border:`1px solid ${color}55`,
                padding:"7px 9px",
                display:"flex", flexDirection:"column", gap:"3px",
              }}>
                <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
                  <div style={{width:"8px", height:"8px", background:color, flexShrink:0, boxShadow:`0 0 4px ${color}`}}/>
                  <span style={{color, fontSize:"12px", fontWeight:"bold", letterSpacing:"0.5px"}}>{label}</span>
                  <span style={{
                    marginLeft:"auto", fontSize:"9px", fontWeight:"bold",
                    color: color === "#555" ? "#555" : color,
                    background:"#00000066", padding:"1px 5px",
                    border:`1px solid ${color}33`,
                  }}>{badge}</span>
                </div>
                <div style={{color:C.dim, fontSize:"10px", lineHeight:"1.35"}}>{desc}</div>
              </div>
            ))}
          </div>

          {/* ── Meccaniche in due righe compatte ── */}
          <div style={{
            background:"#0d1100", border:`1px solid ${C.gold}44`,
            padding:"8px 11px", marginBottom:"8px", flexShrink:0,
          }}>
            <div style={{color:C.gold, fontSize:"10px", fontWeight:"bold", letterSpacing:"1px", marginBottom:"5px"}}>⚠ COME SI CONSUMANO</div>
            <div style={{color:C.text, fontSize:"11px", lineHeight:"1.7"}}>
              Ogni <strong style={{color:C.bright}}>3 celle grattate</strong> → l'unghia degrada di uno stato.<br/>
              Hai <strong style={{color:C.bright}}>5 unghie</strong>. Quando una muore, passi alla prossima.<br/>
              Tutte e 5 morte → <strong style={{color:C.red}}>GAME OVER</strong>.
            </div>
          </div>

          <div style={{
            background:"#080a08", border:`1px solid ${C.cyan}33`,
            padding:"7px 11px", marginBottom:"12px", flexShrink:0,
          }}>
            <div style={{color:C.cyan, fontSize:"10px", fontWeight:"bold", letterSpacing:"1px", marginBottom:"4px"}}>💡 CONSIGLIO</div>
            <div style={{color:C.dim, fontSize:"10px", lineHeight:"1.5"}}>
              Compra cerotti e disinfettanti al tabaccaio prima che sia tardi.<br/>
              Tieni la Kawaii per le carte da alto valore.
            </div>
          </div>

          {/* ── CTA ── */}
          <Btn variant="gold" onClick={() => setScreen("introScratch")}
            style={{fontSize:"14px", padding:"14px", letterSpacing:"2px", flexShrink:0}}>
            ░ HO CAPITO — INIZIAMO ░
          </Btn>
        </div>
      )}

      {/* ═══ INTRO SCRATCH (scratch 2 starting cards, pocket 1 prize) ═══ */}
      {screen === "introScratch" && player && (
        <div style={{width:"100%", maxWidth:"900px", padding:"8px", display:"flex", flexDirection:"column", gap:"6px", height:"100%", minHeight:0, overflow:"hidden"}}>

          {/* NPC Dialogue Log */}
          <CarmeloLogBox
            npc="vecchio"
            name="Nonno Carmelo"
            color={C.gold}
            messages={carmeloLog}
            height="200px"
            footer={player.scratchCards.length > 0
              ? <Btn onClick={(e) => {
                  e.stopPropagation();
                  addLog("Tieni le mani in tasca e vai.", C.dim);
                  updatePlayer(p => ({...p, scratchCards: []}));
                  setIntroPrizes([{prize:0, cardName:"(rifiutato)"}]);
                  setScreen("map");
                }} style={{fontSize:"10px", color:C.dim, borderColor:"#333", padding:"3px 10px"}}>
                  😶 Rifiuta — non guadagni niente ma non rovini le unghie
                </Btn>
              : null
            }
          />

          {/* Cards to scratch */}
          {player.scratchCards.length > 0 && (
            <div style={{display:"flex", flexDirection:"column", gap:"6px", flex:1, minHeight:0, overflowY:"auto"}}>
              {!scratchingCard && (<>
                <div style={{color:C.dim, fontSize:"10px", letterSpacing:"2px", textAlign:"center"}}>
                  — BIGLIETTI DI NONNO CARMELO — rimasti {player.scratchCards.length}/3 —
                </div>
                <div style={{display:"flex", justifyContent:"center", gap:"8px", flexWrap:"wrap"}}>
                  {player.scratchCards.map((card, idx) => (
                    <div key={idx} style={{textAlign:"center"}}
                      onMouseEnter={() => setHoveredIntroIdx(idx)}
                      onMouseLeave={() => setHoveredIntroIdx(-1)}>
                      <Btn variant="gold" onClick={() => {
                        if (!firstScratchShown) triggerNpcComment("first_warning");
                        setScratchingCard(card);
                        setReturnScreen("introScratch");
                        setHoveredIntroIdx(-1);
                      }}>
                        {card.emoji || "🎫"} {card.name}
                        <span style={{display:"block", fontSize:"10px"}}>
                          <span style={{color:C.red, textDecoration:"line-through"}}>€{card.cost}</span>
                          {" "}
                          <span style={{color:C.green, fontWeight:"bold"}}>GRATIS!</span>
                        </span>
                      </Btn>
                    </div>
                  ))}
                </div>
                {/* Preview panel — hover mostra anteprima card */}
                {(() => {
                  const c = hoveredIntroIdx >= 0 ? player.scratchCards[hoveredIntroIdx] : null;
                  const borderColor = c?.theme?.border || C.gold;
                  const cols = c?.cols || 3;
                  const rows = c?.mechanic === "setteemezzo" ? 1 : (c?.rows || 3);
                  return (
                    <div style={{
                      width:"100%", marginTop:"4px",
                      border:`2px solid ${c ? borderColor : "#1a1a2e"}`,
                      background: c ? "#0a0a1a" : "#070710",
                      padding:"16px 20px",
                      flex:"1 1 120px", minHeight:"120px",
                      display:"flex", alignItems:"center", gap:"24px",
                      overflow:"hidden",
                      transition:"border-color 0.15s",
                      boxShadow: c ? `inset 0 0 40px ${borderColor}08` : "none",
                    }}>
                      {c ? (<>
                        {/* Covered grid preview */}
                        <div style={{flexShrink:0}}>
                          <div style={{
                            display:"grid",
                            gridTemplateColumns:`repeat(${cols}, 1fr)`,
                            gap:"3px", marginBottom:"5px",
                            width:"130px",
                          }}>
                            {Array(cols * rows).fill(0).map((_, i) => (
                              <div key={i} style={{
                                height:"20px",
                                background:`linear-gradient(160deg, #c0c0cc 0%, #888898 60%, #606070 100%)`,
                                border:`1px solid #aaa8`,
                                borderRadius:"2px",
                                boxShadow:"inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.3)",
                              }}/>
                            ))}
                          </div>
                          <div style={{color:borderColor, fontSize:"9px", textAlign:"center", letterSpacing:"1px"}}>
                            clicca per grattare
                          </div>
                        </div>
                        {/* Info */}
                        <div style={{flex:1, borderLeft:`1px solid ${borderColor}22`, paddingLeft:"20px"}}>
                          <div style={{color:borderColor, fontWeight:"bold", fontSize:"13px", marginBottom:"6px"}}>
                            {c.emoji || "🎫"} {c.name}
                          </div>
                          <div style={{color:C.text, fontSize:"11px", lineHeight:"1.7", marginBottom:"8px"}}>
                            {(MECH_RULES[c.mechanic] || MECH_RULES.match)(c)}
                          </div>
                          <div style={{display:"flex", gap:"16px", flexWrap:"wrap"}}>
                            <span style={{color:C.dim, fontSize:"10px"}}>
                              Premio max: <span style={{color:C.gold, fontWeight:"bold"}}>€{c.maxPrize}</span>
                            </span>
                            {c.malus && <span style={{color:C.red, fontSize:"10px"}}>⚠ {c.malus.desc}</span>}
                          </div>
                        </div>
                      </>) : (
                        <div style={{color:"#333", fontSize:"10px", letterSpacing:"3px", margin:"0 auto"}}>
                          — passa sopra un biglietto per l'anteprima —
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>)}

              {/* Scratch inline rimosso — gestito dal full-screen overlay (position:fixed zIndex:9000) */}
            </div>
          )}

          {/* Prize selection after all scratched */}
          {player.scratchCards.length === 0 && introPrizes.length >= 3 && (
            <div style={{display:"flex", flexDirection:"column", gap:"8px", flex:1, minHeight:0, overflowY:"auto"}}>
              <div style={{color:C.dim, fontSize:"10px", letterSpacing:"2px", textAlign:"center"}}>
                — QUALE INTASCHI? —
              </div>
              <div style={{display:"flex", justifyContent:"center", gap:"10px", flexWrap:"wrap"}}>
                {introPrizes.map((ip, idx) => (
                  <div key={idx} style={{
                    border:`2px solid ${ip.prize > 0 ? C.gold : C.dim}`,
                    background:"#0a0a18", padding:"12px 18px",
                    cursor:"pointer", textAlign:"center", minWidth:"130px",
                    transition:"all 0.15s",
                    boxShadow: ip.prize > 0 ? `0 0 14px ${C.gold}22` : "none",
                  }}
                    onClick={() => {
                      updatePlayer(p => ({...p, money: p.money + ip.prize}));
                      setGameStats(s => ({...s, moneyEarned: s.moneyEarned + ip.prize}));
                      addLog(`Intaschi €${ip.prize} dal "${ip.cardName}". Il vecchio annuisce.`, C.green);
                      setScreen("map");
                    }}
                  >
                    <div style={{color:C.dim, fontSize:"10px", marginBottom:"4px", letterSpacing:"1px"}}>{ip.cardName}</div>
                    <div style={{
                      color: ip.prize > 0 ? C.gold : C.dim,
                      fontSize:"22px", fontWeight:"bold",
                      textShadow: ip.prize > 0 ? `0 0 10px ${C.gold}` : "none",
                      marginBottom:"8px",
                    }}>
                      {ip.prize > 0 ? `€${ip.prize}` : "—"}
                    </div>
                    <Btn variant={ip.prize > 0 ? "gold" : "default"} style={{fontSize:"10px", padding:"4px 10px"}}>
                      Intasca →
                    </Btn>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      )}

      {/* ═══ SCRATCH CARD — ora gestita dal full-screen overlay in cima (zIndex:500) ═══ */}

      {/* ═══ DOPPIO O NULLA ═══ */}
      {screen === "doppioONulla" && player && doppioONulla && (
        <div style={{maxWidth:"900px", width:"100%"}}>
          <Suspense fallback={<LazyFallback />}>
          <DoppioONullaView
            prize={doppioONulla.prize}
            onDecline={handleDoppioDecline}
            onResult={handleDoppioResult}
          />
          </Suspense>
        </div>
      )}

      {/* ═══ SELECT CARD TO SCRATCH ═══ */}
      {screen === "selectCard" && player && (() => {
        const TIER_META = {
          1: { label: "COMUNE",       accent: C.green,   emoji: "🎫" },
          2: { label: "MEDIA",        accent: C.cyan,    emoji: "🎟️" },
          3: { label: "RARA",         accent: C.magenta, emoji: "💎" },
          4: { label: "LEGGENDARIA",  accent: C.gold,    emoji: "👑" },
        };
        const MECH_BADGE = {
          trap: "💣 TRAPPOLE", sum13: "🃏 SOMMA 13", ruota: "🎡 RUOTA",
          doppioOnulla: "🎲 DOPPIO", labirinto: "🗺️ LABIRINTO",
          combina: "🧩 COMBINA", tesoro: "🗺️ TESORO", jolly: "✨ JOLLY",
          setteemezzo: "🃏 7½", collect: "💰 COLLECT", mahjong: "🀄 MAHJONG",
        };
        return (
        <div style={{maxWidth:"760px", width:"100%", margin: "10px auto"}}>
          <div style={{
            ...S.panel, background: "#05050b",
            border: `2px solid ${C.gold}55`,
            boxShadow: `0 0 22px ${C.gold}22, inset 0 0 28px ${C.gold}08`,
            position: "relative",
          }}>
            {/* Corner brackets */}
            {["tl","tr","bl","br"].map(pos => {
              const [v, h] = pos.split("");
              return (
                <div key={pos} style={{
                  position: "absolute",
                  [v === "t" ? "top" : "bottom"]: "10px",
                  [h === "l" ? "left" : "right"]: "10px",
                  width: "14px", height: "14px",
                  borderTop: v === "t" ? `2px solid ${C.gold}` : "none",
                  borderBottom: v === "b" ? `2px solid ${C.gold}` : "none",
                  borderLeft: h === "l" ? `2px solid ${C.gold}` : "none",
                  borderRight: h === "r" ? `2px solid ${C.gold}` : "none",
                  boxShadow: `0 0 8px ${C.gold}88`,
                  pointerEvents: "none",
                }}/>
              );
            })}

            {/* Header */}
            <div style={{
              textAlign:"center", marginBottom:"16px",
              paddingBottom:"10px", borderBottom:`1px solid ${C.gold}33`,
              background: `linear-gradient(180deg, ${C.gold}08 0%, transparent 100%)`,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: "-2px", right: "10px",
                fontSize: "12px", color: C.gold,
                animation: "variantSparkle 2.4s ease-in-out infinite",
              }}>✦</div>
              <div style={{
                fontSize: "22px", fontWeight: "bold", color: C.gold,
                letterSpacing: "4px", marginBottom: "4px",
                textShadow: `0 0 12px ${C.gold}aa, 0 0 26px ${C.gold}55`,
                fontFamily: FONT,
              }}>
                🎫 I TUOI BIGLIETTI
              </div>
              <div style={{
                display: "inline-block",
                color: "#000", background: C.gold,
                fontSize: "9px", letterSpacing: "3px", fontWeight: "bold",
                padding: "2px 8px", marginBottom: "8px",
                boxShadow: `0 0 8px ${C.gold}aa`,
              }}>
                ≋ SCEGLI COSA GRATTARE ≋
              </div>
              <div style={{color:C.text, fontSize:"11px", fontStyle:"italic"}}>
                {player.scratchCards.length} biglietto{player.scratchCards.length === 1 ? "" : "i"} in mano
              </div>
            </div>

            {/* Card grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "10px",
              marginBottom: "14px",
            }}>
              {player.scratchCards.map((card, idx) => {
                const tier = Math.min(4, Math.max(1, card.tier || 1));
                const meta = TIER_META[tier];
                const accent = meta.accent;
                const tierLabel = meta.label;
                const cardEmoji = card.emoji || meta.emoji;
                const mechBadge = MECH_BADGE[card.mechanic];
                return (
                  <div key={idx} onClick={() => handleSelectCard(idx)} style={{
                    position: "relative",
                    background: "#0a0a14",
                    border: `2px solid ${accent}88`,
                    boxShadow: `0 0 10px ${accent}44, inset 0 0 14px ${accent}12`,
                    padding: "10px 10px 12px", cursor: "pointer",
                    textAlign: "center",
                    transition: "transform 0.12s, box-shadow 0.15s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = `0 0 18px ${accent}aa, 0 4px 12px #000a, inset 0 0 18px ${accent}22`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = `0 0 10px ${accent}44, inset 0 0 14px ${accent}12`;
                  }}>
                    {/* Preview tile */}
                    <div style={{
                      position: "relative",
                      width: "64px", height: "64px", margin: "0 auto 8px",
                      background: `linear-gradient(135deg, ${accent}22, ${accent}05)`,
                      border: `1px solid ${accent}66`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `inset 0 0 12px ${accent}22`,
                    }}>
                      {["tl","tr","bl","br"].map(pos => {
                        const [v, h] = pos.split("");
                        return (
                          <div key={pos} style={{
                            position: "absolute",
                            [v === "t" ? "top" : "bottom"]: "3px",
                            [h === "l" ? "left" : "right"]: "3px",
                            width: "8px", height: "8px",
                            borderTop: v === "t" ? `1px solid ${accent}` : "none",
                            borderBottom: v === "b" ? `1px solid ${accent}` : "none",
                            borderLeft: h === "l" ? `1px solid ${accent}` : "none",
                            borderRight: h === "r" ? `1px solid ${accent}` : "none",
                          }}/>
                        );
                      })}
                      <div style={{
                        fontSize: "30px",
                        textShadow: `0 0 14px ${accent}`,
                      }}>{cardEmoji}</div>
                      {tier >= 4 && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: `linear-gradient(110deg, transparent 30%, ${accent}55 50%, transparent 70%)`,
                          backgroundSize: "200% 100%",
                          animation: "variantShimmer 2.4s linear infinite",
                          mixBlendMode: "screen",
                          pointerEvents: "none",
                        }}/>
                      )}
                    </div>

                    {/* Tier badge */}
                    <div style={{
                      display: "inline-block",
                      background: accent, color: "#000",
                      padding: "2px 6px", fontSize: "8px", fontWeight: "bold",
                      letterSpacing: "2px", marginBottom: "4px",
                      boxShadow: `0 0 6px ${accent}88`,
                    }}>
                      ★ {tierLabel} ★
                    </div>

                    {/* Name */}
                    <div style={{
                      color: C.bright, fontSize: "12px", fontWeight: "bold",
                      marginBottom: "5px", lineHeight: 1.2,
                    }}>
                      {card.name}
                    </div>

                    {/* Cost + Max pills */}
                    <div style={{display:"flex", justifyContent:"center", gap:"4px", marginBottom:"4px", flexWrap:"wrap"}}>
                      <div style={{
                        fontSize:"9px", color: C.gold,
                        background: `${C.gold}14`,
                        border: `1px solid ${C.gold}66`,
                        padding: "1px 5px", letterSpacing: "0.5px",
                      }}>€{card.cost}</div>
                      <div style={{
                        fontSize:"9px", color: C.green,
                        background: `${C.green}14`,
                        border: `1px solid ${C.green}66`,
                        padding: "1px 5px", letterSpacing: "0.5px",
                      }}>max €{card.maxPrize}</div>
                    </div>

                    {/* Mechanic badge */}
                    {mechBadge && (
                      <div style={{
                        color: accent, fontSize: "8px", letterSpacing: "1px",
                        fontWeight: "bold", marginBottom: "3px",
                      }}>
                        {mechBadge}
                      </div>
                    )}

                    {/* Malus warning */}
                    {card.malus && (
                      <div style={{
                        color:C.red, fontSize:"9px", letterSpacing:"0.3px",
                        lineHeight: 1.3, marginTop: "4px",
                        borderTop: `1px dashed ${C.red}55`, paddingTop: "4px",
                      }}>
                        ⚠ {card.malus.desc}
                      </div>
                    )}

                    {/* Requires grattatore flag */}
                    {card.requiresGrattatore && (
                      <div style={{
                        position: "absolute", top: "6px", right: "6px",
                        color: C.cyan, fontSize: "9px",
                        background: "#000a",
                        padding: "1px 4px",
                        border: `1px solid ${C.cyan}88`,
                        letterSpacing: "0.5px", fontWeight: "bold",
                      }}>
                        🔧
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Back button */}
            <div style={{
              display: "flex", justifyContent: "center",
              borderTop: `1px solid ${C.gold}33`, paddingTop: "12px",
            }}>
              <Btn onClick={() => {
                setCardSelectMode(false);
                setReturnScreen(null);
                if (returnScreen === "shop") setScreen("shop");
                else if (currentNode) setScreen("preScratch");
                else setScreen("map");
              }}>← Torna indietro</Btn>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ═══ PRE-SCRATCH (before entering node) ═══ */}
      {screen === "preScratch" && player && currentNode && (() => {
        const NODE_ACCENT = {
          tabaccaio: C.gold, locanda: C.pink, spacciatore: C.green,
          chirurgo: C.red, ladro: C.orange, mendicante: C.blue,
          zaino: C.cyan, miniboss: C.orange, boss: C.red,
          evento: C.magenta, stregone: C.magenta, poliziotto: C.blue,
          anziana: C.pink, sacerdote: C.gold, bambino: C.cyan,
          streamer: C.pink, macellaio: C.red,
          maestroTe: C.green, guantaio: C.gold, start: C.dim,
        };
        const NODE_NAMES = {
          tabaccaio: "TABACCAIO", locanda: "LOCANDA", spacciatore: "SPACCIATORE",
          chirurgo: "CHIRURGO", ladro: "LADRO", mendicante: "MENDICANTE",
          zaino: "ZAINO", miniboss: "MINI-BOSS", boss: "BOSS",
          evento: "EVENTO", stregone: "STREGONE", poliziotto: "POLIZIOTTO",
          anziana: "ANZIANA", sacerdote: "SACERDOTE", bambino: "BAMBINO",
          streamer: "STREAMER", macellaio: "MACELLAIO",
          maestroTe: "MAESTRO DEL TÈ", guantaio: "GUANTAIO", start: "INIZIO",
        };
        const accent = NODE_ACCENT[currentNode.type] || C.cyan;
        const nodeName = NODE_NAMES[currentNode.type] || currentNode.type.toUpperCase();
        const nodeIcon = NODE_ICONS[currentNode.type] || "?";
        const isBoss = currentNode.type === "boss";
        const isElite = !!currentNode.elite;

        // Corner brackets helper
        const CornerBrackets = ({ color = accent, size = 14, inset = 10, shadow = true }) => (
          <>{["tl","tr","bl","br"].map(pos => {
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
                boxShadow: shadow ? `0 0 8px ${color}88` : "none",
                pointerEvents: "none",
              }}/>
            );
          })}</>
        );

        return (
        <div style={{maxWidth:"760px", width:"100%", margin:"10px auto"}}>

          {/* ═══ BOSS ENTRY WARNING ═══ */}
          {isBoss && (() => {
            const bossName = currentNode.bossName || "Il Broker";
            const BOSS_ENTRY = {
              "Il Broker":     { min: 200 },
              "Il Romanaccio": { min: 300 },
              "Il Napoletano": { min: 500 },
              "Il Drago d'Oro":{ min: 400 },
            };
            const req = BOSS_ENTRY[bossName];
            if (!req) return null;
            const canEnter = player.money >= req.min;
            const gateColor = canEnter ? C.green : C.red;
            return (
              <div style={{
                position: "relative",
                background: canEnter ? "#001a0a" : "#1a0000",
                border: `2px solid ${gateColor}`,
                padding: "14px 20px", marginBottom: "10px",
                textAlign: "center",
                boxShadow: canEnter
                  ? `0 0 16px ${gateColor}44, inset 0 0 16px ${gateColor}12`
                  : `0 0 20px ${gateColor}66, inset 0 0 20px ${gateColor}22`,
                animation: canEnter ? "none" : "pulse 1.2s infinite",
              }}>
                <CornerBrackets color={gateColor} size={12} inset={6} />
                <div style={{
                  display: "inline-block",
                  background: gateColor, color: "#000",
                  padding: "3px 10px", fontSize: "10px", fontWeight: "bold",
                  letterSpacing: "3px", marginBottom: "8px",
                  boxShadow: `0 0 8px ${gateColor}aa`,
                }}>
                  ★ {canEnter ? "ACCESSO CONSENTITO" : "ACCESSO NEGATO"} ★
                </div>
                <div style={{color: C.text, fontSize: "12px", lineHeight: 1.6}}>
                  <strong style={{color: gateColor, fontSize: "13px"}}>{bossName}</strong> richiede almeno{" "}
                  <strong style={{color: C.gold}}>€{req.min}</strong>.
                  {" "}Hai{" "}
                  <strong style={{color: gateColor}}>€{player.money}</strong>.
                </div>
                {!canEnter && (
                  <div style={{
                    marginTop: "8px", padding: "6px 10px",
                    background: "#0a0004",
                    border: `1px dashed ${C.orange}66`,
                    color: C.orange, fontSize: "10px",
                    letterSpacing: "1px", fontStyle: "italic",
                  }}>
                    ⚠ Se entri ora verrai rispedito all'inizio della mappa
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ MAIN PANEL — node preview + actions ═══ */}
          <div style={{
            ...S.panel, position: "relative",
            background: "#05050b",
            border: `2px solid ${accent}55`,
            boxShadow: `0 0 22px ${accent}22, inset 0 0 28px ${accent}08`,
          }}>
            <CornerBrackets />

            {/* Header: icon tile + title */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              gap: "16px", alignItems: "center",
              padding: "8px 8px 14px",
              borderBottom: `1px solid ${accent}33`,
              marginBottom: "14px",
              background: `linear-gradient(180deg, ${accent}08 0%, transparent 100%)`,
            }}>
              {/* Icon tile */}
              <div style={{
                position: "relative",
                width: "72px", height: "72px",
                background: `linear-gradient(135deg, ${accent}22, ${accent}05)`,
                border: `1px solid ${accent}66`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `inset 0 0 16px ${accent}22, 0 0 14px ${accent}44`,
              }}>
                {["tl","tr","bl","br"].map(pos => {
                  const [v, h] = pos.split("");
                  return (
                    <div key={pos} style={{
                      position: "absolute",
                      [v === "t" ? "top" : "bottom"]: "4px",
                      [h === "l" ? "left" : "right"]: "4px",
                      width: "10px", height: "10px",
                      borderTop: v === "t" ? `1px solid ${accent}` : "none",
                      borderBottom: v === "b" ? `1px solid ${accent}` : "none",
                      borderLeft: h === "l" ? `1px solid ${accent}` : "none",
                      borderRight: h === "r" ? `1px solid ${accent}` : "none",
                    }}/>
                  );
                })}
                <div style={{
                  fontSize: "38px",
                  textShadow: `0 0 16px ${accent}`,
                  filter: `drop-shadow(0 0 8px ${accent}aa)`,
                }}>{nodeIcon}</div>
                {(isBoss || isElite) && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `linear-gradient(110deg, transparent 30%, ${accent}55 50%, transparent 70%)`,
                    backgroundSize: "200% 100%",
                    animation: "variantShimmer 2.4s linear infinite",
                    mixBlendMode: "screen", pointerEvents: "none",
                  }}/>
                )}
              </div>

              {/* Title block */}
              <div>
                <div style={{
                  color: C.dim, fontSize: "9px",
                  letterSpacing: "4px", marginBottom: "2px",
                }}>
                  ≋ PROSSIMO NODO ≋
                </div>
                <div style={{
                  fontSize: "22px", fontWeight: "bold", color: accent,
                  letterSpacing: "3px", marginBottom: "4px",
                  textShadow: `0 0 12px ${accent}aa, 0 0 26px ${accent}55`,
                  fontFamily: FONT,
                }}>
                  {nodeName}
                </div>
                {isElite && (
                  <div style={{
                    display: "inline-block",
                    color: "#000", background: C.orange,
                    fontSize: "9px", letterSpacing: "3px", fontWeight: "bold",
                    padding: "1px 7px", marginRight: "4px",
                    boxShadow: `0 0 8px ${C.orange}aa`,
                  }}>
                    ★ ELITE ★
                  </div>
                )}
                {isBoss && (
                  <div style={{
                    display: "inline-block",
                    color: "#000", background: C.red,
                    fontSize: "9px", letterSpacing: "3px", fontWeight: "bold",
                    padding: "1px 7px",
                    boxShadow: `0 0 8px ${C.red}aa`,
                    animation: "pulse 1.2s infinite",
                  }}>
                    ⚠ BOSS ⚠
                  </div>
                )}
              </div>
            </div>

            {/* Body: tickets info OR empty state */}
            {player.scratchCards.length > 0 ? (
              <div style={{
                textAlign: "center",
                background: `${accent}0c`,
                border: `1px solid ${accent}33`,
                padding: "10px 14px",
                marginBottom: "14px",
                fontSize: "11px", color: C.text, letterSpacing: "0.5px",
              }}>
                🎫 Puoi grattare fino a <strong style={{color: C.gold}}>
                {3 - preScratchCount}</strong> biglietto{(3 - preScratchCount) === 1 ? "" : "i"} prima di entrare
              </div>
            ) : (
              <div style={{
                textAlign: "center", marginBottom: "14px",
                padding: "14px 10px",
                background: "#0a0508",
                border: `1px dashed ${C.red}55`,
              }}>
                <pre style={{...S.pre, display:"block", margin:"0 auto 10px", fontSize:"20px", color:C.dim}}>{`( ._.)
 ﾉ   )`}</pre>
                <div style={{
                  display: "inline-block",
                  background: C.red, color: "#000",
                  padding: "2px 8px", fontSize: "9px", fontWeight: "bold",
                  letterSpacing: "3px", marginBottom: "8px",
                  boxShadow: `0 0 8px ${C.red}aa`,
                }}>
                  ★ NESSUN GRATTINO ★
                </div>
                <div style={{color: C.dim, fontSize: "11px", lineHeight: 1.5, marginBottom: "4px"}}>
                  Di solito qui ci si ferma a grattare<br/>i biglietti comprati al Tabaccaio.
                </div>
                <div style={{color: C.gold, fontSize: "11px", fontStyle: "italic"}}>
                  Comprane al prossimo 🏪 Tabaccaio!
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{
              display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap",
              borderTop: `1px solid ${accent}33`, paddingTop: "12px",
            }}>
              {preScratchCount < 3 && player.scratchCards.length > 0 && (
                <Btn variant="gold" onClick={handlePreScratch}>
                  🎫 Gratta ({3 - preScratchCount} rimasti)
                </Btn>
              )}
              <Btn onClick={enterNode}>
                Entra nel nodo →
              </Btn>
            </div>
          </div>

          {/* ═══ GRATTATORI ═══ */}
          {player.grattatori.length > 0 && (
            <div style={{
              ...S.panel, position: "relative",
              background: "#05080a",
              border: `2px solid ${C.cyan}44`,
              boxShadow: `0 0 14px ${C.cyan}20, inset 0 0 20px ${C.cyan}06`,
            }}>
              {/* Section header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                borderBottom: `1px solid ${C.cyan}44`,
                paddingBottom: "6px", marginBottom: "10px",
                flexWrap: "nowrap", overflow: "hidden",
              }}>
                <div style={{
                  flexShrink: 0,
                  background: C.cyan, color: "#000",
                  padding: "3px 8px", fontSize: "10px", fontWeight: "bold",
                  letterSpacing: "1px", whiteSpace: "nowrap",
                  boxShadow: `0 0 8px ${C.cyan}88`,
                }}>
                  🔧 GRATTATORI
                </div>
                <div style={{flex: 1, color: C.dim, fontSize: "10px", letterSpacing: "0.5px", fontStyle: "italic",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                  proteggono le unghie
                </div>
                <div style={{flexShrink: 0, color: C.cyan, fontSize: "10px", letterSpacing: "1px", whiteSpace: "nowrap"}}>
                  {player.grattatori.length} {player.grattatori.length === 1 ? "pezzo" : "pezzi"}
                </div>
              </div>

              {/* Equipped indicator */}
              {player.equippedGrattatore && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  color: C.green, fontSize: "11px", marginBottom: "8px",
                  background: "#001a0a",
                  border: `1px solid ${C.green}66`,
                  padding: "5px 10px",
                  boxShadow: `inset 0 0 10px ${C.green}14`,
                }}>
                  <span style={{fontSize: "14px"}}>✓</span>
                  <span style={{letterSpacing: "1px"}}>EQUIPAGGIATO:</span>
                  <strong style={{color: C.bright}}>
                    {player.equippedGrattatore.emoji} {player.equippedGrattatore.name}
                  </strong>
                  <span style={{color: C.dim}}>({player.equippedGrattatore.usesLeft} usi)</span>
                  <Btn onClick={unequipGrattatore} style={{fontSize: "10px", marginLeft: "auto", padding: "2px 8px"}}>
                    ✗ Rimuovi
                  </Btn>
                </div>
              )}

              {/* Grattatori list */}
              <div style={{display: "flex", flexWrap: "wrap", gap: "5px"}}>
                {player.grattatori.map((g, idx) => {
                  const def = GRATTATORE_DEFS[g.id];
                  return (
                    <Tooltip key={idx} text={def ? `${def.desc} · ${g.usesLeft} uso/i rimasti` : g.name}>
                      <Btn
                        onClick={() => equipGrattatore(idx)}
                        variant={player.equippedGrattatore?.inventoryIdx === idx ? "gold" : "normal"}
                        style={{fontSize: "11px"}}>
                        {g.emoji} {g.name} ({g.usesLeft})
                      </Btn>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ CONSUMABILI ═══ */}
          {player.items.length > 0 && (
            <div style={{
              ...S.panel, position: "relative",
              background: "#05080a",
              border: `2px solid ${C.green}44`,
              boxShadow: `0 0 14px ${C.green}20, inset 0 0 20px ${C.green}06`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                borderBottom: `1px solid ${C.green}44`,
                paddingBottom: "6px", marginBottom: "10px",
              }}>
                <div style={{
                  background: C.green, color: "#000",
                  padding: "3px 10px", fontSize: "10px", fontWeight: "bold",
                  letterSpacing: "2px",
                  boxShadow: `0 0 8px ${C.green}88`,
                }}>
                  ★ 💊 CONSUMABILI ★
                </div>
                <div style={{color: C.dim, fontSize: "10px", letterSpacing: "1px", fontStyle: "italic"}}>
                  click per usare
                </div>
                <div style={{marginLeft: "auto", color: C.green, fontSize: "10px", letterSpacing: "1px"}}>
                  {player.items.length}/{MAX_ITEMS}
                </div>
              </div>

              <div style={{display: "flex", flexWrap: "wrap", gap: "5px"}}>
                {player.items.map((itemId, idx) => {
                  const item = ITEM_DEFS[itemId];
                  return item ? (
                    <Tooltip key={idx} text={item.desc}>
                      <Btn onClick={() => useItem(idx)} style={{fontSize: "11px"}}>
                        {item.emoji} {item.name}
                      </Btn>
                    </Tooltip>
                  ) : null;
                })}
              </div>
            </div>
          )}

        </div>
        );
      })()}

      {/* ═══ MAP ═══ */}
      {screen === "map" && player && map && (
        <div style={{
          flex:1, minHeight:0, width:"100%", maxWidth:"1000px",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}>
          {/* Mappa — occupa tutto lo spazio disponibile */}
          <Suspense fallback={<LazyFallback />}>
          <MapView
            map={map}
            currentRow={currentRow}
            visitedNodes={visitedNodes}
            reachableNodes={getReachableNodes()}
            onSelectNode={selectNode}
            currentBiome={currentBiome}
            playerFortuna={effectiveFortune || player.fortune || 0}
          />
          </Suspense>

          {/* Striscia inventario compatta — flexShrink:0, NON toglie spazio alla mappa */}
          {(player.items.length > 0 || player.grattatori.length > 0) && (
            <div style={{
              flexShrink:0,
              display:"flex", alignItems:"center", gap:"6px",
              padding:"5px 8px",
              background:"#06060e",
              borderTop:`1px solid ${C.cyan}22`,
              overflowX:"auto", overflowY:"hidden",
              WebkitOverflowScrolling:"touch",
            }}>
              {/* Grattatori */}
              {player.grattatori.map((g, idx) => {
                const def = GRATTATORE_DEFS[g.id];
                const isEquipped = player.equippedGrattatore?.inventoryIdx === idx;
                return (
                  <Tooltip key={"g"+idx} text={def ? `${def.desc} · ${g.usesLeft} uso/i` : g.name}>
                    <button
                      onClick={() => equipGrattatore(idx)}
                      style={{
                        flexShrink:0,
                        display:"flex", alignItems:"center", gap:"3px",
                        background: isEquipped ? `${C.cyan}22` : "#0a0a18",
                        border:`1px solid ${isEquipped ? C.cyan : "#333355"}`,
                        color: isEquipped ? C.cyan : C.dim,
                        padding:"3px 7px",
                        fontSize:"10px", fontFamily:FONT,
                        cursor:"pointer",
                        boxShadow: isEquipped ? `0 0 8px ${C.cyan}55` : "none",
                        letterSpacing:"0.5px",
                        WebkitTapHighlightColor:"transparent",
                      }}
                    >
                      <span style={{fontSize:"13px"}}>{g.emoji}</span>
                      <span style={{fontSize:"9px"}}>{g.name}</span>
                      <span style={{
                        background: isEquipped ? C.cyan : "#222244",
                        color: isEquipped ? "#000" : C.dim,
                        fontSize:"8px", padding:"0 3px",
                        fontWeight:"bold",
                      }}>{g.usesLeft}</span>
                    </button>
                  </Tooltip>
                );
              })}
              {/* Divisore */}
              {player.grattatori.length > 0 && player.items.length > 0 && (
                <div style={{width:"1px", height:"20px", background:`${C.dim}33`, flexShrink:0}}/>
              )}
              {/* Consumabili */}
              {player.items.map((itemId, idx) => {
                const item = ITEM_DEFS[itemId];
                return item ? (
                  <Tooltip key={idx} text={item.desc}>
                    <button
                      onClick={() => useItem(idx)}
                      style={{
                        flexShrink:0,
                        display:"flex", alignItems:"center", gap:"3px",
                        background:"#0a0a12",
                        border:`1px solid ${C.green}44`,
                        color: C.green,
                        padding:"3px 7px",
                        fontSize:"10px", fontFamily:FONT,
                        cursor:"pointer",
                        letterSpacing:"0.5px",
                        WebkitTapHighlightColor:"transparent",
                      }}
                    >
                      <span style={{fontSize:"13px"}}>{item.emoji}</span>
                      <span style={{fontSize:"9px", color:C.dim}}>{item.name}</span>
                    </button>
                  </Tooltip>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ SHOP (Tabaccaio) ═══ */}
      {screen === "shop" && player && (
        <div style={{maxWidth:"900px", width:"100%"}}>
          <Suspense fallback={<LazyFallback />}>
          <ShopView
            player={player}
            currentRow={currentRow}
            currentBiome={currentBiome}
            onBuyCard={handleBuyCard}
            onBuyItem={handleBuyItem}
            onBuyGrattatore={handleBuyGrattatore}
            onLeave={() => setScreen("map")}
            onScratch={handleShopScratch}
            onSlotResult={handleSlotResult}
          />
          </Suspense>
        </div>
      )}

      {/* ═══ LOCANDA ═══ */}
      {screen === "locanda" && player && (
        <div style={{maxWidth:"900px", width:"100%"}}>
          <Suspense fallback={<LazyFallback />}>
          <LocandaView
            player={player}
            onRest={handleRest}
            onLeave={() => setScreen("map")}
          />
          </Suspense>
        </div>
      )}

      {/* ═══ EVENT / NPC ═══ */}
      {screen === "event" && player && currentNode && (
        <div style={{maxWidth:"900px", width:"100%"}}>
          <Suspense fallback={<LazyFallback />}>
          <EventView
            node={currentNode}
            player={player}
            onChoice={handleEventChoice}
          />
          </Suspense>
        </div>
      )}

      {/* ═══ NODE (generic) ═══ */}
      {screen === "node" && player && currentNode && (
        <div style={{maxWidth:"900px", width:"100%"}}>
          <div style={{...S.panel, textAlign:"center"}}>
            <div style={{...S.h2}}>{NODE_ICONS[currentNode.type]} {currentNode.type}</div>
            <Btn onClick={() => setScreen("map")}>Continua →</Btn>
          </div>
        </div>
      )}

      {/* ═══ COMBAT ═══ */}
      {screen === "combat" && player && combatEnemy && (
        <div style={{flex:1, minHeight:0, width:"100%", maxWidth:"900px", display:"flex", flexDirection:"column", overflow:"hidden"}}>
          <Suspense fallback={<LazyFallback />}>
          <CombatView
            enemy={combatEnemy}
            player={player}
            onEnd={handleCombatEnd}
            onCellScratch={handleCombatCellScratch}
            playerWallet={player.money}
            onCombo={() => { unlockAchievement("combo_master"); setGameStats(s => ({...s, combosFired: (s.combosFired || 0) + 1})); }}
            onVariantRevealed={(variantId) => {
              if (!vintageCollected.includes(variantId)) {
                collectVintage(variantId);
                addLog(`🎨 Nuova variante vintage scoperta: ${variantId}!`, C.magenta);
                if (vintageCollected.length + 1 >= 5) unlockAchievement("vintage_collector");
              }
            }}
            onNailDamage={(count, onExplosiva) => {
              updatePlayer(p => {
                // noCombatDegradeMeta: unghia d'acciaio — nessun danno in combat
                if (p.noCombatDegradeMeta) return p;
                const nails = [...p.nails];
                let explosivaBonus = 0;
                for (let d = 0; d < count; d++) {
                  const alive = nails.findIndex(n => n.state !== "morta");
                  if (alive >= 0) {
                    // Check esplosiva PRIMA di degradare (per verificare se muore)
                    const hadEsplosiva = nails[alive].implant === "esplosiva";
                    nails[alive] = degradeNailObj(nails[alive], 1);
                    if (hadEsplosiva && nails[alive].state === "morta") {
                      explosivaBonus += 60;
                      addLog("💥 Unghia Esplosiva esplode! -€60 al nemico!", C.orange);
                    }
                  }
                }
                // GAY OVER immediato se tutte le unghie sono morte durante il combattimento
                if (!isAlive(nails)) {
                  setTimeout(() => setScreen("gameOver"), 800);
                }
                if (explosivaBonus > 0 && onExplosiva) onExplosiva(explosivaBonus);
                return {...p, nails};
              });
            }}
          />
          </Suspense>
        </div>
      )}

      {/* ═══ CELLA ═══ */}
      {screen === "cella" && player && (() => {
        const WALL_NEEDED = 8;
        const allNailsMax = player.nails.every(n =>
          n.state === "sana" || n.state === "kawaii" || n.state === "piede" || n.state === "morta" && player.nails.filter(x=>x.state!=="morta").every(x=>x.state==="sana"||x.state==="kawaii"||x.state==="piede")
        );
        // Check reale: nessuna unghia VIVA sotto-max
        const anyAliveBelowMax = player.nails.some(n =>
          n.state !== "morta" && n.state !== "sana" && n.state !== "kawaii" && n.state !== "piede"
        );
        const canEscape = !anyAliveBelowMax && player.nails.some(n => n.state !== "morta");
        const aliveCount = player.nails.filter(n => n.state !== "morta").length;

        const handleGrattaMuro = () => {
          AudioEngine.scratch();
          if (canEscape) {
            // Avanza il contatore
            const newProgress = cellaProgress + 1;
            setCellaProgress(newProgress);
            addLog(`💪 Graffi il muro con forza! (${newProgress}/${WALL_NEEDED})`, C.green);
            // Ogni grattata consuma anche l'unghia
            updatePlayer(p => {
              const nails = [...p.nails];
              const active = p.activeNail;
              let nail = {...nails[active]};
              nail.scratchCount = (nail.scratchCount || 0) + 1;
              if (nail.scratchCount >= 3) { nail = degradeNailObj(nail); nail.scratchCount = 0; }
              nails[active] = nail;
              const newActive = nail.state === "morta"
                ? nails.findIndex((n,i) => i !== active && n.state !== "morta")
                : active;
              return {...p, nails, activeNail: newActive >= 0 ? newActive : active};
            });
            if (newProgress >= WALL_NEEDED) {
              addLog("🧱 IL MURO CEDE! Sei evaso! Corri!", C.gold);
              setTimeout(() => { setCellaProgress(0); setScreen("map"); }, 1200);
            }
          } else {
            // Nessun progresso — l'unghia si consuma contro il cemento
            addLog("🩸 Graffi il muro ma non succede nulla... l'unghia soffre.", C.red);
            updatePlayer(p => {
              const nails = [...p.nails];
              const active = p.activeNail;
              let nail = {...nails[active]};
              nail.scratchCount = (nail.scratchCount || 0) + 1;
              if (nail.scratchCount >= 3) { nail = degradeNailObj(nail); nail.scratchCount = 0; }
              nails[active] = nail;
              let newActive = active;
              if (nail.state === "morta") {
                const next = nails.findIndex((n,i) => i !== active && n.state !== "morta");
                newActive = next >= 0 ? next : active;
              }
              // GAY OVER se tutte le unghie morte
              if (!nails.some(n => n.state !== "morta")) {
                setTimeout(() => setScreen("gameOver"), 800);
              }
              return {...p, nails, activeNail: newActive};
            });
          }
        };

        const wallBricks = Array.from({length: WALL_NEEDED}, (_, i) => i < cellaProgress);

        return (
          <div style={{maxWidth:"500px", width:"100%", textAlign:"center", fontFamily:FONT}}>
            <div style={{...S.panel, borderColor:C.dim, background:"#080808", marginTop:"8px"}}>

              {/* Titolo */}
              <div style={{color:C.red, fontSize:"20px", fontWeight:"bold", letterSpacing:"3px", marginBottom:"4px", }}>
                🔒 IN CELLA
              </div>
              <div style={{color:C.dim, fontSize:"11px", marginBottom:"14px", fontStyle:"italic"}}>
                "Quindici anni di grattini illegali. Ora graffi i muri."
              </div>

              {/* ASCII art cella */}
              <pre style={{...S.pre, color:"#555", fontSize:"11px", marginBottom:"12px", lineHeight:"1.4", display:"inline-block"}}>
{`┌──────────────────────┐
│  ░░░░░░░░░░░░░░░░░░  │
│  ░ [MURO DI PIETRA]░  │
│  ░░░░░░░░░░░░░░░░░░  │
│                      │
│   ╭───╮  Tu sei qui  │
│   │ 😰│              │
│   ╰───╯              │
│_____________________ │
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`}
              </pre>

              {/* Barra progresso muro */}
              <div style={{marginBottom:"12px"}}>
                <div style={{fontSize:"11px", color:C.dim, marginBottom:"5px"}}>
                  {canEscape ? "Graffi nel posto giusto! Il muro si sgretola..." : "Unghie danneggiate — non riesci a fare breccia"}
                </div>
                <div style={{display:"flex", gap:"4px", justifyContent:"center", marginBottom:"6px"}}>
                  {wallBricks.map((broken, i) => (
                    <div key={i} style={{
                      width:"28px", height:"16px",
                      background: broken ? C.gold : "#2a2a2a",
                      border: `1px solid ${broken ? C.gold+"88" : "#444"}`,
                      borderRadius:"0",
                      transition:"all 0.3s",
                      boxShadow: broken ? `0 0 6px ${C.gold}66` : "none",
                      fontSize:"9px", display:"flex", alignItems:"center", justifyContent:"center",
                      color: broken ? "#000" : "#555",
                    }}>
                      {broken ? "✓" : "░"}
                    </div>
                  ))}
                </div>
                <div style={{color:C.dim, fontSize:"10px"}}>{cellaProgress}/{WALL_NEEDED} mattoni rimossi</div>
              </div>

              {/* Condizione fuga */}
              <div style={{
                ...S.panel,
                borderColor: canEscape ? C.green+"66" : C.red+"44",
                background: canEscape ? "#001200" : "#120000",
                padding:"8px 12px", marginBottom:"14px", fontSize:"11px",
              }}>
                {canEscape ? (
                  <span style={{color:C.green}}>✅ Unghie al massimo — puoi scavare! Ancora {WALL_NEEDED - cellaProgress} graffi.</span>
                ) : (
                  <span style={{color:C.red}}>
                    ❌ Le unghie danneggiate non scavano il cemento.<br/>
                    <span style={{color:C.dim, fontSize:"10px"}}>Hai bisogno di tutte le unghie vive al massimo (Sana/Kawaii).<br/>Altrimenti... gratta fino alla fine.</span>
                  </span>
                )}
              </div>

              {/* Stato unghie */}
              <div style={{display:"flex", gap:"5px", justifyContent:"center", marginBottom:"14px", flexWrap:"wrap"}}>
                {player.nails.map((n, i) => {
                  const info = NAIL_INFO[n.state] || NAIL_INFO.morta;
                  return (
                    <div key={i} style={{
                      padding:"3px 7px", borderRadius:"0",
                      border: `1px solid ${info.color}66`,
                      background: i === player.activeNail ? info.color+"22" : "transparent",
                      fontSize:"10px", color: info.color,
                    }}>
                      {info.label}
                    </div>
                  );
                })}
              </div>

              {/* Bottone gratta */}
              {aliveCount > 0 ? (
                <Btn
                  variant={canEscape ? "success" : "default"}
                  onClick={handleGrattaMuro}
                  style={{
                    fontSize:"16px", padding:"12px 32px", letterSpacing:"2px",
                    boxShadow: canEscape ? `0 0 20px ${C.green}55` : "none",
                  }}
                >
                  {canEscape ? "💪 GRATTA IL MURO" : "🩸 Gratta (inutile...)"}
                </Btn>
              ) : (
                <div style={{color:C.red, fontSize:"14px", fontWeight:"bold"}}>
                  Nessuna unghia rimasta. Il muro ha vinto.
                </div>
              )}

              {/* Flavor text */}
              <div style={{color:C.dim, fontSize:"10px", marginTop:"10px", fontStyle:"italic"}}>
                {canEscape
                  ? "Le unghie kawaii scavano il cemento come un laser. Tecnica di fuga livello 9."
                  : "\"Le unghie rotte non scalfiscono il muro di una cella.\" — Guardia Penitenziaria"}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ LABIRINTO ═══ */}
      {screen === "labirinto" && player && labirintoState && (() => {
        const ls = labirintoState;
        const [row, col] = ls.pos;
        const CELL_PRIZE = 8;
        const JACKPOT_PRIZE = 300;

        const handleMove = () => {
          if (ls.done) return;
          const cell = ls.grid[row][col];
          if (cell === "💀") {
            // Danno unghia + perdi tutto
            handleNailDamage();
            addLog("💀 Hai trovato una trappola! Perdi tutto e un'unghia!", C.red);
            setLabirintoState(null);
            setSpecialCardRef(null);
            setScratchingCard(null);
            if (currentNode) setScreen("preScratch"); else setScreen("map");
            return;
          }
          if (cell === "🏆") {
            // JACKPOT!
            const totalPrize = ls.prize + JACKPOT_PRIZE;
            updatePlayer(p => ({...p, money: p.money + totalPrize}));
            addLog(`🏆 SEI USCITO! Jackpot €${JACKPOT_PRIZE} + €${ls.prize} = €${totalPrize}!`, C.gold);
            setLabirintoState(null);
            setSpecialCardRef(null);
            setScratchingCard(null);
            if (currentNode) setScreen("preScratch"); else setScreen("map");
            return;
          }
          // Calcola nuova posizione
          const DELTA = {"→":[0,1],"↓":[1,0],"←":[0,-1],"↑":[-1,0]};
          const [dr,dc] = DELTA[cell] || [0,0];
          const nr = row+dr, nc = col+dc;
          if (nr<0||nr>3||nc<0||nc>3) {
            addLog("Il percorso porta fuori dalla griglia... cella sbagliata!", C.red);
            return;
          }
          const newRevealed = new Set(ls.revealed);
          newRevealed.add(`${row},${col}`);
          const newPrize = ls.prize + CELL_PRIZE;
          setLabirintoState({...ls, pos:[nr,nc], revealed:newRevealed, prize:newPrize});
          addLog(`Avanzi! +€${CELL_PRIZE} → totale €${newPrize}`, C.green);
        };

        const handleIncassa = () => {
          if (ls.prize <= 0) { if (currentNode) setScreen("preScratch"); else setScreen("map"); return; }
          updatePlayer(p => ({...p, money: p.money + ls.prize}));
          addLog(`🏃 Hai incassato €${ls.prize} scappando dal labirinto!`, C.gold);
          setLabirintoState(null);
          setSpecialCardRef(null);
          setScratchingCard(null);
          if (currentNode) setScreen("preScratch"); else setScreen("map");
        };

        return (
          <div style={{maxWidth:"500px", width:"100%", textAlign:"center"}}>
            <div style={{...S.panel, borderColor:"#00aa55", background:"#001a0a"}}>
              <div style={{...S.h2, color:"#00aa55"}}>🌀 IL LABIRINTO</div>
              <div style={{color:C.dim, fontSize:"11px", marginBottom:"8px"}}>
                Segui le frecce — arriva a 🏆 per €{JACKPOT_PRIZE}! Ogni cella = +€{CELL_PRIZE}.
              </div>
              <div style={{color:C.gold, fontSize:"14px", marginBottom:"10px", fontWeight:"bold"}}>
                💰 Accumulato: €{ls.prize}
              </div>
              {/* Griglia 4x4 */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px", marginBottom:"12px", maxWidth:"220px", margin:"0 auto 12px"}}>
                {ls.grid.map((rowData, r) => rowData.map((cell, c) => {
                  const isPos = r===row && c===col;
                  const isRevealed = ls.revealed.has(`${r},${c}`);
                  return (
                    <div key={`${r},${c}`} style={{
                      width:"48px", height:"48px", border:`2px solid ${isPos?"#00ff88":"#004422"}`,
                      background: isPos ? "#002211" : isRevealed ? "#001a0a" : "#001208",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize: isPos ? "22px" : isRevealed ? "16px" : "12px",
                      color: isPos ? "#00ff88" : isRevealed ? "#006633" : "#003311",
                      borderRadius:"0",
                    }}>
                      {isPos ? "👆" : isRevealed ? cell : "?"}
                    </div>
                  );
                }))}
              </div>
              <div style={{color:C.bright, fontSize:"12px", marginBottom:"10px"}}>
                Cella attuale: <strong style={{color:"#00ff88"}}>{ls.grid[row]?.[col]}</strong> — segui questa freccia!
              </div>
              <div style={{display:"flex", gap:"8px", justifyContent:"center", flexWrap:"wrap"}}>
                <Btn variant="gold" onClick={handleMove}>
                  ➡ Muoviti!
                </Btn>
                {ls.prize > 0 && (
                  <Btn variant="normal" onClick={handleIncassa}>
                    🏃 Incassa e scappa (€{ls.prize})
                  </Btn>
                )}
                <Btn variant="danger" onClick={() => { setLabirintoState(null); setSpecialCardRef(null); setScratchingCard(null); if(currentNode)setScreen("preScratch");else setScreen("map"); }}>
                  ✗ Abbandona (€0)
                </Btn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ GRATTA & COMBINA ═══ */}
      {screen === "grattaCombina" && player && combinaState && (() => {
        const cs = combinaState;
        const COMBO_PRIZE = 30;
        const MEGA_MULT = 5;
        const SYMS_LABELS = {"⭐":"Stella","🔔":"Campana","💎":"Diamante","🍋":"Limone","🎯":"Bersaglio"};

        const handleReveal = (grid, idx) => {
          if (cs.done) return;
          if (grid === "A" && cs.revealedA[idx]) return;
          if (grid === "B" && cs.revealedB[idx]) return;

          let newState = {...cs};
          if (grid === "A") {
            const newRev = [...cs.revealedA]; newRev[idx] = true;
            newState = {...newState, revealedA: newRev, lastRevealedA: cs.gridA[idx]};
          } else {
            const newRev = [...cs.revealedB]; newRev[idx] = true;
            newState = {...newState, revealedB: newRev, lastRevealedB: cs.gridB[idx]};
          }

          // Check combo: se entrambi i lastRevealed sono uguali e non-null
          const lastA = grid === "A" ? newState.lastRevealedA : newState.lastRevealedA;
          const lastB = grid === "B" ? newState.lastRevealedB : newState.lastRevealedB;
          if (lastA && lastB && lastA === lastB) {
            const newCombos = newState.combos + 1;
            const newPrize = newState.prize + COMBO_PRIZE;
            addLog(`✨ COMBO! ${lastA} = ${lastA}! +€${COMBO_PRIZE} (combo ${newCombos}/3)`, C.gold);
            if (newCombos >= 3) {
              // MEGA COMBO!
              const megaPrize = newPrize * MEGA_MULT;
              updatePlayer(p => ({...p, money: p.money + megaPrize}));
              addLog(`🎆 MEGA COMBO x${MEGA_MULT}! +€${megaPrize}!`, C.gold);
              setCombinaState(null); setSpecialCardRef(null); setScratchingCard(null);
              if(currentNode)setScreen("preScratch");else setScreen("map");
              return;
            }
            newState = {...newState, combos: newCombos, prize: newPrize, lastRevealedA: null, lastRevealedB: null};
          }

          // Check se tutte le celle sono rivelate
          const allRevA = newState.revealedA.every(Boolean);
          const allRevB = newState.revealedB.every(Boolean);
          if (allRevA && allRevB) {
            if (newState.prize > 0) {
              updatePlayer(p => ({...p, money: p.money + newState.prize}));
              addLog(`🃏 Gratta & Combina finita! Hai vinto €${newState.prize}!`, C.gold);
            } else {
              addLog("Nessuna combo trovata...", C.dim);
            }
            setCombinaState(null); setSpecialCardRef(null); setScratchingCard(null);
            if(currentNode)setScreen("preScratch");else setScreen("map");
            return;
          }
          setCombinaState(newState);
        };

        const renderGrid = (which) => {
          const grid = which === "A" ? cs.gridA : cs.gridB;
          const revealed = which === "A" ? cs.revealedA : cs.revealedB;
          const lastRev = which === "A" ? cs.lastRevealedA : cs.lastRevealedB;
          return (
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"4px"}}>
              {grid.map((sym, i) => (
                <div key={i} onClick={() => handleReveal(which, i)} style={{
                  width:"56px", height:"56px", border:`2px solid ${revealed[i] ? (sym===lastRev?"#ffd700":"#444") : "#336633"}`,
                  background: revealed[i] ? (sym===cs.lastRevealedA||sym===cs.lastRevealedB ? "#1a1200" : "#111") : "#001a00",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize: revealed[i] ? "24px" : "12px", cursor: revealed[i] ? "default" : "pointer",
                  color: revealed[i] ? "#fff" : "#336633", borderRadius:"0",
                }}>
                  {revealed[i] ? (sym || "—") : "?"}
                </div>
              ))}
            </div>
          );
        };

        return (
          <div style={{maxWidth:"500px", width:"100%", textAlign:"center"}}>
            <div style={{...S.panel, borderColor:"#aa00ff", background:"#0d001a"}}>
              <div style={{...S.h2, color:"#aa00ff"}}>🃏 GRATTA & COMBINA</div>
              <div style={{color:C.dim, fontSize:"11px", marginBottom:"8px"}}>
                Gratta una cella per volta. Stessa cella su entrambe le griglie = COMBO (+€{COMBO_PRIZE}). 3 COMBO = MEGA COMBO x{MEGA_MULT}!
              </div>
              <div style={{color:C.gold, fontSize:"13px", marginBottom:"8px"}}>
                Combo: {cs.combos}/3 · Premio: €{cs.prize}
              </div>
              <div style={{display:"flex", gap:"16px", justifyContent:"center", marginBottom:"12px", flexWrap:"wrap"}}>
                <div>
                  <div style={{color:"#aa00ff", fontSize:"11px", marginBottom:"4px"}}>GRIGLIA A</div>
                  {renderGrid("A")}
                </div>
                <div>
                  <div style={{color:"#aa00ff", fontSize:"11px", marginBottom:"4px"}}>GRIGLIA B</div>
                  {renderGrid("B")}
                </div>
              </div>
              <Btn variant="danger" onClick={() => {
                if (cs.prize > 0) { updatePlayer(p => ({...p, money: p.money + cs.prize})); addLog(`Incassato €${cs.prize} abbandonando.`, C.dim); }
                setCombinaState(null); setSpecialCardRef(null); setScratchingCard(null);
                if(currentNode)setScreen("preScratch");else setScreen("map");
              }}>
                ✗ Abbandona {cs.prize > 0 ? `(incassa €${cs.prize})` : "(€0)"}
              </Btn>
            </div>
          </div>
        );
      })()}

      {/* ═══ MAPPA DEL TESORO ═══ */}
      {screen === "mappaTesor0" && player && tesoroState && (() => {
        const ts = tesoroState;
        const X_PRIZE = 150;
        const JACKPOT_PRIZE = 400;

        const getManhattanDist = (idx) => {
          const r = Math.floor(idx/4), c = idx%4;
          let minDist = 99;
          ts.treasures.forEach(ti => {
            const tr = Math.floor(ti/4), tc = ti%4;
            minDist = Math.min(minDist, Math.abs(r-tr)+Math.abs(c-tc));
          });
          return minDist;
        };

        const handleReveal = (idx) => {
          if (ts.done || ts.revealed[idx]) return;
          const newRevealed = [...ts.revealed]; newRevealed[idx] = true;

          if (ts.bombs.has(idx)) {
            // Bomba!
            handleNailDamage();
            addLog("💣 BOMBA! Perdi tutto e un'unghia!", C.red);
            setTesoroState(null); setSpecialCardRef(null); setScratchingCard(null);
            if(currentNode)setScreen("preScratch");else setScreen("map");
            return;
          }

          let newPrize = ts.prize;
          let newFoundTreasures = ts.foundTreasures;
          if (ts.treasures.has(idx)) {
            newFoundTreasures++;
            newPrize += X_PRIZE;
            addLog(`💎 TESORO TROVATO! +€${X_PRIZE} (${newFoundTreasures}/2)`, C.gold);
            if (newFoundTreasures >= 2) {
              // JACKPOT — trovati tutti i tesori: paga il cumulato + jackpot bonus
              const total = newPrize + JACKPOT_PRIZE;
              updatePlayer(p => ({...p, money: p.money + total}));
              addLog(`🗺️ JACKPOT! Trovato tutto! €${newPrize} accumulati + €${JACKPOT_PRIZE} bonus = +€${total}!`, C.gold);
              setTesoroState(null); setSpecialCardRef(null); setScratchingCard(null);
              if(currentNode)setScreen("preScratch");else setScreen("map");
              return;
            }
          }

          setTesoroState({...ts, revealed:newRevealed, prize:newPrize, foundTreasures:newFoundTreasures});
        };

        return (
          <div style={{maxWidth:"500px", width:"100%", textAlign:"center"}}>
            <div style={{...S.panel, borderColor:"#cc8800", background:"#1a0e00"}}>
              <div style={{...S.h2, color:"#cc8800"}}>🗺️ LA MAPPA DEL TESORO</div>
              <div style={{color:C.dim, fontSize:"11px", marginBottom:"8px"}}>
                Trova le 2 X senza toccare le 💣. I numeri indicano la distanza dal tesoro più vicino.
              </div>
              <div style={{color:C.gold, fontSize:"13px", marginBottom:"10px"}}>
                Trovati: {ts.foundTreasures}/2 · Premio: €{ts.prize > 0 ? ts.prize : "?"} (jackpot €{JACKPOT_PRIZE})
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px", maxWidth:"240px", margin:"0 auto 12px"}}>
                {Array.from({length:16}, (_,idx) => {
                  const rev = ts.revealed[idx];
                  const isTreasure = ts.treasures.has(idx);
                  const isBomb = ts.bombs.has(idx);
                  const dist = rev && !isTreasure && !isBomb ? getManhattanDist(idx) : null;
                  const distColor = dist === 1 ? C.red : dist === 2 ? C.orange : dist === 3 ? C.gold : C.dim;
                  return (
                    <div key={idx} onClick={() => handleReveal(idx)} style={{
                      width:"52px", height:"52px",
                      border:`2px solid ${rev ? (isTreasure ? C.gold : isBomb ? C.red : "#444") : "#664400"}`,
                      background: rev ? (isTreasure ? "#1a1200" : isBomb ? "#1a0000" : "#111") : "#1a0a00",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize: rev ? (isTreasure || isBomb ? "22px" : "18px") : "16px",
                      cursor: rev ? "default" : "pointer", borderRadius:"0",
                      color: rev && !isTreasure && !isBomb ? distColor : "#fff",
                    }}>
                      {rev ? (isTreasure ? "💎" : isBomb ? "💣" : dist !== null ? dist : "") : "?"}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex", gap:"8px", justifyContent:"center", flexWrap:"wrap"}}>
                {ts.prize > 0 && (
                  <Btn variant="gold" onClick={() => {
                    updatePlayer(p => ({...p, money: p.money + ts.prize}));
                    addLog(`💰 Incassato €${ts.prize} con ${ts.foundTreasures} tesori trovati.`, C.gold);
                    setTesoroState(null); setSpecialCardRef(null); setScratchingCard(null);
                    if(currentNode)setScreen("preScratch");else setScreen("map");
                  }}>
                    💰 Incassa €{ts.prize}
                  </Btn>
                )}
                <Btn variant="danger" onClick={() => {
                  setTesoroState(null); setSpecialCardRef(null); setScratchingCard(null);
                  if(currentNode)setScreen("preScratch");else setScreen("map");
                }}>
                  ✗ Abbandona (€0)
                </Btn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ GAME OVER ═══ */}
      {screen === "gameOver" && (
        <div style={{
          textAlign: "center", maxWidth: "560px", width: "100%",
          background: "linear-gradient(180deg, #120000 0%, #05050b 100%)",
          border: `2px solid ${C.red}`,
          animation: "gameOverBorder 2s ease-in-out infinite",
          padding: "18px",
          position: "relative",
          // CRT scanlines overlay via pseudo-gradient
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px), linear-gradient(180deg, #120000 0%, #05050b 100%)",
        }}>
          {/* Corner brackets decorativi grandi */}
          {["tl","tr","bl","br"].map(pos => {
            const [v, h] = pos.split("");
            return (
              <div key={pos} style={{
                position: "absolute",
                [v === "t" ? "top" : "bottom"]: "6px",
                [h === "l" ? "left" : "right"]: "6px",
                width: "18px", height: "18px",
                borderTop: v === "t" ? `2px solid ${C.red}` : "none",
                borderBottom: v === "b" ? `2px solid ${C.red}` : "none",
                borderLeft: h === "l" ? `2px solid ${C.red}` : "none",
                borderRight: h === "r" ? `2px solid ${C.red}` : "none",
                boxShadow: `0 0 8px ${C.red}88`,
              }}/>
            );
          })}

          {/* Skull animato */}
          <div style={{
            fontSize:"52px", marginBottom:"6px",
            animation:"gameOverSkull 1.8s ease-in-out infinite",
            filter:`drop-shadow(0 0 14px ${C.red})`,
          }}>💀</div>

          {/* ASCII GAME OVER con flicker CRT */}
          <div style={{marginBottom: "12px"}}>
            <pre style={{
              ...S.pre, color: C.red, fontSize: "12px",
              display: "inline-block", lineHeight: 1.2,
              animation: "gameOverFlicker 3.2s ease-in-out infinite",
              margin: 0,
              textAlign: "left",
            }}>{` ██████╗  █████╗ ██╗   ██╗
██╔════╝ ██╔══██╗╚██╗ ██╔╝
██║  ███╗███████║ ╚████╔╝
██║   ██║██╔══██║  ╚██╔╝
╚██████╔╝██║  ██║   ██║
 ╚═════╝ ╚═╝  ╚═╝   ╚═╝
      O   V   E   R`}
            </pre>
          </div>

          {/* Badge di morte — sotto l'ASCII per gerarchia visiva */}
          <div style={{marginBottom: "12px"}}>
            <div style={{
              display: "inline-block",
              background: C.red, color: "#000",
              fontSize: "10px", fontWeight: "bold", letterSpacing: "4px",
              padding: "3px 14px",
              boxShadow: `0 0 12px ${C.red}aa`,
            }}>
              ★ FINE DELLA RUN ★
            </div>
          </div>

          <div style={{
            color: "#cc6677", fontSize: "12px", fontStyle: "italic",
            marginBottom: "14px", letterSpacing: "1px",
            background: "#1a0005",
            border: `1px solid ${C.red}44`,
            padding: "6px 12px",
            display: "inline-block",
            boxShadow: `inset 0 0 10px ${C.red}14`,
          }}>
            <span style={{color: C.red, marginRight: "6px"}}>❝</span>
            Le tue unghie si sono consumate fino all'osso.
            <span style={{color: C.red, marginLeft: "6px"}}>❞</span>
          </div>

          {/* Section header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            borderBottom: `1px solid ${C.gold}44`,
            paddingBottom: "6px", marginBottom: "10px",
            maxWidth: "420px", margin: "0 auto 10px",
          }}>
            <div style={{
              background: C.gold, color: "#000",
              padding: "2px 10px", fontSize: "9px", fontWeight: "bold",
              letterSpacing: "2px",
              boxShadow: `0 0 6px ${C.gold}88`,
            }}>
              ★ 📊 DIARIO DI RUN ★
            </div>
            <div style={{marginLeft: "auto", color: C.gold, fontSize: "9px", letterSpacing: "1px"}}>
              12 metriche
            </div>
          </div>

          {/* Stats grid — tile foil con icon centrale */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px",
            marginBottom: "16px", maxWidth: "420px", margin: "0 auto 16px",
          }}>
            {[
              { icon: "🖐️", label: "GRATTATE", val: gameStats.cardsScratched, color: C.magenta },
              { icon: "✅", label: "VINTE", val: gameStats.scratchWins || 0, color: C.green },
              { icon: "❌", label: "PERSE", val: gameStats.scratchLosses || 0, color: C.red },
              { icon: "💰", label: "GUADAGNATO", val: `€${gameStats.moneyEarned}`, color: C.gold },
              { icon: "💸", label: "SPESO", val: `€${gameStats.moneySpent || 0}`, color: C.orange },
              { icon: "🗺️", label: "NODI", val: gameStats.nodesVisited, color: C.cyan },
              { icon: "⚔️", label: "COMBAT ✓", val: gameStats.combatsWon || 0, color: C.green },
              { icon: "💀", label: "COMBAT ✗", val: gameStats.combatsLost || 0, color: C.red },
              { icon: "⚡", label: "COMBO", val: gameStats.combosFired || 0, color: C.cyan },
              { icon: "🌙", label: "SOGNI", val: gameStats.dreamsHad || 0, color: C.magenta },
              { icon: "🎰", label: "SLOT", val: gameStats.slotPlays || 0, color: C.gold },
              { icon: "🏆", label: "MIGLIOR €", val: `€${gameStats.bestPrize || 0}`, color: C.gold },
            ].map(s => (
              <div key={s.label} style={{
                background: "#07070d",
                border: `1px solid ${s.color}66`,
                boxShadow: `inset 0 0 8px ${s.color}18`,
                padding: "6px 4px 5px",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Icon dietro semi-trasparente */}
                <div style={{
                  position: "absolute", right: "-4px", bottom: "-6px",
                  fontSize: "28px", opacity: 0.12,
                  textShadow: `0 0 8px ${s.color}`,
                  pointerEvents: "none",
                }}>{s.icon}</div>
                <div style={{
                  color: s.color, fontSize: "8px",
                  letterSpacing: "1.5px", fontWeight: "bold",
                  marginBottom: "2px", position: "relative",
                }}>
                  {s.icon} {s.label}
                </div>
                <div style={{
                  color: s.color, fontSize: "14px", fontWeight: "bold",
                  fontFamily: FONT, position: "relative",
                  textShadow: `0 0 6px ${s.color}55`,
                }}>
                  {s.val}
                </div>
              </div>
            ))}
          </div>

          <div style={{display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap"}}>
            <Btn variant="gold" onClick={() => { setScreen("title"); }} style={{letterSpacing: "2px"}}>
              ↻ RIPROVA
            </Btn>
            <Btn onClick={() => setShowTrophies(true)} style={{fontSize: "11px", borderColor: C.gold, color: C.gold, letterSpacing: "1px"}}>
              🏆 TROFEI
            </Btn>
          </div>
        </div>
      )}

      {/* ═══ VICTORY ═══ */}
      {/* ═══ CEDOLE DEL BROKER — meta-progressione post-vittoria ═══ */}
      {screen === "cedole" && pendingCedoleOffer && (
        <div style={{textAlign:"center", maxWidth:"600px", width:"100%"}}>
          <div style={{color:C.gold, fontSize:"18px", fontWeight:"bold", letterSpacing:"4px", marginBottom:"4px"}}>
            IL BROKER TI OFFRE UN ACCORDO
          </div>
          <div style={{color:C.dim, fontSize:"11px", marginBottom:"20px", letterSpacing:"2px"}}>
            Scegli una cedola permanente — attiva dalla prossima run
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:"12px", marginBottom:"20px"}}>
            {pendingCedoleOffer.map(cedola => (
              <div
                key={cedola.id}
                onClick={() => {
                  setStored(STORAGE_KEYS.cedola, cedola.id);
                  setActiveCedola(cedola.id);
                  setPendingCedoleOffer(null);
                  setScreen("victory");
                }}
                style={{
                  border:`2px solid ${C.gold}`, background:"#000000",
                  padding:"14px 18px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:"14px",
                  textAlign:"left",
                }}
                onMouseEnter={e => e.currentTarget.style.background=C.gold}
                onMouseLeave={e => e.currentTarget.style.background="#000000"}
              >
                <div style={{fontSize:"32px", flexShrink:0}}>{cedola.icon}</div>
                <div style={{flex:1}}>
                  <div style={{color:C.gold, fontWeight:"bold", fontSize:"13px", marginBottom:"4px", fontFamily:FONT}}>
                    {cedola.name}
                  </div>
                  <div style={{fontSize:"11px", display:"flex", gap:"12px"}}>
                    <span style={{color:C.green}}>✚ {cedola.pro}</span>
                    <span style={{color:C.red}}>✖ {cedola.contro}</span>
                  </div>
                </div>
                <div style={{color:C.gold, fontSize:"16px", flexShrink:0}}>▶</div>
              </div>
            ))}
          </div>
          <Btn onClick={() => { setPendingCedoleOffer(null); setScreen("victory"); }}
            style={{fontSize:"11px", color:C.dim, borderColor:C.dim}}>
            Rifiuta — nessuna cedola
          </Btn>
          {activeCedola && (
            <div style={{color:C.dim, fontSize:"10px", marginTop:"12px"}}>
              Cedola attiva: {CEDOLE.find(c=>c.id===activeCedola)?.icon} {CEDOLE.find(c=>c.id===activeCedola)?.name}
            </div>
          )}
        </div>
      )}

      {screen === "victory" && player && (
        <div style={{textAlign:"center", maxWidth:"520px", width:"100%", position:"relative"}}>

          {/* ── CONFETTI gold — visibili solo dopo il reveal ── */}
          {victoryRevealed && (() => {
            const rng = (s) => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
            const confetti = ["🌟","✨","💫","⭐","🏆","💰","🎊","🎉"];
            return Array.from({length:18}, (_,i) => (
              <div key={i} style={{
                position:"absolute",
                left:`${5 + rng(i*7)*88}%`,
                top:`${rng(i*11)*30}%`,
                fontSize:`${10 + rng(i*13)*14}px`,
                animation:`confettiDrop ${1.2 + rng(i*17)*1.6}s ${rng(i*19)*0.8}s ease-in forwards`,
                pointerEvents:"none", zIndex:10,
              }}>{confetti[i % confetti.length]}</div>
            ));
          })()}

          {/* ── SCRATCH CARD TITOLO ── */}
          <div style={{position:"relative", marginBottom: victoryRevealed ? "16px" : "4px", userSelect:"none"}}>
            {/* Testo nascosto sotto */}
            <div style={{padding:"18px 0 10px"}}>
              <div style={{
                color:C.gold, fontSize:"clamp(32px,7vw,56px)", fontWeight:"bold",
                letterSpacing:"4px", lineHeight:1, fontFamily:FONT,
                animation: victoryRevealed ? "victoryGoldPulse 1.8s ease-in-out infinite" : "none",
              }}>
                SEI LUDOPATICO
              </div>
              <div style={{
                color:C.gold, fontSize:"clamp(14px,3vw,22px)", fontWeight:"bold",
                letterSpacing:"6px", fontFamily:FONT, marginTop:"6px",
                opacity:0.9, animation: victoryRevealed ? "victoryGoldPulse 2.2s ease-in-out infinite" : "none",
              }}>
                COMPLIMENTI!
              </div>
            </div>
            {/* Canvas overlay — sparisce quando rivelato */}
            {!victoryRevealed && (
              <canvas
                ref={victoryCanvasRef}
                width={520} height={140}
                style={{
                  position:"absolute", top:0, left:0, width:"100%", height:"100%",
                  cursor:"crosshair", touchAction:"none",
                }}
                onMouseDown={e => { victoryDrawing.current = true; handleVictoryScratch(e.clientX, e.clientY); }}
                onMouseMove={e => { if (victoryDrawing.current) handleVictoryScratch(e.clientX, e.clientY); }}
                onMouseUp={() => { victoryDrawing.current = false; }}
                onMouseLeave={() => { victoryDrawing.current = false; }}
                onTouchStart={e => { victoryDrawing.current = true; handleVictoryScratch(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchMove={e => { e.preventDefault(); handleVictoryScratch(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchEnd={() => { victoryDrawing.current = false; }}
              />
            )}
          </div>

          {/* ── CONTENUTO: visibile solo dopo il reveal ── */}
          {victoryRevealed && (<>
            <div style={{color:C.dim, fontSize:"13px", marginBottom:"10px", letterSpacing:"3px"}}>
              ─── vittoria ───
            </div>
            <div style={{color:C.green, fontSize:"13px", marginBottom:"6px"}}>
              Hai sconfitto {BIOMES[BIOMES.length-1].boss}!
            </div>
            <div style={{color:C.bright, marginBottom:"12px", fontSize:"11px"}}>
              Hai conquistato tutti e 3 i biomi. Sei il Re dei Grattini — 'o capo d'Italia!
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"16px", textAlign:"left", maxWidth:"380px", margin:"0 auto 16px"}}>
              {[
                ["💰 Soldi finali", `€${player.money}`, C.gold],
                ["🖐️ Unghie vive", `${player.nails.filter(n=>n.state!=="morta").length}/5`, C.green],
                ["🖐️ Carte grattate", gameStats.cardsScratched, C.magenta],
                ["✅ Grattate vincenti", gameStats.scratchWins||0, C.green],
                ["❌ Grattate perdenti", gameStats.scratchLosses||0, C.red],
                ["💰 Guadagnato", `€${gameStats.moneyEarned}`, C.gold],
                ["🗺️ Nodi visitati", gameStats.nodesVisited, C.cyan],
                ["🏆 Miglior premio", `€${gameStats.bestPrize||0}`, C.gold],
                ["⚔️ Combat vinti", gameStats.combatsWon||0, C.green],
                ["⚡ Combo", gameStats.combosFired||0, C.cyan],
              ].map(([label, val, color], i) => (
                <div key={label} style={{
                  background:"#0d0d18", border:`1px solid ${color}44`, padding:"5px 8px",
                  animation:`statTileIn 0.4s ${i * 0.06}s ease-out both`,
                  boxShadow:`inset 0 0 8px ${color}18`,
                }}>
                  <div style={{color:C.dim, fontSize:"9px"}}>{label}</div>
                  <div style={{color, fontSize:"12px", fontWeight:"bold"}}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{color:C.dim, marginBottom:"12px", fontSize:"11px"}}>
              BETA 5 — Hai completato tutti i biomi!
            </div>
            <div style={{display:"flex", gap:"10px", justifyContent:"center", flexWrap:"wrap"}}>
              <Btn variant="gold" onClick={() => setScreen("title")} style={{fontSize:"16px", padding:"12px 32px"}}>
                Nuova Run
              </Btn>
              <Btn onClick={() => setShowTrophies(true)} style={{fontSize:"11px", borderColor:C.gold, color:C.gold}}>
                🏆 Trofei
              </Btn>
            </div>
          </>)}

          {/* hint se non ancora rivelato */}
          {!victoryRevealed && (
            <div style={{color:C.dim, fontSize:"10px", letterSpacing:"2px", marginTop:"6px"}}>
              gratta la tessera per scoprire il risultato
            </div>
          )}
        </div>
      )}

      {/* ═══ ITEM FOUND MODAL ═══ */}
      {itemFoundModal && (() => {
        const IFM_RARITY = {
          comune:     { c:"#7a8aaa", label:"COMUNE" },
          media:      { c:"#00cccc", label:"MEDIA" },
          rara:       { c:"#cc66ff", label:"RARA" },
          epica:      { c:C.orange,  label:"EPICA" },
          rarissimo:  { c:C.gold,    label:"RARISSIMO" },
          rarissima:  { c:C.gold,    label:"RARISSIMA" },
          leggendaria:{ c:C.gold,    label:"LEGGEND." },
        };
        const rar = IFM_RARITY[itemFoundModal.rarity] || null;
        const em = itemFoundModal.emoji || "✦";
        const sub = (itemFoundModal.subtitle || "").toLowerCase();
        const nm  = (itemFoundModal.name    || "").toLowerCase();
        const isDanger = ["💀","🩸","🚫"].some(e => em.includes(e))
          || nm.match(/fallita|maledizione|gelosia|negato|perdita|maledett/);
        const isWin = ["🏆","⚡","🌍"].some(e => em.includes(e))
          || sub.match(/vittoria|sbloccato/);
        const accent = rar ? rar.c
          : isDanger ? "#ff3355"
          : isWin    ? C.green
          : sub.includes("reliquia")  ? C.gold
          : sub.includes("grattatore")? C.cyan
          : sub.includes("chirurgo")  ? "#00cccc"
          : sub.includes("macellaio") ? "#ff6600"
          : sub.includes("collezion") ? "#ffcc00"
          : sub.includes("evento")    ? "#cc99ff"
          : C.gold;
        const descLines = (itemFoundModal.desc || "").split("\n");
        return (
          <div style={{
            position:"fixed", inset:0,
            background:"rgba(0,0,0,0.91)", zIndex:99998,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {/* Backdrop glow */}
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              background:`radial-gradient(ellipse 70% 55% at 50% 50%, ${accent}1a 0%, ${accent}07 45%, transparent 70%)`,
            }}/>
            <div style={{
              background:"linear-gradient(180deg,#08081c 0%,#040410 100%)",
              border:`2px solid ${accent}`,
              maxWidth:"320px", width:"92%",
              boxShadow:`0 0 50px ${accent}44, 0 0 90px ${accent}18, inset 0 0 18px ${accent}0a`,
              fontFamily:FONT, position:"relative", overflow:"hidden",
              animation:"itemFoundIn 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}>
              {/* Top shimmer line */}
              <div style={{height:"2px", background:`linear-gradient(90deg,transparent,${accent}55,${accent}bb,${accent}55,transparent)`}}/>

              {/* Header */}
              <div style={{padding:"10px 14px 0", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", flexWrap:"wrap"}}>
                <div style={{color:accent, fontSize:"10px", letterSpacing:"3px", fontWeight:"bold", textShadow:`0 0 10px ${accent}`}}>
                  {itemFoundModal.subtitle ? `✦ ${itemFoundModal.subtitle.toUpperCase()} ✦` : "✦ HAI TROVATO ✦"}
                </div>
                {rar && (
                  <div style={{background:`${accent}22`, border:`1px solid ${accent}66`, color:accent, fontSize:"8px", letterSpacing:"1.5px", padding:"2px 6px", fontWeight:"bold"}}>
                    {rar.label}
                  </div>
                )}
              </div>

              {/* Emoji ring */}
              <div style={{position:"relative", width:"96px", height:"96px", margin:"10px auto 4px", display:"flex", alignItems:"center", justifyContent:"center"}}>
                <div style={{position:"absolute", inset:0, borderRadius:"50%", background:`radial-gradient(circle,${accent}44 0%,${accent}16 50%,transparent 70%)`, animation:"itemGlowRing 2.2s ease-in-out infinite"}}/>
                <div style={{position:"absolute", inset:"18%", borderRadius:"50%", border:`1px solid ${accent}44`, animation:"itemGlowRing 2.2s ease-in-out infinite 0.7s"}}/>
                <div style={{fontSize:"50px", position:"relative", zIndex:1, filter:`drop-shadow(0 0 14px ${accent})`, animation:isDanger?"pulse 1.4s ease-in-out infinite":"none"}}>
                  {em}
                </div>
              </div>

              {/* Name */}
              <div style={{color:"#fff", fontWeight:"bold", fontSize:"16px", padding:"0 18px 6px", textAlign:"center", textShadow:`0 0 12px ${accent}88`, letterSpacing:"0.4px"}}>
                {itemFoundModal.name}
              </div>

              {/* Divider */}
              <div style={{height:"1px", margin:"0 18px 10px", background:`linear-gradient(90deg,transparent,${accent}44,transparent)`}}/>

              {/* Desc */}
              <div style={{padding:"0 18px 14px", display:"flex", flexDirection:"column", gap:"2px"}}>
                {descLines.map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{height:"4px"}}/>;
                  const isArt = /^[\s]*[│┌┐└┘╔╗╚╝║═╠╣░▒▓┼─]/.test(line);
                  const isStat = /^[+\-±]/.test(line.trim()) || /[€×x]\d/.test(line) || /VINCITA|BONUS|COMBO/.test(line);
                  if (isArt) return (
                    <div key={i} style={{color:`${accent}99`, fontSize:"9px", lineHeight:"1.3", fontFamily:"monospace", whiteSpace:"pre", overflow:"hidden", textOverflow:"ellipsis"}}>{line}</div>
                  );
                  return (
                    <div key={i} style={{color:isStat?C.bright:C.text, fontSize:isStat?"12px":"11px", lineHeight:"1.7", fontWeight:isStat?"bold":"normal"}}>
                      {line}
                    </div>
                  );
                })}
              </div>

              {/* Buttons */}
              <div style={{padding:"0 16px 18px", display:"flex", flexDirection:"column", gap:"8px"}}>
                {itemFoundModal.choices ? (
                  itemFoundModal.choices.map((ch, ci) => (
                    <Btn key={ci} variant={ci===0?"gold":"normal"} onClick={() => { ch.action?.(); setItemFoundModal(null); }}
                      style={{fontSize:"12px", padding:"10px 20px"}}>
                      {ch.label}
                    </Btn>
                  ))
                ) : (
                  <div onClick={() => setItemFoundModal(null)} style={{
                    padding:"11px 20px", background:`${accent}18`, border:`1px solid ${accent}88`,
                    color:accent, fontSize:"13px", fontWeight:"bold", letterSpacing:"1px",
                    cursor:"pointer", textAlign:"center", fontFamily:FONT,
                    boxShadow:`0 0 14px ${accent}2a, inset 0 0 8px ${accent}0d`,
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=`${accent}2a`}
                  onMouseLeave={e=>e.currentTarget.style.background=`${accent}18`}>
                    {itemFoundModal.buttonLabel || "OK →"}
                  </div>
                )}
              </div>

              {/* Bottom shimmer */}
              <div style={{height:"1px", background:`linear-gradient(90deg,transparent,${accent}44,${accent}88,${accent}44,transparent)`}}/>
            </div>
          </div>
        );
      })()}

      {/* ═══ NAIL EQUIP MODAL — "Su quale unghia lo equipaggi?" ═══ */}
      {nailEquipModal && player && (() => {
        const TIER_ORDER = ["marcia","sanguinante","graffiata","sana","kawaii"];
        const TIER_COLORS = { marcia:C.red, sanguinante:C.orange, graffiata:C.gold, sana:C.green, kawaii:C.pink };
        // Sprint 2: stati speciali fuori catena — mappa pip all'equivalente più vicino
        const SPECIAL_TIER_MAP = { polliceVerde: "kawaii", unghiaNera: "marcia" };
        const activeNailColor = NAIL_INFO[player.nails[player.activeNail]?.state]?.color || C.magenta;
        return (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.88)", zIndex:99998,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            background:C.card, border:`2px solid ${activeNailColor}`,
            boxShadow:`0 0 40px ${activeNailColor}44`,
            padding:"24px 28px", textAlign:"center", maxWidth:"420px", width:"95%",
            fontFamily:FONT,
          }}>
            {nailEquipResult ? (
              <>
                <div style={{color:C.green, fontSize:"11px", letterSpacing:"3px", marginBottom:"6px"}}>✦ APPLICATO ✦</div>
                <div style={{fontSize:"42px", margin:"6px 0 8px"}}>{nailEquipResult.emoji}</div>
                <div style={{color:C.green, fontWeight:"bold", fontSize:"16px", marginBottom:"8px"}}>
                  {nailEquipResult.text}
                </div>
                <Btn onClick={() => { setNailEquipResult(null); setNailEquipModal(null); }} style={{marginTop:"12px", fontSize:"12px"}}>
                  OK →
                </Btn>
              </>
            ) : (
            <>
            <div style={{color:activeNailColor, fontSize:"11px", letterSpacing:"3px", marginBottom:"6px"}}>
              {nailEquipModal.fromZaino ? "✦ USA OGGETTO ✦" : "✦ HAI TROVATO ✦"}
            </div>
            <div style={{fontSize:"42px", margin:"6px 0 8px"}}>{nailEquipModal.emoji}</div>
            <div style={{color:C.bright, fontWeight:"bold", fontSize:"16px", marginBottom:"4px"}}>
              {nailEquipModal.name}
            </div>
            <div style={{color:C.text, fontSize:"11px", lineHeight:"1.6", marginBottom:"16px"}}>
              {nailEquipModal.desc}
            </div>
            {/* Stat boost preview */}
            {(() => {
              const def = ITEM_DEFS[nailEquipModal.itemId];
              const boost = def?.statBoost || {};
              return Object.keys(boost).length > 0 && (
                <div style={{color:C.dim, fontSize:"10px", marginBottom:"14px", display:"flex", gap:"8px", justifyContent:"center"}}>
                  {boost.fortuna && <span style={{color:C.green}}>🍀+{boost.fortuna}</span>}
                  {boost.potenza && <span style={{color:C.red}}>⚔️+{boost.potenza}</span>}
                  {boost.resilienza && <span style={{color:C.cyan}}>🛡️+{boost.resilienza}</span>}
                </div>
              );
            })()}
            <div style={{color:C.gold, fontSize:"12px", letterSpacing:"1px", marginBottom:"12px", fontWeight:"bold"}}>
              📎 Su quale unghia lo equipaggi?
            </div>
            {/* 5 nail buttons */}
            <div style={{display:"flex", gap:"6px", justifyContent:"center", flexWrap:"wrap", marginBottom:"14px"}}>
              {player.nails.map((n, i) => {
                const ni = NAIL_INFO[n.state];
                const isDead = n.state === "morta";
                const nailEmoji = isDead ? "💀"
                  : n.state==="piede" ? "🦶"
                  : n.state==="kawaii" ? "💖"
                  : n.state==="polliceVerde" ? "🌿"
                  : n.state==="unghiaNera" ? "🖤"
                  : "🖐";
                const pipStateModal = SPECIAL_TIER_MAP[n.state] || n.state;
                const aliveTiersModal = TIER_ORDER.indexOf(pipStateModal);
                const cbRef = nailEquipCallbackRef.current;
                const canSelect = cbRef?.nailFilter ? cbRef.nailFilter(n) : !isDead;
                return (
                  <div key={i}
                    onClick={!canSelect ? undefined : () => {
                      const resultText = cbRef?.resultText?.(i, n);
                      if (cbRef?.onNailSelect) { cbRef.onNailSelect(i); }
                      else { equipItemOnNail(nailEquipModal.itemId, i); }
                      nailEquipCallbackRef.current = null;
                      if (nailEquipModal.fromZaino && resultText) {
                        setNailEquipResult({ emoji: nailEquipModal.emoji, text: resultText });
                      } else {
                        setNailEquipModal(null);
                      }
                    }}
                    style={{
                      width:"68px", padding:"8px 4px",
                      border:`1px solid ${!canSelect ? "#333" : i === player.activeNail ? ni.color : ni.color+"55"}`,
                      background: !canSelect ? "#0a0a0a" : i === player.activeNail ? ni.color+"15" : "#0a0a14",
                      cursor: !canSelect ? "not-allowed" : "pointer",
                      opacity: !canSelect ? 0.4 : 1,
                      textAlign:"center",
                      transition:"border-color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={e => { if (canSelect) { e.currentTarget.style.borderColor = C.magenta; e.currentTarget.style.background = C.magenta+"15"; }}}
                    onMouseLeave={e => { if (canSelect) { e.currentTarget.style.borderColor = i === player.activeNail ? ni.color : ni.color+"55"; e.currentTarget.style.background = i === player.activeNail ? ni.color+"15" : "#0a0a14"; }}}
                  >
                    <div style={{fontSize:"18px", marginBottom:"4px"}}>{nailEmoji}</div>
                    <div style={{color:ni.color, fontSize:"7px", fontWeight:"bold", marginBottom:"3px"}}>{ni.label}</div>
                    {/* HP pips */}
                    <div style={{display:"flex", gap:"2px", justifyContent:"center", flexWrap:"wrap"}}>
                      {TIER_ORDER.map((tier, ti) => {
                        const filled = ti <= aliveTiersModal && !isDead;
                        return <span key={ti} style={{display:"inline-block", width:"7px", height:"4px", background: filled ? TIER_COLORS[tier] : "#111", border:`1px solid ${filled ? TIER_COLORS[tier]+"aa" : "#2a2a2a"}`}}/>;
                      })}
                      {Array(n.cremaHP||0).fill(0).map((_,ci) => (
                        <span key={"c"+ci} style={{display:"inline-block", width:"7px", height:"4px", background:"#fff", border:"1px solid #aaa"}}/>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Metti in inventario instead (solo quando trovato, non da zaino) */}
            {!nailEquipModal.fromZaino && (
              <Btn variant="normal" onClick={() => {
                updatePlayer(p => p.items.length >= MAX_ITEMS ? p : ({...p, items: [...p.items, nailEquipModal.itemId]}));
                addLog(`🎒 ${nailEquipModal.emoji} ${nailEquipModal.name} messo nello zaino`, C.dim);
                nailEquipCallbackRef.current = null;
                setNailEquipModal(null);
              }} style={{fontSize:"10px", padding:"6px 16px", color:C.dim}}>
                🎒 Metti nello zaino →
              </Btn>
            )}
            {nailEquipModal.fromZaino && (
              <Btn variant="normal" onClick={() => { nailEquipCallbackRef.current = null; setNailEquipModal(null); }} style={{fontSize:"10px", padding:"6px 16px", color:C.dim}}>
                ✖ Annulla
              </Btn>
            )}
            </>
            )}
          </div>
        </div>
        );
      })()}

      {/* ═══ STAMP OVERLAY (Timbro WIN) ═══ */}
      {stampOverlay && (
        <div style={{
          position:"fixed", inset:0,
          zIndex:999999, pointerEvents:"none",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            color: stampOverlay.color || C.gold, fontSize:"72px", fontWeight:"bold", fontFamily:FONT,
            textShadow:`0 0 40px ${stampOverlay.color || C.gold}, 0 0 80px ${stampOverlay.color || C.gold}88, 0 0 120px ${stampOverlay.color || C.gold}44`,
            letterSpacing:"12px",
            transform:"rotate(-12deg) scale(1.2)",
            animation:"stampIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            border:`4px solid ${stampOverlay.color || C.gold}`,
            padding:"20px 60px",
            background:"rgba(0,0,0,0.7)",
          }}>
            {stampOverlay.text || stampOverlay}
          </div>
        </div>
      )}

      {/* ═══ SMOKE CHOICE MODAL ═══ */}
      {smokeChoiceModal && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.85)", zIndex:99999,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          {(() => { const smokeCol = smokeChoiceModal.itemType === "sigarettaErba" ? C.green : "#aaaaaa"; return (
          <div style={{
            background:"#0d0d0d", border:`2px solid ${smokeCol}`,
            borderRadius:"0", padding:"28px 36px",
            textAlign:"center", maxWidth:"320px", width:"90%",
            fontFamily:FONT, boxShadow:`0 0 28px ${smokeCol}55, inset 0 0 22px ${smokeCol}14`,
          }}>
            <div style={{fontSize:"48px", marginBottom:"8px"}}>
              {smokeChoiceModal.itemType === "sigarettaErba" ? "🌿" : "🚬"}
            </div>
            <div style={{color:C.bright, fontWeight:"bold", fontSize:"16px", marginBottom:"6px"}}>
              {smokeChoiceModal.itemType === "sigarettaErba" ? "Sigaretta con Erba" : "Sigaretta"}
            </div>
            <div style={{color:C.dim, fontSize:"12px", marginBottom:"20px", lineHeight:"1.7"}}>
              {smokeChoiceModal.itemType === "sigarettaErba"
                ? "+2 Fortuna per 4 turni · cura l'unghia attiva\nLa fumi o la tieni?"
                : "+1 Fortuna per 3 turni\nLa fumi subito o la conservi?"}
            </div>
            {player && (player.smokesTotal || 0) >= 4 && !player.tumore && (
              <div style={{color:C.red, fontSize:"11px", marginBottom:"12px", padding:"6px", border:`1px solid ${C.red}`, borderRadius:"0"}}>
                ⚠ Hai già fumato molto... ancora una e rischi grosso!
              </div>
            )}
            <div style={{display:"flex", gap:"10px", justifyContent:"center"}}>
              <Btn variant="gold" onClick={() => handleSmoke(smokeChoiceModal.itemType)}
                style={{fontSize:"12px", padding:"10px 20px"}}>
                🔥 Fuma subito
              </Btn>
              <Btn variant="default" onClick={() => handleSaveSmoke(smokeChoiceModal.itemType)}
                style={{fontSize:"12px", padding:"10px 20px"}}>
                🎒 Zaino →
              </Btn>
            </div>
          </div>
          ); })()}
        </div>
      )}

      {/* ═══ INVENTARIO SLIDE-IN — usabile in qualsiasi momento ═══ */}
      {showInventoryPanel && player && (
        <div
          onClick={() => setShowInventoryPanel(false)}
          style={{
            position:"fixed", inset:0, top:"52px",
            background:"rgba(0,0,0,0.55)", zIndex:99990, cursor:"pointer",
          }}
        />
      )}
      {showInventoryPanel && player && (
        <div style={{
          position:"fixed",
          top:"56px",
          bottom:0,
          right:0,
          width:"min(400px, 100vw)",
          background:C.card,
          border:`2px solid ${C.magenta}`,
          borderRight:"none",
          boxShadow:`-4px 0 20px ${C.magenta}33, inset 0 0 30px ${C.magenta}08`,
          zIndex:99995, overflowY:"auto", overflowX:"hidden",
          display:"flex", flexDirection:"column",
          fontFamily:FONT,
          animation:"inventorySlideIn 0.2s ease-out",
        }}>
          <div style={{padding:"12px 14px 0"}}>
            <div style={{marginBottom:"12px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{color:C.magenta, fontWeight:"bold", fontSize:"14px", letterSpacing:"1px"}}>
                🎒 ZAINO
              </div>
              <div onClick={() => setShowInventoryPanel(false)} style={{
                color:C.magenta, fontSize:"18px", cursor:"pointer", lineHeight:1,
                padding:"2px 6px", opacity:0.7,
              }}>✕</div>
            </div>

            {/* Consumabili */}
            <div style={{marginBottom:"14px"}}>
              <div style={{color:C.dim, fontSize:"10px", letterSpacing:"2px", borderBottom:`1px solid #2a2a3a`, paddingBottom:"4px", marginBottom:"8px"}}>
                💊 CONSUMABILI ({player.items.length})
              </div>
              {player.items.length === 0 && (
                <div style={{color:C.dim, fontSize:"12px", fontStyle:"italic"}}>Nessun consumabile nello zaino.</div>
              )}
              <div style={{display:"flex", flexWrap:"wrap", gap:"6px"}}>
                {player.items.map((itemId, idx) => {
                  const item = ITEM_DEFS[itemId];
                  if (!item) return null;
                  const ZAINO_RC = { comune:"#7a8aaa", media:C.cyan, rara:"#cc66ff", epica:C.orange, rarissimo:C.gold, rarissima:C.gold };
                  const rc = ZAINO_RC[item.rarity] || C.magenta;
                  return (
                    <Tooltip key={idx} text={item.desc}>
                      <div
                        onClick={() => { useItem(idx); if (itemId !== "cappelloSbirro") setShowInventoryPanel(false); }}
                        style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
                          padding:"7px 9px", background:`${rc}11`, border:`1px solid ${rc}55`,
                          cursor:"pointer", minWidth:"62px", fontFamily:FONT, userSelect:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.background=`${rc}22`}
                        onMouseLeave={e=>e.currentTarget.style.background=`${rc}11`}
                      >
                        <div style={{fontSize:"22px", filter:`drop-shadow(0 0 5px ${rc}88)`}}>{item.emoji}</div>
                        <div style={{color:C.bright, fontSize:"10px", fontWeight:"bold", whiteSpace:"nowrap", maxWidth:"68px", overflow:"hidden", textOverflow:"ellipsis"}}>{item.name}</div>
                        <div style={{color:rc, fontSize:"8px", letterSpacing:"1px"}}>{(item.rarity||"").toUpperCase()}</div>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            {/* Grattatori */}
            <div>
              <div style={{color:C.dim, fontSize:"10px", letterSpacing:"2px", borderBottom:`1px solid #2a2a3a`, paddingBottom:"4px", marginBottom:"8px"}}>
                🔧 GRATTATORI ({player.grattatori.length})
              </div>
              {player.grattatori.length === 0 && (
                <div style={{color:C.dim, fontSize:"12px", fontStyle:"italic"}}>Nessun grattatore nello zaino.</div>
              )}
              <div style={{display:"flex", flexWrap:"wrap", gap:"6px"}}>
                {player.grattatori.map((g, idx) => {
                  const def = GRATTATORE_DEFS[g.id];
                  const isEquipped = player.equippedGrattatore?.inventoryIdx === idx;
                  const ZAINO_RC2 = { comune:"#7a8aaa", media:C.cyan, rara:"#cc66ff", epica:C.orange, rarissimo:C.gold, rarissima:C.gold };
                  const rc = def ? (ZAINO_RC2[def.rarity] || C.cyan) : C.cyan;
                  return (
                    <Tooltip key={idx} text={`${g.desc || def?.desc} · ${g.usesLeft} usi rimasti`}>
                      <div
                        onClick={() => { if (isEquipped) unequipGrattatore(); else equipGrattatore(idx); }}
                        style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"2px",
                          padding:"7px 9px", background:isEquipped?`${rc}22`:`${rc}0c`,
                          border:`1px solid ${isEquipped?rc:rc+"44"}`,
                          boxShadow:isEquipped?`0 0 8px ${rc}44`:"none",
                          cursor:"pointer", minWidth:"62px", fontFamily:FONT, userSelect:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.background=`${rc}28`}
                        onMouseLeave={e=>e.currentTarget.style.background=isEquipped?`${rc}22`:`${rc}0c`}
                      >
                        <div style={{fontSize:"22px", filter:`drop-shadow(0 0 5px ${rc}88)`}}>{g.emoji}</div>
                        <div style={{color:C.bright, fontSize:"10px", fontWeight:"bold", whiteSpace:"nowrap", maxWidth:"68px", overflow:"hidden", textOverflow:"ellipsis"}}>{g.name}</div>
                        <div style={{color:isEquipped?rc:C.dim, fontSize:"8px", letterSpacing:"1px"}}>
                          {isEquipped ? "✓ ATTIVO" : `${g.usesLeft} usi`}
                        </div>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

          </div>
          <div style={{marginTop:"10px", padding:"10px 12px", borderTop:`1px solid #1a1a2a`, color:C.dim, fontSize:"10px", textAlign:"center"}}>
            Puoi usare oggetti in qualsiasi momento · Grattatori vanno equipaggiati prima di grattare
          </div>
        </div>
      )}

      {/* ═══ SMOKE EFFECT OVERLAY ═══ */}
      {showSmokeEffect && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(20,40,20,0.45)", zIndex:99997, pointerEvents:"none",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          animation:"fadeOut 2.5s forwards",
        }}>
          <div style={{fontSize:"60px", opacity:0.7, marginBottom:"12px"}}>💨</div>
          <div style={{color:C.green, fontFamily:FONT, fontSize:"18px", fontWeight:"bold",
            letterSpacing:"2px"}}>
            {player?.tumore ? "💀 TUMORE!" : `+FORTUNA`}
          </div>
        </div>
      )}

      {/* ═══ SOGNO MODAL ═══ */}
      {dreamModal && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.93)", zIndex:99999,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:FONT,
        }}>
          <div style={{
            background:"#050510", border:`2px solid #3a2a6a`,
            borderRadius:"0", padding:"36px 44px",
            textAlign:"center", maxWidth:"360px", width:"90%",
            boxShadow:"0 0 40px #5a3a9877, inset 0 0 40px #3a2a6a22",
          }}>
            <div style={{color:"#7a5ab8", fontSize:"11px", letterSpacing:"4px", marginBottom:"10px"}}>
              ✦ SOGNO... ✦
            </div>
            <div style={{fontSize:"56px", margin:"8px 0 16px", filter:"drop-shadow(0 0 18px #5a3a9888)"}}>
              {dreamModal.emoji}
            </div>
            <div style={{
              color:"#c8b8e8", fontSize:"13px", lineHeight:"2.0",
              marginBottom:"24px", fontStyle:"italic", whiteSpace:"pre-line",
            }}>
              {dreamModal.text}
            </div>
            {dreamModal.effect && (
              <div style={{
                color: dreamModal.effectColor || C.gold,
                fontSize:"11px", marginBottom:"16px",
                background:"#0a0820", borderRadius:"0",
                padding:"6px 12px", letterSpacing:"1px",
              }}>
                {dreamModal.effect}
              </div>
            )}
            <Btn variant="success" onClick={() => {
              if (dreamModal.onConfirm) dreamModal.onConfirm();
              setDreamModal(null);
              setScreen("map");
            }} style={{fontSize:"13px", padding:"9px 28px", borderColor:"#5a3a98", background:"#0d0828", color:"#c8b8e8"}}>
              Mi sveglio...
            </Btn>
          </div>
        </div>
      )}


      {/* ═══ MODAL RELIQUIE ═══ */}
      {showReliquie && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.94)", zIndex:99000,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:FONT, padding:"16px",
        }} onClick={() => setShowReliquie(false)}>
          <div style={{
            background:"#08080f", border:"2px solid #c060ff",
            maxWidth:"640px", width:"96vw", maxHeight:"92vh", overflowY:"auto",
            padding:"18px 20px 16px",
            boxShadow:"0 0 40px #c060ff44, inset 0 0 40px #c060ff11",
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{color:"#c060ff", fontSize:"18px", fontWeight:"bold", letterSpacing:"4px", textAlign:"center", marginBottom:"2px", textShadow:"0 0 12px #c060ff88"}}>
              🏺 RELIQUIE
            </div>
            <div style={{color:C.dim, fontSize:"10px", textAlign:"center", letterSpacing:"1px", marginBottom:"4px"}}>
              Oggetti mistici da equipaggiare per la prossima run
            </div>
            {/* Progress bar */}
            <div style={{margin:"8px auto 18px", maxWidth:"360px"}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:"9px", color:"#c060ff", marginBottom:"3px", letterSpacing:"1px"}}>
                <span>SCOPERTE · {enabledRelics.length} ATTIVE</span>
                <span>{discoveredRelics.length} / {Object.keys(RELIC_DEFS).length}</span>
              </div>
              <div style={{height:"6px", background:"#1a1a22", border:"1px solid #2a2a3a", position:"relative"}}>
                <div style={{
                  height:"100%", width:`${(discoveredRelics.length/Object.keys(RELIC_DEFS).length)*100}%`,
                  background:"linear-gradient(90deg, #c060ff, #ff9900)",
                  boxShadow:"0 0 8px #c060ffaa",
                  transition:"width 0.4s",
                }} />
              </div>
            </div>
            {/* Grid cards — stile Vintage con toggle ATTIVA */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))",
              gap:"12px", marginBottom:"16px",
            }}>
              {Object.entries(RELIC_DEFS).map(([id, def]) => {
                const known = discoveredRelics.includes(id);
                const active = enabledRelics.includes(id);
                const isEpic = def.rarity === "epica";
                const accent = isEpic ? "#ff9900" : "#c060ff";
                return (
                  <div key={id} style={{
                    background: known ? "#0d0d14" : "#0a0a10",
                    border: `2px solid ${known ? (active ? accent : accent+"55") : "#252538"}`,
                    padding:"0", position:"relative",
                    overflow:"hidden",
                    boxShadow: known && active ? `0 0 14px ${accent}66` : "none",
                    opacity: known ? 1 : 0.72,
                    display:"flex", flexDirection:"column",
                  }}>
                    {/* Preview tile */}
                    <div style={{
                      height:"92px", position:"relative",
                      background: known ? (isEpic ? "#1f1408" : "#140a1f") : "#060608",
                      borderBottom: `1px solid ${known ? accent+"66" : "#1a1a28"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      filter: known ? "none" : "grayscale(100%) brightness(0.4)",
                      overflow:"hidden",
                    }}>
                      {/* Shimmer foil per scoperti */}
                      {known && (
                        <div style={{
                          position:"absolute", inset:0, pointerEvents:"none",
                          background:`linear-gradient(110deg, transparent 30%, ${accent}55 48%, ${accent}aa 50%, ${accent}55 52%, transparent 70%)`,
                          backgroundSize:"200% 100%",
                          animation:`variantShimmer ${active ? "2.2s" : "3.2s"} linear infinite`,
                          mixBlendMode:"screen",
                        }} />
                      )}
                      {/* Emoji centrale */}
                      <div style={{
                        fontSize:"40px", position:"relative", zIndex:2,
                        textShadow: known ? `0 0 14px ${accent}cc` : "none",
                        filter: known ? "none" : "blur(1px)",
                      }}>
                        {known ? def.emoji : "🔮"}
                      </div>
                      {/* Sparkle per epiche */}
                      {known && isEpic && (
                        <div style={{
                          position:"absolute", top:8, right:10, fontSize:"14px",
                          color: accent, zIndex:3,
                          animation:"variantSparkle 1.6s ease-in-out infinite",
                          textShadow:`0 0 8px ${accent}`,
                        }}>✦</div>
                      )}
                      {/* Rarity badge angolo */}
                      {known && (
                        <div style={{
                          position:"absolute", top:6, left:6, zIndex:3,
                          fontSize:"7px", letterSpacing:"1px", fontWeight:"bold",
                          color: accent,
                          background: isEpic ? "#1f1408" : "#140a1f",
                          border:`1px solid ${accent}88`,
                          padding:"1px 4px",
                        }}>{def.rarity.toUpperCase()}</div>
                      )}
                    </div>
                    {/* Badge label */}
                    <div style={{
                      background: known ? accent : "#1a1a28",
                      color: known ? "#000" : "#3a3a52",
                      padding:"4px 6px", fontSize:"11px", fontWeight:"bold",
                      letterSpacing:"2px", textAlign:"center",
                      textShadow: known ? "0 0 4px #fff8" : "none",
                    }}>
                      ★ {known ? def.name.toUpperCase() : "???"} ★
                    </div>
                    {/* Body: desc + toggle */}
                    <div style={{padding:"8px 8px 10px", flex:1, display:"flex", flexDirection:"column", gap:"6px"}}>
                      <div style={{
                        color: known ? C.text : "#2a2a4a",
                        fontSize:"10px", lineHeight:"1.35", minHeight:"42px",
                      }}>
                        {known ? def.desc : "Scoprila durante una run per sbloccarne i poteri."}
                      </div>
                      {known ? (
                        <button onClick={() => {
                          setEnabledRelics(prev => {
                            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
                            setStored(STORAGE_KEYS.relicsEnabled, next);
                            return next;
                          });
                        }} style={{
                          width:"100%",
                          background: active ? accent : "transparent",
                          border:`1px solid ${active ? accent : accent+"55"}`,
                          color: active ? "#000" : accent,
                          fontSize:"10px", cursor:"pointer", padding:"5px 8px",
                          fontFamily:FONT, fontWeight:"bold", letterSpacing:"1.5px",
                          textShadow: active ? "0 0 4px #fff8" : "none",
                          boxShadow: active ? `0 0 8px ${accent}66` : "none",
                          transition:"all 0.15s",
                        }}>
                          {active ? "✓ ATTIVA" : "▸ ATTIVA"}
                        </button>
                      ) : (
                        <div style={{
                          borderTop:`1px solid #1a1a28`, paddingTop:"5px",
                          fontSize:"9px", color:"#3a3a52", textAlign:"center",
                          letterSpacing:"1px",
                        }}>— LOCKED —</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {enabledRelics.length > 0 && (
              <div style={{color:"#c060ff", fontSize:"10px", textAlign:"center", marginBottom:"10px", letterSpacing:"1px"}}>
                ✦ Le {enabledRelics.length} reliquie attive saranno presenti dall'inizio della prossima run ✦
              </div>
            )}
            <div style={{textAlign:"center"}}>
              <Btn onClick={() => setShowReliquie(false)} style={{borderColor:"#c060ff", color:"#c060ff", fontSize:"11px"}}>
                Chiudi
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VINTAGE COLLEZIONABILI (Sprint 5) ═══ */}
      {showVintage && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.94)", zIndex:99000,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:FONT, padding:"16px",
        }} onClick={() => setShowVintage(false)}>
          <div style={{
            background:"#08080f", border:"2px solid #ffaa88",
            maxWidth:"640px", width:"96vw", maxHeight:"92vh", overflowY:"auto",
            padding:"18px 20px 16px",
            boxShadow:"0 0 40px #ffaa8844, inset 0 0 40px #ffaa8811",
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{color:"#ffaa88", fontSize:"18px", fontWeight:"bold", letterSpacing:"4px", textAlign:"center", marginBottom:"2px", textShadow:"0 0 12px #ffaa8888"}}>
              🎨 VINTAGE COLLEZIONABILI
            </div>
            <div style={{color:C.dim, fontSize:"10px", textAlign:"center", letterSpacing:"1px", marginBottom:"4px"}}>
              Varianti ULTRA-rare delle carte combat
            </div>
            {/* Progress bar */}
            <div style={{margin:"8px auto 18px", maxWidth:"360px"}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:"9px", color:"#ffaa88", marginBottom:"3px", letterSpacing:"1px"}}>
                <span>COLLEZIONE</span>
                <span>{vintageCollected.length} / 5</span>
              </div>
              <div style={{height:"6px", background:"#1a1a22", border:"1px solid #2a2a3a", position:"relative"}}>
                <div style={{
                  height:"100%", width:`${(vintageCollected.length/5)*100}%`,
                  background:"linear-gradient(90deg, #ffaa88, #ffd700)",
                  boxShadow:"0 0 8px #ffaa88aa",
                  transition:"width 0.4s",
                }} />
              </div>
            </div>
            {/* Grid cards — 2 colonne su mobile, 3 su desktop, con preview stile carta combat */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))",
              gap:"12px", marginBottom:"16px",
            }}>
              {Object.entries(CARD_VARIANTS).map(([id, v]) => {
                const known = vintageCollected.includes(id);
                const rarityPct = (v.chance * 100).toFixed(1);
                return (
                  <div key={id} style={{
                    background: known ? "#0d0d14" : "#0a0a10",
                    border: `2px solid ${known ? v.color : "#252538"}`,
                    padding:"0", position:"relative",
                    overflow:"hidden",
                    boxShadow: known ? v.glow : "none",
                    opacity: known ? 1 : 0.72,
                    display:"flex", flexDirection:"column",
                  }}>
                    {/* Preview — mini "carta combat" stilizzata */}
                    <div style={{
                      height:"92px", position:"relative",
                      background: known
                        ? (id === "ORO" ? "#2a1f00"
                          : id === "BN" ? "#1a1a1a"
                          : id === "STRAPPATO" ? "#1a1208"
                          : id === "FOIL" ? "#0a1428"
                          : id === "MULTI" ? "#1f0a1a"
                          : "#0a0a12")
                        : "#060608",
                      borderBottom: `1px solid ${known ? v.color+"66" : "#1a1a28"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      filter: known ? (id === "BN" ? "grayscale(100%) contrast(1.2)" : id === "STRAPPATO" ? "saturate(0.55) brightness(0.82)" : "none") : "grayscale(100%) brightness(0.4)",
                      overflow:"hidden",
                    }}>
                      {/* Shimmer per foil/oro/multi */}
                      {known && (id === "FOIL" || id === "ORO" || id === "MULTI") && (
                        <div style={{
                          position:"absolute", inset:0, pointerEvents:"none",
                          background:`linear-gradient(110deg, transparent 30%, ${v.color}55 48%, ${v.color}aa 50%, ${v.color}55 52%, transparent 70%)`,
                          backgroundSize:"200% 100%",
                          animation:"variantShimmer 2.4s linear infinite",
                          mixBlendMode:"screen",
                        }} />
                      )}
                      {/* Angolo strappato */}
                      {known && id === "STRAPPATO" && (
                        <div style={{position:"absolute", top:0, right:0, width:0, height:0,
                          borderTop:"22px solid #1a1208", borderLeft:"22px solid transparent", zIndex:2}} />
                      )}
                      {/* Emoji centrale */}
                      <div style={{
                        fontSize:"36px", position:"relative", zIndex:2,
                        color: known ? v.color : "#2a2a3a",
                        textShadow: known ? `0 0 14px ${v.color}` : "none",
                      }}>
                        {known ? "🃏" : "❓"}
                      </div>
                      {/* Sparkle */}
                      {known && (id === "ORO" || id === "FOIL") && (
                        <div style={{
                          position:"absolute", top:8, right:10, fontSize:"14px",
                          color: v.color, zIndex:3,
                          animation:"variantSparkle 1.6s ease-in-out infinite",
                          textShadow:`0 0 8px ${v.color}`,
                        }}>✦</div>
                      )}
                    </div>
                    {/* Badge label — grosso sotto la preview */}
                    <div style={{
                      background: known ? v.color : "#1a1a28",
                      color: known ? "#000" : "#3a3a52",
                      padding:"4px 6px", fontSize:"11px", fontWeight:"bold",
                      letterSpacing:"2px", textAlign:"center",
                      textShadow: known && id === "ORO" ? "0 0 4px #fff8" : "none",
                    }}>
                      ★ {known ? v.label : "???"} ★
                    </div>
                    {/* Body: desc + stats */}
                    <div style={{padding:"8px 8px 10px", flex:1, display:"flex", flexDirection:"column", gap:"6px"}}>
                      <div style={{
                        color: known ? v.color : "#2a2a4a",
                        fontSize:"10px", lineHeight:"1.35", minHeight:"28px",
                      }}>
                        {known ? v.desc : "Scopri questa variante gratt­ando una carta in combat."}
                      </div>
                      <div style={{
                        display:"flex", justifyContent:"space-between",
                        fontSize:"9px", color:C.dim,
                        borderTop:`1px solid ${known ? v.color+"33" : "#1a1a28"}`,
                        paddingTop:"5px", letterSpacing:"0.5px",
                      }}>
                        <span>VAL <span style={{color: known ? (v.valueMult >= 1 ? C.green : C.red) : C.dim, fontWeight:"bold"}}>
                          ×{known ? v.valueMult.toFixed(2) : "?"}
                        </span></span>
                        <span>DROP <span style={{color: known ? v.color : C.dim, fontWeight:"bold"}}>
                          {known ? rarityPct+"%" : "?"}
                        </span></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{color:"#ffaa88", fontSize:"10px", textAlign:"center", marginBottom:"10px", letterSpacing:"1px"}}>
              ✦ Collezionale tutte e 5 per "Collezionista Vintage" ✦
            </div>
            <div style={{textAlign:"center"}}>
              <Btn onClick={() => setShowVintage(false)} style={{borderColor:"#ffaa88", color:"#ffaa88", fontSize:"11px"}}>
                Chiudi
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACHIEVEMENT TOAST ═══ */}
      {achievementToast && (
        <div style={{
          position:"fixed", bottom:"80px", right:"16px", zIndex:99999,
          background:"#0d0d1a", border:`2px solid ${C.gold}`,
          borderRadius:"0", padding:"10px 14px", maxWidth:"220px",
          animation:"achievementSlide 0.4s ease-out",
          boxShadow:`0 0 24px ${C.gold}88, 0 6px 16px #000c, inset 0 0 18px ${C.gold}18`,
          fontFamily: FONT,
        }}>
          <div style={{color:C.gold, fontSize:"11px", fontWeight:"bold", marginBottom:"2px"}}>🏆 ACHIEVEMENT SBLOCCATO!</div>
          <div style={{fontSize:"20px"}}>{achievementToast.emoji}</div>
          <div style={{color:C.text, fontSize:"12px", fontWeight:"bold"}}>{achievementToast.name}</div>
          <div style={{color:C.dim, fontSize:"10px"}}>{achievementToast.desc}</div>
        </div>
      )}

      {/* ═══ TROPHIES OVERLAY ═══ */}
      {showTrophies && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.92)", zIndex:99990,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily: FONT, padding:"16px",
        }} onClick={() => setShowTrophies(false)}>
          <div style={{
            background:"#08080f", border:`2px solid ${C.gold}`,
            maxWidth:"640px", width:"96vw", maxHeight:"92vh", overflowY:"auto",
            padding:"18px 20px 16px",
            boxShadow:`0 0 40px ${C.gold}44, inset 0 0 40px ${C.gold}11`,
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{color:C.gold, fontSize:"18px", fontWeight:"bold", letterSpacing:"4px", textAlign:"center", marginBottom:"2px", textShadow:`0 0 12px ${C.gold}88`}}>
              🏆 TROFEI
            </div>
            <div style={{color:C.dim, fontSize:"10px", textAlign:"center", letterSpacing:"1px", marginBottom:"4px"}}>
              Achievements sbloccati durante le tue run
            </div>
            {/* Progress bar */}
            <div style={{margin:"8px auto 18px", maxWidth:"360px"}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:"9px", color:C.gold, marginBottom:"3px", letterSpacing:"1px"}}>
                <span>COLLEZIONE</span>
                <span>{Object.keys(achievements).length} / {ACHIEVEMENTS.length}</span>
              </div>
              <div style={{height:"6px", background:"#1a1a22", border:"1px solid #2a2a3a", position:"relative"}}>
                <div style={{
                  height:"100%", width:`${(Object.keys(achievements).length/ACHIEVEMENTS.length)*100}%`,
                  background:`linear-gradient(90deg, ${C.gold}, ${C.green})`,
                  boxShadow:`0 0 8px ${C.gold}aa`,
                  transition:"width 0.4s",
                }} />
              </div>
            </div>
            {/* Grid cards — stile Vintage */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))",
              gap:"12px", marginBottom:"16px",
            }}>
              {ACHIEVEMENTS.map(ach => {
                const unlocked = achievements[ach.id];
                const isSecret = ach.secret;
                const hidden = isSecret && !unlocked;
                const accent = unlocked ? C.gold : isSecret ? "#6a5a2a" : "#3a3a52";
                return (
                  <div key={ach.id} style={{
                    background: unlocked ? "#0d0d14" : "#0a0a10",
                    border: `2px solid ${unlocked ? C.gold : "#252538"}`,
                    padding:"0", position:"relative",
                    overflow:"hidden",
                    boxShadow: unlocked ? `0 0 12px ${C.gold}44` : "none",
                    opacity: unlocked ? 1 : 0.72,
                    display:"flex", flexDirection:"column",
                  }}>
                    {/* Preview tile */}
                    <div style={{
                      height:"92px", position:"relative",
                      background: unlocked ? "#1f1a08" : "#060608",
                      borderBottom: `1px solid ${unlocked ? C.gold+"66" : "#1a1a28"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      filter: unlocked ? "none" : "grayscale(100%) brightness(0.5)",
                      overflow:"hidden",
                    }}>
                      {/* Shimmer foil per sbloccati */}
                      {unlocked && (
                        <div style={{
                          position:"absolute", inset:0, pointerEvents:"none",
                          background:`linear-gradient(110deg, transparent 30%, ${C.gold}55 48%, ${C.gold}aa 50%, ${C.gold}55 52%, transparent 70%)`,
                          backgroundSize:"200% 100%",
                          animation:"variantShimmer 2.8s linear infinite",
                          mixBlendMode:"screen",
                        }} />
                      )}
                      {/* Emoji centrale */}
                      <div style={{
                        fontSize:"40px", position:"relative", zIndex:2,
                        textShadow: unlocked ? `0 0 14px ${C.gold}cc` : "none",
                        filter: hidden ? "blur(1px)" : "none",
                      }}>
                        {hidden ? "🔒" : ach.emoji}
                      </div>
                      {/* Sparkle angolo per sbloccati */}
                      {unlocked && (
                        <div style={{
                          position:"absolute", top:8, right:10, fontSize:"14px",
                          color: C.gold, zIndex:3,
                          animation:"variantSparkle 1.6s ease-in-out infinite",
                          textShadow:`0 0 8px ${C.gold}`,
                        }}>✦</div>
                      )}
                      {/* Badge SECRET in alto a sx */}
                      {isSecret && (
                        <div style={{
                          position:"absolute", top:6, left:6, zIndex:3,
                          fontSize:"7px", letterSpacing:"1px", fontWeight:"bold",
                          color: unlocked ? C.magenta : "#4a3a5a",
                          background: unlocked ? "#1a0a1f" : "#0a0810",
                          border:`1px solid ${unlocked ? C.magenta+"88" : "#2a1a3a"}`,
                          padding:"1px 4px",
                        }}>SECRET</div>
                      )}
                    </div>
                    {/* Badge label */}
                    <div style={{
                      background: unlocked ? C.gold : "#1a1a28",
                      color: unlocked ? "#000" : "#3a3a52",
                      padding:"4px 6px", fontSize:"11px", fontWeight:"bold",
                      letterSpacing:"2px", textAlign:"center",
                      textShadow: unlocked ? "0 0 4px #fff8" : "none",
                    }}>
                      ★ {hidden ? "???" : ach.name.toUpperCase()} ★
                    </div>
                    {/* Body: desc + unlock date */}
                    <div style={{padding:"8px 8px 10px", flex:1, display:"flex", flexDirection:"column", gap:"6px"}}>
                      <div style={{
                        color: unlocked ? C.text : "#3a3a52",
                        fontSize:"10px", lineHeight:"1.35", minHeight:"28px",
                      }}>
                        {hidden ? "Un mistero da scoprire giocando..." : ach.desc}
                      </div>
                      <div style={{
                        display:"flex", justifyContent:"space-between",
                        fontSize:"9px", color:C.dim,
                        borderTop:`1px solid ${unlocked ? C.gold+"33" : "#1a1a28"}`,
                        paddingTop:"5px", letterSpacing:"0.5px",
                      }}>
                        <span>{isSecret ? "TIPO" : "TIPO"} <span style={{color: isSecret ? C.magenta : C.cyan, fontWeight:"bold"}}>
                          {isSecret ? "SECRET" : "NORMAL"}
                        </span></span>
                        <span style={{color: unlocked ? C.gold : C.dim, fontWeight:"bold"}}>
                          {unlocked ? `✓ ${new Date(unlocked.unlockedAt).toLocaleDateString("it-IT")}` : "— LOCKED"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{color:C.gold, fontSize:"10px", textAlign:"center", marginBottom:"10px", letterSpacing:"1px"}}>
              ✦ Completa tutti i trofei per diventare leggenda ✦
            </div>
            <div style={{textAlign:"center", display:"flex", gap:"10px", justifyContent:"center"}}>
              <Btn onClick={() => setShowTrophies(false)} style={{borderColor:C.gold, color:C.gold, fontSize:"11px"}}>Chiudi</Btn>
              <Btn onClick={() => {
                setStored(STORAGE_KEYS.achievements, {});
                setAchievements({});
              }} style={{fontSize:"11px", borderColor:C.red+"88", color:C.red, opacity:0.7}}>🗑 Azzera</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ALL-TIME STATS OVERLAY ═══ */}
      {showAllTimeStats && (() => {
        const alltime = getStored(STORAGE_KEYS.alltime, {});
        const totalRuns = alltime.totalRuns || 0;
        const totalWins = alltime.totalWins || 0;
        const winRate = totalRuns ? Math.round((totalWins / totalRuns) * 100) : 0;
        const money = alltime.totalMoneyEarned || 0;
        const cards = alltime.totalCardsScratched || 0;
        return (
          <div style={{
            position:"fixed", inset:0,
            background:"rgba(0,0,0,0.94)", zIndex:99990,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily: FONT, padding:"16px",
          }} onClick={() => setShowAllTimeStats(false)}>
            <div style={{
              background:"#08080f", border:`2px solid ${C.cyan}`,
              maxWidth:"560px", width:"96vw", maxHeight:"92vh", overflowY:"auto",
              padding:"18px 20px 16px",
              boxShadow:`0 0 40px ${C.cyan}44, inset 0 0 40px ${C.cyan}11`,
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{color:C.cyan, fontSize:"18px", fontWeight:"bold", letterSpacing:"4px", textAlign:"center", marginBottom:"2px", textShadow:`0 0 12px ${C.cyan}88`}}>
                📊 STATISTICHE ALL-TIME
              </div>
              <div style={{color:C.dim, fontSize:"10px", textAlign:"center", letterSpacing:"1px", marginBottom:"14px"}}>
                Tutto ciò che hai fatto dall'inizio dei tempi
              </div>

              {/* HERO: Win rate grande con barra */}
              <div style={{
                position:"relative", overflow:"hidden",
                background:"#0d0d14", border:`2px solid ${C.cyan}`,
                padding:"14px 16px", marginBottom:"14px",
                boxShadow:`0 0 16px ${C.cyan}33`,
              }}>
                {/* shimmer foil */}
                <div style={{
                  position:"absolute", inset:0, pointerEvents:"none",
                  background:`linear-gradient(110deg, transparent 30%, ${C.cyan}33 48%, ${C.cyan}77 50%, ${C.cyan}33 52%, transparent 70%)`,
                  backgroundSize:"220% 100%",
                  animation:"variantShimmer 3.6s linear infinite",
                  mixBlendMode:"screen",
                }} />
                <div style={{position:"relative", zIndex:2, display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px"}}>
                  <div>
                    <div style={{color:C.cyan, fontSize:"9px", letterSpacing:"2px", opacity:0.8}}>WIN RATE</div>
                    <div style={{color:C.gold, fontSize:"36px", fontWeight:"bold", letterSpacing:"2px", textShadow:`0 0 14px ${C.gold}aa`, lineHeight:1}}>
                      {winRate}%
                    </div>
                    <div style={{color:C.dim, fontSize:"9px", marginTop:"4px", letterSpacing:"1px"}}>
                      {totalWins} vittorie · {totalRuns} run
                    </div>
                  </div>
                  <div style={{fontSize:"56px", filter:`drop-shadow(0 0 12px ${C.gold}88)`, opacity: totalRuns ? 1 : 0.3}}>
                    {winRate >= 50 ? "🏆" : totalRuns ? "🎯" : "🕹️"}
                  </div>
                </div>
                {/* progress bar */}
                <div style={{marginTop:"10px", position:"relative", zIndex:2}}>
                  <div style={{height:"6px", background:"#1a1a22", border:"1px solid #2a2a3a", position:"relative"}}>
                    <div style={{
                      height:"100%", width:`${winRate}%`,
                      background:`linear-gradient(90deg, ${C.cyan}, ${C.gold})`,
                      boxShadow:`0 0 8px ${C.gold}aa`,
                      transition:"width 0.6s",
                    }} />
                  </div>
                </div>
              </div>

              {/* 4 stat cards in griglia */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:"10px", marginBottom:"14px"}}>
                {[
                  {label:"RUN TOTALI", icon:"🎮", val: totalRuns, color: C.cyan},
                  {label:"VITTORIE", icon:"🏆", val: totalWins, color: C.gold},
                  {label:"GUADAGNI", icon:"💰", val: `€${money}`, color: C.green},
                  {label:"CARTE GRATTATE", icon:"🖐️", val: cards, color: C.magenta},
                ].map(s => (
                  <div key={s.label} style={{
                    background:"#0d0d14", border:`1px solid ${s.color}55`,
                    padding:"10px 12px",
                    display:"flex", flexDirection:"column", gap:"2px",
                    position:"relative", overflow:"hidden",
                  }}>
                    <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
                      <span style={{fontSize:"16px", filter:`drop-shadow(0 0 4px ${s.color}88)`}}>{s.icon}</span>
                      <span style={{color:s.color, fontSize:"8px", letterSpacing:"1.5px", fontWeight:"bold", opacity:0.8}}>{s.label}</span>
                    </div>
                    <div style={{color:s.color, fontSize:"20px", fontWeight:"bold", letterSpacing:"1px", textShadow:`0 0 8px ${s.color}66`, lineHeight:1.1, marginTop:"2px"}}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* footer insight */}
              <div style={{
                color:C.cyan, fontSize:"10px", textAlign:"center",
                letterSpacing:"1px", marginBottom:"12px", opacity:0.9,
                borderTop:`1px solid ${C.cyan}33`, paddingTop:"10px",
              }}>
                {totalRuns === 0 ? "✦ Nessuna run completata ancora — inizia a grattare! ✦"
                  : totalRuns >= 100 ? `✦ Leggenda del grattino — ${totalRuns} run al tuo attivo ✦`
                  : totalRuns >= 10 ? `✦ Grattatore esperto — ${totalRuns} run completate ✦`
                  : `✦ Continua così — ${totalRuns} run e non fermarti ✦`}
              </div>

              <div style={{textAlign:"center"}}>
                <Btn onClick={() => setShowAllTimeStats(false)} style={{borderColor:C.cyan, color:C.cyan, fontSize:"11px"}}>Chiudi</Btn>
              </div>
            </div>
          </div>
        );
      })()}

      </div>{/* fine DESK */}

      </div>{/* fine 3-column */}

      {/* ── LOG STRIP (bottom) — ticker CSS dell'ultima voce ── */}
      {player && !["title","tutorialNails"].includes(screen) && log.length > 0 && (() => {
        const latest = log[log.length - 1];
        const duration = Math.max(7, latest.text.length * 0.085);
        return (
          <div style={{
            width:"100%", flexShrink:0,
            borderTop:"1px solid #12121e",
            background:"#04040c",
            height:"30px",
            display:"flex", alignItems:"stretch",
            overflow:"hidden",
          }}>
            {/* Badge LOG */}
            <div style={{
              flexShrink:0,
              padding:"0 8px",
              display:"flex", alignItems:"center",
              color:C.dim, fontSize:"8px", letterSpacing:"1px", opacity:0.5,
              borderRight:"1px solid #12121e",
            }}>LOG</div>
            {/* Testo scorrevole */}
            <div style={{
              flex:1, position:"relative", overflow:"hidden",
              maskImage:"linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
              WebkitMaskImage:"linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
            }}>
              <div key={log.length} style={{
                position:"absolute", left:"100%", top:0,
                whiteSpace:"nowrap", lineHeight:"30px",
                animation:`newsTicker ${duration}s linear forwards`,
                willChange:"transform",
                color: latest.color || C.dim,
                fontSize:"10px",
                letterSpacing:"0.2px",
              }}>
                {latest.text}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
    </div>
  );
}

// HMR cleanup — evita che la musica si sovrapponga quando Vite ricarica il modulo
if (import.meta.hot) {
  import.meta.hot.dispose(() => { AudioEngine.stopMusic(); });
}
