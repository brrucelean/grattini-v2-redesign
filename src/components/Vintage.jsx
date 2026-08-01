// Primitivi UI riusabili "Vintage": corner brackets, foil shimmer, badge solid.
// Estratti da scratchlite.jsx + 7 componenti che li duplicavano inline.
import { FS } from "../data/theme.js";

const CORNERS = ["tl","tr","bl","br"];

/**
 * Corner brackets decorativi ai 4 angoli del contenitore parent.
 * Il parent deve essere position:relative.
 *
 * Props:
 *   color: string (CSS color)
 *   size?: px (default 5)
 *   inset?: px (default 1)
 *   thickness?: px (default 1)
 *   glow?: bool (default false) — aggiunge drop-shadow al colore
 *   opacity?: number (default 0.85)
 */
export function CornerBrackets({ color, size = 5, inset = 1, thickness = 1, glow = false, opacity = 0.85 }) {
  return (
    <>
      {CORNERS.map(pos => {
        const v = pos[0]; // t/b
        const h = pos[1]; // l/r
        return (
          <span key={pos} style={{
            position:"absolute",
            [v === "t" ? "top" : "bottom"]: `${inset}px`,
            [h === "l" ? "left" : "right"]: `${inset}px`,
            width: `${size}px`, height: `${size}px`,
            borderTop:    v === "t" ? `${thickness}px solid ${color}` : "none",
            borderBottom: v === "b" ? `${thickness}px solid ${color}` : "none",
            borderLeft:   h === "l" ? `${thickness}px solid ${color}` : "none",
            borderRight:  h === "r" ? `${thickness}px solid ${color}` : "none",
            filter: glow ? `drop-shadow(0 0 4px ${color}aa)` : "none",
            opacity,
            pointerEvents:"none",
          }}/>
        );
      })}
    </>
  );
}

/**
 * Strato shimmer iridescente diagonale animato — overlay sopra al contenitore parent.
 * Il parent deve essere position:relative + overflow:hidden.
 *
 * Props:
 *   color?: string accent della scia (default "#ffffff")
 *   speed?: number secondi del loop (default 2.4)
 *   intensity?: number 0-1 opacità scia (default 0.4)
 *   blend?: CSS mix-blend-mode (default "overlay")
 */
export function FoilShimmer({ color = "#ffffff", speed = 2.4, intensity = 0.4, blend = "overlay" }) {
  const a = Math.round(intensity * 255).toString(16).padStart(2, "0");
  return (
    <span style={{
      position:"absolute", inset:0, pointerEvents:"none",
      background: `linear-gradient(110deg, transparent 35%, ${color}${a} 50%, transparent 65%)`,
      backgroundSize:"200% 100%",
      animation: `variantShimmer ${speed}s linear infinite`,
      mixBlendMode: blend,
    }}/>
  );
}

/**
 * Badge solid stile vintage "★ LABEL ★" con glow del colore accent.
 * Opzionalmente include un FoilShimmer interno.
 *
 * Props:
 *   color: string accent (sfondo + glow)
 *   children: contenuto (di solito il label senza le stelle, oppure include emoji)
 *   stars?: bool (default true) — se aggiungere "★ ... ★"
 *   size?: "sm" | "md" (default "md")
 *   shimmer?: bool (default false)
 *   style?: override CSS
 */
export function VintageBadge({ color, children, stars = true, size = "md", shimmer = false, style = {} }) {
  // Le tre taglie erano 7/8/10px: le prime due sotto il minimo leggibile, e i
  // badge sono proprio l'elemento che deve dire "questo è raro" a colpo d'occhio.
  // Ora partono da FS.xs (10px) e la differenza la fa il respiro, non il corpo.
  const sizes = {
    sm: { fontSize:FS.xs, padding:"2px 7px",   letterSpacing:"1.5px", glow:4  },
    md: { fontSize:FS.sm, padding:"3px 9px",   letterSpacing:"2px",   glow:6  },
    lg: { fontSize:FS.md, padding:"4px 13px",  letterSpacing:"2.5px", glow:8  },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div style={{
      display:"inline-block", position:"relative",
      background: color, color:"#000",
      fontWeight:"bold",
      fontSize: s.fontSize,
      padding: s.padding,
      letterSpacing: s.letterSpacing,
      boxShadow: `0 0 ${s.glow}px ${color}99`,
      ...style,
    }}>
      {stars ? <>★ {children} ★</> : children}
      {shimmer && <FoilShimmer color="#ffffff" speed={2.4} intensity={0.4} blend="overlay" />}
    </div>
  );
}
