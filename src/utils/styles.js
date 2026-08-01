import { C, FONT, FONT_TITLE, FS, W, T } from "../data/theme.js";

// ─── SHARED STYLES — CGA ARCADE PIXEL-ART ────────────────────
export const S = {
  container: {
    fontFamily: FONT, color: C.text, height: "100%",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "0", boxSizing: "border-box", userSelect: "none",
    imageRendering: "pixelated",
    fontSize: "clamp(13px, 1vw, 16px)", lineHeight: "1.4",
    overflowX: "hidden",
    background: C.bg,
  },
  // Pannello standard — V2 HOLO: vetro traslucido con blur + bordo 2px + pixel shadow
  panel: {
    background: `linear-gradient(180deg, rgba(10,12,26,0.62) 0%, rgba(3,3,8,0.78) 100%)`,
    backdropFilter: "blur(12px) saturate(1.5)",
    WebkitBackdropFilter: "blur(12px) saturate(1.5)",
    border: `2px solid ${C.dim}`,
    borderRadius: "0",
    padding: "clamp(10px, 1.5vh, 18px) clamp(12px, 2vw, 28px)",
    margin: "4px clamp(8px, 2vw, 24px)",
    width: "calc(100% - clamp(16px, 4vw, 48px))",
    maxWidth: W.content,
    boxShadow: `4px 4px 0 #000000, 0 0 20px ${C.cyan}14, inset 0 0 20px #00000066`,
  },
  // Bottone default — bordo 2px + pixel shadow
  // transition: prima era "none", quindi il glow di hover (applicato via DOM in
  // Btn.jsx) scattava di colpo. Ora dissolve in D.instant su ombra e testo:
  // il transform resta fuori dalla transizione perché lo stato :active
  // (definito in styles/animations.js) deve rispondere secco al click.
  btn: {
    fontFamily: FONT,
    background: "#0a0a14",
    color: C.text,
    border: `2px solid ${C.dim}`,
    padding: "8px 16px",
    cursor: "pointer",
    borderRadius: "0",
    fontSize: FS.md,
    transition: `box-shadow ${T.instant}, text-shadow ${T.instant}`,
    textShadow: `0 0 6px ${C.cyan}44`,
    boxShadow: "2px 2px 0 #000000",
  },
  // Bottone gold — bordo 2px oro + pixel shadow + neon
  btnGold: {
    fontFamily: FONT,
    background: "#0d0a00",
    color: C.gold,
    border: `2px solid ${C.gold}`,
    padding: "8px 16px",
    cursor: "pointer",
    borderRadius: "0",
    fontSize: FS.md,
    transition: `box-shadow ${T.instant}, text-shadow ${T.instant}`,
    boxShadow: `2px 2px 0 #000000, 0 0 14px ${C.gold}44`,
    textShadow: `0 0 8px ${C.gold}99`,
  },
  // Bottone danger — bordo 2px rosso + pixel shadow + neon
  btnDanger: {
    fontFamily: FONT,
    background: "#0d0000",
    color: C.red,
    border: `2px solid ${C.red}`,
    padding: "8px 16px",
    cursor: "pointer",
    borderRadius: "0",
    fontSize: FS.md,
    transition: `box-shadow ${T.instant}, text-shadow ${T.instant}`,
    boxShadow: `2px 2px 0 #000000, 0 0 14px ${C.red}44`,
    textShadow: `0 0 8px ${C.red}99`,
  },
  // Bottone disabilitato
  btnDisabled: {
    fontFamily: FONT,
    background: "#080808",
    color: "#444",
    border: `2px solid #222`,
    padding: "8px 16px",
    borderRadius: "0",
    fontSize: FS.md,
    cursor: "not-allowed",
    boxShadow: "2px 2px 0 #000000",
  },
  pre:   { margin: 0, fontFamily: FONT, whiteSpace: "pre", lineHeight: "1.2" },

  // ─── TIPOGRAFIA ────────────────────────────────────────────
  // Era invertita: `title` stava a 11px, cioè PIÙ PICCOLO di h2 (15px) e
  // h3 (14px). Ora la gerarchia scende davvero — display > title > h2 > h3 —
  // e i livelli cerimoniali usano il grottesco condensato (FONT_TITLE),
  // lasciando il monospace al corpo e ai dati da terminale.
  display: { fontFamily: FONT_TITLE, color: C.gold, textAlign: "center", fontSize: FS.huge, letterSpacing: "3px", lineHeight: 1.05, textShadow: `0 0 18px ${C.gold}88` },
  title:   { fontFamily: FONT_TITLE, color: C.gold, textAlign: "center", fontSize: FS.xxl, letterSpacing: "3px", lineHeight: 1.1, textShadow: `0 0 14px ${C.gold}77` },
  h2:      { fontFamily: FONT_TITLE, color: C.cyan, margin: "0 0 8px 0", fontSize: FS.xl, letterSpacing: "2px", textShadow: `0 0 12px ${C.cyan}88` },
  h3:      { color: C.gold, margin: "8px 0 4px 0", fontSize: FS.lg, letterSpacing: "1px", textShadow: `0 0 10px ${C.gold}77` },
  // Numeri-chiave (soldi, danni, punteggi): stessa voce dei titoli, così le
  // cifre importanti si leggono come un'insegna e non come un listato.
  num:     { fontFamily: FONT_TITLE, fontSize: FS.xl, letterSpacing: "1px", fontWeight: "bold" },
};
