import { useState, useEffect, useRef } from "react";
import { C, FONT, FS, W } from "../data/theme.js";
import { ITEM_DEFS, GRATTATORE_DEFS } from "../data/items.js";
import { CARD_TYPES } from "../data/cards.js";
import { TABACCAIO_LINES } from "../data/art.js";
import { rng } from "../utils/random.js";
import { S } from "../utils/styles.js";
import { Btn } from "./Btn.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { Asset } from "./Asset.jsx";
import { VintageBadge } from "./Vintage.jsx";
import { ANIM } from "../styles/animations.js";

const SLOT_SYMBOLS = ["🍋","🍒","🔔","💎","7️⃣","⭐"];

// ─── Helper: color per rarità ───────────────────────────────
const rarityAccent = (rarity, vip = false) => {
  if (vip) return { c: C.gold, glow: "aa", label: "VIP" };
  switch (rarity) {
    case "leggendaria": return { c: C.gold, glow: "aa", label: "LEGGEND." };
    case "rarissimo":   return { c: C.orange, glow: "aa", label: "RARISSIMO" };
    case "rara":        return { c: C.magenta, glow: "88", label: "RARA" };
    case "media":       return { c: C.cyan, glow: "66", label: "MEDIA" };
    case "comune":
    default:            return { c: "#7a8aaa", glow: "44", label: "COMUNE" };
  }
};

// ─── ScrollRow: contenitore App Store — scroll orizzontale ──
function ScrollRow({ children, bg = "#05050b" }) {
  return (
    <div style={{position:"relative", marginBottom:"16px"}}>
      <div style={{
        display:"flex",
        overflowX:"auto",
        gap:"10px",
        paddingBottom:"6px",
        paddingLeft:"2px",
        paddingRight:"40px",   // spazio per il fade
        scrollbarWidth:"none",
        msOverflowStyle:"none",
        WebkitOverflowScrolling:"touch",
        // Impedisce che lo swipe orizzontale scorra la pagina verticale
        touchAction:"pan-x",
        overscrollBehaviorX:"contain",
      }}>
        {children}
      </div>
      {/* Gradiente sfumato a destra — hint "ci sono altri" */}
      <div style={{
        position:"absolute", top:0, right:0,
        width:"48px", height:"calc(100% - 6px)",
        background:`linear-gradient(to right, transparent, ${bg})`,
        pointerEvents:"none",
      }}/>
    </div>
  );
}

