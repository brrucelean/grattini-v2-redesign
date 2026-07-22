import { useState, useRef, useEffect } from "react";
import { C } from "../data/theme.js";
import { AudioEngine } from "../audio.js";

export function useNailEffects({ player, screen, gameStats, unlockAchievement, updateAllTimeStats, addLog }) {
  const [globalPainFlash, setGlobalPainFlash] = useState(0);
  const [nailDeathFlash, setNailDeathFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [moneyBling, setMoneyBling] = useState(0);
  const prevNailsRef = useRef(null);
  const prevScreenRef = useRef(null);
  const prevTumoreRef = useRef(false);
  const prevMoneyRef = useRef(0);

  // ─── EFFETTI DANNO UNGHIA ────────────────────────────────────
  useEffect(() => {
    if (!player?.nails) return;
    if (prevNailsRef.current) {
      let becameSanguinante = false;
      let becameMorta = false;
      player.nails.forEach((n, i) => {
        const prev = prevNailsRef.current[i];
        if (!prev) return;
        if (n.state === "marcia" && prev.state !== "marcia") becameSanguinante = true;
        if (n.state === "morta" && prev.state !== "morta") becameMorta = true;
      });
      if (becameMorta) {
        AudioEngine.nailCrack();
        AudioEngine.painScream();
        setNailDeathFlash(true);
        setScreenShake(true); setTimeout(() => setScreenShake(false), 400);
      } else if (becameSanguinante) {
        AudioEngine.painScream();
        setScreenShake(true); setTimeout(() => setScreenShake(false), 300);
        // flash rosso breve
        setGlobalPainFlash(0.7);
        setTimeout(() => setGlobalPainFlash(0.35), 120);
        setTimeout(() => setGlobalPainFlash(0), 350);
      }
    }
    prevNailsRef.current = player.nails;
  }, [player?.nails]);

  // ─── GAME OVER: achievements & stats ────────────────────────
  useEffect(() => {
    if (screen === "gameOver" && prevScreenRef.current !== "gameOver") {
      // all_nails_dead achievement
      if (player && player.nails.every(n => n.state === "morta")) {
        unlockAchievement("all_nails_dead");
      }
      updateAllTimeStats({...gameStats, _isWin: false});
    }
    prevScreenRef.current = screen;
  }, [screen]); // eslint-disable-line

  // ─── TUMORE: log quando si manifesta ──────────────────────
  useEffect(() => {
    if (player?.tumore && !prevTumoreRef.current) {
      prevTumoreRef.current = true;
      addLog("💀 TUMORE AI POLMONI! Troppo fumo... -5 Fortuna permanente!", C.red);
      unlockAchievement("tumore");
    }
    if (!player?.tumore) prevTumoreRef.current = false;
  }, [player?.tumore]);

  // ─── MONEY BLING ANIMATION ──────────────────────────────────
  useEffect(() => {
    if (player && player.money > prevMoneyRef.current) {
      setMoneyBling(b => b + 1);
    }
    prevMoneyRef.current = player?.money || 0;
  }, [player?.money]);

  return { globalPainFlash, nailDeathFlash, setNailDeathFlash, screenShake, setScreenShake, moneyBling };
}
