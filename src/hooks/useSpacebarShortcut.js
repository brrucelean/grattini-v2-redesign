import { useRef, useEffect } from "react";

export function useSpacebarShortcut({ screen, startGame, handlePreScratch, enterNode, preScratchCount, player, setScreen }) {
  const globalSpaceRef = useRef(null);
  globalSpaceRef.current = () => {
    if (screen === "scratch" || screen === "combat" || screen === "doppioONulla") return;
    if (screen === "title") { startGame(); return; }
    if (screen === "preScratch") {
      if (preScratchCount < 3 && player?.scratchCards.length > 0) handlePreScratch();
      else enterNode();
      return;
    }
    if (screen === "gameOver" || screen === "victory") { setScreen("title"); return; }
  };
  useEffect(() => {
    const onKey = (e) => { if (e.code !== "Space") return; e.preventDefault(); globalSpaceRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
