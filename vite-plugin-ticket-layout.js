// ─── DEV-ONLY: salvataggio dell'impaginazione biglietti su disco ────────────
// L'editor (?ticket=<id>&edit=1) fa POST qui con il layout completo; il plugin
// riscrive src/data/ticketLayout.js mantenendo commenti e formattazione, poi
// l'HMR ricarica e il gioco usa subito le nuove posizioni.
// Attivo SOLO in `vite dev` (apply: "serve"): non finisce mai in produzione.
import fs from "node:fs";
import path from "node:path";

const ENDPOINT = "/__ticket-layout";
const TARGET = "src/data/ticketLayout.js";
const START = "export const TICKET_LAYOUT = {";
const END = "};";

const num = n => {
  const r = Math.round(Number(n) * 10) / 10;
  return Number.isFinite(r) ? r : 0;
};

// Un rect valido ha 4 lati numerici e non degenera (left+right < 100, idem top/bottom).
function cleanRect(r, withDir) {
  if (!r || typeof r !== "object") return null;
  const out = { top: num(r.top), left: num(r.left), right: num(r.right), bottom: num(r.bottom) };
  for (const v of Object.values(out)) if (v < -50 || v > 150) return null;
  if (out.left + out.right >= 99 || out.top + out.bottom >= 99) return null;
  if (withDir) out.dir = r.dir === "row" ? "row" : "col";
  return out;
}

function serialize(layout) {
  const lines = Object.entries(layout).map(([id, v]) => {
    const p = v.play, h = v.header;
    return `  ${(id + ":").padEnd(18)}` +
      `{ play:{top:${p.top}, left:${p.left}, right:${p.right}, bottom:${p.bottom}}, ` +
      `header:{top:${h.top}, left:${h.left}, right:${h.right}, bottom:${h.bottom}, dir:"${h.dir}"} },`;
  });
  return `${START}\n${lines.join("\n")}\n${END}`;
}

export function ticketLayoutPlugin() {
  return {
    name: "grattini:ticket-layout",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("POST only");
        }
        let body = "";
        req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
        req.on("end", () => {
          const reply = (code, msg) => {
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(code === 200 ? { ok: true, saved: msg } : { ok: false, error: msg }));
          };
          try {
            const incoming = JSON.parse(body);
            const layout = {};
            for (const [id, v] of Object.entries(incoming)) {
              // gli id arrivano dal client: niente chiavi strane nel sorgente
              if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) return reply(400, `id non valido: ${id}`);
              const play = cleanRect(v.play, false);
              const header = cleanRect(v.header, true);
              if (!play || !header) return reply(400, `rect non valido per ${id}`);
              layout[id] = { play, header };
            }
            if (!Object.keys(layout).length) return reply(400, "layout vuoto");

            const file = path.resolve(server.config.root, TARGET);
            const src = fs.readFileSync(file, "utf8");
            const from = src.indexOf(START);
            if (from === -1) return reply(500, `blocco TICKET_LAYOUT non trovato in ${TARGET}`);
            const to = src.indexOf(`\n${END}`, from);
            if (to === -1) return reply(500, `fine blocco non trovata in ${TARGET}`);

            const next = src.slice(0, from) + serialize(layout) + src.slice(to + 1 + END.length);
            fs.writeFileSync(file, next, "utf8");
            reply(200, `${Object.keys(layout).length} biglietti in ${TARGET}`);
          } catch (e) {
            reply(400, String(e && e.message || e));
          }
        });
      });
    },
  };
}
