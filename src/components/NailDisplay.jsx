import { NailPipRow } from "./NailMeter.jsx";

// Striscia unghie dell'HUD di combattimento → stesso pattern compatto
// condiviso con l'HUD di gioco (stessa pip, stessi stati spenti, stesso
// tooltip). Vedi NailMeter.jsx. La vecchia card verticale 65×80 (uno dei tre
// pattern che l'audit chiedeva di unificare) non aveva più chiamanti dopo la
// fase 2 ed è stata rimossa.
export function NailDisplay({ nails, activeNail, onSelectNail=null }) {
  return <NailPipRow nails={nails} activeNail={activeNail} size="md" onSelectNail={onSelectNail} />;
}
