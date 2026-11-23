/**
 * Le scelte del proprietario nella scheda delle domande di Claude, e le risposte che ne escono.
 * Funzioni pure: la scheda tiene lo stato, qui si decide che cosa vuol dire.
 */

import type { Domanda } from "../../src/protocollo/eventi.ts";

/** Ciò che il proprietario ha scelto per una domanda: le risposte proposte e, se vuole, una sua. */
export interface SceltaDiDomanda {
  scelte: string[];
  altro: boolean;
  testoAltro: string;
}

export const SCELTA_VUOTA: SceltaDiDomanda = { scelte: [], altro: false, testoAltro: "" };

/** Il proprietario tocca una delle risposte proposte: con una sola scelta la prende, con più la aggiunge o la toglie. */
export function scegli(domanda: Domanda, scelta: SceltaDiDomanda, etichetta: string): SceltaDiDomanda {
  if (!domanda.piuScelte) return { ...scelta, scelte: [etichetta], altro: false };
  const presa = scelta.scelte.includes(etichetta);
  return { ...scelta, scelte: presa ? scelta.scelte.filter((voce) => voce !== etichetta) : [...scelta.scelte, etichetta] };
}

/** Il proprietario tocca "Altro": con una sola scelta prende il posto delle risposte proposte. */
export function scegliAltro(domanda: Domanda, scelta: SceltaDiDomanda): SceltaDiDomanda {
  if (!domanda.piuScelte) return { ...scelta, scelte: [], altro: true };
  return { ...scelta, altro: !scelta.altro };
}

/**
 * La risposta a una domanda, come la riceve Claude: le scelte nell'ordine in cui le ha proposte,
 * unite da ", ", e poi il testo del proprietario. Undefined se non ha ancora risposto.
 */
export function rispostaDi(domanda: Domanda, scelta: SceltaDiDomanda): string | undefined {
  const scelte = domanda.opzioni.map((opzione) => opzione.etichetta).filter((etichetta) => scelta.scelte.includes(etichetta));
  const altro = scelta.altro ? scelta.testoAltro.trim() : "";
  const parti = [...scelte, ...(altro === "" ? [] : [altro])];
  return parti.length === 0 ? undefined : parti.join(", ");
}

/** Le risposte a tutte le domande, nello stesso ordine; undefined finché ne manca una. */
export function risposteComplete(domande: Domanda[], scelte: SceltaDiDomanda[]): string[] | undefined {
  const risposte = domande.map((domanda, indice) => rispostaDi(domanda, scelte[indice] ?? SCELTA_VUOTA));
  return risposte.every((risposta): risposta is string => risposta !== undefined) ? risposte : undefined;
}
