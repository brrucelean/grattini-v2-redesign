import { useEffect, useRef } from "react";
import { C } from "../data/theme.js";
import { VintageBadge } from "./Vintage.jsx";

// Auto-scroll al fondo quando le dependencies cambiano
function useAutoScroll(deps) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, deps);
  return ref;
}

export function LogSidebar({ log }) {
  const ref = useAutoScroll([log]);
  return (
    <div ref={ref} style={{
      height:"100%", overflowY:"auto", padding:"6px 4px",
      display:"flex", flexDirection:"column", gap:"0",
    }}>
      <div style={{textAlign:"center", marginBottom:"6px", paddingBottom:"4px", borderBottom:`1px solid #1a1a2e`}}>
        <VintageBadge color={C.cyan} size="md">📋 LOG</VintageBadge>
      </div>
      {log.slice(-40).map((l, i) => (
        <div key={i} style={{
          color: l.color || C.dim, fontSize:"10px", lineHeight:"1.35",
          borderBottom:"1px solid #0d0d1a",
          padding:"3px 2px",
        }}>
          {l.text}
        </div>
      ))}
    </div>
  );
}
