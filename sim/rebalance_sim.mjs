// Proposta rebalance — target: RTP globale 88-92%, hit rate 30%+, bancarotta <10%
const NEW_BALANCE = {
  fortunaFlash:    { cost:0.5, winChance: 0.30, prizeMin: 1,   prizeMax: 3,    tier: 1 },
  setteEMezzo:     { cost:1,   winChance: 0.32, prizeMin: 2,   prizeMax: 6,    tier: 1 },
  portaFortuna:    { cost:2,   winChance: 0.28, prizeMin: 5,   prizeMax: 12,   tier: 2 },
  fintoMilionario: { cost:5,   winChance: 0.24, prizeMin: 12,  prizeMax: 38,   tier: 2 },
  puzzle:          { cost:10,  winChance: 0.26, prizeMin: 20,  prizeMax: 60,   tier: 3 },
  boccaDrago:      { cost:20,  winChance: 0.20, prizeMin: 50,  prizeMax: 160,  tier: 3 },
  miliardario:     { cost:30,  winChance: 0.16, prizeMin: 70,  prizeMax: 360,  tier: 3 },
  tredici:         { cost:50,  winChance: 0.13, prizeMin: 220, prizeMax: 820,  tier: 4 },
  maledetto:       { cost:100, winChance: 0.10, prizeMin: 550, prizeMax: 2000, tier: 4 },
  ruota:           { cost:15,  winChance: 0.20, prizeMin: 28,  prizeMax: 70,   tier: 2, nearWin:0.40, nearWinMult:1.5 },
  labirinto:       { cost:15,  winChance: 0.24, prizeMin: 35,  prizeMax: 110,  tier: 2 },
  grattaCombina:   { cost:25,  winChance: 0.26, prizeMin: 45,  prizeMax: 150,  tier: 3 },
  mappaTesor0:     { cost:35,  winChance: 0.20, prizeMin: 80,  prizeMax: 280,  tier: 3 },
  doppioOnulla:    { cost:20,  winChance: 0.48, prizeMin: 32,  prizeMax: 65,   tier: 2 },
  mahjong:         { cost:25,  winChance: 0.26, prizeMin: 45,  prizeMax: 150,  tier: 3 },
  jackpotMix:      { cost:20,  winChance: 0.22, prizeMin: 50,  prizeMax: 180,  tier: 3 },
  turistaPerSempre:{ cost:40,  winChance: 0.19, prizeMin: 90,  prizeMax: 340,  tier: 3 },
};

function simCard(id, runs=100000) {
  const cb = NEW_BALANCE[id];
  let wins=0, spent=0, won=0;
  for (let i=0;i<runs;i++) {
    spent += cb.cost;
    if (Math.random() < cb.winChance) {
      won += Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin)));
      wins++;
    } else if (cb.nearWin && Math.random() < cb.nearWin) {
      won += Math.round(cb.cost*cb.nearWinMult);
    }
  }
  return { id, cost:cb.cost, tier:cb.tier, winPct:(wins/runs)*100, rtp:(won/spent)*100, ev:(won-spent)/runs };
}

console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
console.log("║ PROPOSTA REBALANCE — RTP target: t1 95-100% · t2 88-92% · t3 82-88% · t4 95%+    ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");
console.log("Card              Tier  Cost   Win%    RTP%    EV/card   Verdict");
console.log("─".repeat(80));
for (const id of Object.keys(NEW_BALANCE)) {
  const r = simCard(id);
  const verdict = r.rtp > 95 ? "✅ generoso" : r.rtp > 85 ? "🟢 sano" : r.rtp > 75 ? "🟡 tight" : "🟠 duro";
  console.log(`${id.padEnd(17)} t${r.tier}   €${String(r.cost).padEnd(4)} ${r.winPct.toFixed(1).padStart(5)}% ${r.rtp.toFixed(1).padStart(6)}%   ${r.ev>=0?"+":""}${r.ev.toFixed(2).padStart(6)}   ${verdict}`);
}

function simRun(startMoney=150, cardsPerRun=30) {
  const pool = ["fortunaFlash","setteEMezzo","portaFortuna","fintoMilionario","puzzle","boccaDrago","ruota","labirinto","doppioOnulla","grattaCombina","jackpotMix"];
  let money = startMoney; let won = 0;
  for (let i=0;i<cardsPerRun;i++) {
    const aff = pool.filter(id => NEW_BALANCE[id].cost <= money);
    if (!aff.length) break;
    const cb = NEW_BALANCE[aff[Math.floor(Math.random()*aff.length)]];
    money -= cb.cost;
    if (Math.random() < cb.winChance) {
      money += Math.max(cb.cost, Math.round(cb.prizeMin + Math.random()*(cb.prizeMax-cb.prizeMin)));
      won++;
    } else if (cb.nearWin && Math.random() < cb.nearWin) money += Math.round(cb.cost*cb.nearWinMult);
  }
  return { net: money - startMoney, wins: won, bankrupt: money <= 0 };
}

console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
console.log("║ RUN SIMULATION POST-REBALANCE — 10.000 run, €150 → 30 carte                      ║");
console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");
const N=10000, results=[];
for (let i=0;i<N;i++) results.push(simRun());
const sorted = results.map(r=>r.net).sort((a,b)=>a-b);
const p = q => sorted[Math.floor(q*N)];
const avgNet = sorted.reduce((a,b)=>a+b,0)/N;
const avgWins = results.reduce((a,r)=>a+r.wins,0)/N;
console.log(`  p5:               €${p(0.05)}`);
console.log(`  p25:              €${p(0.25)}`);
console.log(`  median:           €${p(0.50)}`);
console.log(`  p75:              €${p(0.75)}`);
console.log(`  p95:              €${p(0.95)}`);
console.log(`  mean:             €${avgNet.toFixed(1)}`);
console.log(`  bankrupt:         ${(results.filter(r=>r.bankrupt).length/N*100).toFixed(1)}%`);
console.log(`  profitable run:   ${(results.filter(r=>r.net>0).length/N*100).toFixed(1)}%`);
console.log(`  avg wins/30:      ${avgWins.toFixed(1)}   (${(avgWins/30*100).toFixed(1)}% hit rate)`);
