import { C, FONT } from "../data/theme.js";
import { NPC_ART } from "../data/art.js";
import { S } from "../utils/styles.js";
import { Btn } from "./Btn.jsx";

// ─── RoomTile: card per singola stanza della locanda ──────────
function RoomTile({ room, canAfford, onClick }) {
  const disabled = !room.isFloor && !canAfford;
  const accent = room.accent;
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        gap: "12px", alignItems: "center",
        background: "#0a0a14",
        border: `2px solid ${disabled ? "#2a2a3a" : accent}`,
        boxShadow: disabled
          ? "inset 0 0 10px #0008"
          : `0 0 12px ${accent}44, inset 0 0 16px ${accent}14`,
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        userSelect: "none",
        transition: "transform 0.12s, box-shadow 0.15s",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateX(4px)";
        e.currentTarget.style.boxShadow = `0 0 20px ${accent}aa, 0 4px 12px #000a, inset 0 0 20px ${accent}22`;
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.boxShadow = `0 0 12px ${accent}44, inset 0 0 16px ${accent}14`;
      }}
    >
      {/* Preview tile con emoji + brackets */}
      <div style={{
        position: "relative",
        width: "56px", height: "56px",
        background: `linear-gradient(135deg, ${accent}22, ${accent}05)`,
        border: `1px solid ${accent}66`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `inset 0 0 12px ${accent}22`,
      }}>
        {["tl","tr","bl","br"].map(pos => {
          const [v, h] = pos.split("");
          return (
            <div key={pos} style={{
              position: "absolute",
              [v === "t" ? "top" : "bottom"]: "3px",
              [h === "l" ? "left" : "right"]: "3px",
              width: "8px", height: "8px",
              borderTop: v === "t" ? `1px solid ${accent}` : "none",
              borderBottom: v === "b" ? `1px solid ${accent}` : "none",
              borderLeft: h === "l" ? `1px solid ${accent}` : "none",
              borderRight: h === "r" ? `1px solid ${accent}` : "none",
            }}/>
          );
        })}
        <div style={{
          fontSize: "30px",
          textShadow: `0 0 14px ${accent}`,
          filter: disabled ? "grayscale(0.6) brightness(0.7)" : "none",
        }}>{room.emoji}</div>
        {room.kawaii && !disabled && (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            background: `linear-gradient(110deg, transparent 30%, ${accent}55 50%, transparent 70%)`,
            backgroundSize: "200% 100%",
            animation: "variantShimmer 2.4s linear infinite",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}/>
        )}
      </div>

      {/* Body: name + desc + flags */}
      <div style={{minWidth: 0}}>
        <div style={{
          display: "inline-block",
          background: disabled ? "#2a2a3a" : accent,
          color: disabled ? "#666" : "#000",
          padding: "2px 8px", fontSize: "10px", fontWeight: "bold",
          letterSpacing: "2px", marginBottom: "5px",
          boxShadow: disabled ? "none" : `0 0 6px ${accent}88`,
        }}>
          ★ {room.name.toUpperCase()} ★
        </div>
        <div style={{color: C.text, fontSize: "11px", lineHeight: 1.4, marginBottom: "3px"}}>
          {room.desc}
        </div>
        {room.risk && (
          <div style={{color: C.red, fontSize: "9px", letterSpacing: "1px"}}>
            ⚠ RISCHIO: {room.risk === "pavimento" ? "50% ladro nel sonno" : room.risk}
          </div>
        )}
        {room.kawaii && (
          <div style={{color: C.pink, fontSize: "9px", letterSpacing: "1px"}}>
            ✨ MANICURE KAWAII INCLUSA — x2 premio
          </div>
        )}
      </div>

      {/* Cost pill + CTA */}
      <div style={{textAlign: "right", display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end"}}>
        <div style={{
          fontSize: "13px", fontWeight: "bold",
          color: room.isFloor ? C.dim : (canAfford ? C.gold : C.red),
          background: room.isFloor ? "#1a1a22" : canAfford ? `${C.gold}18` : `${C.red}18`,
          border: `1px solid ${room.isFloor ? C.dim : canAfford ? C.gold : C.red}88`,
          padding: "3px 10px",
          letterSpacing: "1px",
          minWidth: "56px", textAlign: "center",
        }}>
          {room.cost > 0 ? `€${room.cost}` : "GRATIS"}
        </div>
        <div style={{color: accent, fontSize: "9px", letterSpacing: "1px", fontWeight: "bold"}}>
          +{room.heals} UNGHIE
        </div>
      </div>
    </div>
  );
}

