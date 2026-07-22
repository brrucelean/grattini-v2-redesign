// ─── GRATTINI ECONOMY SIMULATION ─────────────────────────────
// Analista finanziario simulato — calcola RTP (Return To Player),
// distribuzione profitto run, rischio bancarotta. Esegue con `node sim/economy_sim.mjs`

const CARD_BALANCE = {
  fortunaFlash:    { cost:0.5, winChance: 0.25, prizeMin: 1,   prizeMax: 3,    tier: 1 },
  setteEMezzo:     { cost:1,   winChance: 0.28, prizeMin: 2,   prizeMax: 5,    tier: 1 },
  portaFortuna:    { cost:2,   winChance: 0.22, prizeMin: 4,   prizeMax: 11,   tier: 2 },
  fintoMilionario: { cost:5,   winChance: 0.18, prizeMin: 10,  prizeMax: 35,   tier: 2 },
  puzzle:          { cost:10,  winChance: 0.20, prizeMin: 15,  prizeMax: 55,   tier: 3 },
  boccaDrago:      { cost:20,  winChance: 0.15, prizeMin: 40,  prizeMax: 150,  tier: 3 },
  miliardario:     { cost:30,  winChance: 0.12, prizeMin: 60,  prizeMax: 350,  tier: 3 },
  tredici:         { cost:50,  winChance: 0.10, prizeMin: 200, prizeMax: 800,  tier: 4 },
  maledetto:       { cost:100, winChance: 0.08, prizeMin: 500, prizeMax: 2000, tier: 4 },
  ruota:           { cost:15,  winChance: 0.15, prizeMin: 25,  prizeMax: 60,   tier: 2, nearWin:0.35, nearWinMult:1.5 },
  labirinto:       { cost:15,  winChance: 0.18, prizeMin: 30,  prizeMax: 100,  tier: 2 },
  grattaCombina:   { cost:25,  winChance: 0.20, prizeMin: 40,  prizeMax: 140,  tier: 3 },
  mappaTesor0:     { cost:35,  winChance: 0.15, prizeMin: 70,  prizeMax: 260,  tier: 3 },
  doppioOnulla:    { cost:20,  winChance: 0.45, prizeMin: 30,  prizeMax: 60,   tier: 2 },
  mahjong:         { cost:25,  winChance: 0.20, prizeMin: 40,  prizeMax: 140,  tier: 3 },
  jackpotMix:      { cost:20,  winChance: 0.22, prizeMin: 50,  prizeMax: 180,  tier: 3 },
  turistaPerSempre:{ cost:40,  winChance: 0.14, prizeMin: 80,  prizeMax: 320,  tier: 3 },
};

function simulateCard(id, runs=100000, fortune=0) {
  const cb = CARD_BALANCE[id];
  const winP = Math.min(cb.winChance + Math.min(fortune,3)*0.05, 0.95);
  let wins=0, totalSpent=0, totalWon=0, maxWin=0;
  const winPrizes=[];
  for (let i=0;i<runs;i++) {
    totalSpent += cb.cost;
    const r = Math.random();
    if (r < winP) {
      const prize = Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin)));
      totalWon += prize;
      winPrizes.push(prize);
      maxWin = Math.max(maxWin, prize);
      wins++;
    } else if (cb.nearWin && Math.random() < cb.nearWin) {
      const nw = Math.round(cb.cost * cb.nearWinMult);
      totalWon += nw;
    }
  }
  const rtp = (totalWon/totalSpent)*100;
  const avgPrize = winPrizes.length ? winPrizes.reduce((a,b)=>a+b,0)/winPrizes.length : 0;
  return { id, cost:cb.cost, winPct:(wins/runs)*100, rtp, avgPrizeWin:avgPrize, maxWin, ev:(totalWon-totalSpent)/runs };
}

