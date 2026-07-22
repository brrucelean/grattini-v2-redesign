import { useState, useEffect, useRef, useCallback } from "react";
import { C, FONT } from "../data/theme.js";
import { S } from "../utils/styles.js";
import { CornerBrackets } from "./Vintage.jsx";

// ─── DOPPIO O NULLA COMPONENT ──────────────────────────────────
export function DoppioONullaView({ prize, onDecline, onResult }) {
  const [revealed, setRevealed] = useState(false);
  const [won, setWon] = useState(null);
  const [scratching, setScratching] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);

  // Determine outcome on mount (50/50)
  const outcomeRef = useRef(Math.random() < 0.5);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    // Fill with silver scratch layer
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Add "GRATTA QUI" text
    ctx.fillStyle = "#666";
    ctx.font = "bold 16px 'Courier New'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GRATTA QUI", canvas.width / 2, canvas.height / 2);
  }, []);

  const checkReveal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = ctxRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) transparent++;
    }
    const pct = transparent / (pixels.length / 4);
    setScratchProgress(Math.round(pct * 100));
    if (pct > 0.45) {
      setRevealed(true);
      const w = outcomeRef.current;
      setWon(w);
      // Clear remaining scratch layer
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTimeout(() => onResult(w), 1400);
    }
  }, [revealed, onResult]);

  const handlePointerDown = (e) => {
    if (revealed) return;
    isDrawing.current = true;
    setScratching(true);
    scratch(e);
  };
  const handlePointerMove = (e) => {
    if (!isDrawing.current || revealed) return;
    scratch(e);
  };
  const handlePointerUp = () => {
    isDrawing.current = false;
    setScratching(false);
    checkReveal();
  };

  const scratch = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
    const ctx = ctxRef.current;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x * (canvas.width / rect.width), y * (canvas.height / rect.height), 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  const resultSymbol = outcomeRef.current ? "💰" : "💀";
  const resultText = outcomeRef.current ? `€${prize * 2}` : "€0";
  const resultColor = outcomeRef.current ? C.gold : C.red;
  const accent = C.gold; // gambling → gold theme

  return (
    <div style={{
      ...S.panel,
      position: "relative",
      background: "#05050b",
      border: `2px solid ${accent}66`,
      boxShadow: `0 0 28px ${accent}33, inset 0 0 32px ${accent}0a`,
      maxWidth: "480px", margin: "10px auto",
      textAlign: "center",
      paddingTop: "18px", paddingBottom: "14px",
    }}>
      <CornerBrackets color={accent} size={14} inset={10} thickness={2} glow />

      {/* ═══ HEADER ═══ */}
      <div style={{
        position: "relative",
        borderBottom: `1px solid ${accent}33`,
        paddingBottom: "10px", marginBottom: "14px",
        background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
      }}>
        {/* Sparkle decor */}
        <div style={{
          position: "absolute", top: "-4px", left: "10px",
          fontSize: "12px", color: accent,
          animation: "variantSparkle 2.4s ease-in-out infinite",
        }}>✦</div>
        <div style={{
          position: "absolute", top: "-4px", right: "10px",
          fontSize: "12px", color: accent,
          animation: "variantSparkle 2.4s ease-in-out infinite",
          animationDelay: "1.2s",
        }}>✦</div>

        <div style={{
          fontSize: "22px", fontWeight: "bold", color: accent,
          letterSpacing: "5px", marginBottom: "4px",
          textShadow: `0 0 14px ${accent}aa, 0 0 30px ${accent}55`,
          fontFamily: FONT,
          animation: "pulse 1.8s ease-in-out infinite",
        }}>
          🎰 DOPPIO O NULLA 🎰
        </div>
        <div style={{
          display: "inline-block",
          color: "#000", background: accent,
          fontSize: "9px", letterSpacing: "3px", fontWeight: "bold",
          padding: "2px 10px",
          boxShadow: `0 0 8px ${accent}aa`,
        }}>
          ≋ EVENTO CASUALE · ODDS 50/50 ≋
        </div>
      </div>

      {/* ═══ STAKES DISPLAY ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: "10px",
        alignItems: "center",
        padding: "10px 8px",
        marginBottom: "14px",
        background: "#0a0a14",
        border: `1px solid ${accent}44`,
        boxShadow: `inset 0 0 16px ${accent}0c`,
      }}>
        {/* Current prize */}
        <div style={{textAlign: "center"}}>
          <div style={{
            color: C.dim, fontSize: "9px", letterSpacing: "2px",
            marginBottom: "4px",
          }}>HAI IN MANO</div>
          <div style={{
            color: C.green, fontSize: "20px", fontWeight: "bold",
            textShadow: `0 0 10px ${C.green}66`,
            fontFamily: FONT,
          }}>€{prize}</div>
        </div>

        {/* Arrow */}
        <div style={{
          color: accent, fontSize: "22px",
          textShadow: `0 0 10px ${accent}`,
          fontWeight: "bold",
        }}>→</div>

        {/* Stakes */}
        <div style={{textAlign: "center"}}>
          <div style={{
            color: C.dim, fontSize: "9px", letterSpacing: "2px",
            marginBottom: "4px",
          }}>RISCHI PER</div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            <span style={{
              color: accent, fontSize: "20px", fontWeight: "bold",
              textShadow: `0 0 10px ${accent}aa`,
              fontFamily: FONT,
            }}>€{prize * 2}</span>
            <span style={{color: C.dim, fontSize: "10px"}}>/</span>
            <span style={{
              color: C.red, fontSize: "14px", fontWeight: "bold",
              textShadow: `0 0 8px ${C.red}88`,
              fontFamily: FONT,
            }}>€0</span>
          </div>
        </div>
      </div>

      {/* ═══ SCRATCH ZONE ═══ */}
      <div style={{
        position: "relative",
        width: "200px", height: "140px",
        margin: "0 auto 12px auto",
        border: `2px solid ${accent}`,
        overflow: "hidden",
        boxShadow: `0 0 22px ${accent}66, inset 0 0 18px ${accent}14`,
        background: C.card,
      }}>
        {/* Inner corner ticks */}
        {["tl","tr","bl","br"].map(pos => {
          const [v, h] = pos.split("");
          return (
            <div key={pos} style={{
              position: "absolute",
              [v === "t" ? "top" : "bottom"]: "4px",
              [h === "l" ? "left" : "right"]: "4px",
              width: "10px", height: "10px",
              borderTop: v === "t" ? `1px solid ${accent}aa` : "none",
              borderBottom: v === "b" ? `1px solid ${accent}aa` : "none",
              borderLeft: h === "l" ? `1px solid ${accent}aa` : "none",
              borderRight: h === "r" ? `1px solid ${accent}aa` : "none",
              zIndex: 3, pointerEvents: "none",
            }}/>
          );
        })}

        {/* Result underneath — hidden until revealed */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontSize: "48px", zIndex: 1,
          opacity: revealed ? 1 : 0,
          background: revealed ? `radial-gradient(circle at center, ${resultColor}22 0%, transparent 70%)` : "none",
        }}>
          <div style={{
            textShadow: revealed ? `0 0 20px ${resultColor}` : "none",
            filter: revealed ? `drop-shadow(0 0 10px ${resultColor}aa)` : "none",
            animation: revealed ? "pulse 0.6s ease-in-out" : "none",
          }}>{resultSymbol}</div>
          <div style={{
            fontSize: "22px", fontWeight: "bold", color: resultColor, fontFamily: FONT,
            letterSpacing: "2px", marginTop: "4px",
            textShadow: `0 0 14px ${resultColor}aa`,
          }}>{resultText}</div>
        </div>

        {/* Placeholder text */}
        {!revealed && (
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", color: "#444", fontFamily: FONT, zIndex: 0,
            pointerEvents: "none", letterSpacing: "2px",
          }}>
            ?
          </div>
        )}

        {/* Scratch layer on top */}
        <canvas
          ref={canvasRef}
          width={200} height={140}
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            zIndex: 2, cursor: revealed ? "default" : "crosshair",
            touchAction: "none",
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      {/* ═══ PROGRESS BAR ═══ */}
      {!revealed && scratchProgress > 0 && (
        <div style={{
          width: "200px", margin: "0 auto 10px",
          background: "#0a0a14",
          border: `1px solid ${accent}44`,
          height: "8px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.min(100, scratchProgress / 0.45)}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${accent}88, ${accent})`,
            boxShadow: `0 0 8px ${accent}`,
            transition: "width 0.15s ease-out",
          }}/>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "8px", color: C.bright, letterSpacing: "2px",
            fontWeight: "bold", mixBlendMode: "difference",
          }}>
            {scratchProgress}%
          </div>
        </div>
      )}

      {/* ═══ RESULT HERO BANNER ═══ */}
      {revealed && (
        <div style={{
          display: "inline-block",
          background: won ? C.gold : C.red, color: "#000",
          padding: "5px 14px", fontSize: "12px", fontWeight: "bold",
          letterSpacing: "3px", marginBottom: "8px",
          boxShadow: `0 0 16px ${won ? C.gold : C.red}aa`,
          animation: "pulse 0.5s ease-in-out",
        }}>
          ★ {won ? `🎉 RADDOPPIATO — €${prize * 2}!` : "💀 PERSO TUTTO!"} ★
        </div>
      )}

      {/* ═══ CTAs ═══ */}
      {!scratching && !revealed && (
        <div style={{
          display: "flex", gap: "10px", justifyContent: "center",
          alignItems: "center", flexWrap: "wrap",
          borderTop: `1px solid ${accent}33`, paddingTop: "12px", marginTop: "4px",
        }}>
          <button
            style={{
              ...S.btn, color: C.green, borderColor: C.green,
              background: `${C.green}10`,
              boxShadow: `0 0 10px ${C.green}33`,
              letterSpacing: "1px", fontWeight: "bold",
            }}
            onClick={onDecline}
          >
            ✋ INTASCA €{prize}
          </button>
          <div style={{
            color: C.dim, fontSize: "10px",
            letterSpacing: "1px", fontStyle: "italic",
          }}>
            oppure gratta →
          </div>
        </div>
      )}
    </div>
  );
}
