import { C, MAX_ITEMS } from "../data/theme.js";
import { CARD_TYPES, CARD_BALANCE } from "../data/cards.js";
import { ITEM_DEFS, GRATTATORE_DEFS } from "../data/items.js";
import { BIOME_MODIFIERS } from "../data/biomes.js";
import { generateCard } from "../utils/card.js";
import { roundMoney } from "../utils/money.js";
import { hasRelic } from "../utils/hasRelic.js";

export function useShopHandlers({ player, updatePlayer, addLog, setGameStats, setCardSelectMode, setScreen, setReturnScreen, effectiveFortune, unlockAchievement, setItemFoundModal, currentBiome = 0 }) {
  // Modificatore bioma: shopDiscount additivo a shopDiscountMeta
  const biomeShopDiscount = BIOME_MODIFIERS[currentBiome]?.shopDiscount || 0;
  const handleBuyCard = (cardId) => {
    const type = CARD_TYPES.find(t => t.id === cardId);
    if (!type) return;
    const discount = (player.shopDiscountMeta || 0) + biomeShopDiscount;
    // Cedola Monopolio: carte tier 3+ costano ×highCardCostMeta
    const cardTier = CARD_BALANCE[cardId]?.tier || 1;
    const highCostMult = ((player.highCardCostMeta || 1) > 1 && cardTier >= 3) ? (player.highCardCostMeta || 1) : 1;
    const finalCost = Math.max(0, Math.round(type.cost * (1 - discount) * highCostMult * 100) / 100);
    if (player.money < finalCost) return;
    const riggedBonus = (cardId === "doppioOnulla" && hasRelic(player, "riggedDice")) ? 0.15 : 0;
    const card = {...generateCard(cardId, effectiveFortune, riggedBonus), owned: true};
    updatePlayer(p => ({...p, money: roundMoney(p.money - finalCost), scratchCards: [...p.scratchCards, card]}));
    setGameStats(s => ({...s, moneySpent: (s.moneySpent || 0) + finalCost}));
    const monopolioSuffix = highCostMult > 1 ? ` [×${highCostMult} MONOPOLIO]` : "";
    addLog(`Comprato: ${type.name} (€${finalCost}${discount > 0 ? ` [-${Math.round(discount*100)}%]` : ""}${monopolioSuffix})`, C.green);
    if (setItemFoundModal) setItemFoundModal({
      emoji: type.emoji || "🎟️", name: type.name,
      desc: `${type.desc}\nPagato €${finalCost}${discount > 0 ? ` (sconto -${Math.round(discount*100)}%)` : ""} · Max vincita: €${type.maxPrize}`,
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
    const discount = (player.shopDiscountMeta || 0) + biomeShopDiscount;
    const finalCost = Math.max(0, Math.round(item.cost * (1 - discount)));
    if (player.money < finalCost) return;
    if (player.items.length >= MAX_ITEMS) { addLog("Zaino pieno! Usa o butta un oggetto.", C.red); return; }
    updatePlayer(p => ({...p, money: roundMoney(p.money - finalCost), items: [...p.items, itemId]}));
    setGameStats(s => ({...s, moneySpent: (s.moneySpent || 0) + finalCost}));
    addLog(`Comprato: ${item.emoji} ${item.name} (€${finalCost}${discount>0?` [-${Math.round(discount*100)}%]`:""})`, C.green);
    if (setItemFoundModal) setItemFoundModal({
      emoji: item.emoji, name: item.name,
      desc: `${item.desc}\nPagato €${finalCost}${discount>0?` (sconto -${Math.round(discount*100)}%)`:""}.`,
      subtitle: "Acquistato dal Tabaccaio",
      rarity: item.rarity,
    });
  };

  const handleBuyGrattatore = (gratId) => {
    const def = GRATTATORE_DEFS[gratId];
    if (!def) return;
    const discount = (player.shopDiscountMeta || 0) + biomeShopDiscount;
    const finalCost = Math.max(0, Math.round(def.cost * (1 - discount)));
    if (player.money < finalCost) return;
    const newGrat = { id: gratId, name: def.name, emoji: def.emoji, effect: def.effect, value: def.value, usesLeft: def.maxUses };
    updatePlayer(p => ({...p, money: roundMoney(p.money - finalCost), grattatori: [...p.grattatori, newGrat]}));
    addLog(`Comprato grattatore: ${def.emoji} ${def.name} (€${finalCost}${discount > 0 ? ` [-${Math.round(discount*100)}%]` : ""})`, C.cyan);
    if (setItemFoundModal) setItemFoundModal({
      emoji: def.emoji, name: def.name,
      desc: `${def.desc}\nPagato €${finalCost}${discount > 0 ? ` (sconto -${Math.round(discount*100)}%)` : ""}.`,
      subtitle: "Grattatore acquistato",
      rarity: def.rarity,
    });
  };

  const handleSlotResult = ({ type, amount, isTriple7 }) => {
    if (type === "pay") {
      updatePlayer(p => ({...p, money: p.money - amount}));
      addLog(`🎰 Inserisci €${amount} nella slot machine...`, C.dim);
      // Track slot play
      setGameStats(s => {
        const newCount = (s.slotPlays || 0) + 1;
        if (newCount >= 5) unlockAchievement("gambler");
        return {...s, slotPlays: newCount};
      });
    } else if (type === "win") {
      updatePlayer(p => ({...p, money: p.money + amount}));
      if (amount >= 100) {
        addLog(`🎆 SUPER JACKPOT! +€${amount}! Il tabaccaio impallidisce.`, C.gold);
        unlockAchievement("triple7");
      } else if (amount >= 50) addLog(`🎉 JACKPOT! +€${amount}! Le monete cascano!`, C.gold);
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
