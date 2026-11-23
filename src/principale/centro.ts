/**
 * Il centro di Shinka visto dall'app: le richieste partono dal processo principale, con il gettone
 * del dispositivo e senza `Origin`, come quelle di un programma (ADR 0002 e 0004).
 */

import { leggiFlusso, type MessaggioDelFlusso } from "./flusso.ts";

/** Come si fa una richiesta: `fetch`, o in Electron quello che usa i certificati di Windows. */
export type Chiedi = (indirizzo: string, opzioni: RequestInit) => Promise<Response>;

export type Metodo = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";

/** Il centro ha risposto, e ha detto di no. */
export class ErroreCentro extends Error {
  readonly stato: number;
  readonly riprovaTraSecondi: number | undefined;

  constructor(stato: number, messaggio: string, riprovaTraSecondi?: number) {
    super(messaggio);
    this.stato = stato;
    this.riprovaTraSecondi = riprovaTraSecondi;
  }
}

/** Il centro non ha risposto: manca la rete, o l'indirizzo non è il suo. */
export class NonRaggiungibile extends Error {
  constructor(causa?: unknown) {
    super("Il centro di Shinka non risponde.", { cause: causa });
  }
}

/**
 * L'indirizzo di un centro come lo scrive il proprietario, messo in forma: senza percorso né
 * barra finale, e con `https://` se manca. Restituisce `undefined` se non è un indirizzo.
 */
export function indirizzoDelCentro(scritto: string): string | undefined {
  const pulito = scritto.trim();
  if (pulito === "") return undefined;
  try {
    const indirizzo = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(pulito) ? pulito : `https://${pulito}`);
    if (indirizzo.protocol !== "https:" && indirizzo.protocol !== "http:") return undefined;
    if (indirizzo.hostname === "" || indirizzo.username !== "" || indirizzo.password !== "") return undefined;
    return indirizzo.origin;
  } catch {
    return undefined;
  }
}

/**
 * L'indirizzo intero di un percorso delle API del centro. La pagina può chiedere solo questo:
 * un percorso che comincia con `/api/` e che resta dentro il centro. Altrimenti `undefined`.
 */
export function indirizzoDelleApi(centro: string, percorso: string): string | undefined {
  if (!percorso.startsWith("/api/") || percorso.includes("\\")) return undefined;
  try {
    const indirizzo = new URL(percorso, centro);
    if (indirizzo.origin !== new URL(centro).origin || !indirizzo.pathname.startsWith("/api/")) return undefined;
    return indirizzo.href;
  } catch {
    return undefined;
  }
}

async function erroreDa(risposta: Response): Promise<ErroreCentro> {
  const dati: unknown = await risposta.json().catch(() => ({}));
  const campi = typeof dati === "object" && dati !== null ? (dati as Record<string, unknown>) : {};
  const messaggio = typeof campi.errore === "string" ? campi.errore : `Il centro ha risposto ${risposta.status}.`;
  return new ErroreCentro(risposta.status, messaggio, typeof campi.riprovaTraSecondi === "number" ? campi.riprovaTraSecondi : undefined);
}

export interface OpzioniCentro {
  indirizzo: string;
  /** Il gettone del dispositivo. Manca solo mentre lo si sta chiedendo. */
  gettone?: string;
  chiedi: Chiedi;
  /** Come l'app si presenta: `ShinkaDesktop/<versione>`. */
  programma: string;
  /** Il centro ha rifiutato il gettone: il dispositivo è stato tolto, e serve di nuovo la password. */
  alRifiuto?: () => void;
}

export class Centro {
  readonly indirizzo: string;
  readonly #gettone: string | undefined;
  readonly #chiedi: Chiedi;
  readonly #programma: string;
  readonly #alRifiuto: (() => void) | undefined;

  constructor(opzioni: OpzioniCentro) {
    this.indirizzo = opzioni.indirizzo;
    this.#gettone = opzioni.gettone;
    this.#chiedi = opzioni.chiedi;
    this.#programma = opzioni.programma;
    this.#alRifiuto = opzioni.alRifiuto;
  }

  /** Una richiesta alle API del centro, così com'è: chi la fa guarda da sé la risposta. */
  async richiesta(metodo: Metodo, percorso: string, opzioni: { corpo?: BodyInit; intestazioni?: Record<string, string>; segnale?: AbortSignal } = {}): Promise<Response> {
    const indirizzo = indirizzoDelleApi(this.indirizzo, percorso);
    if (indirizzo === undefined) throw new ErroreCentro(400, "Percorso non ammesso.");
    let risposta: Response;
    try {
      risposta = await this.#chiedi(indirizzo, {
        method: metodo,
        headers: {
          ...opzioni.intestazioni,
          "User-Agent": this.#programma,
          ...(this.#gettone === undefined ? {} : { Authorization: `Bearer ${this.#gettone}` }),
        },
        ...(opzioni.corpo === undefined ? {} : { body: opzioni.corpo }),
        ...(opzioni.segnale === undefined ? {} : { signal: opzioni.segnale }),
        redirect: "error",
      });
    } catch (causa) {
      if (opzioni.segnale?.aborted === true) throw causa;
      throw new NonRaggiungibile(causa);
    }
    if (risposta.status === 401 && this.#gettone !== undefined) this.#alRifiuto?.();
    return risposta;
  }

  /** Una chiamata che parla JSON nei due versi. Se il centro dice di no, lo dice un `ErroreCentro`. */
  async chiama<T = unknown>(metodo: Metodo, percorso: string, corpo?: unknown, segnale?: AbortSignal): Promise<T> {
    const risposta = await this.richiesta(metodo, percorso, {
      ...(corpo === undefined ? {} : { corpo: JSON.stringify(corpo), intestazioni: { "Content-Type": "application/json" } }),
      ...(segnale === undefined ? {} : { segnale }),
    });
    if (!risposta.ok) throw await erroreDa(risposta);
    return (await risposta.json().catch(() => ({}))) as T;
  }

  /** Un flusso di eventi: i suoi messaggi finché il centro lo tiene aperto, o finché il segnale non lo chiude. */
  async *flusso(percorso: string, segnale: AbortSignal): AsyncGenerator<MessaggioDelFlusso> {
    const risposta = await this.richiesta("GET", percorso, { intestazioni: { Accept: "text/event-stream" }, segnale });
    if (!risposta.ok) throw await erroreDa(risposta);
    if (risposta.body === null) return;
    try {
      yield* leggiFlusso(risposta.body);
    } catch (causa) {
      if (segnale.aborted) return;
      throw new NonRaggiungibile(causa);
    }
  }
}

/**
 * Chiede al centro un gettone per questo dispositivo, con la password del proprietario (ADR 0004).
 * La password serve solo qui. Il gettone si vede solo in questa risposta.
 */
export async function aggiungiDispositivo(
  opzioni: { indirizzo: string; chiedi: Chiedi; programma: string },
  password: string,
  nome: string,
): Promise<{ id: string; token: string }> {
  const centro = new Centro(opzioni);
  return await centro.chiama<{ id: string; token: string }>("POST", "/api/dispositivi", { password, nome, genere: "desktop" });
}
