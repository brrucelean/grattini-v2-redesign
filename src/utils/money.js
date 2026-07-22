// Utility per gestione moneta — evita errori floating point.
// I prezzi delle carte possono essere €0.5, e moltiplicazioni con
// coefficienti (sconto bioma, prizeBoost, ecc.) producono float lunghi:
// es. 0.5 * 0.9 + 50 = 50.45 ma in pratica può finire 50.449999...

/**
 * Arrotonda a 2 decimali (centesimo). Usalo SEMPRE quando aggiorni
 * player.money con un'operazione che potrebbe produrre float lunghi.
 */
export const roundMoney = (n) => Math.round(n * 100) / 100;

/**
 * Formatta un importo per visualizzazione. Se è intero mostra il numero
 * intero, altrimenti 2 decimali. Es: 50 → "50", 50.45 → "50.45", 0.5 → "0.50".
 */
export function fmtMoney(n) {
  const v = roundMoney(n);
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}
