/**
 * Il collegamento di questo PC con il suo centro, da quando c'è un gettone a quando si esce: le
 * richieste, la cache, la sincronizzazione in background, il quadro e le conversazioni seguite.
 */

import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Cache } from "./cache.ts";
import { Centro, type Chiedi } from "./centro.ts";
import type { Dispositivo } from "./dispositivo.ts";
import { Immagini } from "./immagini.ts";
import { Quadro } from "./quadro.ts";
import { cercaInCache, type Trovato } from "./ricerca.ts";
import { Seguite } from "./seguite.ts";
import { Sincronia, type StatoSincronia } from "./sincronia.ts";
import { SportelloDiQui, quadroOffline, type OpzioniSportello } from "./sportello.ts";

/** Com'è il collegamento, per la pagina: se il centro risponde e quanto manca alla cache. */
export interface Situazione extends StatoSincronia {
  collegato: boolean;
  /** Senza centro, il nome dell'ambiente di questo PC, i cui progetti si mandano avanti dal suo nodo (ADR 0011). */
  offline?: string;
}

/** Il progetto di un percorso di base, se è quello di un progetto. */
function progettoDellaBase(base: string): string | undefined {
  const trovato = /^\/api\/progetti\/([^/?#]+)$/.exec(base);
  if (trovato?.[1] === undefined) return undefined;
  try {
    return decodeURIComponent(trovato[1]);
  } catch {
    return undefined;
  }
}

/** Il file della cache di un centro: ogni centro ha il suo, e dal nome non si risale all'indirizzo. */
export function fileDellaCache(cartella: string, centro: string): string {
  return join(cartella, `${createHash("sha256").update(centro).digest("hex").slice(0, 16)}.sqlite`);
}

/** La cartella delle immagini tenute di un centro, accanto alla sua cache. */
export function cartellaDelleImmagini(cartella: string, centro: string): string {
  return fileDellaCache(cartella, centro).replace(/.sqlite$/, "-immagini");
}

/** Butta la cache di un centro: il file, quelli che SQLite gli tiene accanto, e le immagini. */
export function buttaLaCache(cartella: string, centro: string): void {
  const file = fileDellaCache(cartella, centro);
  for (const coda of ["", "-wal", "-shm"]) rmSync(`${file}${coda}`, { force: true });
  rmSync(cartellaDelleImmagini(cartella, centro), { recursive: true, force: true });
}

export class Collegamento {
  readonly dispositivo: Dispositivo;
  readonly centro: Centro;
  readonly cache: Cache;
  readonly sincronia: Sincronia;
  readonly quadro: Quadro;
  readonly seguite: Seguite;
  readonly immagini: Immagini;
  /** Lo sportello del nodo di questo PC, per lavorare ai suoi progetti senza centro. */
  readonly sportello: SportelloDiQui;
  readonly #allaSituazione: (situazione: Situazione) => void;
  #chiuso = false;

  constructor(opzioni: {
    dispositivo: Dispositivo;
    /** La cartella delle cache, nel profilo dell'utente. */
    cartella: string;
    chiedi: Chiedi;
    programma: string;
    /** Il centro ha rifiutato il gettone. */
    alRifiuto: () => void;
    allaSituazione: (situazione: Situazione) => void;
    /** Come si chiede allo sportello del nodo di questo PC; senza, come al centro. */
    chiediLocale?: Chiedi;
    /** Dove trovare lo sportello, nelle prove. */
    sportello?: Pick<OpzioniSportello, "file" | "indirizzo" | "intervalloMs">;
  }) {
    this.dispositivo = opzioni.dispositivo;
    this.#allaSituazione = opzioni.allaSituazione;
    mkdirSync(opzioni.cartella, { recursive: true });
    this.centro = new Centro({
      indirizzo: opzioni.dispositivo.centro,
      gettone: opzioni.dispositivo.gettone,
      chiedi: opzioni.chiedi,
      programma: opzioni.programma,
      alRifiuto: () => {
        if (!this.#chiuso) opzioni.alRifiuto();
      },
    });
    this.cache = Cache.apri(fileDellaCache(opzioni.cartella, opzioni.dispositivo.centro));
    this.immagini = new Immagini(cartellaDelleImmagini(opzioni.cartella, opzioni.dispositivo.centro));
    this.sincronia = new Sincronia({ centro: this.centro, cache: this.cache, alloStato: () => this.#avvisa() });
    this.quadro = new Quadro({ centro: this.centro, cache: this.cache, sincronia: this.sincronia, alCollegamento: () => this.#ricalcola() });
    this.sportello = new SportelloDiQui({ chiedi: opzioni.chiediLocale ?? opzioni.chiedi, programma: opzioni.programma, ...opzioni.sportello, alCambio: () => this.#ricalcola() });
    this.seguite = new Seguite({
      centro: this.centro,
      cache: this.cache,
      quadro: this.quadro,
      sportello: (base) => {
        const idProgetto = progettoDellaBase(base);
        return idProgetto === undefined ? undefined : this.portaPer(idProgetto);
      },
    });
    this.quadro.avvia();
    this.sportello.avvia();
  }

  get situazione(): Situazione {
    const nome = this.offline ? this.sportello.stato?.nome : undefined;
    return { collegato: this.quadro.collegato, ...this.sincronia.stato, ...(nome === undefined ? {} : { offline: nome }) };
  }

  /** Vero se il centro non risponde e il nodo di questo PC, che non lo raggiunge nemmeno lui, ha lo sportello aperto. */
  get offline(): boolean {
    const stato = this.sportello.stato;
    return !this.quadro.collegato && stato !== undefined && !stato.collegato;
  }

  /**
   * Lo sportello, se le richieste di questo progetto vanno lì adesso: offline, per i progetti del
   * nodo di questo PC; con il centro tornato, finché il lavoro cominciato offline non è finito.
   */
  portaPer(idProgetto: string): Centro | undefined {
    const progetto = this.sportello.progetto(idProgetto);
    if (progetto === undefined) return undefined;
    return this.offline || progetto.occupato ? this.sportello.porta : undefined;
  }

  /** Il centro o lo sportello sono cambiati: il quadro della pagina e le conversazioni seguite si adeguano. */
  #ricalcola(): void {
    if (this.#chiuso) return;
    const stato = this.sportello.stato;
    this.quadro.trasforma(this.offline && stato !== undefined ? (messaggio) => quadroOffline(messaggio, stato) : undefined);
    this.seguite.cambiaStrada();
    this.#avvisa();
  }

  /** Cerca nelle conversazioni tenute qui; `completa` è vero se non ne manca nessuna da scaricare. */
  cerca(cercato: string): { risultati: Trovato[]; completa: boolean } {
    const { collegato, mancano, ferma } = this.situazione;
    return { risultati: cercaInCache(this.cache, cercato), completa: collegato && mancano === 0 && !ferma };
  }

  #avvisa(): void {
    if (!this.#chiuso) this.#allaSituazione(this.situazione);
  }

  /** Chiude flussi, coda e cache. Dopo, questo collegamento non si usa più. */
  chiudi(): void {
    if (this.#chiuso) return;
    this.#chiuso = true;
    this.sportello.chiudi();
    this.seguite.chiudi();
    this.quadro.chiudi();
    this.sincronia.chiudi();
    this.cache.chiudi();
  }
}
