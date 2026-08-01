import { C } from "../data/theme.js";
import { S } from "../utils/styles.js";
import { AudioEngine } from "../audio.js";

export function Btn({ children, onClick, variant="normal", disabled=false, style={} }) {
  const base = disabled ? S.btnDisabled :
               variant === "gold" ? S.btnGold :
               variant === "danger" ? S.btnDanger : S.btn;
  // Hover: glow del colore del bottone (usa borderColor o color effettivo)
  const merged = {...base, ...style};
  const glowColor = merged.borderColor || (variant === "gold" ? C.gold : variant === "danger" ? C.red : merged.color || C.dim);
  // className "btn-ui": porta con sé lo stato :active (scale 0.96) definito in
  // styles/animations.js — uno pseudo-stato non è esprimibile inline.
  // Il click suona: AudioEngine.click() esisteva già ma non era collegato a
  // nulla, quindi l'intera UI era muta al tocco.
  return <button className="btn-ui" style={merged}
    onClick={disabled ? undefined : (e) => { AudioEngine.click(); onClick?.(e); }}
    onMouseEnter={e => { if(!disabled) {
      e.currentTarget.style.boxShadow = `0 0 16px ${glowColor}66, 0 0 32px ${glowColor}33`;
      e.currentTarget.style.textShadow = `0 0 12px ${glowColor}`;
    }}}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = merged.boxShadow || "none";
      e.currentTarget.style.textShadow = merged.textShadow || "none";
    }}
  >{children}</button>;
}
