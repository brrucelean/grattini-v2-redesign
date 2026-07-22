// Sanity check EV approssimato per carte + value/€ degli oggetti
// dopo il full rebalance Beta 5 (carte + items).
//
// Esegui: node scripts/check-balance.mjs

const CARDS = {
  fortunaFlash:    { winChance: 0.32, evTarget:  0.00, prizeMin: 1,   prizeMax: 3,    cost: 0.5  },
  setteEMezzo:     { winChance: 0.34, evTarget:  0.00, prizeMin: 2,   prizeMax: 4,    cost: 1    },
  portaFortuna:    { winChance: 0.30, evTarget: -0.03, prizeMin: 4,   prizeMax: 9,    cost: 2    },
  fintoMilionario: { winChance: 0.26, evTarget: -0.05, prizeMin: 10,  prizeMax: 28,   cost: 5    },
  puzzle:          { winChance: 0.28, evTarget: -0.08, prizeMin: 18,  prizeMax: 48,   cost: 10   },
  boccaDrago:      { winChance: 0.22, evTarget: -0.08, prizeMin: 40,  prizeMax: 130,  cost: 20   },
  miliardario:     { winChance: 0.17, evTarget: -0.10, prizeMin: 60,  prizeMax: 260,  cost: 30   },
  tredici:         { winChance: 0.14, evTarget:  0.00, prizeMin: 200, prizeMax: 520,  cost: 50   },
  maledetto:       { winChance: 0.11, evTarget:  0.00, prizeMin: 450, prizeMax: 1400, cost: 100  },
  ruota:           { winChance: 0.22, evTarget: -0.02, prizeMin: 25,  prizeMax: 65,   cost: 15   },
  labirinto:       { winChance: 0.26, evTarget: -0.09, prizeMin: 30,  prizeMax: 75,   cost: 15   },
  grattaCombina:   { winChance: 0.28, evTarget: -0.10, prizeMin: 45,  prizeMax: 115,  cost: 25   },
  mappaTesor0:     { winChance: 0.22, evTarget: -0.10, prizeMin: 75,  prizeMax: 210,  cost: 35   },
  doppioOnulla:    { winChance: 0.48, evTarget: -0.09, prizeMin: 28,  prizeMax: 48,   cost: 20   },
  mahjong:         { winChance: 0.28, evTarget: -0.10, prizeMin: 45,  prizeMax: 115,  cost: 25   },
  jackpotMix:      { winChance: 0.24, evTarget:  0.00, prizeMin: 45,  prizeMax: 120,  cost: 20   },
  turistaPerSempre:{ winChance: 0.20, evTarget: -0.14, prizeMin: 85,  prizeMax: 260,  cost: 40   },
};

// ITEMS — valore stimato / prezzo (Beta 5 post-rebalance)
// "valueAt" = valore atteso in € dell'effetto in uno scenario tipico.
const ITEMS = [
  // consumabili globali
  { id:"cerotto",          cost:3,   valueAt:5,    note:"cura 1 stato → evita degrado futuro" },
  { id:"sigaretta",         cost:5,   valueAt:6,    note:"+1F 4t (=24%) – malus dopo 3 grattate" },
  { id:"disinfettante",    cost:8,   valueAt:10,   note:"cura 2 stati" },
  { id:"sigarettaErba",    cost:15,  valueAt:18,   note:"+2F 4t + cura + chance ×2.5" },
  { id:"giornalettoPorno", cost:15,  valueAt:18,   note:"+3F per 6 grattate, rischio multa €15" },
  { id:"cremaRinforzante", cost:10,  valueAt:12,   note:"+1 HP bianco (assorbe 3 danni)" },
  { id:"cappelloSbirro",   cost:15,  valueAt:20,   note:"ignora 1 polizia (multa €20-40)" },
  { id:"smalto",           cost:25,  valueAt:35,   note:"kawaii x2 + 3 colpi protetti" },
  { id:"sieroRicrescita",  cost:25,  valueAt:30,   note:"unghia morta → sana" },
  { id:"manoProtesica",    cost:100, valueAt:120,  note:"cura tutte le unghie vive" },
  // impianti macellaio std
  { id:"plastica (imp.)",  cost:6,   valueAt:8,    note:"3 grattate × 0.5 — comune" },
  { id:"ferro (imp.)",     cost:25,  valueAt:30,   note:"4 × 1.0 — non sanguina" },
  { id:"oro (imp.)",       cost:50,  valueAt:60,   note:"5 × 1.5 — pericolo ladri" },
  // impianti spec
  { id:"neonato (imp.)",   cost:20,  valueAt:30,   note:"1 grattata garantita 50%" },
  { id:"marcione (imp.)",  cost:15,  valueAt:18,   note:"2 grattate garantite 50%" },
  { id:"baddie (imp.)",    cost:60,  valueAt:80,   note:"9 grattate × 1.0 + ladri ti amano" },
  { id:"sacra (imp.)",     cost:40,  valueAt:50,   note:"1 grattata × 3 garantita (era ×5)" },
  // grattatori
  { id:"bottone",          cost:5,   valueAt:6,    note:"+20% premio (era +10%)" },
  { id:"bullone",          cost:7,   valueAt:9,    note:"80% ignora malus" },
  { id:"unghiaFinta",      cost:10,  valueAt:12,   note:"protegge 3 grattate" },
  { id:"discoRotto",       cost:22,  valueAt:25,   note:"2 celle/click — strong vantaggio" },
  { id:"moneta_argento",   cost:20,  valueAt:30,   note:"x2 per 2 grattate" },
  { id:"gettoneLavaggio",  cost:20,  valueAt:30,   note:"cura tutte + rimuove grattamania" },
  { id:"chiaveOttone",     cost:18,  valueAt:20,   note:"rivela 2 celle tier 3+ (niche)" },
  { id:"plettro",          cost:35,  valueAt:50,   note:"x2 + silenzioso" },
  { id:"moneta_oro",       cost:55,  valueAt:70,   note:"x4 (era €40)" },
];

