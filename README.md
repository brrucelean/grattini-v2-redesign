# 📱 iPhone Grattini

> Versione mobile-first di **Grattini** — roguelike italiano di gratta-e-vinci, riadattato completamente per iPhone (touch, layout verticale, gesture di grattata).

**Versione desktop originale:** https://github.com/brrucelean/grattini
**Play online:** https://brrucelean.github.io/iphone-grattini/ *(attivo dopo il primo deploy)*

> ⚠️ Questo repo è il fork mobile. Il gioco desktop originale resta su `grattini` e non viene toccato.

---

## Cos'è

Un roguelike a nodi (tipo Slay the Spire) dove invece di carte giochi **gratta-e-vinci**. Ogni run:

- **4 biomi** (Tabacchitalia Nord, Sud, Quartiere Cinese, Boss Arena)
- **5 unghie** come "HP" — degradano grattando, muoiono se ferite troppo
- **15 tipi di grattino**, da *Il Poveraccio* (€0.50) a *Il Maledetto* (€100)
- **Meccaniche diverse per tipo**: match-3, Sette e Mezzo, collect-or-bust, slot, labirinto, mahjong, doppio-o-nulla...
- **Eventi**: ladri, mendicanti, chirurghi-macellai, streamer, polizia
- **Grattatori** (equipaggiabili): Bottone, Plettro, Moneta d'Oro, Porta-Chiavi Leggendario
- **Reliquie** con effetto permanente: Malocchio, Cornetto Rosso, Maneki Neko
- **Economia calibrata**: EV negativo come un vero gratta (t1 ≈ -10%, t2 ≈ -20%, t3 ≈ -30%, t4 ≈ neutro ma varianza enorme)

## Dev

```bash
npm install
npm run dev       # vite dev server → http://localhost:5173
npm run build     # produce dist/
npm run preview   # serve dist/ localmente
```

## Architettura

- `src/scratchlite.jsx` — root component, screen router, tutti gli hook
- `src/hooks/use*Handlers.js` — logica di dominio spezzata per area (scratch, shop, event, node, combat, item)
- `src/data/cards.js` — definizione grattini + `CARD_BALANCE` (single-source-of-truth per winChance / EV)
- `src/data/items.js` — consumabili, grattatori, reliquie, impianti
- `src/data/biomes.js` — palette, nemici, perk di start
- `src/utils/card.js` — `generateCard()` legge CARD_BALANCE e tira premio/win/symbols
- `src/audio.js` — SFX procedurali via WebAudio (niente asset audio)

## Simulazione economia

In dev, apri la console e lancia:

```js
simEV("miliardario", 10000)   // Monte Carlo 10k run, stampa ROI medio
```

Usato per validare l'EV di ogni carta prima di shippare.

## Stack

React 18 · Vite 5 · Zero dipendenze runtime oltre a React. Build ~470 kB (148 kB gzip).

## License

Da decidere. Per ora: tutti i diritti riservati, progetto personale.
