// Valida l'arte ASCII: larghezze uniformi per ritratto + niente char double-width.
// Uso: node scripts/check-art.mjs [path-al-modulo]  (default: src/data/art.js)
import { pathToFileURL } from "url";
import { resolve } from "path";

const target = resolve(process.argv[2] || "src/data/art.js");
const mod = await import(pathToFileURL(target).href);
const SPR = mod.SPR_BIG;
if (!SPR) { console.error("SPR_BIG non trovato in " + target); process.exit(1); }

// Char double-width: emoji, CJK, fullwidth — rompono la griglia monospace
const wide = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F000}-\u{1FFFF}\u{20000}-\u{2FFFD}]/u;

let fail = 0;
for (const [name, lines] of Object.entries(SPR)) {
  const widths = lines.map(l => [...l].length); // code points, non byte
  const uniq = [...new Set(widths)];
  const wideLines = lines.map((l, i) => wide.test(l) ? i : -1).filter(i => i >= 0);
  if (uniq.length > 1 || wideLines.length) {
    fail++;
    console.log(`✗ ${name}: larghezze ${JSON.stringify(uniq)}${wideLines.length ? ` — double-width alle righe ${wideLines}` : ""}`);
    if (uniq.length > 1) {
      const max = Math.max(...widths);
      lines.forEach((l, i) => { if ([...l].length !== max) console.log(`    riga ${i} (${[...l].length}/${max}): "${l}"`); });
    }
  } else {
    console.log(`✓ ${name} (${widths[0]}×${lines.length})`);
  }
}
console.log(fail ? `\n${fail} ritratti da sistemare` : "\nTutti i ritratti sono allineati ✨");
process.exit(fail ? 1 : 0);
