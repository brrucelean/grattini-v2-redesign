// ─── CONSUMABILI (usabili dall'inventario) ───────────────────
// global: true = effetto globale (va in inventario, non su unghia)
// nailEquip: true = equipaggiabile su un'unghia specifica
export const ITEM_DEFS = {
  cerotto:     { name:"Cerotto", desc:"Cura 1 unghia di 1 stato (scegli quale)", cost:3, rarity:"comune", emoji:"🩹", nailEquip:true },
  disinfettante:{ name:"Disinfettante", desc:"Cura 1 unghia di 2 stati (scegli quale)", cost:8, rarity:"comune", emoji:"💧", nailEquip:true },
  sigaretta:     { name:"Sigaretta", desc:"+1 Fortuna (4 turni). Dopo 3 grattate l'unghia attiva diventa 🖤 UNGHIA NERA (×0.4, rischio annullo)", cost:5, rarity:"comune", emoji:"🚬", global:true },
  sigarettaErba: { name:"Sigaretta con Erba", desc:"+2 Fortuna (4 turni) + cura unghia attiva. Dopo 4 grattate l'unghia attiva diventa 🌿 POLLICE VERDE (×2.5 premi)", cost:15, rarity:"media", emoji:"🌿", global:true },
  cremaRinforzante:{ name:"Crema Rinforzante", desc:"+1 HP bianco sull'unghia (assorbe 3 danni)", cost:10, rarity:"media", emoji:"🧴", nailEquip:true, cremaEquip:true },
  cappelloSbirro:{ name:"Cappello Sbirro", desc:"Ignora poliziotto 1 volta (attira ladri e spacciatori!)", cost:15, rarity:"rara", emoji:"🎩", global:true },
  sieroRicrescita:{ name:"Siero Ricrescita", desc:"Ricresce 1 unghia morta → Sana", cost:25, rarity:"rara", emoji:"💉", nailEquip:true },

  smalto:      { name:"Smalto", desc:"1 unghia → KAWAII (x2 premio) + protegge da 3 danni", cost:25, rarity:"rara", emoji:"💅", nailEquip:true },
  timbroVincente:{ name:"Timbro VINCENTE", desc:"Timbra VINCENTI tutti i grattini in tasca!", cost:0, rarity:"rarissimo", emoji:"🏆", global:true },
  clipVirale:  { name:"Clip Virale", desc:"La prossima vincita viene RIPRESA! Vincita x2!", cost:0, rarity:"rara", emoji:"🎬", global:true },
  manoProtesica:{ name:"Mano Protesica", desc:"Cura TUTTE le unghie vive → Sane", cost:100, rarity:"rara", emoji:"🦾", global:true },
  tesseraVIP:  { name:"Tessera VIP", desc:"Sblocca zona VIP nel tabaccaio", cost:30, rarity:"rara", emoji:"🎫", global:true },
  // Sprint 5: item retro — "rivista scandalosa" da sottobanco del tabaccaio
  giornalettoPorno:{ name:"Giornaletto", desc:"Rivista scandalosa dai primi anni '90. +3 Fortuna per 6 grattate. Attenzione: se un Poliziotto ti becca con questo... figuraccia + €15 di multa.", cost:15, rarity:"media", emoji:"📖", global:true },
};

// ─── IMPIANTI CHIRURGO MACELLAIO ────────────────────────────
// Unghie "recuperate" da clienti precedenti. Vincita garantita,
// ma si sacrificano dopo gli usi.
export const MACELLAIO_IMPLANTS = [
  { id:"neonato", name:"Unghia Neonato", emoji:"👶", cost:20,
    desc:"1 grattata: VINCITA GARANTITA al 50% del premio. Dopo, l'unghia muore.",
    rarity:"rara", uses:1, prizeMult:0.5, guaranteedWin:true, onExhaust:"morta" },
  { id:"marcione", name:"Unghia Marcia", emoji:"🧟", cost:15,
    desc:"2 grattate: VINCITA GARANTITA al 50% del premio. Dopo, l'unghia muore.",
    rarity:"media", uses:2, prizeMult:0.5, guaranteedWin:true, onExhaust:"morta" },
  { id:"baddie", name:"Unghia da Baddie", emoji:"💋", cost:60,
    desc:"9 grattate al 100% del premio. I ladri se ne INNAMORANO — non ti rubano più nulla. Poi l'unghia muore.",
    rarity:"epica", uses:9, prizeMult:1.0, thiefImmune:true, onExhaust:"morta" },
];

// ─── IMPIANTI SACRI (Anziana Maledetta) ──────────────────────
export const ANZIANA_IMPLANTS = [
  { id:"sacra", name:"Unghia Sacra", emoji:"✨", cost:40,
    desc:"1 grattata: vincita × 3 GARANTITA. Poi l'unghia torna Sana.",
    rarity:"rarissima", uses:1, prizeMult:3.0, guaranteedWin:true, onExhaust:"sana" },
];

