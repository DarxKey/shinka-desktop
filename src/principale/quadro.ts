/**
 * Il quadro: ambienti, progetti, argomenti, memoria e il resto, come il centro li manda su un
 * flusso solo. L'app lo tiene sempre aperto: ne salva l'ultima forma nella cache, per mostrarla
 * subito alla prossima apertura e senza connessione, e dagli elenchi capisce quali conversazioni
 * sono cambiate (ADR 0046 di Shinka).
 */

import type { StatoArgomenti } from "../../shinka/src/protocollo/argomenti.ts";
import type { IndiceArchivio } from "../../shinka/src/protocollo/eventi.ts";
import type { StatoProgetti } from "../../shinka/src/protocollo/progetti.ts";
import { chiaveDellArgomento, chiaveDelProgetto, type Cache, type Chiave } from "./cache.ts";
import { ErroreCentro, type Centro } from "./centro.ts";
import type { MessaggioDelFlusso } from "./flusso.ts";
import type { Dichiarata, Sincronia } from "./sincronia.ts";

export const PERCORSO_QUADRO = "/api/quadro/eventi";

/** Quanto si aspetta prima di riprovare un flusso caduto: ogni volta di più, fino a mezzo minuto. */
export const ATTESE_MS = [1_000, 2_000, 5_000, 15_000, 30_000];

/** Un'attesa che il segnale può interrompere. */
export function aspetta(ms: number, segnale: AbortSignal): Promise<void> {
  return new Promise((risolvi) => {
    if (segnale.aborted) return risolvi();
    const sveglia = setTimeout(fine, ms);
    function fine(): void {
      clearTimeout(sveglia);
      segnale.removeEventListener("abort", fine);
      risolvi();
    }
    segnale.addEventListener("abort", fine);
  });
}

type Ascoltatore = (messaggio: MessaggioDelFlusso) => void;

function leggi<T>(dati: string): T | undefined {
  try {
    return JSON.parse(dati) as T;
  } catch {
    return undefined;
  }
}

export class Quadro {
  readonly #centro: Pick<Centro, "flusso">;
  readonly #cache: Cache;
  readonly #sincronia: Pick<Sincronia, "dichiara" | "completo">;
  readonly #alCollegamento: (collegato: boolean) => void;
  readonly #attese: readonly number[];
  readonly #ascoltatori = new Set<Ascoltatore>();
  readonly #fine = new AbortController();
  #collegato = false;
  #trasforma: ((messaggio: MessaggioDelFlusso) => MessaggioDelFlusso) | undefined;

  constructor(opzioni: {
    centro: Pick<Centro, "flusso">;
    cache: Cache;
    sincronia: Pick<Sincronia, "dichiara" | "completo">;
    alCollegamento?: (collegato: boolean) => void;
    attese?: readonly number[];
  }) {
    this.#centro = opzioni.centro;
    this.#cache = opzioni.cache;
    this.#sincronia = opzioni.sincronia;
    this.#alCollegamento = opzioni.alCollegamento ?? (() => {});
    this.#attese = opzioni.attese ?? ATTESE_MS;
  }

  /** Tiene aperto il flusso del quadro finché l'app è collegata a questo centro. */
  avvia(): void {
    void this.#tieniAperto();
  }

  chiudi(): void {
    this.#fine.abort();
    this.#ascoltatori.clear();
  }

  get collegato(): boolean {
    return this.#collegato;
  }

  /** Una pagina guarda il quadro: riceve subito l'ultima forma vista, poi ogni cambiamento. */
  segui(ascoltatore: Ascoltatore): () => void {
    for (const messaggio of this.#cache.quadro()) ascoltatore(this.#vista(messaggio));
    this.#ascoltatori.add(ascoltatore);
    return () => this.#ascoltatori.delete(ascoltatore);
  }

  /**
   * Cambia come le pagine vedono il quadro, senza toccare ciò che è in cache: offline, i progetti e
   * gli ambienti come li dice lo sportello del nodo di questo PC. Le pagine ricevono subito
   * progetti e ambienti nella forma nuova.
   */
  trasforma(trasformazione: ((messaggio: MessaggioDelFlusso) => MessaggioDelFlusso) | undefined): void {
    this.#trasforma = trasformazione;
    for (const messaggio of this.#cache.quadro()) {
      if (messaggio.nome !== "progetti" && messaggio.nome !== "ambienti") continue;
      for (const ascoltatore of this.#ascoltatori) ascoltatore(this.#vista(messaggio));
    }
  }

  #vista(messaggio: MessaggioDelFlusso): MessaggioDelFlusso {
    return this.#trasforma === undefined ? messaggio : this.#trasforma(messaggio);
  }

  /** La conversazione che la Home ha aperta adesso, per quanto ne sa il quadro. */
  argomentoAperto(): { chiave: Chiave; indice?: IndiceArchivio } | undefined {
    const argomenti = this.#leggi<StatoArgomenti>("argomenti");
    const home = this.#leggi<{ argomento?: { id?: string; ultimo?: number; versione?: string } }>("home")?.argomento;
    // Dei due messaggi vale quello che dice l'argomento con il suo indice; la Home lo rimanda più spesso.
    if (typeof home?.id === "string" && home.id !== "" && typeof home.versione === "string" && typeof home.ultimo === "number") {
      if (argomenti === undefined || argomenti.idAperto === home.id || argomenti.aperto === undefined) {
        return { chiave: chiaveDellArgomento(home.id), indice: { versione: home.versione, ultimo: home.ultimo } };
      }
    }
    if (argomenti === undefined || typeof argomenti.idAperto !== "string" || argomenti.idAperto === "") return undefined;
    return { chiave: chiaveDellArgomento(argomenti.idAperto), ...(argomenti.aperto === undefined ? {} : { indice: argomenti.aperto }) };
  }

  #leggi<T>(nome: string): T | undefined {
    const trovato = this.#cache.quadro().find((voce) => voce.nome === nome);
    return trovato === undefined ? undefined : leggi<T>(trovato.dati);
  }

