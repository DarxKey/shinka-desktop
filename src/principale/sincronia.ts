/**
 * La sincronizzazione in background (ADR 0003): porta nella cache la storia di tutte le
 * conversazioni, chiedendo al centro solo ciò che viene dopo quello che c'è già (ADR 0046 di
 * Shinka). Le rotte della storia non hanno effetti: non avviano motori e non contano come pagine.
 */

import type { IndiceArchivio, PezzoDiStoria } from "../../shinka/src/protocollo/eventi.ts";
import { baseDi, type Cache, type Chiave } from "./cache.ts";
import { ErroreCentro, type Centro } from "./centro.ts";

/** Quanti eventi si chiedono per volta: il centro non ne dà comunque più di mille. */
const PASSO = 1000;
/** Quante conversazioni si scaricano insieme. */
const INSIEME = 2;

/** Ciò che il centro dichiara di una conversazione nel quadro. */
export interface Dichiarata {
  chiave: Chiave;
  indice: IndiceArchivio;
}

export interface StatoSincronia {
  /** Quante conversazioni mancano ancora. */
  mancano: number;
  /** Vero se l'ultima richiesta non è andata: si riprova alla prossima dichiarazione. */
  ferma: boolean;
}

export class Sincronia {
  readonly #centro: Pick<Centro, "chiama">;
  readonly #cache: Cache;
  readonly #alloStato: (stato: StatoSincronia) => void;
  /** Le conversazioni da portare in pari, nell'ordine in cui farlo. */
  readonly #attesa = new Map<Chiave, IndiceArchivio>();
  readonly #inCorso = new Set<Chiave>();
  #ferma = false;
  #chiusa = false;
  #quiete: (() => void)[] = [];

  constructor(opzioni: { centro: Pick<Centro, "chiama">; cache: Cache; alloStato?: (stato: StatoSincronia) => void }) {
    this.#centro = opzioni.centro;
    this.#cache = opzioni.cache;
    this.#alloStato = opzioni.alloStato ?? (() => {});
  }

  /**
   * Il centro ha mandato un elenco: le conversazioni che la cache non ha, o ha più indietro o in
   * un'altra versione, si mettono in coda nell'ordine dato. Una nuova dichiarazione fa riprovare
   * anche dopo un errore.
   */
  dichiara(dichiarate: readonly Dichiarata[]): void {
    if (this.#chiusa) return;
    for (const { chiave, indice } of dichiarate) {
      const copia = this.#cache.indice(chiave);
      if (copia !== undefined && copia.versione === indice.versione && copia.ultimo >= indice.ultimo) {
        this.#attesa.delete(chiave);
        continue;
      }
      this.#attesa.set(chiave, indice);
    }
    this.#ferma = false;
    this.#avanti();
  }

  /**
   * L'elenco di un genere è completo: una conversazione di quel genere che non c'è è stata
   * eliminata, e la sua copia esce dalla cache.
   */
  completo(genere: "progetti" | "argomenti", presenti: ReadonlySet<Chiave>): void {
    for (const chiave of this.#cache.chiavi()) {
      if (chiave.startsWith(`${genere}/`) && !presenti.has(chiave)) this.#cache.togli(chiave);
    }
    for (const chiave of [...this.#attesa.keys()]) {
      if (chiave.startsWith(`${genere}/`) && !presenti.has(chiave)) this.#attesa.delete(chiave);
    }
  }

  get stato(): StatoSincronia {
    return { mancano: this.#attesa.size + this.#inCorso.size, ferma: this.#ferma };
  }

  /** Si risolve quando non c'è più nulla in coda né in corso: per le prove. */
  quiete(): Promise<void> {
    if (this.#attesa.size === 0 && this.#inCorso.size === 0) return Promise.resolve();
    if (this.#ferma && this.#inCorso.size === 0) return Promise.resolve();
    return new Promise((risolvi) => this.#quiete.push(risolvi));
  }

  chiudi(): void {
    this.#chiusa = true;
    this.#attesa.clear();
  }

  #avanti(): void {
    while (!this.#chiusa && !this.#ferma && this.#inCorso.size < INSIEME) {
      const prossima = [...this.#attesa.keys()].find((chiave) => !this.#inCorso.has(chiave));
      if (prossima === undefined) break;
      this.#attesa.delete(prossima);
      this.#inCorso.add(prossima);
      void this.#allinea(prossima)
        .catch((errore: unknown) => {
          // Una conversazione che il centro non ha più si lascia stare; ogni altro errore ferma la coda.
          if (errore instanceof ErroreCentro && errore.stato === 404) return;
          this.#ferma = true;
        })
        .finally(() => {
          this.#inCorso.delete(prossima);
          this.#alloStato(this.stato);
          this.#avanti();
          if (this.#inCorso.size === 0 && (this.#attesa.size === 0 || this.#ferma)) {
            for (const risolvi of this.#quiete.splice(0)) risolvi();
          }
        });
    }
    this.#alloStato(this.stato);
  }

  /** Porta in pari una conversazione: chiede pezzi di storia finché il centro dice che ce ne sono altri. */
  async #allinea(chiave: Chiave): Promise<void> {
    for (;;) {
      if (this.#chiusa) return;
      const copia = this.#cache.indice(chiave);
      const domanda = new URLSearchParams({ limite: String(PASSO) });
      if (copia !== undefined) {
        domanda.set("dopo", String(copia.ultimo));
        domanda.set("versione", copia.versione);
      }
      const pezzo = await this.#centro.chiama<PezzoDiStoria>("GET", `${baseDi(chiave)}/storia?${domanda.toString()}`);
      if (this.#chiusa) return;
      // Un pezzo che comincia da capo dice che la copia non vale più: `aggiungi` la butta se la versione è un'altra,
      // ma può essere la stessa versione con un punto oltre la fine.
      if (pezzo.daCapo && copia !== undefined) this.#cache.togli(chiave);
      const ultimoDelPezzo = pezzo.eventi.at(-1)?.n;
      this.#cache.aggiungi(chiave, pezzo.versione, pezzo.eventi, pezzo.altri ? ultimoDelPezzo : pezzo.ultimo);
      if (!pezzo.altri) return;
      // Un pezzo vuoto che ne promette altri non farebbe mai avanzare: meglio fermarsi.
      if (ultimoDelPezzo === undefined) throw new Error("Il centro ha mandato un pezzo di storia vuoto che ne promette altri.");
    }
  }
}
