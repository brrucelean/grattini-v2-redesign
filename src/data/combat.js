// ─── COMBAT CARD HEIGHT ──────────────────────────────────────
export const COMBAT_CARD_H = 94;
export const CAT_EMOJI_MAP = { COMBATTIMENTO:"🗡️", DIFESA:"🛡", DENARO:"💰" };
export const CAT_BG = { COMBATTIMENTO:"#1a0005", DIFESA:"#00051a", DENARO:"#1a1000" };

// Pool carte base — usate dal giocatore
export const PLAYER_COMBAT_CELLS = {
  COMBATTIMENTO: [
    { name:"Strappa!",    desc:"TAGLIA un'unghia — morta istantanea! 💀",           effect:"damageNail",  emoji:"✂️" },
    { name:"Furto!",      desc:"Ruba €10 al nemico",                                effect:"stealMoney",  value:10, emoji:"💸" },
    { name:"Schiaffo!",   desc:"Degrada 1 stato unghia avversario 🩸",              effect:"lightDamage", emoji:"🖐" },
    // Tradeoff: alto rischio/ricompensa
    { name:"All-in!",     desc:"+€40 MA il nemico guadagna +€15 sicuri 🎲",         effect:"allIn",       value:40, cost:15, emoji:"🎰", tradeoff:true },
    { name:"Berserk!",    desc:"Strappa unghia nemico MA degrada la tua di 1 🩸",   effect:"berserk",     emoji:"💢", tradeoff:true },
  ],
  DIFESA: [
    { name:"Scudo!",      desc:"Blocca il prossimo attacco",                        effect:"block",       emoji:"🛡" },
    { name:"Schiva!",     desc:"Schiva tutto — nessun danno",                       effect:"dodge",       emoji:"💨" },
    { name:"Adrenalina!", desc:"Unghie danneggiate: cura 1. Sane: +€15.",           effect:"adrenaline",  value:15, emoji:"💉" },
    // Tradeoff: difesa costosa
    { name:"Fortezza!",   desc:"Blocca tutto MA perdi €20 per costruirla 🏰",       effect:"fortress",    cost:20, emoji:"🏰", tradeoff:true },
  ],
  DENARO: [
    { name:"+10€",        desc:"Guadagni €10",                                      effect:"money", value:10,  emoji:"💰" },
    { name:"+20€",        desc:"Guadagni €20",                                      effect:"money", value:20,  emoji:"💰" },
    { name:"+30€",        desc:"Guadagni €30",                                      effect:"money", value:30,  emoji:"💰" },
    { name:"+50€",        desc:"Guadagni €50",                                      effect:"money", value:50,  emoji:"💰" },
    // Grattino in omaggio — carta gratis trovata in combattimento
    { name:"Grattino!",   desc:"Trovi un grattino in omaggio! 🎫",                  effect:"freeCard",        emoji:"🎫" },
    // Tradeoff: jackpot con rischio
    { name:"Schedina!",   desc:"50% chance: +€60. 50%: −€15 🎟",                   effect:"gamble", value:60, cost:15, emoji:"🎟", tradeoff:true },
  ],
};

