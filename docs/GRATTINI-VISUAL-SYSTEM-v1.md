# GRATTINI VISUAL SYSTEM v1

Videogioco DOS/PICO-8 incontra gratta-e-vinci italiano stampato male nel 1997.

## Regole

- Frame logico 640×360; scaling intero e letterbox. Sotto 640×360: scroll a 1×,
  non un ridimensionamento frazionario. Un layout mobile verticale è lavoro separato.
- Griglia compositiva 8 px; bordi e dettaglio sprite 1–2 px. Non confondere la
  griglia di impaginazione con un obbligo di disegnare ogni tratto spesso 8 px.
- Palette finita da `pixelSystem.js`. Mondo scuro e poco saturo; ticket rossi,
  ciano, gialli. Colore più label più pattern: la categoria non dipende solo dal colore.
- Testi bitmap, tratti interi, nessun antialias nel renderer. Il browser non deve
  inventare un font da una fallback di sistema. Accenti normalizzati nel pilota;
  estensione del set italiano necessaria per la produzione.
- Niente blur, glow, gradienti morbidi, bordi arrotondati o scale elastiche.
- Stessa silhouette per tutti i ticket combat; patina argento, testata commerciale,
  numero seriale e cornice stampata. Le categorie restano quelle reali del motore.
- Il pilota riusa il motore del duello; non altera pool, probabilità, danni o timing.

## Master combat

| Area | x, y | Dimensione | Contenuto |
| --- | --- | --- | --- |
| Testata | 8, 8 | 624×72 | Nemico, HP, scudo, turno e intenti |
| Tavolo | 8, 88 | 448×216 | Nove ticket fissi, 3×3 |
| Diario | 464, 88 | 168×216 | Bottino, ultime righe e stato |
| Unghie / azione | 8, 312 | 624×40 | Cinque unghie selezionabili e azione di fase |

Ticket: 136×56, origine 24,112, passo orizzontale 144, verticale 64.
Log ed effetti non possono modificare questi rettangoli.
Il timing copre temporaneamente il tavolo con una finestra netta; il tavolo
rimane sotto, senza filtri. Il cursore viene disegnato a coordinate intere,
mentre la precisione temporale del motore resta invariata.

## Reference

- [Chroma Noir](https://v3x3d.itch.io/chroma-noir): disciplina 8×8 e silhouette;
  non importare il suo tema platformer o la sua monocromia come identità del gioco.
- [DUNGEON.mode](https://datagoblin.itch.io/dungeonmode): linguaggio bitmap.
- [Casino](https://reflector88.itch.io/casino): grammatica da gioco di casinò.
- [8Bit Deck](https://drawsgood.itch.io/8bit-deck-card-assets): leggibilità e famiglia delle carte.

Nessun asset commerciale delle reference è incluso in questa branch. Font
essenziale e simboli del pilota sono definiti in codice. Il ritratto pilota è
un segnaposto pixel disegnato appositamente, non il set finale dei nemici.

## Attivazione e limiti

Il pilota si attiva aggiungendo `?visual=pixel` all'URL e arrivando a un combattimento.
Il resto della run usa le viste attuali. Durante il pilota le cinque unghie sono
selezionabili; il pannello inventario completo resta da migrare. Il renderer
è sperimentale: build e invarianti geometriche non sostituiscono una prova visuale
e una run completa nel browser. Non promuovere automaticamente questa branch su main.
