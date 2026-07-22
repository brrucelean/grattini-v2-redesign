import { useState, useCallback } from "react";
import { C } from "../data/theme.js";
import { NPC_CARMELO_COMMENTS } from "../data/art.js";

export function useLog() {
  const [log, setLog] = useState([]);
  const [carmeloLog, setCarmeloLog] = useState([]);

  const addLog = useCallback((text, color) => {
    setLog(l => [...l.slice(-20), { text, color: color || C.dim }]);
  }, []);

  const triggerNpcComment = useCallback((category) => {
    const pool = NPC_CARMELO_COMMENTS[category];
    if (!pool) return;
    const text = pool[Math.floor(Math.random() * pool.length)];
    setCarmeloLog(l => [...l, text]);
  }, []);

  return { log, setLog, carmeloLog, setCarmeloLog, addLog, triggerNpcComment };
}
