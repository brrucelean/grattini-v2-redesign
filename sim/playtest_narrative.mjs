// Simulazione run narrativa per panel game-design (Balatro/Inscryption/StS/Isaac)
// Genera un log turn-by-turn di una run media con scelte "player realistico"

const CARDS = {
  fortunaFlash:    { cost:0.5, win:0.32, pmin:1,   pmax:3,    name:"Il Poveraccio",       tier:1 },
  setteEMezzo:     { cost:1,   win:0.34, pmin:2,   pmax:4,    name:"Sette e Mezzo",       tier:1 },
  portaFortuna:    { cost:2,   win:0.30, pmin:4,   pmax:9,    name:"Porta Sfortuna",      tier:2 },
  fintoMilionario: { cost:5,   win:0.26, pmin:10,  pmax:28,   name:"Il Finto Milionario", tier:2 },
  puzzle:          { cost:10,  win:0.28, pmin:18,  pmax:48,   name:"Puzzle",              tier:3 },
  boccaDrago:      { cost:20,  win:0.22, pmin:40,  pmax:130,  name:"Bocca del Drago",     tier:3 },
  miliardario:     { cost:30,  win:0.17, pmin:60,  pmax:260,  name:"Il Miliardario",      tier:3 },
  tredici:         { cost:50,  win:0.14, pmin:200, pmax:520,  name:"Tredici",             tier:4 },
  ruota:           { cost:15,  win:0.22, pmin:25,  pmax:65,   name:"La Ruota",            tier:2, near:0.30, nearMult:1.3 },
  doppioOnulla:    { cost:20,  win:0.48, pmin:28,  pmax:48,   name:"Doppio o Nulla",      tier:2 },
  jackpotMix:      { cost:20,  win:0.24, pmin:45,  pmax:120,  name:"Jackpot Mix",         tier:3 },
};

function playCard(id, fortune=0) {
  const c = CARDS[id];
  const eff = Math.min(c.win + Math.min(fortune,3)*0.05, 0.95);
  if (Math.random() < eff) {
    return { win:true, prize:Math.max(c.cost, Math.round(c.pmin + Math.random()*(c.pmax-c.pmin))), name:c.name, cost:c.cost };
  } else if (c.near && Math.random() < c.near) {
    return { win:false, prize:Math.round(c.cost*c.nearMult), name:c.name, cost:c.cost, nearWin:true };
  }
  return { win:false, prize:0, name:c.name, cost:c.cost };
}

// Player "realistico": bankroll strategy da giocatore cauto
function pickCard(money, biome=1) {
  const affordable = Object.entries(CARDS).filter(([id,c]) => c.cost <= money && c.tier <= Math.min(biome+1, 4));
  if (!affordable.length) return null;
  // 60% value bet (carta media), 25% safe bet (tier basso), 15% yolo (tier alto se >€50)
  const r = Math.random();
  affordable.sort((a,b) => a[1].cost - b[1].cost);
  if (r < 0.25 || money < 20) return affordable[Math.floor(Math.random()*Math.min(2, affordable.length))][0];
  if (r < 0.85) {
    const mid = affordable.filter(([,c]) => c.cost >= money*0.08 && c.cost <= money*0.25);
    return mid.length ? mid[Math.floor(Math.random()*mid.length)][0] : affordable[Math.floor(affordable.length/2)][0];
  }
  return affordable[affordable.length-1][0];
}

const log = [];
let money = 15; // start
let nails = 5; let biome = 1; let streak = 0; let maxStreak = 0;
let wins=0, losses=0, nearWins=0;
let totalSpent=0, totalWon=0;
const bigWins = []; const bigLosses = [];

log.push(`═══════════════════════════════════════════════════════════════════`);
log.push(` GRATTINI BETA 4.1 — RUN SIMULATA "giocatore medio, cauto"`);
log.push(` Start: €${money} · 5 unghie · Biome 1`);
log.push(`═══════════════════════════════════════════════════════════════════\n`);

