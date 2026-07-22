// ─── RANDOM UTILITIES ────────────────────────────────────────
export const rng = () => Math.random();
export const roll = (chance) => rng() < chance;
export const pick = (arr) => arr[Math.floor(rng() * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const shuffle = (a) => { let b=[...a]; for(let i=b.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; };

export function weightedPick(items) {
  const total = items.reduce((s,i) => s + i.w, 0);
  let r = rng() * total;
  for (const item of items) { r -= item.w; if (r <= 0) return item.type; }
  return items[items.length-1].type;
}
