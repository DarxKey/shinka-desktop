/**
 * La storia leggera, come la fa il centro (`src/centro/storia-leggera.ts` di Shinka): di un'azione
 * conclusa restano un riassunto della richiesta e dell'esito, segnati come accorciati. La cache
 * tiene questa forma (ADR 0003); gli eventi che arrivano in diretta sono interi, e prima di
 * scriverli si alleggeriscono allo stesso modo. Il dettaglio si chiede al centro quando serve.
 */

import type { EventoArchiviato } from "../../shinka/src/protocollo/eventi.ts";

/** Quanto resta di un testo nel riassunto di un'azione conclusa. */
export const LUNGHEZZA_RIASSUNTO = 120;
/** Quante voci restano di un elenco. */
const VOCI_RIASSUNTO = 20;

function accorcia(valore: unknown): { valore: unknown; accorciato: boolean } {
  if (typeof valore === "string") {
    return valore.length <= LUNGHEZZA_RIASSUNTO ? { valore, accorciato: false } : { valore: `${valore.slice(0, LUNGHEZZA_RIASSUNTO)}…`, accorciato: true };
  }
  if (Array.isArray(valore)) {
    let accorciato = valore.length > VOCI_RIASSUNTO;
    const voci = valore.slice(0, VOCI_RIASSUNTO).map((voce: unknown) => {
      const fatto = accorcia(voce);
      accorciato ||= fatto.accorciato;
      return fatto.valore;
    });
    return { valore: voci, accorciato };
  }
  if (typeof valore === "object" && valore !== null) {
    let accorciato = false;
    const campi = Object.fromEntries(
      Object.entries(valore).map(([chiave, voce]) => {
        const fatto = accorcia(voce);
        accorciato ||= fatto.accorciato;
        return [chiave, fatto.valore];
      }),
    );
    return { valore: campi, accorciato };
  }
  return { valore, accorciato: false };
}

/** L'inizio di un'azione che ora è conclusa, con la richiesta ridotta a un riassunto. */
export function inizioLeggero(archiviato: EventoArchiviato): EventoArchiviato {
  const { evento } = archiviato;
  if (evento.tipo !== "azione-iniziata") return archiviato;
  const fatto = accorcia(evento.ingresso);
  return fatto.accorciato ? { ...archiviato, evento: { ...evento, ingresso: fatto.valore, accorciato: true } } : archiviato;
}

/** La conclusione di un'azione, con l'esito ridotto a un riassunto. Ogni altro evento resta com'è. */
export function conclusioneLeggera(archiviato: EventoArchiviato): EventoArchiviato {
  const { evento } = archiviato;
  if (evento.tipo !== "azione-conclusa" || evento.esito.length <= LUNGHEZZA_RIASSUNTO) return archiviato;
  return { ...archiviato, evento: { ...evento, esito: `${evento.esito.slice(0, LUNGHEZZA_RIASSUNTO)}…`, accorciato: true } };
}