// 3 biome, ognuno ~10 carte giocate tra combat/shop/event
for (let b=1; b<=3; b++) {
  log.push(`\n━━━━ BIOME ${b} ━━━━`);
  biome = b;
  // Shop event iniziale (piccolo bonus)
  if (b === 2) { money += 35; log.push(`  🎪 Evento "Vecchia che piange": +€35 (bankroll: €${money})`); }
  if (b === 3) { money += 50; log.push(`  🏮 Evento "Turista Cinese": +€50 (bankroll: €${money})`); }

  for (let c=0; c<10; c++) {
    const id = pickCard(money, b);
    if (!id) { log.push(`  💸 €${money} — Non posso più permettermi niente.`); break; }
    const res = playCard(id);
    money -= res.cost; totalSpent += res.cost;
    if (res.win) {
      money += res.prize; totalWon += res.prize; wins++; streak++;
      maxStreak = Math.max(maxStreak, streak);
      const profit = res.prize - res.cost;
      if (profit >= 50) bigWins.push({ turn: wins+losses, name: res.name, profit, cost: res.cost });
      log.push(`  T${(wins+losses).toString().padStart(2,'0')} ✅ ${res.name.padEnd(22)} costo €${res.cost} → €${res.prize} (+€${profit})  [bank €${money}]`);
    } else {
      losses++; streak = 0;
      if (res.nearWin) { nearWins++; money += res.prize; totalWon += res.prize;
        log.push(`  T${(wins+losses).toString().padStart(2,'0')} 🎯 ${res.name.padEnd(22)} costo €${res.cost} → near-win €${res.prize}  [bank €${money}]`);
      } else {
        if (res.cost >= 20) bigLosses.push({ turn: wins+losses, name: res.name, cost: res.cost });
        log.push(`  T${(wins+losses).toString().padStart(2,'0')} ❌ ${res.name.padEnd(22)} costo €${res.cost} → €0           [bank €${money}]`);
      }
    }
    if (money <= 0) { log.push(`  💀 BANCAROTTA al turno ${wins+losses}`); break; }
  }

  // Boss combat alla fine del biome — assume 50% win chance, +€30 reward
  if (money > 0) {
    const bossWin = Math.random() < 0.55;
    if (bossWin) { money += 40; log.push(`  👊 BOSS Biome ${b}: VITTORIA (+€40)  [bank €${money}]`); }
    else { nails -= 1; log.push(`  💢 BOSS Biome ${b}: SCONFITTA, perdi 1 unghia (${nails} vive)`); }
  }
  if (money <= 0 || nails <= 0) break;
}

log.push(`\n═══════════════════════════════════════════════════════════════════`);
log.push(` RISULTATO FINALE`);
log.push(`═══════════════════════════════════════════════════════════════════`);
log.push(`  Bankroll finale:    €${money}`);
log.push(`  Net:                ${money - 15 >= 0 ? "+" : ""}€${money - 15}`);
log.push(`  Carte giocate:      ${wins + losses}`);
log.push(`  Vittorie:           ${wins}  (hit rate ${((wins/(wins+losses))*100).toFixed(1)}%)`);
log.push(`  Sconfitte:          ${losses}`);
log.push(`  Near-win (Ruota):   ${nearWins}`);
log.push(`  Streak max:         ${maxStreak} vittorie consecutive`);
log.push(`  Unghie rimaste:     ${nails}/5`);
log.push(`  Totale speso:       €${totalSpent.toFixed(1)}`);
log.push(`  Totale incassato:   €${totalWon}`);
log.push(`  RTP run:            ${((totalWon/totalSpent)*100).toFixed(1)}%`);
log.push(`\n  🏆 Big wins (+€50):`);
bigWins.forEach(w => log.push(`     T${w.turn} ${w.name} costo €${w.cost} → profit +€${w.profit}`));
log.push(`\n  💀 Big losses (-€20+):`);
bigLosses.forEach(l => log.push(`     T${l.turn} ${l.name} costo €${l.cost} → €0`));

console.log(log.join("\n"));