export function LocandaView({ player, onRest, onLeave }) {
  const rooms = [
    { name: "Per Terra", emoji: "🛏️", cost: 0, heals: 0, risk: "pavimento", desc: "Dormi sul pavimento lurido. Recuperi metà stato unghie. 50% chance ladro ti sveglia!", isFloor: true, accent: "#6a6a7a" },
    { name: "Bettola", emoji: "🍺", cost: 5, heals: 1, risk: "ladri", desc: "Recuperi 1 unghia (anche morta). Rischio ladri!", accent: C.cyan },
    { name: "Camera Media", emoji: "🛌", cost: 15, heals: 2, risk: null, desc: "Recuperi 2 unghie (anche morte). Conta raschiature azzerate.", accent: C.magenta },
    { name: "Suite", emoji: "🏨", cost: 80, heals: 5, risk: null, desc: "Recuperi TUTTE le unghie a Sana!", kawaii: false, accent: C.gold },
    { name: "Manicure Kawaii", emoji: "💅", cost: 150, heals: 5, risk: null, desc: "✨ Tutte le unghie diventano KAWAII (x2 premio)!", kawaii: true, accent: C.pink },
  ];

  return (
    <div style={{...S.panel, maxWidth: "540px", margin: "10px auto", background: "#05050b", border: `2px solid ${C.pink}55`, boxShadow: `0 0 22px ${C.pink}22, inset 0 0 28px ${C.pink}08`}}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "16px", alignItems: "center",
        padding: "10px 12px 14px",
        borderBottom: `1px solid ${C.pink}33`,
        marginBottom: "16px",
        background: `linear-gradient(180deg, ${C.pink}08 0%, transparent 100%)`,
        position: "relative",
      }}>
        {/* Sparkle decor */}
        <div style={{
          position: "absolute", top: "8px", right: "14px", fontSize: "12px", color: C.pink,
          animation: "variantSparkle 2.4s ease-in-out infinite",
        }}>✦</div>

        <pre style={{
          ...S.pre, ...S.title, margin: 0, fontSize: "11px", color: C.pink, lineHeight: 1.2,
          textShadow: `0 0 8px ${C.pink}66`,
          padding: "4px 10px",
          border: `1px solid ${C.pink}33`,
          background: "#0a0510",
          boxShadow: `inset 0 0 14px ${C.pink}10`,
        }}>{NPC_ART.locanda}</pre>

        <div>
          <div style={{
            fontSize: "22px", fontWeight: "bold", color: C.pink,
            letterSpacing: "4px", marginBottom: "2px",
            textShadow: `0 0 12px ${C.pink}aa, 0 0 26px ${C.pink}55`,
            fontFamily: FONT,
          }}>
            🏨 LOCANDA
          </div>
          <div style={{
            display: "inline-block",
            color: "#000", background: C.pink,
            fontSize: "9px", letterSpacing: "3px", fontWeight: "bold",
            padding: "1px 7px", marginBottom: "8px",
            boxShadow: `0 0 8px ${C.pink}aa`,
          }}>
            ≋ CURA · RIPOSO · MANICURE ≋
          </div>
          <div style={{
            color: C.pink, fontSize: "11px", fontStyle: "italic",
            background: "#140010",
            border: `1px solid ${C.pink}55`,
            padding: "6px 10px", lineHeight: 1.4,
            boxShadow: `inset 0 0 10px ${C.pink}14`,
          }}>
            <span style={{color: C.pink, marginRight: "5px"}}>❝</span>
            Riposati, viaggiatore. Le tue unghie ne hanno bisogno.
            <span style={{color: C.pink, marginLeft: "5px"}}>❞</span>
          </div>
        </div>
      </div>

      {/* ═══ SECTION HEADER STANZE ═══ */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        borderBottom: `1px solid ${C.pink}44`,
        paddingBottom: "6px", marginBottom: "10px",
      }}>
        <div style={{
          background: C.pink, color: "#000",
          padding: "3px 10px", fontSize: "10px", fontWeight: "bold",
          letterSpacing: "2px",
          boxShadow: `0 0 8px ${C.pink}88`,
        }}>
          ★ 🛏️ STANZE ★
        </div>
        <div style={{color: C.dim, fontSize: "10px", letterSpacing: "1px", fontStyle: "italic"}}>
          scegli il tuo livello di lusso
        </div>
        <div style={{marginLeft: "auto", color: C.pink, fontSize: "10px", letterSpacing: "1px"}}>
          {rooms.length} opzioni
        </div>
      </div>

      {/* ═══ LISTA STANZE ═══ */}
      <div style={{display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px"}}>
        {rooms.map((room, i) => (
          <RoomTile
            key={i}
            room={room}
            canAfford={player.money >= room.cost}
            onClick={() => onRest(room)}
          />
        ))}
      </div>

      {/* ═══ AZIONI ═══ */}
      <div style={{
        display: "flex", justifyContent: "flex-end",
        borderTop: `1px solid ${C.pink}33`, paddingTop: "10px",
      }}>
        <Btn onClick={onLeave}>Vai via →</Btn>
      </div>
    </div>
  );
}
