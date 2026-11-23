/**
 * Le modifiche ai file di un turno: i file cambiati mentre Claude lavorava, com'erano prima del
 * turno e come sono alla fine. Ci sono quelli che Claude ha cambiato con i suoi strumenti di
 * modifica e, dove si fanno le fotografie dei file, quelli cambiati dai comandi che ha eseguito.
 * Il proprietario le rivede nel pannello Modifiche e può riportare i file a com'erano, uno per uno
 * o tutto il turno. Dati semplici, serializzabili in JSON.
 */

/** Un file cambiato in un turno, in breve. */
export interface FileModificato {
  /** Relativo alla cartella del progetto; assoluto se il file sta fuori. */
  percorso: string;
  aggiunte: number;
  tolte: number;
  /** "nuovo" se prima non c'era, "tolto" se alla fine non c'è più. */
  stato: "cambiato" | "nuovo" | "tolto";
  /** Non lo ha cambiato uno strumento di modifica: lo dice il confronto tra le fotografie del turno. */
  daComando?: true;
}

/**
 * Se in una conversazione si vedono i file cambiati dai comandi: servono le fotografie dei file,
 * che non si fanno dove manca Git o dove il progetto è troppo grande.
 */
export type FileDeiComandi = { guardati: true } | { guardati: false; motivo: string };

/** Com'era un file prima del turno e com'è alla fine: null se non c'era. */
export interface VersioniDiUnFile {
  prima: string | null;
  dopo: string | null;
}

/** Com'è andato il ritorno indietro di alcuni file. */
export interface EsitoAnnullamento {
  annullati: string[];
  nonAnnullati: { percorso: string; motivo: string }[];
}

/**
 * Che cosa ha deciso il proprietario di alcuni file di un turno. Oggi solo «annullate»: i file
 * riportati com'erano. «accettate» resta per le conversazioni di quando il pannello lo chiedeva.
 */
export type DecisioneModifiche = "accettate" | "annullate";

/** Quanto può essere grande un file perché se ne tengano le versioni. */
export const FILE_MASSIMO = 1024 * 1024;

/** Di quanti turni si tengono le modifiche. */
export const TURNI_TENUTI = 40;

/** Gli strumenti dell'harness che cambiano un file, con il campo che dice quale. */
export const STRUMENTI_DI_MODIFICA: Readonly<Record<string, string>> = {
  Edit: "file_path",
  MultiEdit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
};

/**
 * Ciò che il centro chiede alla conversazione di un progetto su un nodo: per il pannello Modifiche,
 * e l'uscita di un'attività per la scheda della sessione.
 */
export type RichiestaAllaConversazione =
  | { tipo: "versioni"; idTurno: string; percorso: string }
  | { tipo: "annulla-modifiche"; idTurno: string; percorsi?: string[] }
  | { tipo: "uscita-attivita"; idAttivita: string };

export function leggiRichiestaAllaConversazione(valore: unknown): RichiestaAllaConversazione | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { tipo, idTurno, percorso, percorsi, idAttivita } = valore as Record<string, unknown>;
  if (tipo === "uscita-attivita") return typeof idAttivita === "string" && idAttivita !== "" && idAttivita.length <= 200 ? { tipo, idAttivita } : undefined;
  if (typeof idTurno !== "string" || idTurno === "" || idTurno.length > 100) return undefined;
  if (tipo === "versioni") return typeof percorso === "string" && percorso !== "" && percorso.length <= 4000 ? { tipo, idTurno, percorso } : undefined;
  if (tipo !== "annulla-modifiche") return undefined;
  if (percorsi === undefined) return { tipo, idTurno };
  if (!Array.isArray(percorsi) || percorsi.length > 1000 || !percorsi.every((voce) => typeof voce === "string" && voce.length <= 4000)) return undefined;
  return { tipo, idTurno, percorsi: percorsi as string[] };
}

/** Il nome di una cartella che viene da un identificativo: niente che porti fuori. */
export function nomeDiCartella(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_") || "_";
}

export function leggiVersioni(valore: unknown): VersioniDiUnFile | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { prima, dopo } = valore as Record<string, unknown>;
  const valida = (versione: unknown): versione is string | null => versione === null || (typeof versione === "string" && versione.length <= FILE_MASSIMO * 4);
  return valida(prima) && valida(dopo) ? { prima, dopo } : undefined;
}

export function leggiEsitoAnnullamento(valore: unknown): EsitoAnnullamento | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { annullati, nonAnnullati } = valore as Record<string, unknown>;
  if (!Array.isArray(annullati) || !Array.isArray(nonAnnullati)) return undefined;
  return {
    annullati: annullati.filter((voce): voce is string => typeof voce === "string").slice(0, 1000),
    nonAnnullati: nonAnnullati
      .flatMap((voce: unknown) => {
        if (typeof voce !== "object" || voce === null) return [];
        const { percorso, motivo } = voce as Record<string, unknown>;
        return typeof percorso === "string" && typeof motivo === "string" ? [{ percorso, motivo: motivo.slice(0, 1000) }] : [];
      })
      .slice(0, 1000),
  };
}
