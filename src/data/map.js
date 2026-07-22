// ─── NODE TYPES & MAP ────────────────────────────────────────
export const NODE_ICONS = {
  tabaccaio:"🏪", locanda:"🏨", spacciatore:"💊", chirurgo:"🔪",
  ladro:"🗡️", mendicante:"🙏", zaino:"🎒", miniboss:"💀",
  boss:"👹", evento:"❓", start:"🚩", stregone:"🧙",
  poliziotto:"🚔", anziana:"👵", sacerdote:"⛪", bambino:"👦",
  streamer:"📱", macellaio:"🔪",
  maestroTe:"🍵", guantaio:"🧤",
};

export const NODE_POOL_WEIGHTS = [
  { type:"tabaccaio", w:28 }, { type:"locanda", w:12 },
  { type:"spacciatore", w:10 }, { type:"ladro", w:12 },
  { type:"mendicante", w:10 }, { type:"zaino", w:8 },
  { type:"chirurgo", w:7 }, { type:"miniboss", w:7 },
  { type:"evento", w:8 }, { type:"stregone", w:10 },
  { type:"anziana", w:5 }, { type:"sacerdote", w:3 },
  { type:"bambino", w:4 }, { type:"streamer", w:6 },
];

// ─── NODE TOOLTIPS ────────────────────────────────────────────
export const NODE_TOOLTIPS = {
  tabaccaio:   "🛒 Compra gratta & vinci, grattatori e consumabili",
  locanda:     "🛏️ Riposa e cura le tue unghie (costo €5-50)",
  spacciatore: "💊 Gratta contrabbando e sigarette speciali — rischioso!",
  chirurgo:    "🔪 Impiantati unghie speciali più resistenti (costoso)",
  ladro:       "🗡️ Ti blocca il cammino — combatti, cedi oggetti o fuggi",
  mendicante:  "🙏 Vende grattatori sacri a prezzi scontati",
  zaino:       "🎒 Zaino abbandonato — loot o trappola? Solo un modo per scoprirlo.",
  miniboss:    "💀 Mini Boss — ti blocca il passaggio. Gratta e combatti.",
  boss:        "👹 BOSS FINALE — Ti aspetta. Porta tutto quello che hai.",
  evento:      "❓ Evento misterioso — qualcosa di strano ti aspetta",
  stregone:    "🧙 Lo Stregone della Doppia Mano — rarissimo, sa cose che non dovresti sapere.",
  start:       "🚩 Da qui è iniziato tutto. Non tornare a mani vuote.",
  poliziotto:  "🚔 Poliziotto della Lotteria — meglio avere il Cappello Sbirro o una buona scusa.",
  anziana:     "👵 Anziana Maledetta — guarisce o maledice, dipende da come la guardi.",
  sacerdote:   "⛪ Sacerdote della Fortuna — dona in fede, ricevi in modo inspiegabile.",
  bambino:     "👦 Bambino Collezionista — ossessionato dai grattini. Ha roba fuori produzione.",
  streamer:    "📱 Streamer Scratch — vuole filmarti. La chat impazzirà comunque.",
  macellaio:   "🔪 Il Chirurgo Macellaio — impianti d'avanguardia. 25% di complicazioni.",
  maestroTe:   "🍵 Il Maestro del Tè — tè speciali che curano e potenziano. Solo nel Quartiere Cinese.",
  guantaio:    "🧤 Il Guantaio — vende guanti rari, incluso il GUANTO DA BOSS (protegge dal prossimo combattimento).",
};
