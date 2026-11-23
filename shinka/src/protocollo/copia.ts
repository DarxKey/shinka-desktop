/**
 * La copia di sicurezza dei dati di Shinka (ADR 0042): ciò che centro e interfaccia si dicono.
 * Dati semplici, serializzabili in JSON.
 */

/** Quanto dev'essere lunga, almeno, la password che protegge una copia. */
export const PASSWORD_DELLA_COPIA_MINIMA = 10;

/** Quanto può essere grande una copia caricata. */
export const COPIA_MASSIMA = 16 * 1024 * 1024 * 1024;

/** Una copia preparata, che il proprietario può scaricare. */
export interface CopiaPronta {
  id: string;
  /** Il nome del file che arriva al browser. */
  nome: string;
  byte: number;
  /** Quanti file contiene. */
  file: number;
  /** I percorsi rimasti fuori perché non si potevano leggere o erano troppo grandi. */
  saltati: string[];
}

/** Ciò che una copia dice di sé senza la password. */
export interface CopiaCaricata {
  /** Quando è stata fatta. */
  quando: string;
  /** La versione di Shinka che l'ha fatta, se lo sapeva. */
  versione?: string;
  byte: number;
  /** Che cosa c'è dentro: si sa dopo averla aperta con la sua password. */
  contenuto?: ContenutoDellaCopia;
}

/** Una skill che sta in una copia. */
export interface SkillNellaCopia {
  nome: string;
  descrizione: string;
  /** Qui c'è già una skill con questo nome: "uguale" se il testo è lo stesso. */
  qui?: "uguale" | "diversa";
}

/** Che cosa c'è in una copia aperta. */
export interface ContenutoDellaCopia {
  /** Vero se viene dalla stessa versione di Shinka che è in funzione. */
  stessaVersione: boolean;
  /** Le voci di memoria, e quante di loro qui non ci sono ancora. */
  memoria: { voci: number; nuove: number };
  skill: SkillNellaCopia[];
  progetti: number;
  /** I progetti dell'ambiente del centro la cui cartella qui non c'è: i file dei progetti non stanno nella copia. */
  progettiSenzaCartella: string[];
  argomenti: number;
  /** Quanti file, e quanto occupano una volta aperti. */
  file: number;
  byteAperti: number;
}

/** Che cosa portare qui da una copia, senza toccare il resto. */
export interface ScelteDelTrasloco {
  memoria: boolean;
  /** I nomi delle skill da portare. */
  skill: string[];
}

export interface EsitoTrasloco {
  /** Le voci di memoria aggiunte: quelle che c'erano già non si ripetono. */
  memoria: number;
  skillCreate: string[];
  skillCambiate: string[];
  /** Ciò che non è stato accettato, con il motivo. */
  rifiutati: { che: string; motivo: string }[];
}

/** Com'è andato l'ultimo ripristino, per come lo ha lasciato scritto il centro ripartendo. */
export interface EsitoRipristino {
  quando: string;
  riuscito: boolean;
  /** La copia da cui venivano i dati. */
  copia: { quando: string; versione?: string };
  errore?: string;
}

/** Lo stato delle copie di sicurezza, per la pagina Impostazioni. */
export interface StatoCopie {
  /** Vero se il centro sa ripartire da solo: senza, dopo un ripristino va riavviato a mano. */
  riparte: boolean;
  /** La copia caricata che aspetta una decisione. */
  caricata?: CopiaCaricata;
  ultimoRipristino?: EsitoRipristino;
  /** I dati di prima dell'ultimo ripristino, tenuti da parte: quanto occupano. */
  datiDiPrima?: { byte: number };
}

export function leggiScelteDelTrasloco(valore: unknown): ScelteDelTrasloco | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { memoria, skill } = valore as Record<string, unknown>;
  if (typeof memoria !== "boolean" || !Array.isArray(skill) || skill.length > 500) return undefined;
  if (!skill.every((nome) => typeof nome === "string" && nome.length <= 100)) return undefined;
  return { memoria, skill: [...new Set(skill as string[])] };
}
