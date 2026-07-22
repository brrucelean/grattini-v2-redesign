import { useEffect } from "react";
import { AudioEngine } from "../audio.js";

export function useAudioTheme({ screen, currentNode, combatEnemy, currentBiome }) {
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
      gameover:     null,        // silenzio — il gioco è finito
      victory:      "boss",      // riusa il boss theme per l'epica della vittoria
    };
    let theme = screenTheme[screen];
    if (screen === "event" && currentNode) {
      const t = currentNode.type;
      if (t === "boss") theme = "boss";
      else if (t === "miniboss" || t === "ladro") theme = "combat";
      else if (t === "locanda" || t === "stregone") theme = "locanda";
      else theme = "explore";
    }
    if (screen === "combat" && combatEnemy?.isBoss) {
      theme = combatEnemy?.name === "Il Drago d'Oro" ? "bossDrago" : "boss";
    }
    // Bioma 3: override temi non-combat a chinaTown
    if (currentBiome === 3 && ["explore","shop","locanda","scratch"].includes(theme)) {
      theme = "chinaTown";
    }
    if (theme) AudioEngine.playMusic(theme);
    else AudioEngine.stopMusic();
  }, [screen, currentNode?.type, combatEnemy?.isBoss]);
}
