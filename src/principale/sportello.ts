/**
 * Lo sportello del nodo di Shinka di questo PC (ADR 0011, e ADR 0056 di Shinka): quando il centro
 * non si raggiunge, i progetti che vivono su questo PC si mandano avanti da lì. Il nodo scrive tra i
 * suoi dati dove ascolta e con quale gettone; l'app lo rilegge ogni volta, perché a ogni avvio del
 * nodo cambiano. Lo sportello si guarda ogni pochi secondi: se c'è, se il nodo è collegato al centro,
 * quali progetti ha e quali lavorano.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { FILE_SPORTELLO, type IndirizzoDelloSportello, type ProgettoAlloSportello, type StatoDelloSportello } from "../../shinka/src/protocollo/offline.ts";
import type { Ambiente, StatoAmbienti } from "../../shinka/src/protocollo/nodi.ts";
import type { StatoProgetti, VoceProgetto } from "../../shinka/src/protocollo/progetti.ts";
import { Centro, type Chiedi } from "./centro.ts";
import type { MessaggioDelFlusso } from "./flusso.ts";
import { datiDelNodo } from "./luogo.ts";
import { aspetta } from "./quadro.ts";

/** Ogni quanto si guarda lo sportello. */
export const INTERVALLO_SPORTELLO_MS = 3_000;

/** Il file dello sportello del nodo di questo PC. */
export function fileDelloSportello(ambiente: NodeJS.ProcessEnv = process.env, casa: string = homedir()): string {
  return join(datiDelNodo(ambiente, casa), FILE_SPORTELLO);
}

function leggiIndirizzo(file: string): IndirizzoDelloSportello | undefined {
  try {
    const letto = JSON.parse(readFileSync(file, "utf8")) as Partial<IndirizzoDelloSportello>;
    if (typeof letto.porta !== "number" || !Number.isInteger(letto.porta) || letto.porta <= 0 || letto.porta > 65535) return undefined;
    if (typeof letto.gettone !== "string" || letto.gettone === "" || typeof letto.idAmbiente !== "string" || typeof letto.nome !== "string") return undefined;
    return { porta: letto.porta, gettone: letto.gettone, idAmbiente: letto.idAmbiente, nome: letto.nome };
  } catch {
    return undefined;
  }
}

export interface OpzioniSportello {
  /** Come si fa una richiesta allo sportello: va su 127.0.0.1, senza proxy. */
  chiedi: Chiedi;
  programma: string;
  /** Dove sta il file dello sportello. Nelle prove se ne mette un altro. */
  file?: string;
  /** Al posto del file, nelle prove: l'indirizzo dello sportello. */
  indirizzo?: () => IndirizzoDelloSportello | undefined;
  /** Chiamata quando cambia ciò che si sa dello sportello. */
  alCambio: () => void;
  intervalloMs?: number;
}

export class SportelloDiQui {
  readonly #o: OpzioniSportello;
  readonly #fine = new AbortController();
  #indirizzo: string | undefined;
  #porta: Centro | undefined;
  #stato: StatoDelloSportello | undefined;
  #letto = "";

  constructor(opzioni: OpzioniSportello) {
    this.#o = opzioni;
  }

  avvia(): void {
    void this.#guarda();
  }

  chiudi(): void {
    this.#fine.abort();
  }

  /** Ciò che lo sportello ha detto l'ultima volta; nulla se non c'è o non risponde. */
  get stato(): StatoDelloSportello | undefined {
    return this.#stato;
  }

  /** Lo sportello, per mandargli richieste come a un centro. */
  get porta(): Centro | undefined {
    return this.#stato === undefined ? undefined : this.#porta;
  }

  progetto(id: string): ProgettoAlloSportello | undefined {
    return this.#stato?.progetti.find((progetto) => progetto.id === id);
  }

