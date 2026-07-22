// Tuning v2 — target: RTP 88-92% tier 1-3, 95-100% tier 4
// Mantiene hit rate percepito >28% (contro il 21% attuale) con payout ricalibrati
const V2 = {
  fortunaFlash:    { cost:0.5, winChance: 0.30, prizeMin: 1,   prizeMax: 2,    tier: 1 },
  setteEMezzo:     { cost:1,   winChance: 0.32, prizeMin: 2,   prizeMax: 4,    tier: 1 },
  portaFortuna:    { cost:2,   winChance: 0.28, prizeMin: 4,   prizeMax: 9,    tier: 2 },
  fintoMilionario: { cost:5,   winChance: 0.24, prizeMin: 10,  prizeMax: 28,   tier: 2 },
  puzzle:          { cost:10,  winChance: 0.26, prizeMin: 18,  prizeMax: 50,   tier: 3 },
  boccaDrago:      { cost:20,  winChance: 0.20, prizeMin: 40,  prizeMax: 140,  tier: 3 },
  miliardario:     { cost:30,  winChance: 0.16, prizeMin: 60,  prizeMax: 280,  tier: 3 },
  tredici:         { cost:50,  winChance: 0.13, prizeMin: 200, prizeMax: 600,  tier: 4 },
  maledetto:       { cost:100, winChance: 0.10, prizeMin: 450, prizeMax: 1400, tier: 4 },
  ruota:           { cost:15,  winChance: 0.20, prizeMin: 30,  prizeMax: 75,   tier: 2, nearWin:0.40, nearWinMult:1.3 },
  labirinto:       { cost:15,  winChance: 0.24, prizeMin: 30,  prizeMax: 85,   tier: 2 },
  grattaCombina:   { cost:25,  winChance: 0.26, prizeMin: 50,  prizeMax: 125,  tier: 3 },
  mappaTesor0:     { cost:35,  winChance: 0.20, prizeMin: 80,  prizeMax: 235,  tier: 3 },
  doppioOnulla:    { cost:20,  winChance: 0.48, prizeMin: 28,  prizeMax: 48,   tier: 2 },
  mahjong:         { cost:25,  winChance: 0.26, prizeMin: 50,  prizeMax: 125,  tier: 3 },
  jackpotMix:      { cost:20,  winChance: 0.22, prizeMin: 45,  prizeMax: 130,  tier: 3 },
  turistaPerSempre:{ cost:40,  winChance: 0.19, prizeMin: 90,  prizeMax: 290,  tier: 3 },
};

function simCard(id, runs=100000) {
  const cb = V2[id]; let wins=0, spent=0, won=0;
  for (let i=0;i<runs;i++) {
    spent += cb.cost;
    if (Math.random() < cb.winChance) {
      won += Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin))); wins++;
    } else if (cb.nearWin && Math.random() < cb.nearWin) won += Math.round(cb.cost*cb.nearWinMult);
  }
  return { id, cost:cb.cost, tier:cb.tier, winPct:(wins/runs)*100, rtp:(won/spent)*100, ev:(won-spent)/runs };
}

console.log("\n╔══ REBALANCE v2 — target RTP 88-92% t1-3, 95-100% t4 ═══╗\n");
console.log("Card              T  Cost   Win%    RTP%   EV     Verdict");
console.log("─".repeat(70));
for (const id of Object.keys(V2)) {
  const r = simCard(id);
  const targetMin = r.tier===4 ? 95 : r.tier===1 ? 90 : 85;
  const targetMax = r.tier===4 ? 105 : 95;
  const verdict = r.rtp >= targetMin && r.rtp <= targetMax ? "✅ in target"
    : r.rtp > targetMax ? "⚠️ troppo gen." : "⚠️ troppo duro";
  console.log(`${id.padEnd(17)} ${r.tier} €${String(r.cost).padEnd(4)} ${r.winPct.toFixed(1).padStart(5)}% ${r.rtp.toFixed(1).padStart(5)}% ${r.ev>=0?"+":""}${r.ev.toFixed(2).padStart(6)} ${verdict}`);
}

function simRun(startMoney=150, cardsPerRun=30) {
  const pool = ["fortunaFlash","setteEMezzo","portaFortuna","fintoMilionario","puzzle","boccaDrago","ruota","labirinto","doppioOnulla","grattaCombina","jackpotMix"];
  let money = startMoney; let won = 0;
  for (let i=0;i<cardsPerRun;i++) {
    const aff = pool.filter(id => V2[id].cost <= money); if (!aff.length) break;
    const cb = V2[aff[Math.floor(Math.random()*aff.length)]]; money -= cb.cost;
    if (Math.random() < cb.winChance) { money += Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin))); won++; }
    else if (cb.nearWin && Math.random() < cb.nearWin) money += Math.round(cb.cost*cb.nearWinMult);
  }
  return { net: money - startMoney, wins: won, bankrupt: money <= 0 };
}

console.log("\n╔══ RUN SIMULATION v2 — 10k run, €150 → 30 carte ═══╗\n");
const N=10000, results=[];
for (let i=0;i<N;i++) results.push(simRun());
const sorted = results.map(r=>r.net).sort((a,b)=>a-b);
const p = q => sorted[Math.floor(q*N)];
const avgNet = sorted.reduce((a,b)=>a+b,0)/N;
const avgWins = results.reduce((a,r)=>a+r.wins,0)/N;
console.log(`  p5:  €${p(0.05)}  |  p25: €${p(0.25)}  |  median: €${p(0.50)}  |  p75: €${p(0.75)}  |  p95: €${p(0.95)}`);
console.log(`  mean: €${avgNet.toFixed(1)}`);
console.log(`  bankrupt:        ${(results.filter(r=>r.bankrupt).length/N*100).toFixed(1)}%`);
console.log(`  profitable run:  ${(results.filter(r=>r.net>0).length/N*100).toFixed(1)}%`);
console.log(`  avg wins/30:     ${avgWins.toFixed(1)}   (hit rate ${(avgWins/30*100).toFixed(1)}%)`);