const fortuneBonus = (f) => Math.min(Math.max(f, 0), 5) * 0.06;

function evAtFortune(b, fortune) {
  const winP = Math.min(b.winChance + fortuneBonus(fortune), 0.95);
  const avgPrize = (b.prizeMin + b.prizeMax) / 2;
  const ev = winP * avgPrize - b.cost;
  return { winP, ev, evPct: ev / b.cost };
}

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("  GRATTINI · CARDS — EV check (post-rebalance Fortuna Beta 5)");
console.log("══════════════════════════════════════════════════════════════════════\n");
console.log("Card                 │  F0   │  F2   │  F5   │  Target   │ Status");
console.log("─────────────────────┼───────┼───────┼───────┼───────────┼────────");
const cardIssues = [];
for (const [id, b] of Object.entries(CARDS)) {
  const f0 = evAtFortune(b, 0);
  const f2 = evAtFortune(b, 2);
  const f5 = evAtFortune(b, 5);
  const drift = f0.evPct - b.evTarget;
  const status = Math.abs(drift) < 0.05 ? "✓"
    : drift > 0.05 ? `▲ +${(drift*100).toFixed(1)}%`
    : `▼ ${(drift*100).toFixed(1)}%`;
  if (Math.abs(drift) >= 0.10) cardIssues.push({ id, target: b.evTarget, actual: f0.evPct, drift });
  const fmt = (n) => (n >= 0 ? "+" : "") + (n*100).toFixed(0).padStart(3) + "%";
  console.log(`${id.padEnd(20)} │ ${fmt(f0.evPct)} │ ${fmt(f2.evPct)} │ ${fmt(f5.evPct)} │ ${fmt(b.evTarget).padEnd(9)} │ ${status}`);
}

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("  GRATTINI · ITEMS — value/cost ratio (Beta 5)");
console.log("══════════════════════════════════════════════════════════════════════\n");
console.log("Item                       │ Cost │ Value │ Ratio │ Note");
console.log("───────────────────────────┼──────┼───────┼───────┼─────");
const itemIssues = [];
for (const it of ITEMS) {
  const ratio = it.valueAt / it.cost;
  const ok = ratio >= 1.0 && ratio <= 1.6;
  const tag = ratio >= 1.6 ? "▲ over" : ratio < 0.9 ? "▼ under" : ratio < 1.0 ? "≈ trap" : "✓";
  if (!ok && ratio >= 1.0) itemIssues.push({ id: it.id, ratio });
  console.log(`${it.id.padEnd(26)} │ €${String(it.cost).padStart(3)} │ €${String(it.valueAt).padStart(4)} │ ${ratio.toFixed(2).padStart(5)} │ ${tag} · ${it.note}`);
}

console.log("\n──────────────────────────────────────────────────────────────────────");
console.log("Summary:");
console.log(`  · Carte con EV F0 drift >10% da target: ${cardIssues.length}`);
if (cardIssues.length) cardIssues.forEach(i => console.log(`     ${i.id}: target=${(i.target*100).toFixed(0)}% actual=${(i.actual*100).toFixed(1)}%`));
console.log(`  · Oggetti con value/cost > 1.6 (potenziali OP):`);
const opItems = ITEMS.filter(it => it.valueAt/it.cost > 1.6);
if (opItems.length === 0) console.log("     nessuno — economia bilanciata ✓");
else opItems.forEach(it => console.log(`     ${it.id}: ratio=${(it.valueAt/it.cost).toFixed(2)} (val €${it.valueAt} / cost €${it.cost})`));
console.log();
