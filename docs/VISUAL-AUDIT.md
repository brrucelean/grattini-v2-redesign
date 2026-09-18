# Grattini — audit visuale, 17 settembre 2026

## Evidenza e limiti

Sorgente esaminato: main `78d27a325672565dee6b23a8d6026ecf2b2dcdee`.
`npm ci` e `npm run build` completati. Vite avviato su 127.0.0.1:5173.
Il browser remoto non raggiunge localhost: la sessione giocata e gli screenshot
provengono da https://brrucelean.github.io/grattini-v2-redesign/.
Non è stata verificata l'identità del commit pubblicato con quello locale.
Viewport screenshot: 1363 × 936. Nessuna verifica mobile effettuata.

La sessione percorre tutorial, Nonno Carmelo, Sette e Mezzo (sballato a 8),
mappa, tabaccaio, acquisto, selezione biglietto, spacciatore, ladro elite,
combattimento fino al quarto turno. Verificati drag di grattata, blocco Fortezza,
timing attacco, scudo, fine turno e Furia. La connessione al browser si è bloccata
nel quarto turno: non si dichiara una run completa né copertura di tutte le schermate.

## Screenshot raccolti

01 title; 02 tutorial unghie; 03 tutorial combat; 04 tutorial mappa;
05 Nonno Carmelo; 06 Sette e Mezzo; 07 esito ticket; 08 mappa;
09 pre-nodo; 10 shop; 11 selezione ticket; 12 evento spacciatore;
13 combat intro; 14 combat griglia; 15 timing; 16 fine turno.

I file originali sono consegnati separatamente; non incorporare immagini
ricampionate nel pacchetto delle evidenze.

## Riscontri osservati

| Priorità | Riscontro | Effetto | Decisione per il pilota |
| --- | --- | --- | --- |
| Alta | Carte combat cambiano altezza mentre cresce il log | Il bersaglio si muove durante l'interazione | Coordinate e dimensioni fisse; log in area separata |
| Alta | Unghie in HUD, sidebar e combat | Ridondanza e spazio sottratto al tavolo | Una sola fascia di selezione, stato e usura |
| Alta | Illustrazioni dettagliate, emoji, ASCII, Courier e neon nello stesso frame | Nessuna densità di pixel comune | Bitmap e sprite a risoluzione nativa; palette comune |
| Alta | Carte del combat tutte oro | Tre categorie distinte sembrano lo stesso prodotto | Ticket rosso, ciano e giallo, con label e pattern distinti |
| Media | Shop con scroll e prodotti molto scuri quando non acquistabili | Catalogo difficile da leggere | Articoli leggibili anche se non acquistabili; vincolo sul prezzo/azione |
| Media | Mappa con nomi e sprite piccoli nel campo ampio | Percorso meno leggibile dei bordi | Disegnare una mappa dedicata, senza scalare una lista |
| Media | Fine turno sostituisce il tavolo con un grande log | Sparisce il contesto del turno | Tenere il tavolo e mostrare l'azione in fascia fissa |
| Media | Tutorial e dialogo Nonno discordano sulla penalità del sangue | Regole percepite incoerenti | Correggere il copy separatamente: `NAIL_INFO.sanguinante.mult` è 1 |

## Presentation layer

- `src/scratchlite.jsx`: router, cornice, sfondo, overlay, HUD, sidebar e numerose schermate inline.
- `src/components/CombatView.jsx`: stato del duello, risoluzione effetti, timing, patina scratch e JSX inline. Non riscrivere gli effetti per cambiare la grafica.
- `src/components/{HUD,NailSidebar,NailDisplay,ShopView,EventView,MapView}.jsx`: presentazione condivisa e viste principali.
- `src/components/{ScratchCardView,TicketHeader,TicketThumb,ScratchCell}.jsx`: composizione ticket e superficie grattabile.
- `src/data/theme.js`, `src/styles/animations.js`: token esistenti, ma numerosi valori sono ancora inline.
- `src/assets/registry.js`, `src/assets/img/`: immagini e fallback. `image-rendering:pixelated` da solo non converte questi asset in pixel art coerente.
- `src/styles/pixelSystem.js`: fondazione già presente nella branch `design/pixel-art-rework`, recuperata nel lavoro attuale.

## Copertura ancora da completare

Locanda e sogni; inventario popolato e uso oggetti; reliquie/impianti;
altri eventi e nodi segreti; cella; labirinto; gratta-combina; mappa tesoro;
doppio-o-nulla; varianti degli altri ticket; boss e cambi di bioma;
cedole, vittoria finale, game over; collezioni e statistiche del menu;
timing parata effettivo; viewport mobile.

Questa lista è un gate di verifica residua, non una dichiarazione di schermate viste.
