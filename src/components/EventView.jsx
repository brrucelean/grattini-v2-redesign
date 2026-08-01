import { useState, useEffect, useRef } from "react";
import { C, FONT } from "../data/theme.js";
import { NPC_ART, SPR_BIG, NPC_PALETTE, VECCHIO_DIALOGHI } from "../data/art.js";
import { MACELLAIO_IMPLANTS, GRATTATORE_DEFS } from "../data/items.js";
import { S } from "../utils/styles.js";
import { normalizePortrait } from "../utils/nail.js";
import { Asset } from "./Asset.jsx";
import { hasAsset } from "../assets/registry.js";
import { Tooltip } from "./Tooltip.jsx";

// ─── NPC CATEGORIES ─────────────────────────────────────────────
// Ogni tipo NPC ha categoria, icona e colore primario per UI
const NPC_CAT = {
  ladro:      { label:"NEMICO",     icon:"⚔️",  color:"#ff3355", danger:3 },
  miniboss:   { label:"SFIDA",      icon:"💀",  color:"#ff4400", danger:3 },
  poliziotto: { label:"AUTORITÀ",   icon:"🚔",  color:"#4488ff", danger:2 },
  spacciatore:{ label:"SOTTOBANCO", icon:"🤫",  color:"#ffaa00", danger:1 },
  bambino:    { label:"COLLEZIONISTA",icon:"🃏", color:"#ffcc00", danger:0 },
  mendicante: { label:"MERCANTE",   icon:"🧿",  color:"#aa88ff", danger:0 },
  chirurgo:   { label:"CHIRURGO",   icon:"💉",  color:"#00cccc", danger:1 },
  macellaio:  { label:"CHIRURGO",   icon:"🔪",  color:"#ff6600", danger:2 },
  anziana:    { label:"GUARITRICE", icon:"✨",  color:"#ff9ec4", danger:0 },
  sacerdote:  { label:"SACERDOTE",  icon:"⛪",  color:"#ffdd66", danger:0 },
  stregone:   { label:"STREGONE",   icon:"🧙",  color:"#4aa8ff", danger:1 },
  maestroTe:  { label:"MAESTRO",    icon:"🍵",  color:"#66dd88", danger:0 },
  streamer:   { label:"STREAMER",   icon:"📱",  color:"#ff44aa", danger:0 },
  guantaio:   { label:"ARTIGIANO",  icon:"🧤",  color:"#88ccff", danger:0 },
  evento:     { label:"EVENTO",     icon:"✦",   color:"#ff9ec4", danger:0 },
  zaino:      { label:"OGGETTO",    icon:"🎒",  color:"#888899", danger:0 },
};

// ─── ACTION META — icona + badge + colore per ogni tipo di scelta ─
function actionMeta(action, label) {
  const a = action || "";
  const l = label  || "";
  if (a === "fight" || a.includes("defy"))     return { icon:"⚔️",  badge:"COMBATTI",   col:"#ff3355" };
  if (a.includes("bribe"))                     return { icon:"🕊️",  badge:"CALMA",       col:"#66dd88" };
  if (a.includes("flee") || a.includes("fintotonto")) return { icon:"🏃",  badge:"SCAPPA",     col:"#ff8800" };
  if (a === "leave")                           return { icon:"🚪",  badge:"ESCI",        col:"#555566" };
  if (a.includes("Nail") || a.includes("nail")) return { icon:"🦴",  badge:"UNGHIA",      col:"#ff8800" };
  if (a.includes("baratto"))                   return { icon:"🤝",  badge:"BARATTO",     col:"#ffaa00" };
  if (a.includes("dona") || a.includes("dona"))return { icon:"🙏",  badge:"DONA",        col:"#66dd88" };
  if (a.includes("implant") || a.includes("macellaio")) return { icon:"🔧", badge:"IMPIANTO",  col:"#00cccc" };
  if (a.includes("cappello") || a === "useCappello") return { icon:"🎩", badge:"OGGETTO",   col:"#ffcc00" };
  if (a.includes("buy") || a.includes("Buy")
    || a.includes("compra") || a.includes("pagaMulta")
    || a.includes("te") || l.includes("€"))    return { icon:"💰",  badge:"ACQUISTO",    col:"#ffcc00" };
  if (a.includes("accept") || a.includes("porgi") || a.includes("tocca")) return { icon:"🎲", badge:"RISCHIO", col:"#ff9ec4" };
  if (a.includes("swap") || a.includes("Swap")) return { icon:"🔄", badge:"SCAMBIA",     col:"#88ccff" };
  if (a.includes("vendi") || a.includes("Vendi")) return { icon:"💸", badge:"VENDI",      col:"#66dd88" };
  if (a.includes("silentBypass"))              return { icon:"🎸",  badge:"SPECIALE",    col:"#ff44aa" };
  if (a.includes("snitch"))                    return { icon:"🕵️",  badge:"TRADIMENTO",  col:"#ff8800" };
  if (a.includes("lore") || a.includes("Lore")) return { icon:"📖", badge:"GRATIS",      col:"#888899" };
  return                                              { icon:"✓",   badge:"SCEGLI",      col:C.bright  };
}

// ─── COST EXTRACTOR — estrae €N da label per mostrarlo come badge ─
function extractCost(label) {
  const m = (label || "").match(/€(\d+)/);
  return m ? `€${m[1]}` : null;
}