// ─── ProductTile: card App-Store style ───────────────────────
function ProductTile({ emoji, assetId, name, subtitle, cost, maxPrize, accent, canAfford, onClick, tooltip, badgeLabel, shimmer = false, disabled = false }) {
  const cantPay = !canAfford || disabled;
  return (
    <Tooltip text={tooltip}>
      <div
        onClick={cantPay ? undefined : onClick}
        className={shimmer && !cantPay ? "holo holo-strong" : undefined}
        style={{
          flexShrink: 0,          // non si schiaccia nel row orizzontale
          width: "130px",
          // Passata ottone: base calda con sheen dall'alto invece del nero piatto
          background: cantPay
            ? "linear-gradient(180deg, #12110d 0%, #0a0a12 100%)"
            : "linear-gradient(180deg, #1a150b 0%, #0c0b13 46%, #08080e 100%)",
          border: `2px solid ${cantPay ? "#333" : accent.c}`,
          boxShadow: cantPay
            ? "inset 0 0 10px #0008"
            : `0 0 10px ${accent.c}${accent.glow === "aa" ? "66" : "33"}, inset 0 1px 0 ${C.gold}33, inset 0 0 14px ${accent.c}14`,
          cursor: cantPay ? "not-allowed" : "pointer",
          userSelect: "none",
          display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
          opacity: cantPay ? 0.5 : 1,
          transition: "transform 0.12s, box-shadow 0.12s",
        }}
        onMouseEnter={e => {
          if (cantPay) return;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 0 18px ${accent.c}aa, 0 4px 12px #000a, inset 0 1px 0 ${C.gold}55, inset 0 0 18px ${accent.c}22`;
        }}
        onMouseLeave={e => {
          if (cantPay) return;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `0 0 10px ${accent.c}${accent.glow === "aa" ? "66" : "33"}, inset 0 1px 0 ${C.gold}33, inset 0 0 14px ${accent.c}14`;
        }}
      >
        {/* Preview area */}
        <div style={{
          position: "relative", height: "62px",
          background: `linear-gradient(135deg, ${accent.c}18, ${accent.c}05)`,
          borderBottom: `1px solid ${accent.c}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Corner brackets */}
          {["tl","tr","bl","br"].map(pos => {
            const [v, h] = pos.split("");
            return (
              <div key={pos} style={{
                position: "absolute",
                [v === "t" ? "top" : "bottom"]: "3px",
                [h === "l" ? "left" : "right"]: "3px",
                width: "7px", height: "7px",
                borderTop: v === "t" ? `1px solid ${accent.c}aa` : "none",
                borderBottom: v === "b" ? `1px solid ${accent.c}aa` : "none",
                borderLeft: h === "l" ? `1px solid ${accent.c}aa` : "none",
                borderRight: h === "r" ? `1px solid ${accent.c}aa` : "none",
                zIndex: 1,
              }}/>
            );
          })}
          <div style={{
            fontSize: "28px", position: "relative", zIndex: 2,
            textShadow: `0 0 12px ${accent.c}`,
            filter: cantPay ? "grayscale(0.6) brightness(0.7)" : "none",
          }}><Asset id={assetId} emoji={emoji} size={28} /></div>
          {/* Shimmer foil per rarità alta */}
          {shimmer && !cantPay && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `linear-gradient(110deg, transparent 30%, ${accent.c}33 48%, ${accent.c}88 50%, ${accent.c}33 52%, transparent 70%)`,
              backgroundSize: "200% 100%",
              animation: "variantShimmer 2.6s linear infinite",
              mixBlendMode: "screen",
              zIndex: 3,
            }}/>
          )}
        </div>

        {/* Badge label */}
        <div style={{
          background: cantPay ? "#222" : accent.c,
          color: cantPay ? "#666" : "#000",
          padding: "3px 5px", fontSize: FS.xs, fontWeight: "bold",
          letterSpacing: "1px", textAlign: "center",
          borderBottom: `1px solid ${accent.c}55`,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: "15px", height: "21px", boxSizing: "border-box",
        }}>
          ★ {(() => {
            const s = (badgeLabel || name).toUpperCase();
            return s.length > 13 ? s.slice(0, 12) + "…" : s;
          })()} ★
        </div>

        {/* Body: name + cost */}
        <div style={{padding: "6px 7px 7px", background: "linear-gradient(180deg, #0e0c08 0%, #07070d 100%)", flex: 1}}>
          <div style={{
            fontSize: FS.xs, color: C.bright, lineHeight: 1.3,
            marginBottom: "4px", minHeight: "26px",
          }}>
            {name}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: FS.xs,
          }}>
            <span style={{
              color: canAfford ? C.gold : C.red,
              fontWeight: "bold",
              background: canAfford ? `${C.gold}18` : `${C.red}18`,
              border: `1px solid ${canAfford ? C.gold : C.red}55`,
              padding: "1px 5px",
            }}>€{cost}</span>
            {subtitle && (
              <span style={{color: accent.c, fontSize: FS.xs, letterSpacing: "0.5px"}}>
                {subtitle}
              </span>
            )}
          </div>
          {maxPrize != null && (
            <div style={{color: C.dim, fontSize: FS.xs, marginTop: "3px", letterSpacing: "0.5px"}}>
              max €{maxPrize}
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

// ─── SectionHeader: banner sezione con hint di scroll ────────
function SectionHeader({ icon, label, count, accent = C.gold, subtitle, scrollHint = false }) {
  return (
    <div style={{marginBottom: "8px", marginTop: "4px"}}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        borderBottom: `1px solid ${accent}55`,
        paddingBottom: "6px",
      }}>
        <div style={{
          background: accent, color: "#000",
          padding: "3px 10px", fontSize: "10px", fontWeight: "bold",
          letterSpacing: "2px",
          boxShadow: `0 0 8px ${accent}88`,
          flexShrink: 0,
        }}>
          ★ {icon} {label.toUpperCase()} ★
        </div>
        {subtitle && (
          <div style={{color: C.dim, fontSize: "10px", letterSpacing: "1px", fontStyle: "italic", flexShrink: 0}}>
            {subtitle}
          </div>
        )}
        {/* Scroll hint — appare quando ci sono tanti articoli */}
        {scrollHint && count > 2 && (
          <div style={{
            marginLeft: "auto",
            color: accent, fontSize: FS.xs, letterSpacing: "1px",
            opacity: 0.7, flexShrink: 0,
            animation: ANIM.pulseAmbient,
          }}>
            scorri →
          </div>
        )}
        {!scrollHint && count != null && (
          <div style={{
            marginLeft: "auto",
            color: accent, fontSize: "10px", letterSpacing: "1px",
            flexShrink: 0,
          }}>
            {count} {count === 1 ? "art." : "art."}
          </div>
        )}
      </div>
    </div>
  );
}

export function ShopView({ player, onBuyCard, onBuyItem, onBuyGrattatore, onLeave, onScratch, onSlotResult, currentRow=0, currentBiome=0, wideDesk=false }) {
  const punchline = useRef(TABACCAIO_LINES[Math.floor(rng() * TABACCAIO_LINES.length)]);
  const [vw, setVw] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setVw(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const mobile = vw < 600;

  // ─── SLOT MACHINE STATE ────────────────────────────────────────
  const [slotReels, setSlotReels] = useState(["🎰","🎰","🎰"]);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotResult, setSlotResult] = useState(null);
  const slotIntervalRef = useRef(null);

  const spinSlot = () => {
    if (slotSpinning || player.money < 1) return;
    onSlotResult({ type: "pay", amount: 1 });
    setSlotResult(null);
    setSlotSpinning(true);
    let ticks = 0;
    const maxTicks = 22;
    slotIntervalRef.current = setInterval(() => {
      setSlotReels([
        SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)],
      ]);
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(slotIntervalRef.current);
        const r1 = SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)];
        const r2 = SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)];
        const r3 = SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)];
        setSlotReels([r1, r2, r3]);
        setSlotSpinning(false);
        let type = "lose", prize = 0, text = "Nessun premio. Meglio così.";
        if (r1 === "7️⃣" && r2 === "7️⃣" && r3 === "7️⃣") {
          type = "superjackpot"; prize = 100;
          text = "🎆 SUPER JACKPOT! Tre sette! +€100!";
        } else if (r1 === r2 && r2 === r3) {
          type = "jackpot"; prize = 50;
          text = `🎉 JACKPOT! Tre ${r1}! +€50!`;
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
          type = "small"; prize = 5;
          text = `✨ Piccola vincita! Due uguali! +€5`;
        } else {
          text = "💨 Niente. Solo fumo e rimpianti.";
        }
        setSlotResult({ text, prize, type });
        if (prize > 0) onSlotResult({ type: "win", amount: prize });
      }
    }, 80);
  };

  // ─── CATALOG FILTERS ─────────────────────────────────────────
  const baseCards = [
    CARD_TYPES[0], CARD_TYPES[1], CARD_TYPES[2],
    ...(player.money >= 5  ? [CARD_TYPES[3]] : []),
    ...(player.money >= 10 ? [CARD_TYPES[4]] : []),
    ...(player.money >= 20 ? [CARD_TYPES[5]] : []),
    ...(player.money >= 30 && currentRow >= 3 ? [CARD_TYPES[6]] : []),
    ...(player.money >= 50 && currentRow >= 5 ? [CARD_TYPES[7]] : []),
    ...(player.money >= 100 && currentRow >= 6 ? [CARD_TYPES[8]] : []),
    ...(player.money >= 15 ? [CARD_TYPES[9]] : []),
    ...(player.money >= 20 && player.lastWonPrize > 0 ? [CARD_TYPES[13]] : []),
    ...(player.money >= 20 && currentRow >= 3 ? [CARD_TYPES.find(c => c.id === "jackpotMix")] : []).filter(Boolean),
  ];
  const biomeCardsByBiome = {
    0: ["fortunaFlash","setteEMezzo","portaFortuna","ruota"],
    1: ["ruota","doppioOnulla","jackpotMix"],
    2: ["miliardario","tredici","mappaTesor0"],
    3: ["mahjong","turistaPerSempre","grattaCombina"],
  };
  const biomePromo = (biomeCardsByBiome[currentBiome] || [])
    .map(id => CARD_TYPES.find(c => c.id === id))
    .filter(c => c && player.money >= c.cost);
  const seenIds = new Set(baseCards.map(c => c?.id).filter(Boolean));
  const shopCards = [...baseCards, ...biomePromo.filter(c => !seenIds.has(c.id))];

  const stockSeed = (currentBiome * 1000) + (currentRow * 31) + (player.scratchCards.length * 7);
  const prng = (() => {
    let a = stockSeed | 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = a; t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  })();
  const stock = (arr, p, maxSlots) => {
    if (arr.length === 0) return arr;
    const shuffled = [...arr].sort(() => prng() - 0.5);
    const picked = shuffled.filter(() => prng() < p);
    return picked.slice(0, maxSlots);
  };

  const shopItems = ["cerotto","disinfettante","sigaretta"];
  const shopGrattatori = ["bottone","bullone"];
  const mediumItemsPool = ["sigarettaErba","cremaRinforzante"].filter(() => true);
  const mediumItems = player.money >= 8 ? stock(mediumItemsPool, 0.50, 2) : [];
  const mediumGrattatori = player.money >= 10 ? stock(["unghiaFinta","coltelloAffilato"], 0.55, 2) : [];
  const sottoBanco = player.money >= 15 ? stock(["giornalettoPorno"], 0.30, 1) : [];
  const rareItems = player.money >= 15 ? stock(["cappelloSbirro","smalto"], 0.30, 1) : [];
  const rareGrattatori = player.money >= 15 ? stock(["plettro","moneta_argento","discoRotto","chiaveOttone","fasciaPolso","guantoFerro"], 0.30, 2) : [];
  const legendaryGrattatori = player.money >= 40 ? stock(["moneta_oro"], 0.12, 1) : [];
  const vipGrattatori = (currentBiome >= 2 && player.money >= 2000) ? ["portaChiavi"] : [];
  const vipItems = player.hasVIP ? ["sieroRicrescita","gettoneLavaggio","manoProtesica"] : [];
  const vipCards = player.hasVIP ? [
    ...(player.money >= 15 ? [CARD_TYPES.find(t=>t.id==="labirinto")] : []),
    ...(player.money >= 25 ? [CARD_TYPES.find(t=>t.id==="grattaCombina")] : []),
    ...(player.money >= 35 ? [CARD_TYPES.find(t=>t.id==="mappaTesor0")] : []),
    ...(currentBiome === 3 && player.money >= 40 ? [CARD_TYPES.find(t=>t.id==="turistaPerSempre")] : []),
  ].filter(Boolean) : [];

  const cardRarity = (card) => {
    const t = card.tier || 1;
    if (t >= 4) return "leggendaria";
    if (t >= 3) return "rara";
    if (t >= 2) return "media";
    return "comune";
  };

  const allGrattatoriIds = [...shopGrattatori, ...mediumGrattatori, ...rareGrattatori, ...legendaryGrattatori, ...vipGrattatori];
  const allConsumabili = [...shopItems, ...mediumItems, ...rareItems, ...sottoBanco];

  return (
    <div style={{
      ...S.panel,
      margin: mobile ? "0" : "10px auto",
      // Su desktop largo lo zaino sta fisso a fianco (vedi ShopZainoRail sotto
      // e la composizione in scratchlite.jsx): il banco si restringe un po'
      // per fargli posto, invece di occupare da solo tutto W.content.
      maxWidth: wideDesk ? "820px" : W.content,
      /* Vetro traslucido: lascia intravedere scene-shop dietro, senza perdere leggibilità */
      background: "linear-gradient(180deg, rgba(10,9,18,0.82) 0%, rgba(4,3,8,0.9) 100%)",
      backdropFilter: "blur(10px) saturate(1.3)",
      WebkitBackdropFilter: "blur(10px) saturate(1.3)",
      border: mobile ? "none" : `2px solid ${C.gold}66`,
      boxShadow: mobile ? "none" : `0 0 22px ${C.gold}22, inset 0 0 30px ${C.gold}08`,
      display: "flex", flexDirection: "column",
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        display: "flex",
        flexDirection: mobile ? "row" : "row",
        flexWrap: mobile ? "nowrap" : "nowrap",
        alignItems: "center",
        gap: mobile ? "10px" : "18px",
        borderBottom: `1px solid ${C.gold}33`,
        paddingBottom: mobile ? "10px" : "14px",
        marginBottom: mobile ? "10px" : "16px",
        background: `linear-gradient(180deg, ${C.gold}0a 0%, transparent 100%)`,
        padding: mobile ? "8px 10px 10px" : "10px 12px 14px",
        position: "relative",
      }}>
        {/* Sparkle decorazioni */}
        <div style={{
          position: "absolute", top: "8px", right: "14px", fontSize: "14px", color: C.gold,
          animation: "variantSparkle 2.2s ease-in-out infinite",
        }}>✦</div>

        {/* Ritratto tabaccaio — sprite PNG in un riquadro CRT ottone */}
        {!mobile && (
          <div style={{
            flexShrink: 0,
            padding: "6px",
            border: `1px solid ${C.gold}44`,
            background: "#0a0800",
            boxShadow: `inset 0 0 14px ${C.gold}14, 0 0 10px ${C.gold}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Asset id="spr-tabaccaio" emoji="🏪" size={72}
              style={{ filter: `drop-shadow(0 0 6px ${C.gold}66)` }} />
          </div>
        )}

        {/* Testo header */}
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{
            fontSize: mobile ? "16px" : "22px",
            fontWeight: "bold", color: C.gold,
            letterSpacing: mobile ? "2px" : "4px",
            marginBottom: "2px",
            textShadow: `0 0 12px ${C.gold}aa, 0 0 28px ${C.gold}55`,
            fontFamily: FONT,
          }}>
            🏪 TABACCHERIA
          </div>
          <div style={{
            display: "inline-block",
            color: "#000", background: C.gold,
            fontSize: FS.xs, letterSpacing: mobile ? "1px" : "3px", fontWeight: "bold",
            padding: "1px 7px", marginBottom: "6px",
            boxShadow: `0 0 8px ${C.gold}aa`,
          }}>
            ≋ GRATTA &amp; VINCI · SIGARETTE · LOTTO ≋
          </div>

          {/* Punchline */}
          <div style={{
            color: C.gold, fontSize: mobile ? "11px" : "12px", fontStyle: "italic",
            background: "#0f0a00",
            border: `1px solid ${C.gold}55`,
            padding: mobile ? "5px 8px" : "7px 11px",
            lineHeight: 1.4,
            boxShadow: `inset 0 0 12px ${C.gold}14`,
          }}>
            <span style={{color: C.gold, marginRight: "4px"}}>❝</span>
            {punchline.current}
            <span style={{color: C.gold, marginLeft: "4px"}}>❞</span>
          </div>
        </div>
      </div>

      {/* Contenuto — lo scroll verticale è gestito dal DESK esterno */}
      <div style={{
        padding: mobile ? "0 10px 10px" : "0 12px 12px",
      }}>

        {/* ═══ GRATTA & VINCI ═══ */}
        <SectionHeader
          icon="🎫" label="Gratta & Vinci" count={shopCards.length}
          accent={C.gold} subtitle="scegli il tuo destino"
          scrollHint
        />
        <ScrollRow>
          {shopCards.map(c => {
            const rar = cardRarity(c);
            const accent = rarityAccent(rar);
            return (
              <ProductTile
                key={c.id}
                emoji={c.emoji || "🎫"}
                assetId={`card-${c.id}`}
                name={c.name}
                subtitle={accent.label}
                cost={c.cost}
                maxPrize={c.maxPrize}
                accent={accent}
                canAfford={player.money >= c.cost}
                onClick={() => onBuyCard(c.id)}
                tooltip={`${c.desc} · Max: €${c.maxPrize}${c.malus ? ` · ⚠ ${c.malus.desc}` : ""}`}
                shimmer={rar === "leggendaria" || rar === "rarissimo"}
              />
            );
          })}
        </ScrollRow>

        {/* ═══ GRATTATORI ═══ */}
        <SectionHeader
          icon="🔧" label="Grattatori" count={allGrattatoriIds.length}
          accent={C.cyan} subtitle="proteggono le unghie"
          scrollHint
        />
        <ScrollRow>
          {allGrattatoriIds.map(id => {
            const g = GRATTATORE_DEFS[id];
            if (!g) return null;
            const isVip = id === "portaChiavi";
            const accent = rarityAccent(g.rarity, isVip);
            return (
              <ProductTile
                key={id}
                emoji={g.emoji}
                assetId={`item-${id}`}
                name={g.name}
                subtitle={`${g.maxUses === 99 ? "∞" : g.maxUses} usi`}
                cost={g.cost}
                accent={accent}
                canAfford={player.money >= g.cost}
                onClick={() => onBuyGrattatore(id)}
                tooltip={`${g.desc} · ${g.maxUses === 99 ? "∞" : g.maxUses} uso/i · Rarità: ${g.rarity}`}
                badgeLabel={accent.label}
                shimmer={g.rarity === "leggendaria" || g.rarity === "rarissimo" || isVip}
              />
            );
          })}
        </ScrollRow>

        {/* ═══ CONSUMABILI ═══ */}
        {allConsumabili.length > 0 && (
          <>
            <SectionHeader
              icon="💊" label="Consumabili" count={allConsumabili.length}
              accent={C.green} subtitle="cura · bluff · sotto-banco"
              scrollHint
            />
            <ScrollRow>
              {allConsumabili.map(id => {
                const item = ITEM_DEFS[id];
                if (!item) return null;
                const accent = rarityAccent(item.rarity);
                return (
                  <ProductTile
                    key={id}
                    emoji={item.emoji}
                    assetId={`item-${id}`}
                    name={item.name}
                    subtitle={accent.label}
                    cost={item.cost}
                    accent={accent}
                    canAfford={player.money >= item.cost}
                    onClick={() => onBuyItem(id)}
                    tooltip={`${item.desc} · Rarità: ${item.rarity}`}
                    shimmer={item.rarity === "leggendaria"}
                  />
                );
              })}
            </ScrollRow>
          </>
        )}

        {/* ═══ ZONA VIP ═══ */}
        {player.hasVIP && (vipItems.length > 0 || vipCards.length > 0) && (
          <>
            <SectionHeader
              icon="👑" label="Zona VIP" count={vipItems.length + vipCards.length}
              accent={C.gold} subtitle="accesso esclusivo — riservato"
              scrollHint
            />
            <div style={{
              padding: "8px 8px 2px",
              border: `1px dashed ${C.gold}66`,
              background: `linear-gradient(135deg, ${C.gold}08, transparent)`,
              boxShadow: `inset 0 0 20px ${C.gold}10`,
              marginBottom: "16px",
              position: "relative",
            }}>
              <ScrollRow bg="#030200">
                {vipCards.map(c => {
                  const accent = rarityAccent("leggendaria", true);
                  return (
                    <ProductTile
                      key={c.id}
                      emoji={c.emoji || "🎫"}
                      assetId={`card-${c.id}`}
                      name={c.name}
                      subtitle="VIP"
                      cost={c.cost}
                      maxPrize={c.maxPrize}
                      accent={accent}
                      canAfford={player.money >= c.cost}
                      onClick={() => onBuyCard(c.id)}
                      tooltip={`${c.desc} · Max €${c.maxPrize}`}
                      badgeLabel="VIP"
                      shimmer
                    />
                  );
                })}
                {vipItems.map(id => {
                  const item = ITEM_DEFS[id];
                  if (!item) return null;
                  const accent = rarityAccent("leggendaria", true);
                  return (
                    <ProductTile
                      key={id}
                      emoji={item.emoji}
                      name={item.name}
                      subtitle="VIP"
                      cost={item.cost}
                      accent={accent}
                      canAfford={player.money >= item.cost}
                      onClick={() => onBuyItem(id)}
                      tooltip={`${item.desc} · Rarità: ${item.rarity}`}
                      badgeLabel="VIP"
                      shimmer
                    />
                  );
                })}
              </ScrollRow>
            </div>
          </>
        )}

        {/* ═══ SLOT MACHINE ═══ */}
        <SectionHeader icon="🎰" label="Slot Machine" accent={C.magenta} subtitle="€1 a giro · tre 7️⃣ = €100" />
        <div style={{
          background: "#0a0010",
          border: `2px solid ${C.magenta}55`,
          boxShadow: `0 0 18px ${C.magenta}22, inset 0 0 22px ${C.magenta}10`,
          padding: "12px 14px 10px",
          marginBottom: "14px",
          position: "relative",
        }}>
          {/* Prize table */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "10px",
            fontSize: FS.xs, letterSpacing: "1px",
            marginBottom: "10px", color: C.dim,
            flexWrap: "wrap",
          }}>
            <span><span style={{color: C.gold, fontWeight: "bold"}}>7️⃣7️⃣7️⃣</span> = €100</span>
            <span style={{opacity: 0.5}}>·</span>
            <span><span style={{color: C.gold, fontWeight: "bold"}}>XXX</span> = €50</span>
            <span style={{opacity: 0.5}}>·</span>
            <span><span style={{color: C.green, fontWeight: "bold"}}>XX?</span> = €5</span>
          </div>

          {/* Reels */}
          <div style={{display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px"}}>
            {slotReels.map((sym, i) => {
              const isWinReel = !slotSpinning && slotResult && slotResult.type !== "lose";
              const isSuperJackpot = isWinReel && slotResult.type === "superjackpot";
              return (
                <div key={i} style={{
                  width: mobile ? "58px" : "64px",
                  height: mobile ? "58px" : "64px",
                  background: isWinReel ? `linear-gradient(135deg, ${C.gold}22, #0a0a18)` : "#0a0a18",
                  border: `3px solid ${
                    slotSpinning ? C.magenta :
                    isSuperJackpot ? C.gold :
                    isWinReel ? C.gold :
                    "#3a2a4a"
                  }`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: mobile ? "28px" : "34px",
                  boxShadow:
                    isSuperJackpot ? `0 0 22px ${C.gold}, inset 0 0 16px ${C.gold}55` :
                    isWinReel ? `0 0 14px ${C.gold}aa, inset 0 0 10px ${C.gold}33` :
                    slotSpinning ? `0 0 12px ${C.magenta}88, inset 0 0 8px ${C.magenta}33` :
                    `inset 0 0 8px #000`,
                  transition: "border-color 0.15s, box-shadow 0.25s",
                  animation: isSuperJackpot ? "variantPulse 0.8s ease-in-out infinite" : "none",
                }}>
                  {sym}
                </div>
              );
            })}
          </div>

          {/* Result */}
          {slotResult && (
            <div style={{
              textAlign: "center", marginBottom: "10px", minHeight: "18px",
              color: slotResult.type === "superjackpot" ? C.gold
                   : slotResult.type === "jackpot" ? C.gold
                   : slotResult.type === "small" ? C.green
                   : C.dim,
              fontSize: slotResult.type === "lose" ? "11px" : "14px",
              fontWeight: slotResult.type !== "lose" ? "bold" : "normal",
              letterSpacing: slotResult.type !== "lose" ? "1px" : "0",
              textShadow: slotResult.type === "superjackpot" ? `0 0 14px ${C.gold}` :
                          slotResult.type === "jackpot" ? `0 0 8px ${C.gold}88` : "none",
              animation: slotResult.type === "superjackpot" ? "variantPulse 0.6s ease-in-out infinite" : "none",
            }}>
              {slotResult.text}
            </div>
          )}

          {/* Lever */}
          <div style={{textAlign: "center"}}>
            <Btn
              onClick={spinSlot}
              disabled={slotSpinning || player.money < 1}
              variant={player.money >= 1 && !slotSpinning ? "gold" : "normal"}
              style={{
                fontSize: "13px", minWidth: "170px", letterSpacing: "2px",
                boxShadow: slotSpinning ? "none" : `0 0 10px ${C.gold}66`,
              }}>
              {slotSpinning ? "⠿ GIRANDO..." : "🎰 TIRA LA LEVA — €1"}
            </Btn>
          </div>

          {player.money < 1 && (
            <div style={{textAlign: "center", color: C.red, fontSize: "10px", marginTop: "8px", letterSpacing: "1px"}}>
              ⚠ SEI IN BOLLETTA — la slot ti guarda storto
            </div>
          )}
        </div>

        {/* ═══ IL BROKER — PRESTITO ═══ */}
        {!player.brokerLoan && player.money < 30 && (
          <div style={{
            border: `2px solid ${C.red}88`,
            background: `linear-gradient(135deg, #1a0000, #0a0005)`,
            boxShadow: `0 0 14px ${C.red}33, inset 0 0 18px ${C.red}14`,
            padding: "10px 12px",
            marginBottom: "14px",
            position: "relative",
            animation: ANIM.pulseAmbient,
          }}>
            <div style={{display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px"}}>
              <div style={{
                background: C.red, color: "#000",
                padding: "2px 8px", fontSize: FS.xs, fontWeight: "bold",
                letterSpacing: "2px",
                boxShadow: `0 0 8px ${C.red}aa`,
              }}>★ IL BROKER SUSSURRA ★</div>
              <div style={{color: C.red, fontSize: "10px", letterSpacing: "1px"}}>
                · usura al {Math.round((80-50)/50*100)}%
              </div>
            </div>
            <div style={{color: "#ffaaaa", fontSize: "11px", marginBottom: "8px", fontStyle: "italic", lineHeight: 1.4}}>
              ❝ Vedo che sei al verde, amico. Ti presto <strong style={{color: C.gold}}>€50</strong> ora… ma al boss mi ridai <strong style={{color: C.red}}>€80</strong>. Affare? ❞
            </div>
            <Btn variant="gold" onClick={() => onBuyItem("__brokerLoan__")} style={{fontSize: "11px"}}>
              💰 Accetta il prestito (€50 → €80)
            </Btn>
          </div>
        )}
        {player.brokerLoan && (
          <div style={{
            color: C.red, fontSize: "11px", fontWeight: "bold",
            padding: "6px 10px",
            border: `2px solid ${C.red}`, background: "#1a0000",
            marginBottom: "14px",
            letterSpacing: "1px",
            boxShadow: `0 0 10px ${C.red}55, inset 0 0 10px ${C.red}22`,
            animation: ANIM.pulseActive,
            textAlign: "center",
          }}>
            ⚠ DEBITO ATTIVO: €{player.brokerLoan} — da restituire al prossimo boss
          </div>
        )}

      </div>{/* fine scroll verticale */}

      {/* ═══ AZIONI STICKY ═══ */}
      <div style={{
        display: "flex", gap: "8px", alignItems: "center",
        borderTop: `1px solid ${C.gold}33`,
        padding: mobile ? "8px 10px" : "10px 12px",
        background: "linear-gradient(180deg, rgba(6,5,12,0.85), rgba(4,3,8,0.95))",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        flexShrink: 0,
        position: "sticky", bottom: 0, zIndex: 10,
      }}>
        {player.scratchCards.length > 0 && (
          <Btn onClick={onScratch} variant="gold" style={{flex: 1, textAlign:"center"}}>
            🎫 Gratta ({player.scratchCards.length})
          </Btn>
        )}
        {player.scratchCards.length === 0 && <div style={{flex:1}}/>}
        <Btn onClick={onLeave}>Esci →</Btn>
      </div>
    </div>
  );
}

// ─── ZAINO SEMPRE APERTO — fiancata desktop del tabaccaio ────
// Prima l'unico modo per equipaggiare/usare qualcosa mentre si è dal
// tabaccaio era aprire il pannello zaino a schermo intero (che copre anche
// il banco). Su desktop largo questa fiancata sta fissa a fianco: grattatori
// e consumabili sono selezionabili/usabili senza mai coprire il negozio.
function ZainoChip({ emoji, assetId, name, badge, badgeColor, active, onClick, tooltip }) {
  return (
    <Tooltip text={tooltip} color={C.cyan}>
      <Btn
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          width: "100%", justifyContent: "flex-start",
          background: active ? `${C.cyan}22` : "#0a0a18",
          border: `1px solid ${active ? C.cyan : "#333355"}`,
          color: active ? C.cyan : C.dim,
          padding: "4px 6px", fontSize: "10px", fontFamily: FONT,
          boxShadow: active ? `0 0 8px ${C.cyan}55` : "none",
          letterSpacing: "0.3px",
        }}
      >
        <span style={{ fontSize: "14px", flexShrink: 0, lineHeight: 1 }}>
          <Asset id={assetId} emoji={emoji} size={16} />
        </span>
        <span style={{
          flex: 1, minWidth: 0, textAlign: "left",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </span>
        {badge != null && (
          <span style={{
            flexShrink: 0, fontWeight: "bold", fontSize: "9px", padding: "0 4px",
            background: active ? C.cyan : (badgeColor || "#222244"),
            color: active ? "#000" : C.dim,
          }}>
            {badge}
          </span>
        )}
      </Btn>
    </Tooltip>
  );
}

export function ShopZainoRail({ player, onEquipGrattatore, onUseItem }) {
  const hasGrattatori = player.grattatori?.length > 0;
  const hasItems = player.items?.length > 0;
  return (
    <div style={{
      width: "230px", flexShrink: 0,
      alignSelf: "flex-start", position: "sticky", top: "10px",
      display: "flex", flexDirection: "column", gap: "2px",
      fontFamily: FONT,
      background: "linear-gradient(180deg, rgba(10,9,18,0.82) 0%, rgba(4,3,8,0.9) 100%)",
      backdropFilter: "blur(10px) saturate(1.3)",
      WebkitBackdropFilter: "blur(10px) saturate(1.3)",
      border: `2px solid ${C.gold}44`,
      boxShadow: `inset 0 0 26px rgba(0,0,0,0.6)`,
      maxHeight: "calc(100dvh - 40px)", overflowY: "auto",
    }}>
      <div style={{ textAlign: "center", padding: "8px 6px 6px", borderBottom: `1px solid ${C.gold}33` }}>
        <VintageBadge color={C.gold} size="md">🎒 ZAINO</VintageBadge>
      </div>

      {!hasGrattatori && !hasItems && (
        <div style={{ color: C.dim, fontSize: "11px", fontStyle: "italic", textAlign: "center", padding: "14px 10px" }}>
          Zaino vuoto — compra qualcosa dal banco.
        </div>
      )}

      {hasGrattatori && (
        <div style={{ padding: "8px 8px 4px" }}>
          <div style={{ color: C.dim, fontSize: "10px", letterSpacing: "2px", marginBottom: "5px" }}>
            ░ GRATTATORI ░
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {player.grattatori.map((g, idx) => {
              const def = GRATTATORE_DEFS[g.id];
              const isEquipped = player.equippedGrattatore?.inventoryIdx === idx;
              return (
                <ZainoChip
                  key={idx}
                  emoji={g.emoji} assetId={`item-${g.id}`} name={g.name}
                  badge={isEquipped ? "✓" : g.usesLeft}
                  active={isEquipped}
                  onClick={() => onEquipGrattatore?.(idx)}
                  tooltip={`${g.desc || def?.desc || ""} · ${g.usesLeft} uso/i`}
                />
              );
            })}
          </div>
        </div>
      )}

      {hasItems && (
        <div style={{ padding: "8px 8px 10px" }}>
          <div style={{ color: C.dim, fontSize: "10px", letterSpacing: "2px", marginBottom: "5px" }}>
            ░ CONSUMABILI ░
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {player.items.map((itemId, idx) => {
              const item = ITEM_DEFS[itemId];
              if (!item) return null;
              return (
                <ZainoChip
                  key={idx}
                  emoji={item.emoji} assetId={`item-${itemId}`} name={item.name}
                  active={false}
                  onClick={() => onUseItem?.(idx)}
                  tooltip={item.desc}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