console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
console.log("║ GRATTINI — ANALISI ECONOMICA (100k iterazioni per carta, Fortuna=0)              ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");
console.log("Card              Tier  Cost   Win%    RTP%   AvgPrizeW   EV/card   Verdict");
console.log("─".repeat(90));
const rows = [];
for (const id of Object.keys(CARD_BALANCE)) {
  const r = simulateCard(id);
  rows.push(r);
  const verdict = r.rtp > 95 ? "✅ generoso" : r.rtp > 85 ? "🟢 sano" : r.rtp > 75 ? "🟡 tight" : r.rtp > 65 ? "🟠 duro" : "🔴 predatorio";
  console.log(
    `${id.padEnd(17)} t${r.tier ?? "-"}   €${String(r.cost).padEnd(4)} ${r.winPct.toFixed(1).padStart(5)}% ${r.rtp.toFixed(1).padStart(6)}%  €${r.avgPrizeWin.toFixed(1).padStart(7)}  ${r.ev>=0?"+":""}${r.ev.toFixed(2).padStart(6)}   ${verdict}`
  );
}

// ─── SIMULAZIONE RUN TIPICA ─────────────────────────────────
// Un giocatore medio fa una run: ~30 carte, distribuzione tier
// biased verso tier accessibili (costo limitato da bankroll ~€100-300)
function simulateRun(startMoney=150, cardsPerRun=30) {
  const pool = ["fortunaFlash","setteEMezzo","portaFortuna","fintoMilionario","puzzle","boccaDrago","ruota","labirinto","doppioOnulla","grattaCombina","jackpotMix"];
  let money = startMoney;
  let won = 0;
  for (let i=0;i<cardsPerRun;i++) {
    // Filtra solo carte che il giocatore può permettersi
    const affordable = pool.filter(id => CARD_BALANCE[id].cost <= money);
    if (affordable.length === 0) break;
    // Player tende a scegliere carte medie (non tira sempre al massimo)
    const choice = affordable[Math.floor(Math.random()*affordable.length)];
    const cb = CARD_BALANCE[choice];
    money -= cb.cost;
    if (Math.random() < cb.winChance) {
      const p = Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin)));
      money += p; won++;
    } else if (cb.nearWin && Math.random() < cb.nearWin) {
      money += Math.round(cb.cost*cb.nearWinMult);
    }
  }
  return { finalMoney: money, net: money - startMoney, wins: won, cardsPlayed: cardsPerRun };
}

console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════════╗");
console.log("║ RUN SIMULATION — 10.000 run, bankroll €150 → 30 carte miste tier 1-3            ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");
const N=10000;
const results=[];
for (let i=0;i<N;i++) results.push(simulateRun(150, 30));
const sorted = results.map(r=>r.net).sort((a,b)=>a-b);
const p = (q) => sorted[Math.floor(q*N)];
const avgNet = sorted.reduce((a,b)=>a+b,0)/N;
const bankrupt = results.filter(r => r.finalMoney <= 0).length;
const profitable = results.filter(r => r.net > 0).length;
const avgWins = results.reduce((a,r)=>a+r.wins,0)/N;
console.log(`Net profit distribution:`);
console.log(`  p5 (worst 5%):    €${p(0.05)}`);
console.log(`  p25:              €${p(0.25)}`);
console.log(`  median:           €${p(0.50)}`);
console.log(`  p75:              €${p(0.75)}`);
console.log(`  p95 (best 5%):    €${p(0.95)}`);
console.log(`  mean:             €${avgNet.toFixed(1)}`);
console.log(`  bankrupt:         ${(bankrupt/N*100).toFixed(1)}%   (finale ≤ €0)`);
console.log(`  profitable run:   ${(profitable/N*100).toFixed(1)}%   (net > 0)`);
console.log(`  avg wins/30 cards: ${avgWins.toFixed(1)}   (${(avgWins/30*100).toFixed(1)}% hit rate)`);
console.log(`\n→ Feel test: il giocatore perde nel ${(100-profitable/N*100).toFixed(0)}% delle run.`);
console.log(`→ Hit rate percepito: ~1 vincita ogni ${(30/avgWins).toFixed(1)} carte grattate.`);
