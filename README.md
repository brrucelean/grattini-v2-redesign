# 🃏 Grattini v2

> Rework di **Grattini** — roguelike italiano di gratta-e-vinci — centrato sul combattimento: duello a HP con scudo/furia, minigiochi di tempismo (colpo perfetto, parata) al posto della vecchia "gara a chi fa più soldi".

**Partito da:** https://github.com/brrucelean/iphone-grattini (copia pulita, repo indipendente — nessuna storia condivisa, nessun collegamento al remote originale)

> ⚠️ Progetto in sviluppo attivo. Non c'è ancora un deploy pubblico.

---

## Cos'è

Un roguelike a nodi (tipo Slay the Spire) dove invece di carte giochi **gratta-e-vinci**. Rispetto all'originale, il combattimento è stato riscritto da zero:

- **Duello a HP**: il nemico ha una barra HP + scudo (che accumula sulle sue carte DIFESA); le **5 unghie** del giocatore sono la vita — nessuna barra numerica separata.
- **Griglia 3x3**: gratti 3 delle 9 carte a turno, come nel gratta-e-vinci originale — non un "gratta e scegli" astratto.
- **Botta e risposta a scambi**: ogni carta grattata è uno scambio col nemico, che risponde subito (non tutto in blocco a fine turno).
- **Telegrafo**: vedi in anticipo la sequenza di mosse del nemico (ATTACCO/DIFESA/DENARO) e puoi prepararti.
- **Minigiochi di tempismo**: attacco (colpisci al momento giusto per danno ×1.6) e parata (solo se giochi una carta DIFESA — perfetta annulla il danno e contrattacca).
- **FURIA**: dal turno 3 il nemico va in enrage — smette di curarsi e colpisce sempre più forte, per evitare fight infiniti.
- **4 biomi**, **17 tipi di grattino**, grattatori/reliquie/impianti come nell'originale.

## Dev

```bash
npm install
npm run dev       # vite dev server → http://localhost:5173
npm run build     # produce dist/
npm run preview   # serve dist/ localmente
```

Per saltare dritto in un combattimento senza giocare l'intro: `?combat=miniboss` (o `boss` / `ladro`) come query string.

## Architettura

- `src/scratchlite.jsx` — root component, screen router, tutti gli hook
- `src/components/CombatView.jsx` — il nuovo motore di combattimento (duello HP, scambi, timing)
- `src/hooks/use*Handlers.js` — logica di dominio spezzata per area (scratch, shop, event, node, combat, item)
- `src/data/combat.js` — carte combat (COMBATTIMENTO/DIFESA/DENARO), `ENEMY_STATS`, `EFFECT_DAMAGE`
- `src/data/cards.js` — definizione grattini + `CARD_BALANCE` (single-source-of-truth per winChance / EV)
- `src/data/items.js` — consumabili, grattatori, reliquie, impianti
- `src/data/biomes.js` — palette, nemici, perk di start
- `src/utils/card.js` — `generateCard()` legge CARD_BALANCE e tira premio/win/symbols
- `src/audio.js` — SFX procedurali via WebAudio (niente asset audio)

## Stack

React 18 · Vite 5 · Zero dipendenze runtime oltre a React.

## License

Da decidere. Per ora: tutti i diritti riservati, progetto personale.
