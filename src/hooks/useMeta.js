import { useState, useCallback } from "react";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { AudioEngine } from "../audio.js";
import { STORAGE_KEYS, getStored, setStored } from "../utils/storage.js";

export function useMeta() {
  const [achievements, setAchievements] = useState(() => getStored(STORAGE_KEYS.achievements, {}));
  const [activeCedola, setActiveCedola] = useState(() => getStored(STORAGE_KEYS.cedola, null));
  const [pendingCedoleOffer, setPendingCedoleOffer] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const [showTrophies, setShowTrophies] = useState(false);
  const [showReliquie, setShowReliquie] = useState(false);
  const [discoveredRelics, setDiscoveredRelics] = useState(() => getStored(STORAGE_KEYS.relicsDiscovered, []));
  const [enabledRelics, setEnabledRelics] = useState(() => getStored(STORAGE_KEYS.relicsEnabled, []));
  // Sprint 5: Vintage Collezionabili — varianti carte combat scoperte (meta, persiste tra run)
  const [vintageCollected, setVintageCollected] = useState(() => getStored(STORAGE_KEYS.vintage, []));
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);

  const collectVintage = useCallback((variantId) => {
    setVintageCollected(prev => {
      if (prev.includes(variantId)) return prev;
      const next = [...prev, variantId];
      setStored(STORAGE_KEYS.vintage, next);
      return next;
    });
  }, []);

  const unlockAchievement = useCallback((id) => {
    setAchievements(prev => {
      if (prev[id]) return prev; // already unlocked
      const updated = { ...prev, [id]: { unlockedAt: Date.now() } };
      setStored(STORAGE_KEYS.achievements, updated);
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        AudioEngine.achievementJingle();
        setAchievementToast(ach);
        setTimeout(() => setAchievementToast(null), 3000);
      }
      return updated;
    });
  }, []);

  const updateAllTimeStats = useCallback((runStats) => {
    const existing = getStored(STORAGE_KEYS.alltime, {});
    const updated = {
      totalRuns: (existing.totalRuns || 0) + 1,
      totalWins: (existing.totalWins || 0) + (runStats._isWin ? 1 : 0),
      totalMoneyEarned: (existing.totalMoneyEarned || 0) + (runStats.moneyEarned || 0),
      totalCardsScratched: (existing.totalCardsScratched || 0) + (runStats.cardsScratched || 0),
    };
    setStored(STORAGE_KEYS.alltime, updated);
  }, []);

  return {
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
  };
}