// ─── IMPIANTI CHIRURGO OSCURO (già esistenti) ────────────────
// Unghie artificiali: NON sanguinano, non degradano. Hanno slot fissi;
// a esaurimento slot l'unghia si spezza (muore).
export const CHIRURGO_OSCURO_IMPLANTS = [
  { id:"plastica", name:"Unghia di Plastica", emoji:"🧪", cost:6, desc:"3 grattate al 50% del premio. Non sanguina.", rarity:"comune", uses:3, prizeMult:0.5 },
  { id:"ferro",    name:"Unghia di Ferro",    emoji:"⚙️", cost:25, desc:"4 grattate al 100% del premio. Non sanguina. Attira ladri.", rarity:"media", uses:4, prizeMult:1.0 },
  { id:"oro",      name:"Unghia d'Oro",       emoji:"🥇", cost:50, desc:"5 grattate al 150% del premio. Non sanguina. ALTO PERICOLO LADRI.", rarity:"rara", uses:5, prizeMult:1.5 },
];

// Set di id degli impianti "artificiali" del chirurgo — non sanguinano,
// hanno slot fissi e si spezzano a esaurimento.
export const CHIRURGO_IMPLANT_IDS = new Set(["plastica", "ferro", "oro"]);

// Meta unificata per il lookup nel sidebar/tooltip
export const ALL_IMPLANTS_META = [
  ...MACELLAIO_IMPLANTS, ...ANZIANA_IMPLANTS, ...CHIRURGO_OSCURO_IMPLANTS,
];

// ─── RELIQUIE (persistenti per tutta la run) ─────────────────
// Si trovano come loot raro. Non si consumano. Effetto passivo permanente.
export const RELIC_DEFS = {
  malocchio:    { name:"Malocchio",        emoji:"🧿", desc:"Le trappole 🔥 diventano Jolly ✨", effect:"trapToJolly",   rarity:"rara" },
  cornetto:     { name:"Cornetto Rosso",   emoji:"🌶️", desc:"La Fortuna non scende mai sotto 1",  effect:"minFortune1",   rarity:"rara" },
  manekiNeko:   { name:"Maneki Neko",      emoji:"🐱", desc:"+10% chance vincita su TUTTE le carte", effect:"globalWinBoost", rarity:"epica" },
  occhioTigre:  { name:"Occhio di Tigre",  emoji:"🐯", desc:"Primo danno assorbito gratis per ogni nuovo nodo", effect:"firstHitShield", rarity:"epica" },
  dadoTruccato: { name:"Dado Truccato",    emoji:"🎲", desc:"Doppio o Nulla diventa 65/35 (non 50/50)", effect:"riggedDice",    rarity:"rara" },
};

// ─── GRATTATORI (equipaggiabili al posto dell'unghia) ────────
// Si usano AL POSTO dell'unghia per grattare. Proteggono le unghie
// e danno effetti speciali. Ogni grattatore ha N usi (biglietti).
export const GRATTATORE_DEFS = {
  bottone:        { name:"Bottone", desc:"+20% premio su 1 grattata", cost:5, rarity:"comune", emoji:"🔘",
                    effect:"bonusChance", value:0.2, maxUses:1 },
  bullone:        { name:"Bullone", desc:"80% chance di ignorare il malus del grattino (1 uso)", cost:7, rarity:"comune", emoji:"🔩",
                    effect:"ignoreMalus", maxUses:1 },
  unghiaFinta:    { name:"Unghia Finta", desc:"Protegge l'unghia per 3 grattate (niente danni)", cost:10, rarity:"media", emoji:"💅",
                    effect:"protectNail", maxUses:3 },
  plettro:        { name:"Plettro", desc:"x2 premio + silenzioso (ladri non ti vedono)", cost:35, rarity:"rara", emoji:"🎸",
                    effect:"doublePrize", maxUses:1, silent:true },
  moneta_argento: { name:"Moneta d'Argento", desc:"x2 premio per 2 grattate", cost:20, rarity:"rara", emoji:"🥈",
                    effect:"doublePrize", maxUses:2 },
  moneta_oro:     { name:"Moneta d'Oro", desc:"x4 premio sulla prossima grattata!", cost:55, rarity:"rara", emoji:"🥇",
                    effect:"quadPrize", maxUses:1 },
  discoRotto:     { name:"Disco Rotto", desc:"Gratta 2 celle per click (1 uso)", cost:22, rarity:"rara", emoji:"💿",
                    effect:"doubleCell", maxUses:1 },
  chiaveOttone:   { name:"Chiave d'Ottone", desc:"Rivela 2 celle nascoste su grattini tier 3+ (1 uso)", cost:18, rarity:"rara", emoji:"🔑",
                    effect:"revealPath", maxUses:1 },
  portaChiavi:    { name:"Porta-Chiavi SCRATCH-LITE", desc:"Leggendario! Si rompe solo dopo 3 perdite consecutive", cost:2000, rarity:"rarissimo", emoji:"🔐",
                    effect:"portaChiavi", maxUses:99 },
  gettoneLavaggio:{ name:"Gettone Autolavaggio", desc:"Cura tutte le unghie + rimuove GrattaMania (1 uso)", cost:20, rarity:"rara", emoji:"🪙",
                    effect:"healAll", maxUses:1 },
  monetaCinese:   { name:"Moneta Cinese", desc:"x5 vincita ASSICURATA + teletrasporto in Cina! 🇨🇳 (1 uso)", cost:0, rarity:"rarissimo", emoji:"🀄",
                    effect:"x5teleport", maxUses:1 },
  guantoBoss:     { name:"Guanto da BOSS", desc:"SOLO BOSS: protegge TUTTE le dita per l'intera boss-fight (niente danni alle unghie). Si sgretola a fine fight → avanzi di bioma.", cost:0, rarity:"rarissimo", emoji:"🧤",
                    effect:"bossShield", maxUses:1, bossOnly:true },
};
