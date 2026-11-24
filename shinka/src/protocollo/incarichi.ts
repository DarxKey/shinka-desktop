/**
 * Gli incarichi (ADR 0051): chi guida un progetto affida un pezzo di lavoro, l'implementazione con i
 * suoi test, a un altro modello, che lo svolge in una conversazione a parte del progetto, nella
 * stessa cartella, e riporta com'è andata. Chi implementa lo sceglie il proprietario, progetto per
 * progetto. Dati semplici, serializzabili in JSON.
 */

import { IMPEGNI, NOMI_MOTORI, eMotore, type Impegno, type Motore } from "./impostazioni.ts";

/** Chi implementa gli incarichi di un progetto: motore, modello e impegno. */
export interface ChiImplementa {
  /** Se manca vale il motore predefinito dell'installazione. */
  motore?: Motore;
  /** Se manca vale il modello predefinito del motore. */
  modello?: string;
  /** Se manca vale l'impegno predefinito del modello. */
  impegno?: Impegno;
}

/** Ciò che la scheda della sessione mostra e cambia: chi implementa, se il proprietario lo ha scelto. */
export interface StatoChiImplementa {
  chiImplementa?: ChiImplementa;
}

/** Quanto può essere lungo il testo di un incarico, con vincoli, file e criteri. */
export const INCARICO_MASSIMO = 20_000;

/** Quanto può durare al massimo un incarico: poi lo si ferma, e chi guida lo sa. */
export const DURATA_INCARICO_MASSIMA_MS = 3 * 60 * 60 * 1000;

/** Quanto del resoconto di chi implementa torna a chi guida. */
export const RESOCONTO_MASSIMO = 12_000;

/** Ciò che separa, nell'identificativo della conversazione di un incarico, il progetto dall'incarico. */
const SEGNO_INCARICO = "~incarico-";

/** L'identificativo della conversazione di un incarico: comincia con quello del progetto. */
export function conversazioneDellIncarico(idProgetto: string, idIncarico: string): string {
  return `${idProgetto}${SEGNO_INCARICO}${idIncarico}`;
}

/** Vero se la conversazione è quella di un incarico. */
export function eIncarico(idConversazione: string): boolean {
  return idConversazione.includes(SEGNO_INCARICO);
}

/**
 * Il progetto a cui appartiene una conversazione: il progetto stesso, o quello del suo incarico o
 * della sua chat parallela (ADR 0052), che ne portano l'identificativo prima di una tilde.
 */
export function progettoDellaConversazione(idConversazione: string): string {
  const dove = idConversazione.indexOf("~");
  return dove < 0 ? idConversazione : idConversazione.slice(0, dove);
}

/** Riconosce la scelta di chi implementa arrivata da fuori; nulla se non dice niente di valido. */
export function leggiChiImplementa(valore: unknown): ChiImplementa | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const campi = valore as Record<string, unknown>;
  const modello = typeof campi.modello === "string" && campi.modello.trim() !== "" ? campi.modello.trim().slice(0, 200) : undefined;
  const impegno = IMPEGNI.find((livello) => livello === campi.impegno);
  return {
    ...(eMotore(campi.motore) ? { motore: campi.motore } : {}),
    ...(modello === undefined ? {} : { modello }),
    ...(impegno === undefined ? {} : { impegno }),
  };
}

/** Chi implementa, in parole: il modello, il motore se scelto, l'impegno se scelto. */
export function descriviChiImplementa(scelta: ChiImplementa): string {
  const modello = scelta.modello ?? "il modello predefinito";
  const motore = scelta.motore === undefined ? "" : ` di ${NOMI_MOTORI[scelta.motore]}`;
  return `${modello}${motore}${scelta.impegno === undefined ? "" : `, impegno ${scelta.impegno}`}`;
}
