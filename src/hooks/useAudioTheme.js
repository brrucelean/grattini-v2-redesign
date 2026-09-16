import { useEffect } from "react";
import { AudioEngine } from "../audio.js";

export function useAudioTheme({ screen, currentNode, combatEnemy, currentBiome }) {
  const nodeType = currentNode?.type;
  const bossName = combatEnemy?.isBoss ? combatEnemy.name : null;
  useEffect(() => {
    const screenTheme = {
      title:        null,
      tutorialNails: "explore",
      introScratch: "explore",
      map:          "explore",
      preScratch:   "explore",
      selectCard:   "explore",
      scratch:      "scratch",   // concentrazione durante la grattata
      shop:         "shop",      // tabaccheria calda
      locanda:      "locanda",   // riposo, caldo
      combat:       "combat",    // tensione ritmata
      gameOver:     null,        // silenzio — il gioco è finito
      victory:      "boss",      // riusa il boss theme per l'epica della vittoria
    };
    let theme = screenTheme[screen];
    if (screen === "event" && nodeType) {
      if (nodeType === "boss") theme = "boss";
      else if (nodeType === "miniboss" || nodeType === "ladro") theme = "combat";
      else if (nodeType === "locanda" || nodeType === "stregone") theme = "locanda";
      else theme = "explore";
    }
    if (screen === "combat" && bossName) {
      theme = bossName === "Il Drago d'Oro" ? "bossDrago" : "boss";
    }
    // Bioma 3: override temi non-combat a chinaTown
    if (currentBiome === 3 && ["explore","shop","locanda","scratch"].includes(theme)) {
      theme = "chinaTown";
    }
    if (theme) AudioEngine.playMusic(theme);
    else AudioEngine.stopMusic();
  }, [screen, nodeType, bossName, currentBiome]);
}
