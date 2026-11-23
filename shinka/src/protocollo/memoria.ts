/** La memoria: preferenze e fatti sul proprietario che valgono in ogni conversazione. */

/** Una voce è una frase sola: più lunga di così non è una preferenza, è un documento. */
export const VOCE_MEMORIA_MASSIMA = 400;

/** Oltre questo numero la memoria costerebbe troppo a ogni conversazione che la riceve. */
export const VOCI_MEMORIA_MASSIME = 120;

export interface VoceMemoria {
  id: string;
  testo: string;
  /** Il giorno in cui è stata annotata o corretta l'ultima volta, come AAAA-MM-GG. */
  annotataIl: string;
}

export interface StatoMemoria {
  voci: VoceMemoria[];
}
