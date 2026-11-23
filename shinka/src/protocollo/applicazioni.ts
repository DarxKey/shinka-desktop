/**
 * L'applicazione di un progetto: il programma che serve la sua anteprima, avviato e fermato da
 * Shinka nell'ambiente del progetto con un comando che il progetto ha dato. Qui stanno ciò che il
 * centro chiede a chi sta nell'ambiente, ciò che ne torna, e le regole che valgono da tutte e due
 * le parti. Sono dati semplici, serializzabili in JSON.
 *
 * Ogni progetto ha al più un'applicazione, che si riconosce dall'identificativo del progetto.
 * Avviare un'applicazione già accesa non ne avvia una seconda, e fermarne una ferma non è un errore.
 */

import { percorsoValido, portaValida } from "./anteprima.ts";

/** Come si avvia l'applicazione di un progetto: il comando, che resta in primo piano, e la porta su cui risponde. */
export interface AvvioApplicazione {
  comando: string;
  porta: number;
  /** La pagina da mostrare per prima nell'anteprima. */
  percorso: string;
}

/** Quanto può essere lungo il comando. */
export const COMANDO_MASSIMO = 2000;

/** Quante righe dell'uscita si tengono, e quante se ne mostrano. */
export const RIGHE_TENUTE = 400;
export const RIGHE_MOSTRATE = 40;

/** Quanto si aspetta che un'applicazione appena avviata cominci a rispondere sulla sua porta. */
export const ATTESA_AVVIO_MS = 90_000;

/**
 * In che condizione è l'applicazione: risponde sulla sua porta ("attiva"), è partita ma non
 * risponde ancora ("in-avvio"), non gira ("ferma"), si è fermata da sola con un errore ("fallita"),
 * oppure sulla sua porta risponde qualcosa che non ha avviato Shinka ("fuori-da-shinka").
 */
export type CondizioneApplicazione = "attiva" | "in-avvio" | "ferma" | "fallita" | "fuori-da-shinka";

export interface StatoApplicazione {
  condizione: CondizioneApplicazione;
  /** Le ultime righe dell'uscita del comando, se Shinka lo ha avviato. */
  righe: string[];
  /** Perché è fallita, o che cosa sapere della sua condizione. */
  motivo?: string;
}

/** Ciò che il centro chiede a chi tiene le applicazioni di un ambiente. */
export type ComandoApplicazione =
  | { tipo: "applicazione-avvia"; idRichiesta: string; idApplicazione: string; cartella: string; comando: string; porta: number }
  | { tipo: "applicazione-ferma"; idRichiesta: string; idApplicazione: string }
  | { tipo: "applicazione-stato"; idRichiesta: string; idApplicazione: string; porta: number };

/** Ciò che torna dall'ambiente: com'è l'applicazione dopo ciò che è stato chiesto. */
export type RiferitoApplicazione = { tipo: "applicazione-esito"; idRichiesta: string; stato: StatoApplicazione };

/** Chi tiene le applicazioni di un ambiente, visto dal centro. */
export interface PortaApplicazioni {
  esegui(comando: ComandoApplicazione): void;
}

const CONDIZIONI: readonly CondizioneApplicazione[] = ["attiva", "in-avvio", "ferma", "fallita", "fuori-da-shinka"];

/** Il comando di avvio, se è fatto come deve: una riga sola, non vuota, non troppo lunga. */
export function comandoValido(comando: unknown): comando is string {
  return typeof comando === "string" && comando.trim() !== "" && comando.length <= COMANDO_MASSIMO && !/[\r\n\0]/.test(comando);
}

/** Legge come si avvia un'applicazione; undefined se non è fatto come deve. */
export function leggiAvvio(valore: unknown): AvvioApplicazione | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { comando, porta, percorso } = valore as Record<string, unknown>;
  if (!comandoValido(comando) || !portaValida(porta)) return undefined;
  const pagina = percorso === undefined || percorso === "" ? "/" : percorso;
  if (!percorsoValido(pagina)) return undefined;
  return { comando: comando.trim(), porta, percorso: pagina };
}

function testo(campi: Record<string, unknown>, nome: string, massimo = 1000): string | undefined {
  const valore = campi[nome];
  return typeof valore === "string" && valore.length > 0 && valore.length <= massimo ? valore : undefined;
}

export function leggiComandoApplicazione(campi: Record<string, unknown>): ComandoApplicazione | undefined {
  const idRichiesta = testo(campi, "idRichiesta", 100);
  const idApplicazione = testo(campi, "idApplicazione", 100);
  if (idRichiesta === undefined || idApplicazione === undefined) return undefined;
  switch (campi.tipo) {
    case "applicazione-avvia": {
      const cartella = testo(campi, "cartella");
      const { comando, porta } = campi;
      if (cartella === undefined || !comandoValido(comando) || !portaValida(porta)) return undefined;
      return { tipo: "applicazione-avvia", idRichiesta, idApplicazione, cartella, comando, porta };
    }
    case "applicazione-ferma":
      return { tipo: "applicazione-ferma", idRichiesta, idApplicazione };
    case "applicazione-stato":
      return portaValida(campi.porta) ? { tipo: "applicazione-stato", idRichiesta, idApplicazione, porta: campi.porta } : undefined;
    default:
      return undefined;
  }
}

export function leggiStatoApplicazione(valore: unknown): StatoApplicazione | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { condizione, righe, motivo } = valore as Record<string, unknown>;
  if (!CONDIZIONI.includes(condizione as CondizioneApplicazione) || !Array.isArray(righe)) return undefined;
  const lette = righe.filter((riga): riga is string => typeof riga === "string").slice(-RIGHE_MOSTRATE).map((riga) => riga.slice(0, 2000));
  return {
    condizione: condizione as CondizioneApplicazione,
    righe: lette,
    ...(typeof motivo === "string" ? { motivo: motivo.slice(0, 2000) } : {}),
  };
}

export function leggiRiferitoApplicazione(campi: Record<string, unknown>): RiferitoApplicazione | undefined {
  if (campi.tipo !== "applicazione-esito") return undefined;
  const idRichiesta = testo(campi, "idRichiesta", 100);
  const stato = leggiStatoApplicazione(campi.stato);
  return idRichiesta === undefined || stato === undefined ? undefined : { tipo: "applicazione-esito", idRichiesta, stato };
}

/** La condizione in parole, per il proprietario e per Claude. */
export const CONDIZIONE_IN_PAROLE: Record<CondizioneApplicazione, string> = {
  attiva: "attiva",
  "in-avvio": "in avvio",
  ferma: "ferma",
  fallita: "fallita",
  "fuori-da-shinka": "avviata fuori da Shinka",
};
