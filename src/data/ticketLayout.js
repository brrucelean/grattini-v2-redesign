// ─── TICKET LAYOUT — impaginazione per-biglietto ─────────────
// Le 17 illustrazioni sono state generate senza lock di composizione: banner e
// pannello di gioco cadono in punti diversi su ogni biglietto, quindi un overlay
// unico non impagina bene ovunque. Ogni carta dichiara le SUE due zone, in
// percentuali del box 4:3 del biglietto:
//
//   play   → il rettangolo scuro dell'arte: la griglia delle celle lo riempie
//   header → il cartiglio vuoto dove va il titolo (+ badge costo/max);
//            dir:"row" per fasce basse e larghe (titolo a sinistra, badge a
//            destra), dir:"col" per i cartigli veri e propri.
//
// NON serve modificarlo a mano: in dev apri ?ticket=<id>&edit=1, trascini i
// riquadri sopra il biglietto e premi SALVA — questo file viene riscritto.
// Vedi vite-plugin-ticket-layout.js e TicketLayoutEditor.jsx.
export const TICKET_LAYOUT = {
  fortunaFlash:     { play:{top:43.4, left:7.5, right:7.4, bottom:10.6}, header:{top:8, left:49.1, right:6.3, bottom:66.4, dir:"col"} },
  setteEMezzo:      { play:{top:39.9, left:8, right:8.7, bottom:11.3}, header:{top:13.9, left:21.9, right:22.6, bottom:67, dir:"col"} },
  portaFortuna:     { play:{top:39.5, left:11.8, right:11.7, bottom:13.1}, header:{top:26.2, left:10, right:10, bottom:66, dir:"row"} },
  fintoMilionario:  { play:{top:40.6, left:11.2, right:11.5, bottom:14.3}, header:{top:21.1, left:25.7, right:25.1, bottom:67.5, dir:"col"} },
  puzzle:           { play:{top:39.7, left:12.2, right:12.6, bottom:13.4}, header:{top:23.8, left:24.7, right:26.3, bottom:62.2, dir:"col"} },
  boccaDrago:       { play:{top:48.5, left:9.7, right:9.9, bottom:11.2}, header:{top:32.5, left:26.2, right:26.4, bottom:54.6, dir:"col"} },
  miliardario:      { play:{top:40.6, left:11.4, right:11.6, bottom:13.8}, header:{top:21, left:18.2, right:16.8, bottom:63, dir:"col"} },
  tredici:          { play:{top:36.5, left:8.2, right:8.6, bottom:10.7}, header:{top:3.1, left:25.5, right:24.8, bottom:76, dir:"col"} },
  maledetto:        { play:{top:36.2, left:11.5, right:10.6, bottom:13.8}, header:{top:19.8, left:25, right:27.4, bottom:66.9, dir:"col"} },
  ruota:            { play:{top:31.9, left:-7.9, right:-6.4, bottom:-3.9}, header:{top:8.1, left:8.2, right:7.8, bottom:76.9, dir:"col"} },
  labirinto:        { play:{top:37.9, left:9.2, right:8.5, bottom:11.5}, header:{top:21, left:2.9, right:2.8, bottom:70.5, dir:"row"} },
  grattaCombina:    { play:{top:44.8, left:7.7, right:8.3, bottom:11.5}, header:{top:26.3, left:9.2, right:7.8, bottom:57.7, dir:"col"} },
  mappaTesor0:      { play:{top:41.4, left:11.9, right:12, bottom:14.1}, header:{top:10.2, left:20, right:16.7, bottom:60.9, dir:"col"} },
  doppioOnulla:     { play:{top:10.1, left:-12.4, right:-12.7, bottom:-3.9}, header:{top:15, left:11.4, right:14.6, bottom:77.5, dir:"row"} },
  mahjong:          { play:{top:39.5, left:7.3, right:7.4, bottom:10.3}, header:{top:10.2, left:17.6, right:16.7, bottom:71.8, dir:"col"} },
  jackpotMix:       { play:{top:39.1, left:6.8, right:6.6, bottom:8.3}, header:{top:5.5, left:24, right:24.7, bottom:76, dir:"col"} },
  turistaPerSempre: { play:{top:43.4, left:9.8, right:9.8, bottom:12.7}, header:{top:20.7, left:29.4, right:29.2, bottom:69.2, dir:"col"} },
};

export const TICKET_LAYOUT_FALLBACK = {
  play:   { top:40, left:6, right:6, bottom:6 },
  header: { top:2,  left:6, right:6, bottom:86, dir:"row" },
};

// Layout effettivo di una carta (con fallback se non ancora impaginata).
export function ticketLayout(cardId) {
  return TICKET_LAYOUT[cardId] || TICKET_LAYOUT_FALLBACK;
}

// inset CSS da un rect in percentuali
export const inset = r => `${r.top}% ${r.right}% ${r.bottom}% ${r.left}%`;
