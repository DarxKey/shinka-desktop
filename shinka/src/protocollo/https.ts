/** L'HTTPS del centro come lo vede l'interfaccia. Dati semplici, serializzabili in JSON. */

export interface DatiCertificato {
  /** L'impronta SHA-256, in coppie esadecimali separate da due punti. */
  impronta: string;
  scadeIl: string;
}

export interface StatoHttps {
  /** Vero se il centro, adesso, parla anche HTTPS. */
  inFunzione: boolean;
  /** Ciò che è scelto per il prossimo avvio. */
  scelta: { attivo: boolean; nomi: string[]; reindirizza: boolean };
  /** Vero se l'accensione la decide una variabile d'ambiente, e la pagina non la può cambiare. */
  decisoDaVariabile: boolean;
  /** Gli indirizzi da cui aprire Shinka in HTTPS. */
  indirizzi: string[];
  /** I nomi per cui vale il certificato del server. */
  nomi: string[];
  server?: DatiCertificato;
  /** La CA di Shinka, da installare sui dispositivi; manca con un certificato proprio. */
  ca?: DatiCertificato;
  proprio: boolean;
  /** Che cosa è cambiato all'ultimo avvio. */
  avvisi: string[];
  /** Perché l'HTTPS è scelto ma non è partito. */
  problema?: string;
  /** Vero se Shinka può ripartire da sé, perché la tiene accesa il guardiano. */
  ripartenza: boolean;
}

/** Dove si scarica la CA e si leggono le istruzioni, anche prima dell'accesso. */
export const PERCORSO_CERTIFICATO = "/certificato";