  /** Guarda subito, senza aspettare il prossimo giro: dopo un progetto nuovo, per esempio. */
  async aggiorna(): Promise<void> {
    const indirizzo = this.#o.indirizzo !== undefined ? this.#o.indirizzo() : leggiIndirizzo(this.#o.file ?? fileDelloSportello());
    const chiave = indirizzo === undefined ? undefined : JSON.stringify(indirizzo);
    if (chiave !== this.#indirizzo) {
      this.#indirizzo = chiave;
      this.#porta =
        indirizzo === undefined
          ? undefined
          : new Centro({ indirizzo: `http://127.0.0.1:${indirizzo.porta}`, gettone: indirizzo.gettone, chiedi: this.#o.chiedi, programma: this.#o.programma });
    }
    let stato: StatoDelloSportello | undefined;
    if (this.#porta !== undefined) {
      try {
        stato = await this.#porta.chiama<StatoDelloSportello>("GET", "/api/sportello", undefined, AbortSignal.any([this.#fine.signal, AbortSignal.timeout(2_000)]));
        if (typeof stato !== "object" || stato === null || !Array.isArray(stato.progetti)) stato = undefined;
      } catch {
        stato = undefined;
      }
    }
    if (this.#fine.signal.aborted) return;
    this.#stato = stato;
    const letto = JSON.stringify(stato ?? null);
    if (letto === this.#letto) return;
    this.#letto = letto;
    this.#o.alCambio();
  }

  async #guarda(): Promise<void> {
    while (!this.#fine.signal.aborted) {
      await this.aggiorna();
      await aspetta(this.#o.intervalloMs ?? INTERVALLO_SPORTELLO_MS, this.#fine.signal);
    }
  }
}

/**
 * Il quadro come lo vede la pagina mentre si lavora dallo sportello: l'ambiente di questo PC è
 * attivo e gli altri no; i suoi progetti lavorano o sono fermi come dice lo sportello, quelli nati
 * qui si aggiungono, e gli altri sono spenti. Gli altri messaggi restano come sono.
 */
export function quadroOffline(messaggio: MessaggioDelFlusso, stato: StatoDelloSportello): MessaggioDelFlusso {
  try {
    if (messaggio.nome === "ambienti") {
      const ambienti = JSON.parse(messaggio.dati) as StatoAmbienti;
      if (!Array.isArray(ambienti.ambienti)) return messaggio;
      const qui = ambienti.ambienti.some((ambiente) => ambiente.id === stato.idAmbiente);
      const tutti: Ambiente[] = ambienti.ambienti.map((ambiente) => ({ ...ambiente, attivo: ambiente.id === stato.idAmbiente }));
      if (!qui) tutti.push({ id: stato.idAmbiente, nome: stato.nome, descrizione: "", sistema: stato.sistema, radiceProgetti: stato.radiceProgetti, attivo: true, delCentro: false });
      return { nome: messaggio.nome, dati: JSON.stringify({ ...ambienti, ambienti: tutti }) };
    }
    if (messaggio.nome === "progetti") {
      const progetti = JSON.parse(messaggio.dati) as StatoProgetti;
      if (!Array.isArray(progetti.progetti)) return messaggio;
      const visti = new Set<string>();
      const tutti: VoceProgetto[] = progetti.progetti.map((progetto) => {
        visti.add(progetto.id);
        const qui = stato.progetti.find((uno) => uno.id === progetto.id);
        if (qui === undefined) return { ...progetto, condizione: "ambiente-spento" };
        // Offline lavora solo la chat principale.
        const { chat: _chat, ...senzaChat } = progetto;
        return { ...senzaChat, condizione: qui.occupato ? "al-lavoro" : "fermo" };
      });
      const nati = stato.progetti
        .filter((progetto) => !visti.has(progetto.id))
        .map(
          (progetto): VoceProgetto => ({
            id: progetto.id,
            nome: progetto.nome,
            cartella: progetto.cartella,
            idAmbiente: stato.idAmbiente,
            creatoIl: progetto.creatoIl,
            brief: progetto.brief,
            nomeAmbiente: stato.nome,
            condizione: progetto.occupato ? "al-lavoro" : "fermo",
          }),
        );
      return { nome: messaggio.nome, dati: JSON.stringify({ ...progetti, progetti: [...nati, ...tutti] }) };
    }
  } catch {
    return messaggio;
  }
  return messaggio;
}
