/**
 * Le attività di una conversazione: i comandi che Claude lascia lavorare in background e gli
 * agenti (subagent) a cui affida un pezzo di lavoro, in primo piano o in background. Il proprietario
 * le vede nella scheda della sessione, con il loro stato, un riassunto e, a richiesta, l'uscita.
 * Dati semplici, serializzabili in JSON.
 */

export type StatoAttivita = "in-corso" | "finita" | "fallita" | "fermata";

export interface Attivita {
  id: string;
  /** "agente" per un subagent, "comando" per un comando in background, "altro" per il resto. */
  genere: "agente" | "comando" | "altro";
  descrizione: string;
  stato: StatoAttivita;
  /** Vero se lavora in background: Claude intanto fa altro, e saprà quando finisce. */
  inSfondo: boolean;
  /** Il tipo di agente, per un subagent: per esempio "general-purpose". */
  tipoAgente?: string;
  /** L'ultimo strumento che ha usato, mentre lavora. */
  ultimoStrumento?: string;
  /** Una riga sul punto in cui è, o com'è finita. */
  riassunto?: string;
  strumentiUsati?: number;
  durataMs?: number;
  /** Vero se la sua uscita si può leggere. */
  conUscita?: boolean;
  /** L'attività che l'ha lanciata, se è un agente. */
  genitore?: string;
}

/** Quante attività finite si tengono, oltre a quelle in corso. */
export const ATTIVITA_FINITE_TENUTE = 20;

/** Quanto dell'uscita di un'attività si mostra: la parte finale. */
export const USCITA_MOSTRATA = 64 * 1024;

const STATI: readonly StatoAttivita[] = ["in-corso", "finita", "fallita", "fermata"];

export function leggiAttivita(valore: unknown): Attivita[] | undefined {
  if (!Array.isArray(valore)) return undefined;
  return valore.slice(0, 100).flatMap((voce: unknown) => {
    if (typeof voce !== "object" || voce === null) return [];
    const campi = voce as Record<string, unknown>;
    const { id, genere, descrizione, stato } = campi;
    if (typeof id !== "string" || typeof descrizione !== "string") return [];
    if (genere !== "agente" && genere !== "comando" && genere !== "altro") return [];
    if (!STATI.includes(stato as StatoAttivita)) return [];
    const testo = (nome: string): Record<string, string> => (typeof campi[nome] === "string" ? { [nome]: (campi[nome] as string).slice(0, 2000) } : {});
    const numero = (nome: string): Record<string, number> => (typeof campi[nome] === "number" ? { [nome]: campi[nome] as number } : {});
    return [
      {
        id,
        genere,
        descrizione: descrizione.slice(0, 500),
        stato: stato as StatoAttivita,
        inSfondo: campi.inSfondo === true,
        ...testo("tipoAgente"),
        ...testo("ultimoStrumento"),
        ...testo("riassunto"),
        ...testo("genitore"),
        ...numero("strumentiUsati"),
        ...numero("durataMs"),
        ...(campi.conUscita === true ? { conUscita: true } : {}),
      },
    ];
  });
}