// Pool carte nemico — variano per tipo di nemico
export const ENEMY_COMBAT_POOLS = {
  "Ladro": {
    COMBATTIMENTO: [
      { name:"Borseggio",   effect:"stealMoney", value:20, emoji:"🖐" },
      { name:"Sgambetto",   effect:"lightDamage", emoji:"👟" },
      { name:"Coltellata",  effect:"stealMoney", value:35, emoji:"🔪" },
    ],
    DIFESA: [
      { name:"Scappa!",     effect:"dodge",  emoji:"🏃" },
      { name:"Si nasconde", effect:"block",  emoji:"🫥" },
    ],
    DENARO: [
      { name:"Refurtiva",   effect:"money", value:25, emoji:"💼" },
      { name:"Ricettazione",effect:"money", value:45, emoji:"📦" },
    ],
  },
  "Mini Boss": {
    COMBATTIMENTO: [
      { name:"Pugno",       effect:"lightDamage", emoji:"👊" },
      { name:"Strappa!",    effect:"damageNail",  emoji:"✂️" },
      { name:"Schiaccia",   effect:"lightDamage", emoji:"🦶" },
    ],
    DIFESA: [
      { name:"Corazza",     effect:"block",  emoji:"🛡" },
      { name:"Resistenza",  effect:"block",  emoji:"💪" },
    ],
    DENARO: [
      { name:"Bottino",     effect:"money", value:35, emoji:"💰" },
      { name:"Trofeo",      effect:"money", value:60, emoji:"🏆" },
    ],
  },
  "Sfidante": {
    COMBATTIMENTO: [
      { name:"Provocazione",effect:"lightDamage", emoji:"😤" },
      { name:"Schiaffo",    effect:"lightDamage", emoji:"🖐" },
    ],
    DIFESA: [
      { name:"Schiva",      effect:"dodge", emoji:"💨" },
      { name:"Parata",      effect:"block", emoji:"🛡" },
    ],
    DENARO: [
      { name:"+30€",        effect:"money", value:30, emoji:"💰" },
      { name:"+50€",        effect:"money", value:50, emoji:"💰" },
      { name:"+80€",        effect:"money", value:80, emoji:"💰" },
    ],
  },
  "Ladro Nascosto": {
    COMBATTIMENTO: [
      { name:"Imboscata",   effect:"damageNail",  emoji:"🗡" },
      { name:"Veleno",      effect:"lightDamage", emoji:"☠️" },
    ],
    DIFESA: [
      { name:"Sparisce",    effect:"dodge", emoji:"🫥" },
    ],
    DENARO: [
      { name:"Refurtiva",   effect:"money", value:30, emoji:"💼" },
      { name:"Contrabbando",effect:"money", value:55, emoji:"📦" },
    ],
  },
  "Il Broker": {
    // BILANCIAMENTO boss 1 (più accessibile): valori DENARO abbassati (era 40/80/120),
    // steal ridotti (erano 30/50). Il player deve poter vincere il primo boss.
    COMBATTIMENTO: [
      { name:"Commissione", effect:"stealMoney", value:20, emoji:"📊" },
      { name:"Margin Call", effect:"damageNail",  emoji:"📉" },
      { name:"Shorting",    effect:"stealMoney", value:30, emoji:"🩳" },
    ],
    DIFESA: [
      { name:"Hedge",       effect:"block",  emoji:"🛡" },
      { name:"Diversifica", effect:"dodge",  emoji:"📁" },
    ],
    DENARO: [
      { name:"Dividendo",   effect:"money", value:25, emoji:"💼" },
      { name:"Bull Run",    effect:"money", value:55, emoji:"📈" },
      { name:"IPO",         effect:"money", value:80, emoji:"🏦" },
    ],
  },
  "Il Romanaccio": {
    // BILANCIAMENTO boss 2: valori leggermente ridotti
    COMBATTIMENTO: [
      { name:"Tassametro",   effect:"stealMoney", value:30, emoji:"🚕" },
      { name:"Manomissione", effect:"damageNail",  emoji:"🔧" },
      { name:"Fregatura",    effect:"stealMoney", value:20, emoji:"😏" },
      { name:"Spallata",     effect:"lightDamage", emoji:"💢" },
    ],
    DIFESA: [
      { name:"A Capoccia",   effect:"block",  emoji:"🏛" },
      { name:"Scappa in Vespa",effect:"dodge", emoji:"🛵" },
    ],
    DENARO: [
      { name:"Bar Sport",    effect:"money", value:45, emoji:"☕" },
      { name:"Giro del Colosseo",effect:"money", value:70, emoji:"🏟" },
      { name:"Mancia Grossa",effect:"money", value:40, emoji:"💶" },
      { name:"Spicci",       effect:"money", value:25, emoji:"🪙" },
    ],
  },
  "Il Napoletano": {
    // BILANCIAMENTO boss 3: valori ridotti rispetto a prima
    COMBATTIMENTO: [
      { name:"'O Scippo",     effect:"damageNail",  emoji:"🗝" },
      { name:"'A Guapparia",  effect:"lightDamage", emoji:"🔪" },
      { name:"'O Pizzo",      effect:"stealMoney", value:25, emoji:"📜" },
    ],
    DIFESA: [
      { name:"'O Munaciello",  effect:"block",  emoji:"👻" },
      { name:"Tarantella",     effect:"dodge",  emoji:"💃" },
    ],
    DENARO: [
      { name:"Lotto Clandestino",effect:"money", value:55, emoji:"🎟" },
      { name:"'A Parulana",    effect:"money", value:40, emoji:"🥖" },
      { name:"Tesoro 'e San Gennaro",effect:"money", value:80, emoji:"💎" },
    ],
  },
  "Il Drago d'Oro": {
    // BILANCIAMENTO boss 4 (finale): il più duro, ma non impossibile
    COMBATTIMENTO: [
      { name:"Soffio di Fuoco",   effect:"damage", value:40,  emoji:"🔥" },
      { name:"Artiglio del Drago",effect:"killNail",           emoji:"🐲" },
      { name:"Tempesta di Fiamme",effect:"damage", value:28,  emoji:"☄️" },
      { name:"Morso Velenoso",    effect:"steal",  value:30,  emoji:"🐍" },
    ],
    DIFESA: [
      { name:"Scaglie d'Oro",    effect:"block",  emoji:"🛡" },
      { name:"Nebbia d'Incenso",  effect:"dodge",  emoji:"🌫" },
      { name:"Muro di Giada",     effect:"block",  emoji:"🟢" },
    ],
    DENARO: [
      { name:"Perla del Drago",   effect:"money", value:65,  emoji:"🔮" },
      { name:"Lingotto d'Oro",    effect:"money", value:50,  emoji:"🥇" },
      { name:"Tesoro Imperiale",  effect:"money", value:95,  emoji:"🏯" },
      { name:"Seta Preziosa",     effect:"money", value:35,  emoji:"🧧" },
    ],
  },
};

