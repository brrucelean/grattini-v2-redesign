import { C } from "../data/theme.js";
import { ITEM_DEFS } from "../data/items.js";
import { Tooltip } from "./Tooltip.jsx";
import { CornerBrackets, FoilShimmer, VintageBadge } from "./Vintage.jsx";

// Pip visuali per gli usi (max 5, poi numero)
function UsesPips({ count, color }) {
  if (count > 5) return <span style={{color, fontSize:"8px", fontWeight:"bold"}}>×{count}</span>;
  return (
    <span style={{display:"inline-flex", gap:"1px"}}>
      {Array(count).fill(0).map((_,i) => (
        <span key={i} style={{
          display:"inline-block", width:"4px", height:"4px",
          background: color, boxShadow:`0 0 3px ${color}cc`,
        }}/>
      ))}
    </span>
  );
}

function SectionHeader({ color, label, count, max }) {
  return (
    <div style={{textAlign:"center", marginBottom:"5px"}}>
      <VintageBadge color={color} size="sm" shimmer>{label}</VintageBadge>
      {typeof count === "number" && (
        <div style={{color: color+"aa", fontSize:"7px", marginTop:"2px", letterSpacing:"1px"}}>
          {count}{typeof max === "number" ? `/${max}` : ""}
        </div>
      )}
    </div>
  );
}

export function InventorySidebar({ items, grattatori, equippedGrattatore, onUseItem, onEquipGrattatore }) {
  const hasAnything = items.length > 0 || grattatori.length > 0;

  return (
    <div style={{height:"100%", overflowY:"auto", padding:"6px 4px", display:"flex", flexDirection:"column", gap:"3px"}}>
      {/* Heading principale ZAINO con foil */}
      <div style={{position:"relative", marginBottom:"6px", paddingBottom:"6px", borderBottom:`1px solid ${C.magenta}33`, textAlign:"center"}}>
        <VintageBadge color={C.magenta} size="md" shimmer>🎒 ZAINO</VintageBadge>
      </div>

      {/* Stato vuoto */}
      {!hasAnything && (
        <div style={{
          color:C.dim, fontSize:"9px", textAlign:"center",
          marginTop:"18px", lineHeight:"1.6",
          position:"relative",
          border:`1px dashed ${C.dim}55`,
          padding:"14px 8px",
          fontStyle:"italic",
          background:"#08080d",
        }}>
          <CornerBrackets color={C.dim+"99"}/>
          <div style={{fontSize:"22px", marginBottom:"6px", opacity:0.4, filter:"grayscale(1)"}}>🎒</div>
          <div style={{opacity:0.6}}>❝ zaino<br/>vuoto ❞</div>
          <div style={{fontSize:"7px", marginTop:"6px", letterSpacing:"1px", opacity:0.4}}>
            ★ niente da usare ★
          </div>
        </div>
      )}

      {/* GRATTATORI */}
      {grattatori.length > 0 && (
        <>
          <SectionHeader color={C.cyan} label="🔧 GRATTATORI" count={grattatori.length} />
          {grattatori.map((g, idx) => {
            const isEquipped = equippedGrattatore?.inventoryIdx === idx;
            const lowUses = g.usesLeft <= 1;
            return (
              <Tooltip key={idx} text={isEquipped
                ? `${g.name} — equipaggiato (${g.usesLeft} usi)`
                : `${g.name} — clicca per equipaggiare (${g.usesLeft} usi)`}>
                <div
                  onClick={() => onEquipGrattatore(idx)}
                  style={{
                    position:"relative",
                    border:`1px solid ${isEquipped ? C.cyan : C.cyan+"44"}`,
                    background: isEquipped
                      ? `linear-gradient(135deg, ${C.cyan}22, ${C.cyan}08)`
                      : "#080810",
                    boxShadow: isEquipped
                      ? `0 0 10px ${C.cyan}66, inset 0 0 8px ${C.cyan}14`
                      : "none",
                    padding:"5px 7px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:"5px",
                    transition:"transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                    animation: isEquipped ? "slotGlow 2.4s ease-in-out infinite" : "none",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 0 12px ${C.cyan}88, inset 0 0 8px ${C.cyan}22`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = isEquipped
                      ? `0 0 10px ${C.cyan}66, inset 0 0 8px ${C.cyan}14`
                      : "none";
                  }}>
                  <CornerBrackets color={isEquipped ? C.cyan : C.cyan+"88"}/>
                  <span style={{
                    fontSize:"14px", lineHeight:1, flexShrink:0,
                    filter: isEquipped ? `drop-shadow(0 0 4px ${C.cyan})` : "none",
                  }}>{g.emoji}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{
                      color: isEquipped ? C.cyan : C.cyan+"aa",
                      fontSize:"8px", fontWeight: isEquipped ? "bold" : "normal",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                      letterSpacing:"0.3px",
                    }}>{g.name}</div>
                    <div style={{
                      color: lowUses ? C.orange : C.dim,
                      fontSize:"7px", display:"flex", alignItems:"center", gap:"3px", marginTop:"1px",
                    }}>
                      <UsesPips count={g.usesLeft} color={lowUses ? C.orange : C.cyan}/>
                      <span style={{opacity:0.7}}>{g.usesLeft > 5 ? "" : "usi"}</span>
                    </div>
                  </div>
                  {isEquipped && (
                    <span style={{
                      color: C.cyan, fontSize:"10px", fontWeight:"bold", flexShrink:0,
                      textShadow:`0 0 4px ${C.cyan}`,
                    }}>✓</span>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </>
      )}

      {/* CONSUMABILI */}
      {items.length > 0 && (
        <>
          <div style={{marginTop: grattatori.length > 0 ? "8px" : 0}}/>
          <SectionHeader color={C.gold} label="💊 CONSUMABILI" count={items.length} max={5} />
          {items.map((itemId, idx) => {
            const item = ITEM_DEFS[itemId];
            if (!item) return null;
            return (
              <Tooltip key={idx} text={`${item.name} — ${item.desc || "clicca per usare"}`}>
                <div
                  onClick={() => onUseItem(idx)}
                  style={{
                    position:"relative",
                    border:`1px solid ${C.gold}55`,
                    background:"#080810",
                    padding:"5px 7px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:"5px",
                    transition:"transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.borderColor = C.gold;
                    e.currentTarget.style.boxShadow = `0 0 10px ${C.gold}66, inset 0 0 8px ${C.gold}14`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = C.gold+"55";
                    e.currentTarget.style.boxShadow = "none";
                  }}>
                  <CornerBrackets color={C.gold+"aa"}/>
                  <span style={{fontSize:"14px", lineHeight:1, flexShrink:0}}>{item.emoji}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{
                      color: C.gold+"cc", fontSize:"8px",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                      letterSpacing:"0.3px",
                    }}>{item.name}</div>
                  </div>
                  <span style={{
                    color: C.gold, fontSize:"9px", flexShrink:0, fontWeight:"bold",
                    textShadow:`0 0 4px ${C.gold}88`,
                  }}>▶</span>
                </div>
              </Tooltip>
            );
          })}
        </>
      )}

      {hasAnything && items.length > 0 && (
        <div style={{
          marginTop:"6px", paddingTop:"4px",
          borderTop:`1px solid ${C.dim}33`,
          textAlign:"center", color:C.dim, fontSize:"7px", letterSpacing:"1px",
        }}>
          slot consumabili: {items.length}/5
        </div>
      )}
    </div>
  );
}
