import { C, MAX_ITEMS } from "../data/theme.js";
import { CARD_TYPES } from "../data/cards.js";
import { ITEM_DEFS, GRATTATORE_DEFS, makeGrattatore } from "../data/items.js";
import { generateCard } from "../utils/card.js";
import { roundMoney, fmtMoney } from "../utils/money.js";
import { shopDiscount, monopolioMult, cardPrice, itemPrice } from "../utils/shop.js";
import { hasRelic } from "../utils/hasRelic.js";

export function useShopHandlers({ player, gameStats, updatePlayer, addLog, setGameStats, setCardSelectMode, setScreen, setReturnScreen, effectiveFortune, unlockAchievement, setItemFoundModal, currentBiome = 0 }) {
  // Etichette dello sconto per log e riepilogo ("" se non c'è sconto)
  const discountLabels = () => {
    const pct = Math.round(shopDiscount(player, currentBiome) * 100);
    return pct > 0 ? { tag: ` [-${pct}%]`, note: ` (sconto -${pct}%)` } : { tag: "", note: "" };
  };

  const pay = (cost) => {
    updatePlayer(p => ({...p, money: roundMoney(p.money - cost)}));
    setGameStats(s => ({...s, moneySpent: roundMoney((s.moneySpent || 0) + cost)}));
  };

  const handleBuyCard = (cardId) => {
    const type = CARD_TYPES.find(t => t.id === cardId);
    if (!type) return;
    const finalCost = cardPrice(player, currentBiome, type);
    if (player.money < finalCost) return;
    const riggedBonus = (cardId === "doppioOnulla" && hasRelic(player, "riggedDice")) ? 0.15 : 0;
    const card = {...generateCard(cardId, effectiveFortune, riggedBonus), owned: true};
    pay(finalCost);
    updatePlayer(p => ({...p, scratchCards: [...p.scratchCards, card]}));
    const { tag, note } = discountLabels();
    const mult = monopolioMult(player, type);
    const monopolioSuffix = mult > 1 ? ` [×${mult} MONOPOLIO]` : "";
    addLog(`Comprato: ${type.name} (€${fmtMoney(finalCost)}${tag}${monopolioSuffix})`, C.green);
    if (setItemFoundModal) setItemFoundModal({
      emoji: type.emoji || "🎟️", name: type.name,
      desc: `${type.desc}\nPagato €${fmtMoney(finalCost)}${note} · Max vincita: €${type.maxPrize}`,
      subtitle: "Acquistato dal Tabaccaio",
    });
  };

  const handleBuyItem = (itemId) => {
    // Prestito del Broker — speciale
    if (itemId === "__brokerLoan__") {
      updatePlayer(p => ({...p, money: p.money + 50, brokerLoan: 80}));
      addLog("🤝 Il Broker ti allunga €50. \"Ci vediamo dal boss, amico.\"", C.gold);
      return;
    }
    const item = ITEM_DEFS[itemId];
    if (!item) return;
    const finalCost = itemPrice(player, currentBiome, item.cost);
    if (player.money < finalCost) return;
    if (player.items.length >= MAX_ITEMS) { addLog("Zaino pieno! Usa o butta un oggetto.", C.red); return; }
    pay(finalCost);
    updatePlayer(p => ({...p, items: [...p.items, itemId]}));
    const { tag, note } = discountLabels();
    addLog(`Comprato: ${item.emoji} ${item.name} (€${finalCost}${tag})`, C.green);
    if (setItemFoundModal) setItemFoundModal({
      emoji: item.emoji, name: item.name,
      desc: `${item.desc}\nPagato €${finalCost}${note}.`,
      subtitle: "Acquistato dal Tabaccaio",
      rarity: item.rarity,
    });
  };

  const handleBuyGrattatore = (gratId) => {
    const def = GRATTATORE_DEFS[gratId];
    if (!def) return;
    const finalCost = itemPrice(player, currentBiome, def.cost);
    if (player.money < finalCost) return;
    pay(finalCost);
    updatePlayer(p => ({...p, grattatori: [...p.grattatori, makeGrattatore(gratId)]}));
    const { tag, note } = discountLabels();
    addLog(`Comprato grattatore: ${def.emoji} ${def.name} (€${finalCost}${tag})`, C.cyan);
    if (setItemFoundModal) setItemFoundModal({
      emoji: def.emoji, name: def.name,
      desc: `${def.desc}\nPagato €${finalCost}${note}.`,
      subtitle: "Grattatore acquistato",
      rarity: def.rarity,
    });
  };

  const handleSlotResult = ({ type, amount, prizeType }) => {
    if (type === "pay") {
      updatePlayer(p => ({...p, money: roundMoney(p.money - amount)}));
      addLog(`🎰 Inserisci €${amount} nella slot machine...`, C.dim);
      if ((gameStats.slotPlays || 0) + 1 >= 5) unlockAchievement("gambler");
      setGameStats(s => ({...s, slotPlays: (s.slotPlays || 0) + 1}));
    } else if (type === "win") {
      updatePlayer(p => ({...p, money: roundMoney(p.money + amount)}));
      if (prizeType === "superjackpot") {
        addLog(`🎆 SUPER JACKPOT! +€${amount}! Il tabaccaio impallidisce.`, C.gold);
        unlockAchievement("triple7");
      } else if (prizeType === "jackpot") addLog(`🎉 JACKPOT! +€${amount}! Le monete cascano!`, C.gold);
      else addLog(`✨ Piccola vincita: +€${amount}.`, C.green);
    }
  };

  const handleShopScratch = () => {
    if (player.scratchCards.length === 0) return;
    setCardSelectMode(true);
    if (setReturnScreen) setReturnScreen("shop");
    setScreen("selectCard");
  };

  return { handleBuyCard, handleBuyItem, handleBuyGrattatore, handleSlotResult, handleShopScratch };
}