  async #tieniAperto(): Promise<void> {
    const segnale = this.#fine.signal;
    let tentativo = 0;
    while (!segnale.aborted) {
      try {
        for await (const messaggio of this.#centro.flusso(PERCORSO_QUADRO, segnale)) {
          tentativo = 0;
          this.#collega(true);
          this.#ricevi(messaggio);
        }
      } catch (errore) {
        // Un dispositivo rifiutato non riprova: i tentativi falliti il centro li conta per tutti (ADR 0004).
        if (errore instanceof ErroreCentro && errore.stato === 401) {
          this.#collega(false);
          return;
        }
      }
      this.#collega(false);
      await aspetta(this.#attese[Math.min(tentativo, this.#attese.length - 1)] ?? 30_000, segnale);
      tentativo += 1;
    }
  }

  #collega(collegato: boolean): void {
    if (this.#collegato === collegato) return;
    this.#collegato = collegato;
    this.#alCollegamento(collegato);
  }

  #ricevi(messaggio: MessaggioDelFlusso): void {
    this.#cache.scriviQuadro(messaggio.nome, messaggio.dati);
    if (messaggio.nome === "progetti") this.#progetti(leggi<StatoProgetti>(messaggio.dati));
    if (messaggio.nome === "argomenti") this.#argomenti(leggi<StatoArgomenti>(messaggio.dati));
    if (messaggio.nome === "home") this.#home(leggi<{ argomento?: { id?: string; ultimo?: number; versione?: string } }>(messaggio.dati));
    for (const ascoltatore of this.#ascoltatori) ascoltatore(this.#vista(messaggio));
  }

  #progetti(stato: StatoProgetti | undefined): void {
    if (stato === undefined || !Array.isArray(stato.progetti)) return;
    const presenti = new Set<Chiave>();
    const dichiarate: Dichiarata[] = [];
    for (const progetto of stato.progetti) {
      const chiave = chiaveDelProgetto(progetto.id);
      presenti.add(chiave);
      if (progetto.versione !== undefined && progetto.ultimo !== undefined) dichiarate.push({ chiave, indice: { versione: progetto.versione, ultimo: progetto.ultimo } });
    }
    this.#sincronia.completo("progetti", presenti);
    this.#sincronia.dichiara(dichiarate);
  }

  /** La Home dice fin dove arriva l'argomento aperto ogni volta che comincia o smette di lavorare. */
  #home(stato: { argomento?: { id?: string; ultimo?: number; versione?: string } } | undefined): void {
    const argomento = stato?.argomento;
    if (argomento === undefined || typeof argomento.id !== "string" || typeof argomento.versione !== "string" || typeof argomento.ultimo !== "number") return;
    this.#sincronia.dichiara([{ chiave: chiaveDellArgomento(argomento.id), indice: { versione: argomento.versione, ultimo: argomento.ultimo } }]);
  }

  #argomenti(stato: StatoArgomenti | undefined): void {
    if (stato === undefined || !Array.isArray(stato.archiviati)) return;
    const presenti = new Set<Chiave>();
    const dichiarate: Dichiarata[] = [];
    // Per primo l'argomento aperto, poi gli archiviati, che arrivano già dal più recente.
    if (typeof stato.idAperto === "string" && stato.idAperto !== "") {
      const chiave = chiaveDellArgomento(stato.idAperto);
      presenti.add(chiave);
      if (stato.aperto !== undefined) dichiarate.push({ chiave, indice: stato.aperto });
    }
    for (const argomento of stato.archiviati) {
      const chiave = chiaveDellArgomento(argomento.id);
      presenti.add(chiave);
      if (argomento.versione !== undefined && argomento.ultimo !== undefined) dichiarate.push({ chiave, indice: { versione: argomento.versione, ultimo: argomento.ultimo } });
    }
    this.#sincronia.completo("argomenti", presenti);
    this.#sincronia.dichiara(dichiarate);
  }
}
