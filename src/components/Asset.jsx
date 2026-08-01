import { assetUrl } from "../assets/registry.js";

// ─── ASSET — sprite con fallback emoji ──────────────────────
// Mostra il PNG src/assets/img/<id>.png se esiste, altrimenti ricade
// sull'emoji passato. Così il redesign è incrementale e a rischio zero:
// ogni sprite generato si accende da solo, il resto resta com'era.
//
//   <Asset id="combat-attacco" emoji="⚔️" size={28} />
//
// size: numero (px) o stringa CSS ("1.2em").
// pixel: nearest-neighbor. È il DEFAULT (era opt-in): gli sprite sono pixel-art,
// scalarli con interpolazione bilineare li impasta. Passare pixel={false} solo
// per le rare immagini non-pixel (foto, gradienti).
export function Asset({ id, emoji, size = "1em", alt = "", pixel = true, style = {}, className }) {
  const url = assetUrl(id);
  const dim = typeof size === "number" ? `${size}px` : size;

  if (!url) {
    // Fallback: rende l'emoji dimensionato come lo sprite avrebbe occupato.
    return (
      <span
        className={className}
        aria-label={alt || undefined}
        style={{ fontSize: dim, lineHeight: 1, display: "inline-block", verticalAlign: "middle", ...style }}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={className}
      style={{
        width: dim,
        height: dim,
        objectFit: "contain",
        imageRendering: pixel ? "pixelated" : "auto",
        verticalAlign: "middle",
        display: "inline-block",
        ...style,
      }}
    />
  );
}