// ─── CORNER BRACKETS ────────────────────────────────────────────
function cornerBrackets(color, size = 12, inset = -2, borderW = 2) {
  const base = { position:"absolute", width:`${size}px`, height:`${size}px`,
    borderColor: color, pointerEvents:"none",
    boxShadow: `0 0 5px ${color}55`,
  };
  return {
    tl: {...base, top:inset, left:inset, borderTop:`${borderW}px solid ${color}`, borderLeft:`${borderW}px solid ${color}`},
    tr: {...base, top:inset, right:inset, borderTop:`${borderW}px solid ${color}`, borderRight:`${borderW}px solid ${color}`},
    bl: {...base, bottom:inset, left:inset, borderBottom:`${borderW}px solid ${color}`, borderLeft:`${borderW}px solid ${color}`},
    br: {...base, bottom:inset, right:inset, borderBottom:`${borderW}px solid ${color}`, borderRight:`${borderW}px solid ${color}`},
  };
}

// ─── DANGER METER ───────────────────────────────────────────────
function DangerMeter({ level, color }) {
  if (!level) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          width:"10px", height:"6px",
          background: i <= level ? color : "#1a1a2a",
          boxShadow: i <= level ? `0 0 5px ${color}` : "none",
          transition: "all 0.2s",
        }}/>
      ))}
    </div>
  );
}

