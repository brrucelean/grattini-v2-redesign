import { useState, useCallback, useRef } from "react";
import { C } from "../data/theme.js";
import { NPC_CARMELO_COMMENTS } from "../data/art.js";

export function useLog() {
  const [log, setLog] = useState([]);
  const [carmeloLog, setCarmeloLog] = useState([]);

  // id progressivo: il ticker in basso si rimonta a ogni voce nuova. Prima usava
  // log.length come chiave, che si ferma a 21 quando il log è pieno: da lì in
  // poi i messaggi nuovi non scorrevano più.
  const nextId = useRef(0);
  const addLog = useCallback((text, color) => {
    const id = ++nextId.current;
    setLog(l => [...l.slice(-20), { id, text, color: color || C.dim }]);
  }, []);

  const triggerNpcComment = useCallback((category) => {
    const pool = NPC_CARMELO_COMMENTS[category];
    if (!pool) return;
    const text = pool[Math.floor(Math.random() * pool.length)];
    setCarmeloLog(l => [...l, text]);
  }, []);

  return { log, setLog, carmeloLog, setCarmeloLog, addLog, triggerNpcComment };
}