// ─── V2 DUELLO HP: statistiche nemico ────────────────────────
// Il combat non è più "gara a chi fa più soldi": è un duello a HP.
// Il player usa le unghie come vita; il nemico ha una barra HP (rossa)
// + uno scudo (blu) che accumula quando gioca carte DIFESA.
// I valori sono un punto di partenza da tarare (balance pass successivo).
export const ENEMY_STATS = {
  "Sfidante":       { hp: 50,  shieldPerDef: 10 },
  "Ladro":          { hp: 55,  shieldPerDef: 12 },
  "Ladro Nascosto": { hp: 65,  shieldPerDef: 14 },
  "Mini Boss":      { hp: 95,  shieldPerDef: 16 },
  "Il Broker":      { hp: 130, shieldPerDef: 20 },
  "Il Romanaccio":  { hp: 150, shieldPerDef: 22 },
  "Il Napoletano":  { hp: 165, shieldPerDef: 22 },
  "Il Drago d'Oro": { hp: 210, shieldPerDef: 26 },
};
export const DEFAULT_ENEMY_STATS = { hp: 60, shieldPerDef: 12 };

// Mappa effetto → danno inflitto all'HP nemico (carte COMBATTIMENTO del player).
// Gli effetti che hanno un `value` (stealMoney/damage) derivano il danno dal value.
export const EFFECT_DAMAGE = {
  lightDamage: 18,  // Schiaffo — danno base
  damageNail:  42,  // Strappa! — danno pesante
  berserk:     46,  // Berserk — danno pesante ma degrada 1 unghia tua
  stealMoney:  22,  // Furto! — danno + rubi soldi
};

// ─── TAUNTS ─────────────────────────────────────────────────
export const TAUNTS = [
  { text:"\"Quelle unghie fanno schifo, nemmeno mia nonna gratta così male!\"",
    respond:"\"Le mie unghie ti STRAPPERANNO la faccia!\"",
    rewardMoney:15, riskDamage:1, winChance:0.55 },
  { text:"\"Hai la faccia di uno che perde sempre alla lotteria!\"",
    respond:"\"Stavolta vinco IO, stronzo!\"",
    rewardMoney:20, riskDamage:1, winChance:0.5 },
  { text:"\"Scommetto che non hai neanche i soldi per un Poveraccio!\"",
    respond:"\"Ho più soldi di quanti ne vedrai MAI!\"",
    rewardMoney:25, riskDamage:1, winChance:0.45 },
  { text:"\"Guarda quelle unghie... sembrano i denti di mio nonno!\"",
    respond:"\"Queste unghie ti faranno PIANGERE!\"",
    rewardMoney:10, riskDamage:0, winChance:0.6 },
  { text:"\"Ancora qui? Pensavo fossi già scappato col culo tra le gambe!\"",
    respond:"\"Io non scappo MAI! Adesso paghi!\"",
    rewardMoney:30, riskDamage:2, winChance:0.4 },
];