export function EventView({ node, player, onChoice }) {
  const eventoVariant = useRef((() => {
    const r = Math.random();
    if (r < 0.34) return "lettore";
    if (r < 0.67) return "moneta";
    return "voce";
  })());

  const events = {
    ladro: {
      title: "Ladro di Dita",
      art: NPC_ART.ladro,
      text: player.cappelloSbirroWorn
        ? "\"CAZZO UNO SBIRRO! Scusa capo, non ti avevo riconosciuto!\" 💨 Sparisce in un lampo."
        : "\"Fermo lì, bello. Le tue cose o le tue unghie — scegli in fretta, che ho fretta pure io.\"",
      choices: player.cappelloSbirroWorn
        ? [{ label: "🎩 Il cappello funziona! (si consuma)", action: "cappelloVsLadro" }]
        : [
            ...(player.equippedGrattatore?.silent ? [{ label: "🎸 Passa inosservato (silenzioso)", action: "silentBypass" }] : []),
            { label: "Combatti!", action: "fight" },
            { label: "Cedi un oggetto", action: "giveItem", condition: player.items.length > 0,
              disabledNote: "zaino vuoto" },
            { label: "Scappa! (50%)", action: "flee" },
          ],
    },
    spacciatore: (() => {
      if (player.snitchedOn) {
        return {
          title: "Lo Spacciatore — SA TUTTO",
          art: NPC_ART.spacciatore,
          text: "\"TU... TU SEI IL RATTO! Mi hai venduto ai gendarmi?! Ora ti strappo le unghie una a una.\"",
          choices: [
            { label: "⚔ Combatti! (ti ha scoperto)", action: "fight" },
            { label: "🏃 Prova a scappare (50%)", action: "flee" },
          ],
        };
      }
      // NPC volatile: già nervoso quando lo incontri (deciso in mappa).
      if (node.angry) {
        return {
          title: "Lo Spacciatore — NERVOSO",
          art: NPC_ART.spacciatore,
          text: "\"Chi sei?! Chi ti manda?! Stai zitto e allontanati, o qui finisce male...\" Ha una mano in tasca. Non sembra un bluff.",
          choices: [
            { label: `🕊️ Calmalo con €15`, action: "bribeSpacciatore",
              condition: player.money >= 15, disabledNote: `ti mancano €${Math.max(0,15-player.money)}`,
              tooltip: "Paghi, si tranquillizza, te ne vai senza problemi." },
            { label: "⚔ Affrontalo", action: "fight" },
            { label: "🏃 Scappa (60%)", action: "fleeAngry" },
          ],
        };
      }
      return {
        title: "Lo Spacciatore",
        art: NPC_ART.spacciatore,
        text: player.cappelloSbirroWorn
          ? "\"Psst... ho roba buo— CAZZO UNO SBIRRO!! AIUTOOOOO!\" 💨 Sparisce in tre secondi. Non lascia nemmeno la ricevuta."
          : player.bluffsBought > 0
            ? `"Rieccoti, fratello. L'ultima volta... vabbè, sfiga eh. Stavolta è ROBA VERA, parola. Fidati.${player.bluffsBought >= 2 ? " (Lo hai già sentito.)" : ""}"`
            : "\"Psst. Aspetta. Ho roba buona. Sigarette particolari, grattini con la vincita già dentro... fidati.\"",
        choices: player.cappelloSbirroWorn
          ? [{ label: "🎩 Correre fa bene, amico. (cappello si consuma)", action: "cappelloVsLadro" }]
          : [
              { label: `Sigaretta con Erba (€8)`, action: "buyHerb", condition: player.money >= 8,
                disabledNote: `ti mancano €${Math.max(0,8-player.money)}` },
              { label: `Gratta Contrabbando (€25)`, action: "buyContra", condition: player.money >= 25,
                disabledNote: `ti mancano €${Math.max(0,25-player.money)}` },
              { label: `🎫 Gratta VINCENTE GARANTITO (€15) — "fidati"`, action: "buyFalsoVincente",
                condition: player.money >= 15, disabledNote: `ti mancano €${Math.max(0,15-player.money)}`,
                tooltip: "Lo Spacciatore giura che vince. Qualcosa ti dice di non fidarti al 100%." },
              { label: "No grazie", action: "leave" },
            ],
      };
    })(),
    chirurgo: {
      title: "Il Chirurgo Oscuro",
      art: NPC_ART.chirurgo,
      text: "\"Le unghie sono la finestra dell'anima... e le tue fanno schifo. Posso sistemarle. Intervento rapido, dolore relativo.\"",
      choices: [
        { label: "Unghia di Plastica (€10)", action: "implant_plastica", condition: player.money >= 10,
          disabledNote: `ti mancano €${Math.max(0,10-player.money)}` },
        { label: "Unghia di Ferro (€25)", action: "implant_ferro", condition: player.money >= 25,
          disabledNote: `ti mancano €${Math.max(0,25-player.money)}` },
        { label: "Unghia d'Oro (€50)", action: "implant_oro", condition: player.money >= 50,
          disabledNote: `ti mancano €${Math.max(0,50-player.money)}` },
        { label: "Vattene!", action: "leave" },
      ],
    },
    mendicante: {
      title: "Mendicante Mistico",
      art: NPC_ART.mendicante,
      text: player.money < 5
        ? "\"I soldi non ti servono per avere ciò che ti serve. Le unghie parlano, figliolo... e le tue mi dicono molto.\""
        : "\"Ho attraversato tre mercatini delle pulci e un sogno profetico per trovare questi grattatori. Ora sono tuoi — se li meriti.\"",
      choices: [
        { label: `🔘 Bottone Magico (€5)`, action: "buyGrat_bottone", condition: player.money >= 5,
          disabledNote: `ti mancano €${Math.max(0,5-player.money)}`, tooltip: GRATTATORE_DEFS.bottone.desc },
        { label: `🔩 Bullone Sacro (€7)`, action: "buyGrat_bullone", condition: player.money >= 7,
          disabledNote: `ti mancano €${Math.max(0,7-player.money)}`, tooltip: GRATTATORE_DEFS.bullone.desc },
        { label: `💿 Disco Rotto (€18)`, action: "buyGrat_discoRotto", condition: player.money >= 18,
          disabledNote: `ti mancano €${Math.max(0,18-player.money)}`, tooltip: GRATTATORE_DEFS.discoRotto.desc },
        { label: `🦴 Offri 1 unghia → Bottone Magico gratis`, action: "barattoGrat_bottone",
          condition: player.nails.filter(n => n.state !== "morta").length > 1,
          disabledNote: "non hai unghie da offrire", tooltip: GRATTATORE_DEFS.bottone.desc },
        { label: "Non mi interessa", action: "leave" },
      ],
    },
    zaino: {
      title: "Zaino Abbandonato",
      art: NPC_ART.zaino,
      text: "\"...\" Lo zaino non parla. Ma qualcosa dentro si muove. Forse. Lo apri?",
      choices: [
        { label: "Apri lo zaino!", action: "openBag" },
        { label: "Lascialo stare", action: "leave" },
      ],
    },
    evento: (() => {
      const visits = player.vecchioVisits || 0;
      if (visits < 3 && node._isVecchio) {
        const d = VECCHIO_DIALOGHI[visits];
        return { ...d, art: NPC_ART.vecchio, _isVecchio: true };
      }
      const v = eventoVariant.current;
      const TESTI = {
        lettore: "\"Le unghie non mentono, ragazzo. Le tue... vedo cose. Grandi o terribili, non so ancora.\"",
        moneta:  "\"Ehi! Quella moneta è mia! ...no aspetta, è tua. Forse. Raccoglila e vedi cosa succede.\"",
        voce:    "\"...mi senti? Sono qui. Non girартiʼ — ascolta e basta.\"",
      };
      const SCELTE = {
        lettore: [
          { label: "⭐ Accetta la lettura (gratis) — rischio/ricompensa casuale", action: "acceptEvent" },
          { label: `💰 Paga €10 per una lettura certa — +FORTUNA garantita`, action: "acceptEventPaid",
            condition: player.money >= 10, disabledNote: `ti mancano €${Math.max(0,10-player.money)}` },
          { label: `🦴 Offri un'unghia — il vecchio vuole qualcosa di vivo`, action: "acceptEventNail",
            condition: player.nails.filter(n=>n.state!=="morta").length > 1, disabledNote: "non hai unghie da offrire" },
          { label: "Ignoralo e vai", action: "leave" },
        ],
        moneta: [
          { label: "🪙 Raccoglila e affidati al caso — portafortuna o maledizione?", action: "acceptEvent" },
          { label: `💰 Paghi €10 a un passante per farla "leggere" — +FORTUNA garantita`, action: "acceptEventPaid",
            condition: player.money >= 10, disabledNote: `ti mancano €${Math.max(0,10-player.money)}` },
          { label: `🦴 Scambia la moneta con un'unghia — rituale misterioso`, action: "acceptEventNail",
            condition: player.nails.filter(n=>n.state!=="morta").length > 1, disabledNote: "non hai unghie da offrire" },
          { label: "Lasciala per terra", action: "leave" },
        ],
        voce: [
          { label: "👂 Ascolta la voce — cosa vuole dirti?", action: "acceptEvent" },
          { label: `💰 Offri €10 nell'aria — "accetta il mio dono" (fortuna garantita)`, action: "acceptEventPaid",
            condition: player.money >= 10, disabledNote: `ti mancano €${Math.max(0,10-player.money)}` },
          { label: `🦴 Sacrifica un'unghia — la voce chiede sangue`, action: "acceptEventNail",
            condition: player.nails.filter(n=>n.state!=="morta").length > 1, disabledNote: "non hai unghie da offrire" },
          { label: "Ignora e scappa", action: "leave" },
        ],
      };
      return { title: "Evento Misterioso", art: NPC_ART.evento, text: TESTI[v], choices: SCELTE[v] };
    })(),
    miniboss: {
      title: "Mini Boss del Tabacchino",
      art: NPC_ART.miniboss,
      text: "\"Ehi tu! Pensavi di passare senza fermarti?! Sfidami a grattare — se sei così bravo. Chi vince si prende un'unghia dell'altro. Regole semplici.\"",
      choices: [
        { label: "⚔ Accetta la sfida!", action: "fight" },
        { label: "Rifiuta e scappa", action: "leave" },
      ],
    },
    poliziotto: node.angry ? {
      // NPC volatile: già sul piede di guerra quando lo incontri (deciso in mappa).
      title: "🚔 Poliziotto — SOSPETTOSO",
      art: NPC_ART.poliziotto,
      text: "\"Fermo lì! Ho ricevuto una segnalazione su di lei. Ho tutto il diritto di procedere come mi pare, e oggi non sono dell'umore giusto.\"",
      choices: [
        { label: "🎩 Mostra il Cappello Sbirro", action: "useCappello",
          condition: player.cappelloSbirroWorn, disabledNote: "non ce l'hai" },
        { label: `🕊️ Offrigli €25 "per il disturbo"`, action: "bribePoliziotto",
          condition: player.money >= 25, disabledNote: `ti mancano €${Math.max(0,25-player.money)}`,
          tooltip: "Paghi, si calma e ti lascia andare." },
        { label: "⚔ Sfidalo apertamente", action: "fight",
          tooltip: "Rischioso: è la legge, ma oggi hai poca scelta." },
        { label: "🏃 Prova a scappare (30%)", action: "fintotonto" },
      ],
    } : {
      title: "🚔 Poliziotto della Lotteria",
      art: NPC_ART.poliziotto,
      text: player.giornalettoRead
        ? "\"Ma che... COSA HA IN TASCA?! Un GIORNALETTO?! Atti osceni in luogo pubblico! Multa raddoppiata e che vergogna, a lei!\""
        : player.snitchedOn
        ? "\"Bravo, informatore. Ma non ti ho detto ancora basta. Documenti?\""
        : "\"Alt! Documenti! Cosa ci fa con tutti questi grattini? Lei non mi sembra un pensionato... né un tipo onesto.\"",
      choices: [
        { label: "🎩 Mostra il Cappello Sbirro", action: "useCappello",
          condition: player.cappelloSbirroWorn, disabledNote: "non ce l'hai" },
        { label: player.giornalettoRead ? "Paga la multa DOPPIA (€40)" : "Paga la multa (€20)",
          action: "pagaMulta",
          condition: player.money >= (player.giornalettoRead ? 40 : 20),
          disabledNote: `ti mancano €${Math.max(0,(player.giornalettoRead?40:20)-player.money)}` },
        { label: "🦴 Offri un'unghia invece di €20", action: "multaNail",
          condition: player.money < 20 && player.nails.filter(n=>n.state!=="morta").length > 1,
          disabledNote: "hai abbastanza € oppure non hai unghie" },
        { label: "🕵️ Fai la spia sullo spacciatore (+€30, addio sconti)", action: "snitchSpacciatore",
          condition: !player.snitchedOn, disabledNote: "già denunciato",
          tooltip: "Guadagni €30 + passi senza multa. Ma lo spacciatore ti vedrà come un ratto." },
        { label: "🏃 Prova a scappare (20%)", action: "fintotonto" },
        { label: "😤 Rifiuta e sfidalo apertamente", action: "defyPoliziotto",
          tooltip: "Niente multa, niente scuse. Vediamo come reagisce." },
        { label: "😰 Non ho i soldi... (manganellata)", action: "manganellata",
          condition: player.money < 20 && !player.cappelloSbirroWorn,
          disabledNote: "hai i soldi o il cappello" },
      ],
    },
    anziana: (() => {
      const visits = player.anzianaVisits || 0;
      const alive = player.nails.filter(n => n.state !== "morta").length;
      const allMax = player.nails.every(n => n.state === "sana" || n.state === "kawaii" || n.state === "piede");
      if (visits >= 3) {
        return {
          title: "👵 L'Anziana Maledetta",
          art: NPC_ART.anziana,
          text: "\"Ho dato. Ho guarito. Ho anche pianto un po'. Ora basta — le mie mani hanno un limite settimanale. Vattene!\"",
          choices: [{ label: "Ok nonna, scusa...", action: "leave" }],
        };
      }
      if (allMax) {
        return {
          title: "👵 L'Anziana Maledetta",
          art: NPC_ART.anziana,
          text: "\"Che belle mani... troppo belle. Fanno male solo a guardarle. NON È GIUSTO!\" *STRAPP* Ti strappa 2 unghie per gelosia morbosa!",
          choices: [{ label: "NOOOO NONNA!", action: "anzianaStrappaGelosia" }],
        };
      }
      if (alive <= 1) {
        return {
          title: "👵 L'Anziana Maledetta",
          art: NPC_ART.anziana,
          text: "\"Madonna santa... guarda in che stato. Vieni qui, figliolo.\" Ti mette in mano un'unghia tolta da chi sa dove. Non chiedi.",
          choices: [{ label: "Grazie nonnina 🥺", action: "anzianaRegala" }],
        };
      }
      return {
        title: "👵 L'Anziana Maledetta",
        art: NPC_ART.anziana,
        text: `\"Figliolo mio... avvicina quelle mani. Le unghie non mentono mai — e le tue hanno cose da raccontare.\" (Visita ${visits+1}/3)`,
        choices: [
          { label: "Porgi le mani", action: "anzianaTocca" },
          { label: "🙏 Chiedi la benedizione dell'Unghia Sacra (€40)",
            action: "anzianaSacra",
            condition: !player.anzianaSacraGiven && player.money >= 40 && player.nails.some(n => n.state !== "morta"),
            disabledNote: !player.anzianaSacraGiven ? `ti mancano €${Math.max(0,40-player.money)}` : "già ricevuta",
            tooltip: "Una volta per run. Impianto sacro sull'unghia attiva: prossima grattata = vincita x3 GARANTITA." },
          { label: "No grazie nonna", action: "leave" },
        ],
      };
    })(),
    sacerdote: {
      title: "⛪ Il Sacerdote della Fortuna",
      art: NPC_ART.sacerdote,
      text: "\"Figliolo... la Provvidenza sorride a chi dona senza calcolo. Ogni centesimo che offri torna moltiplicato — in modi che la matematica non spiega.\"",
      choices: [
        { label: "Dona €5 — Fortuna +1 per 3 turni", action: "dona5",
          condition: player.money >= 5, disabledNote: `ti mancano €${Math.max(0,5-player.money)}` },
        { label: "Dona €15 — Fortuna +2 per 5 turni", action: "dona15",
          condition: player.money >= 15, disabledNote: `ti mancano €${Math.max(0,15-player.money)}` },
        { label: "Dona €30 — Fortuna +3 per 8 turni", action: "dona30",
          condition: player.money >= 30, disabledNote: `ti mancano €${Math.max(0,30-player.money)}` },
        { label: "Non sono credente", action: "leave" },
      ],
    },
    bambino: (() => {
      const TIER_PRICE = { 1:3, 2:10, 3:25, 4:65 };
      const grattedCards = player.grattedCards || [];
      const hasGrattate = grattedCards.length > 0;
      const totalValue = grattedCards.reduce((sum, c) => {
        const base = TIER_PRICE[c.tier] || 3;
        return sum + (c.isWinner ? base * 2 : base);
      }, 0);
      return {
        title: "👦 Il Bambino Collezionista",
        art: NPC_ART.bambino,
        text: hasGrattate
          ? `"OHHH! Quelli già grattati valgono ORO per me! ${grattedCards.length} pezzi — circa €${totalValue}. Hai idea di quanto siano rari questi?!"`
          : player.scratchCards.length > 0
            ? '"Psst! Ho grattini di SERIE LIMITATA — fuori produzione da anni. Scambiamo? Dai dai dai!"'
            : '"Niente grattini? Niente affare. Torna quando hai qualcosa di interessante, uffa."',
        choices: [
          ...(hasGrattate ? [
            { label: `💰 Vendi tutti i grattini usati (~€${totalValue})`, action: "bambinoVendiTutte" },
            { label: `💰 Vendi "${grattedCards[0]?.name}" (1 carta)`, action: "bambinoVendiUna" },
          ] : []),
          ...(player.scratchCards.length > 0 ? [
            { label: "🔄 Scambia 1 grattino → 1 grattino raro", action: "bambinoSwap1" },
            { label: "🔄 Scambia 2 grattini → 1 LEGGENDARIO", action: "bambinoSwap2",
              condition: player.scratchCards.length >= 2, disabledNote: "ti serve almeno un altro grattino" },
          ] : []),
          { label: "💰 Compra grattino raro (€30)", action: "bambinoBuy",
            condition: player.money >= 30, disabledNote: `ti mancano €${Math.max(0,30-player.money)}` },
          { label: !hasGrattate && player.scratchCards.length === 0 ? "Ciao piccolo, torno dopo" : "No grazie piccolo", action: "leave" },
        ],
      };
    })(),
    streamer: (() => {
      const cards = player.scratchCards || [];
      return {
        title: "📱 Streamer Scratch",
        art: NPC_ART.streamer,
        text: cards.length > 0
          ? "\"OHH GUYS!! Questo tizio sta per GRATTARE IN LIVE!! 🔴 Chat impazzisce! Scegli una carta — se vinci è x1.5 e diventiamo VIRALI!\""
          : "\"Volevo fare un video ma non hai nemmeno UN grattino?! 😤 Content zero. Boring. Vattene prima che mi fai perdere follower.\"",
        choices: [
          ...(cards.length > 0 ? cards.map((c, i) => ({
            label: `📱 Gratta "${c.name}" (€${c.cost}) in live`,
            action: `streamerLive_${i}`,
          })) : []),
          { label: "❌ Rifiuta — preferisco la privacy", action: "streamerSkip" },
        ],
      };
    })(),
    macellaio: (() => {
      const alive = player.nails.filter(n => n.state !== "morta");
      const activeNailObj = player.nails[player.activeNail];
      const hasImplant = activeNailObj?.implant && MACELLAIO_IMPLANTS.some(x => x.id === activeNailObj.implant);
      return {
        title: "🔪 Il Chirurgo Macellaio",
        art: NPC_ART.macellaio,
        text: alive.length === 0
          ? '"Niente da operare. Anzi, non so neanche come sei ancora vivo. Vattene."'
          : hasImplant
          ? '"Mani già operative. Non tocco il lavoro altrui — codice deontologico. O almeno quello che ne rimane."'
          : '"Impianti d\'ultima generazione. Non chiedere la laurea — chiediti se puoi permetterti di NON farlo. ⚠️ 25% chance di... complicazioni."',
        choices: alive.length === 0 || hasImplant
          ? [{ label: "Capito... arrivederci", action: "leave" }]
          : [
            ...MACELLAIO_IMPLANTS.map(impl => ({
              label: `${impl.emoji} ${impl.name} (€${impl.cost}) — ${impl.rarity}`,
              action: `macellaio_${impl.id}`,
              condition: player.money >= impl.cost,
              disabledNote: `ti mancano €${Math.max(0,impl.cost-player.money)}`,
              tooltip: impl.desc + " · ⚠️ 25% fallimento → unghia morta!",
            })),
            { label: "Troppo rischioso, scappo", action: "leave" },
          ],
      };
    })(),
    stregone: {
      title: "🧙 Lo Stregone della Doppia Mano",
      art: NPC_ART.stregone,
      text: player.skills?.includes("ambidestri")
        ? (player.nails?.some(n => n.state === "piede")
          ? "\"Vedo che hai trovato IL PIEDE... 🦶 Non lavartelo MAI. Il suo potere è nel disgusto.\""
          : "\"Già conosci il segreto delle mani... 🙌 Ma conosci quello dei PIEDI? Per €100 ti rivelo l'unghia più disgustosa — e più potente — che esista.\"")
        : "\"Psst... ti vedo. Hai il dono grezzo. Posso risvegliarti la mano sinistra... 5 dita in più con cui grattare. Certo, partiranno graffiata — non sono allenate come la destra. Il mio prezzo è €200.\"",
      choices: player.skills?.includes("ambidestri")
        ? (player.nails?.some(n => n.state === "piede")
          ? [{ label: "Grazie maestro 🙏", action: "leave" }]
          : [
            { label: "🦶 L'Unghia del Piede (€100)", action: "unghiaPiede",
              condition: player.money >= 100, disabledNote: `ti mancano €${Math.max(0,100-player.money)}` },
            { label: "No grazie, passo", action: "leave" },
          ])
        : [
          { label: "🙌 Impara la Doppia Mano (€200)", action: "learnAmbidestri",
            condition: player.money >= 200, disabledNote: `ti mancano €${Math.max(0,200-player.money)}` },
          { label: "Troppo caro, addio", action: "leave" },
        ],
    },
    maestroTe: {
      title: "🍵 Il Maestro del Tè",
      art: `  ╭──╮\n  │茶│\n  │~ │\n  ╰┬─╯\n  /│\\\n   🍵`,
      text: "\"欢迎, benvenuto. Il tè cura il corpo e l'anima. Scegli la tua miscela — ogni tazza ha un prezzo e un destino.\"",
      choices: [
        { label: "🍵 Tè Verde (€5) — Cura 1 unghia + Fortuna +1", action: "teVerde",
          condition: player.money >= 5, disabledNote: `ti mancano €${Math.max(0,5-player.money)}` },
        { label: "🍵 Tè del Drago (€15) — Cura 2 unghie + Fortuna +2 per 5 turni", action: "teDrago",
          condition: player.money >= 15, disabledNote: `ti mancano €${Math.max(0,15-player.money)}` },
        { label: "🍵 Tè d'Oro Imperiale (€40) — Cura TUTTE + smalto su unghia attiva", action: "teOro",
          condition: player.money >= 40, disabledNote: `ti mancano €${Math.max(0,40-player.money)}` },
        { label: "🐲 Parlami del Drago (gratis)", action: "dragoLore" },
        { label: "Non ho sete, grazie", action: "leave" },
      ],
    },
    guantaio: (() => {
      const hasGuanto = (player.grattatori || []).some(g => g.id === "guantoBoss");
      return {
        title: "🧤 Il Guantaio",
        text: hasGuanto
          ? "\"Hai già il mio pezzo migliore. Usalo bene contro il boss — non ne faccio altri fino al prossimo bioma.\""
          : "\"Signore... le mani sono strumenti. E gli strumenti vanno protetti. Ho un pezzo raro — il GUANTO DA BOSS. Fatto con pelle di unghia marcia ingrassata. SOLO CONTRO IL BOSS: copre TUTTE le dita per l'intera fight. A fine battaglia si sgretola — e tu passi al bioma successivo.\"",
        choices: hasGuanto
          ? [{ label: "Grazie, torno dopo aver grattato", action: "leave" }]
          : [
              { label: "🧤 Compra il Guanto da BOSS (€60)", action: "buyGuantoBoss",
                condition: player.money >= 60, disabledNote: `ti mancano €${Math.max(0,60-player.money)}`,
                tooltip: GRATTATORE_DEFS.guantoBoss.desc },
              { label: "🦴 Baratto: 1 unghia + €20 → Guanto da BOSS", action: "barattoGuantoBoss",
                condition: player.money >= 20 && player.nails.filter(n => n.state !== "morta").length > 1,
                disabledNote: "ti servono €20 e almeno 2 unghie vive" },
              { label: "Troppo caro, passo", action: "leave" },
            ],
      };
    })(),
  };

  const ev = events[node.type] || events.evento;
  const bigArt = SPR_BIG[node.type];
  const pal = NPC_PALETTE[node.type] || [C.text, C.dim, C.gold];
  const cat = NPC_CAT[node.type] || NPC_CAT.evento;
  // Colore principale: usa NPC_CAT se ben definito, altrimenti pal[0]
  const accent = cat.color;

  // Typing effect
  const [typedChars, setTypedChars] = useState(0);
  const fullText = ev.text;
  const typingDone = typedChars >= fullText.length;
  useEffect(() => { setTypedChars(0); }, [node.type]);
  useEffect(() => {
    if (typedChars >= fullText.length) return;
    const t = setTimeout(() => setTypedChars(c => c + 1), 20);
    return () => clearTimeout(t);
  }, [typedChars, fullText]);

  // Blink animation for portrait
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // Talk sound
  const talkSoundRef = useRef(null);
  useEffect(() => {
    if (typedChars >= fullText.length) return;
    if (typedChars % 2 !== 0) return;
    const ch = fullText[typedChars];
    if (ch === " " || ch === "\n") return;
    try {
      const ctx = talkSoundRef.current || new (window.AudioContext || window.webkitAudioContext)();
      talkSoundRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const basePitch = node.type === "mendicante" ? 140 : node.type === "spacciatore" ? 180
        : node.type === "bambino" ? 320 : node.type === "anziana" ? 160
        : node.type === "boss" ? 100 : 220;
      osc.frequency.value = basePitch + (ch.charCodeAt(0) % 8) * 15;
      osc.type = "square";
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }, [typedChars]);

  const cb = cornerBrackets(accent, 13, -3, 2);
  const cbInner = cornerBrackets(pal[1], 8, -2, 1);

  return (
    <div style={{
      maxWidth:"900px", margin:"10px auto",
      position:"relative",
      background:"#04040e",
      border:`2px solid ${accent}66`,
      boxShadow:`0 0 24px ${accent}22, inset 0 0 30px ${accent}06`,
    }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes evChoiceFadeIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes evPulse {
          0%,100% { opacity:1; } 50% { opacity:0.4; }
        }
      `}</style>

      {/* Corner brackets outer */}
      <span style={cb.tl}/><span style={cb.tr}/>
      <span style={cb.bl}/><span style={cb.br}/>

      {/* ── HEADER NPC ─────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", gap:"10px",
        padding:"10px 14px 8px",
        borderBottom:`1px solid ${accent}33`,
        background:`linear-gradient(180deg, ${accent}12 0%, transparent 100%)`,
        flexWrap:"nowrap",
      }}>
        {/* Categoria badge */}
        <div style={{
          flexShrink:0,
          background: accent, color:"#000",
          fontSize:"10px", fontWeight:"bold", letterSpacing:"2px",
          padding:"3px 8px", fontFamily:FONT,
          boxShadow:`0 0 8px ${accent}88`,
          whiteSpace:"nowrap",
        }}>
          {cat.icon} {cat.label}
        </div>

        {/* Titolo NPC */}
        <div style={{
          flex:1, minWidth:0,
          color:accent, fontFamily:FONT, fontWeight:"bold",
          fontSize:"13px", letterSpacing:"1px", lineHeight:"1.3",
          textShadow:`0 0 10px ${accent}88`,
          wordBreak:"break-word",
        }}>
          {ev.title}
        </div>

        {/* Danger meter */}
        {cat.danger > 0 && (
          <div style={{flexShrink:0, display:"flex", alignItems:"center", gap:"5px"}}>
            <span style={{fontSize:"10px", color:"#ff4444", letterSpacing:"1px", fontFamily:FONT, opacity:0.7}}>
              PERICOLO
            </span>
            <DangerMeter level={cat.danger} color="#ff3355"/>
          </div>
        )}
      </div>

      {/* ── BODY — portrait + dialogue ─────────────────────────── */}
      <div style={{
        display:"flex", gap:"0",
        alignItems:"stretch",
      }}>

        {/* ── PORTRAIT COLUMN ──────────────────────────────────── */}
        {bigArt && (
          <div style={{
            flexShrink:0, width:"120px",
            borderRight:`1px solid ${accent}22`,
            background:`linear-gradient(180deg, ${accent}08 0%, transparent 100%)`,
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            padding:"12px 6px 10px",
            gap:"6px",
          }}>
            <div style={{position:"relative", width:"100%"}}>
              <span style={cornerBrackets(accent+"88", 7, -2, 1).tl}/>
              <span style={cornerBrackets(accent+"88", 7, -2, 1).tr}/>
              <span style={cornerBrackets(accent+"88", 7, -2, 1).bl}/>
              <span style={cornerBrackets(accent+"88", 7, -2, 1).br}/>
              {hasAsset(`spr-${node.type}`) ? (
                <Asset id={`spr-${node.type}`} size={108}
                  style={{width:"100%", height:"auto", display:"block",
                    filter:`drop-shadow(0 0 6px ${accent}66)`}} />
              ) : (
                <pre style={{
                  color: accent+"cc", fontSize:"10px", lineHeight:"1.2",
                  margin:0, padding:"4px 2px",
                  fontFamily:FONT,
                  background:"#020208",
                  border:`1px solid ${accent}22`,
                  textShadow:`0 0 5px ${accent}44`,
                  overflow:"hidden",
                  maxHeight:"140px",
                }}>
                  {normalizePortrait(bigArt).map((line, i) => {
                    const t = blink && (i === 4 || i === 5) ? line.replace(/[•◕⊕∞☠><=;.]/g, "─") : line;
                    return <span key={i} style={{color:accent, textShadow:`0 0 4px ${accent}44`}}>{t}{"\n"}</span>;
                  })}
                </pre>
              )}
            </div>
            {/* NPC name plate */}
            <div style={{
              width:"100%", textAlign:"center",
              background: `${accent}22`,
              border:`1px solid ${accent}44`,
              padding:"2px 4px",
              color:accent, fontSize:"10px", fontFamily:FONT,
              letterSpacing:"1px", fontWeight:"bold",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              {ev.title.replace(/[👵🚔⛪📱🧙🔪🎩]/gu,"").trim()}
            </div>
          </div>
        )}

        {/* ── DIALOGUE + CHOICES ───────────────────────────────── */}
        <div style={{flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"0"}}>

          {/* Dialogue bubble */}
          <div style={{
            position:"relative",
            padding:"14px 16px 12px",
            borderBottom:`1px solid ${accent}22`,
            cursor:"pointer",
            minHeight:"80px",
            background:`linear-gradient(180deg, ${pal[1]}06 0%, transparent 60%)`,
          }}
          onClick={() => { if (!typingDone) setTypedChars(fullText.length); }}
          >
            <span style={cbInner.tl}/><span style={cbInner.tr}/>

            {/* Quote open */}
            <div style={{color:pal[1], fontSize:"18px", lineHeight:"0.7", opacity:0.6, marginBottom:"4px"}}>❝</div>

            {/* Typed text */}
            <div style={{
              color:"#e8e8e8", fontSize:"13px", lineHeight:"1.8",
              fontStyle:"italic", minHeight:"32px",
            }}>
              {fullText.slice(0, typedChars)}
              {!typingDone && (
                <span style={{color:accent, animation:"evPulse 0.5s step-start infinite", marginLeft:"1px"}}>▌</span>
              )}
            </div>

            {typingDone && (
              <div style={{color:pal[1], fontSize:"18px", lineHeight:"0.7", opacity:0.6, textAlign:"right", marginTop:"4px"}}>❞</div>
            )}

            {!typingDone && (
              <div style={{
                position:"absolute", bottom:"6px", right:"10px",
                color:C.dim, fontSize:"10px", letterSpacing:"1px", fontFamily:FONT,
              }}>tocca per saltare →</div>
            )}
          </div>

          {/* ── CHOICES ─────────────────────────────────────────── */}
          {typingDone && (
            <div style={{padding:"8px 10px 10px", display:"flex", flexDirection:"column", gap:"5px"}}>
              {/* Section label */}
              <div style={{
                fontSize:"10px", color:accent+"99", letterSpacing:"2.5px",
                fontFamily:FONT, marginBottom:"3px",
                display:"flex", alignItems:"center", gap:"6px",
              }}>
                <div style={{flex:1, height:"1px", background:`${accent}33`}}/>
                SCEGLI
                <div style={{flex:1, height:"1px", background:`${accent}33`}}/>
              </div>

              {ev.choices.map((ch, i) => {
                const isDisabled = ch.condition === false;
                const meta = actionMeta(ch.action, ch.label);
                const cost = extractCost(ch.label);
                const badgeText = cost || meta.badge;
                const badgeCol = isDisabled ? "#333344" : meta.col;

                return (
                  <Tooltip key={i} text={ch.tooltip || (isDisabled && ch.disabledNote ? `⛔ ${ch.disabledNote}` : "")}>
                    <div
                      onClick={() => !isDisabled && onChoice(ch.action)}
                      style={{
                        display:"flex", alignItems:"center", gap:"8px",
                        padding:"10px 10px",
                        background: isDisabled
                          ? "#07070d"
                          : `${meta.col}08`,
                        border:`1px solid ${isDisabled ? "#1a1a28" : meta.col + "44"}`,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.55 : 1,
                        transition:"transform 0.1s, background 0.15s, border-color 0.15s",
                        userSelect:"none",
                        animation:`evChoiceFadeIn 0.25s ${i * 0.06}s both ease-out`,
                        minHeight:"44px", // Apple HIG tap target
                      }}
                      onMouseEnter={e => {
                        if (!isDisabled) {
                          e.currentTarget.style.background = `${meta.col}18`;
                          e.currentTarget.style.borderColor = `${meta.col}88`;
                          e.currentTarget.style.transform = "translateX(2px)";
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isDisabled ? "#07070d" : `${meta.col}08`;
                        e.currentTarget.style.borderColor = isDisabled ? "#1a1a28" : `${meta.col}44`;
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                      onTouchStart={e => { if (!isDisabled) e.currentTarget.style.transform = "scale(0.98)"; }}
                      onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
                    >
                      {/* Indice */}
                      <span style={{
                        // 16px bastavano a 7px di corpo; a 10px "[1]" ne occupa 18.
                        flexShrink:0, width:"22px",
                        color: isDisabled ? "#333" : badgeCol,
                        fontSize:"10px", fontFamily:FONT, fontWeight:"bold",
                        textAlign:"center", opacity:0.8,
                      }}>[{i+1}]</span>

                      {/* Testo scelta */}
                      <span style={{
                        flex:1, minWidth:0,
                        color: isDisabled ? "#444455" : "#d8d8e8",
                        fontSize:"12px", lineHeight:"1.4",
                      }}>
                        {ch.label}
                        {/* Disabled note inline */}
                        {isDisabled && ch.disabledNote && (
                          <span style={{
                            display:"block", fontSize:"10px",
                            color:"#555566", marginTop:"2px", fontStyle:"italic",
                          }}>
                            ⛔ {ch.disabledNote}
                          </span>
                        )}
                      </span>

                      {/* Badge costo/tipo */}
                      <div style={{
                        flexShrink:0,
                        background: isDisabled ? "#0a0a14" : `${badgeCol}18`,
                        border:`1px solid ${isDisabled ? "#222233" : badgeCol + "55"}`,
                        color: isDisabled ? "#333344" : badgeCol,
                        fontSize:"10px", fontWeight:"bold",
                        padding:"3px 7px", letterSpacing:"0.5px",
                        fontFamily:FONT, whiteSpace:"nowrap",
                        minWidth:"40px", textAlign:"center",
                      }}>
                        {badgeText}
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
