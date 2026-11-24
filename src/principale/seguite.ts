/**
 * Seguire una conversazione: ciò che una pagina del sito fa aprendo il flusso degli eventi, qui
 * comincia dalla cache (ADR 0003). La pagina riceve subito la storia che c'è in locale e la
 * mostra; intanto l'app apre il flusso del centro da quel punto in poi (ADR 0046 di Shinka), e ciò
 * che arriva si aggiunge sotto e finisce nella cache.
 *
 * Verso la pagina i messaggi hanno gli stessi nomi di un flusso di eventi del browser: `open`
 * quando comincia una storia da capo, `message` per ogni evento, `storia` quando la storia è
 * finita e si può mostrare, `error` quando il collegamento con il centro cade.
 *
 * Senza centro, un progetto che vive su questo PC si segue dallo sportello del suo nodo (ADR 0011):
 * la storia della cache, e sotto ciò che il nodo ha fatto offline, con i numeri che continuano
 * quelli della cache. Quella parte non entra in cache: arriverà dal centro quando il nodo gliel'avrà
 * consegnata.
 */

import { FINE_STORIA, daRicordare, type EventoArchiviato, type IndiceArchivio } from "../../shinka/src/protocollo/eventi.ts";
import { chiaveDellArgomento, chiaveDelProgetto, type Cache, type Chiave } from "./cache.ts";
import { ErroreCentro, type Centro } from "./centro.ts";
import { MESSAGGIO, type MessaggioDelFlusso } from "./flusso.ts";
import { conclusioneLeggera, inizioLeggero } from "./leggera.ts";
import { ATTESE_MS, aspetta, type Quadro } from "./quadro.ts";

export const APERTO = "open";
export const CADUTO = "error";
const AZZERA = "azzera";
const BASE_HOME = "/api/home";

type Manda = (messaggi: MessaggioDelFlusso[]) => void;

/** Lo sportello da cui seguire una conversazione adesso, se va seguita da lì invece che dal centro. */
export type SportelloPer = (base: string) => Pick<Centro, "flusso"> | undefined;

/** La conversazione di un percorso di base: un progetto, un argomento, o `undefined` per la Home e per ciò che non si riconosce. */
export function chiaveDellaBase(base: string): Chiave | undefined {
  const trovato = /^\/api\/(progetti|argomenti)\/([^/?#]+)$/.exec(base);
  if (trovato?.[1] === undefined || trovato[2] === undefined) return undefined;
  let id: string;
  try {
    id = decodeURIComponent(trovato[2]);
  } catch {
    return undefined;
  }
  return trovato[1] === "progetti" ? chiaveDelProgetto(id) : chiaveDellArgomento(id);
}

function messaggio(dati: string): MessaggioDelFlusso {
  return { nome: MESSAGGIO, dati };
}

function leggi(dati: string): EventoArchiviato | undefined {
  try {
    const letto = JSON.parse(dati) as EventoArchiviato;
    return typeof letto === "object" && letto !== null && typeof letto.n === "number" && typeof letto.evento === "object" && letto.evento !== null ? letto : undefined;
  } catch {
    return undefined;
  }
}

export class Seguite {
  readonly #centro: Pick<Centro, "flusso">;
  readonly #cache: Cache;
  readonly #quadro: Pick<Quadro, "argomentoAperto">;
  readonly #attese: readonly number[];
  readonly #aperte = new Set<AbortController>();
  readonly #seguite = new Set<Seguita>();
  readonly #sportello: SportelloPer | undefined;

  constructor(opzioni: { centro: Pick<Centro, "flusso">; cache: Cache; quadro: Pick<Quadro, "argomentoAperto">; attese?: readonly number[]; sportello?: SportelloPer }) {
    this.#centro = opzioni.centro;
    this.#cache = opzioni.cache;
    this.#quadro = opzioni.quadro;
    this.#attese = opzioni.attese ?? ATTESE_MS;
    this.#sportello = opzioni.sportello;
  }

  /** Il centro o lo sportello sono cambiati: ogni conversazione seguita dalla strada sbagliata passa all'altra. */
  cambiaStrada(): void {
    for (const seguita of this.#seguite) seguita.cambiaStrada();
  }

  /**
   * Una pagina segue una conversazione: `base` è `/api/home`, `/api/progetti/<id>` o
   * `/api/argomenti/<id>`. Restituisce la funzione per smettere.
   */
  segui(base: string, manda: Manda): () => void {
    const fine = new AbortController();
    this.#aperte.add(fine);
    const seguita = new Seguita(this.#centro, this.#cache, this.#quadro, this.#attese, base, manda, fine.signal, this.#sportello);
    this.#seguite.add(seguita);
    // Un errore qui non deve fermare l'app: la pagina resta con ciò che ha.
    void seguita
      .vai()
      .catch(() => {})
      .finally(() => this.#seguite.delete(seguita));
    return () => {
      this.#aperte.delete(fine);
      this.#seguite.delete(seguita);
      fine.abort();
    };
  }

  /** Smette di seguire tutto: il collegamento con il centro si chiude. */
  chiudi(): void {
    for (const fine of this.#aperte) fine.abort();
    this.#aperte.clear();
  }
}

/** Una conversazione seguita da una pagina, dal momento in cui la apre a quando la lascia. */
class Seguita {
  readonly #centro: Pick<Centro, "flusso">;
  readonly #cache: Cache;
  readonly #quadro: Pick<Quadro, "argomentoAperto">;
  readonly #attese: readonly number[];
  readonly #base: string;
  readonly #manda: Manda;
  readonly #segnale: AbortSignal;
  /** Dove vanno in cache gli eventi che arrivano. Per la Home dipende dall'argomento aperto, e può non sapersi. */
  #chiave: Chiave | undefined;
  /** La versione dell'archivio che il flusso sta mandando, quando la si sa. */
  #versione: string | undefined;
  /** Vero da quando il centro ha risposto almeno una volta con una storia: da lì la pagina può avere un testo a metà. */
  #haRisposto = false;
  /** Quante storie il centro ha mandato fin qui. */
  #risposte = 0;
  /** Dove sono in cache gli inizi delle azioni ancora in corso, per accorciarli quando si concludono. */
  readonly #azioniInCorso = new Map<string, number>();
  readonly #sportello: SportelloPer | undefined;
  /** Il collegamento di adesso, per chiuderlo quando la strada cambia. */
  #interno: AbortController | undefined;
  /** Vero se il collegamento di adesso è con lo sportello. */
  #dalloSportello = false;
  /** Vero se la pagina ha visto il lavoro offline: tornati al centro, la storia si rimanda da capo. */
  #vistoOffline = false;

  constructor(
    centro: Pick<Centro, "flusso">,
    cache: Cache,
    quadro: Pick<Quadro, "argomentoAperto">,
    attese: readonly number[],
    base: string,
    manda: Manda,
    segnale: AbortSignal,
    sportello?: SportelloPer,
  ) {
    this.#sportello = sportello;
    this.#centro = centro;
    this.#cache = cache;
    this.#quadro = quadro;
    this.#attese = attese;
    this.#base = base;
    this.#manda = manda;
    this.#segnale = segnale;
  }

  get #dellaHome(): boolean {
    return this.#base === BASE_HOME;
  }

  #spedisci(messaggi: MessaggioDelFlusso[]): void {
    if (!this.#segnale.aborted) this.#manda(messaggi);
  }

  async vai(): Promise<void> {
    this.#chiave = this.#dellaHome ? this.#quadro.argomentoAperto()?.chiave : chiaveDellaBase(this.#base);

    // Subito, dalla cache: la pagina mostra ciò che c'è senza aspettare il centro.
    const copia = this.#chiave === undefined ? undefined : this.#cache.indice(this.#chiave);
    let mostrata = false;
    if (this.#chiave !== undefined && copia !== undefined) {
      this.#spedisci([{ nome: APERTO, dati: "" }, ...this.#storiaInCache(this.#chiave), { nome: FINE_STORIA, dati: JSON.stringify(copia) }]);
      mostrata = true;
    }

    let tentativo = 0;
    while (!this.#segnale.aborted) {
      const interno = new AbortController();
      this.#interno = interno;
      const segnale = AbortSignal.any([this.#segnale, interno.signal]);
      const sportello = this.#sportello?.(this.#base);
      this.#dalloSportello = sportello !== undefined;
      try {
        // Finché il centro non ha mai risposto la pagina ha solo la storia della cache: ciò che manca si aggiunge sotto.
        // Dopo, a ogni ricollegamento la storia si rimanda da capo.
        const rispostePrima = this.#risposte;
        if (sportello !== undefined) await this.#collegamentoOffline(sportello, segnale);
        else
          await this.#collegamento(mostrata && !this.#haRisposto && !this.#vistoOffline, segnale).finally(() => {
            if (this.#risposte > rispostePrima) tentativo = 0;
          });
      } catch (errore) {
        if (this.#segnale.aborted) return;
        if (interno.signal.aborted) continue;
        // Un dispositivo rifiutato o una conversazione che non c'è più non si riprovano.
        if (errore instanceof ErroreCentro && (errore.stato === 401 || errore.stato === 404)) {
          this.#spedisci([{ nome: CADUTO, dati: "" }]);
          return;
        }
      }
      if (this.#segnale.aborted) return;
      // La strada è cambiata: si prende subito l'altra, senza dire che è caduto.
      if (interno.signal.aborted) continue;
      this.#spedisci([{ nome: CADUTO, dati: "" }]);
      await aspetta(this.#attese[Math.min(tentativo, this.#attese.length - 1)] ?? 30_000, this.#segnale);
      tentativo += 1;
    }
  }

  /** Se adesso questa conversazione va seguita dall'altra strada, chiude il collegamento di adesso. */
  cambiaStrada(): void {
    if ((this.#sportello?.(this.#base) !== undefined) !== this.#dalloSportello) this.#interno?.abort();
  }

  /**
   * Un collegamento allo sportello del nodo di questo PC: la storia della cache, poi quella offline
   * con i numeri che continuano, poi ciò che arriva. Nulla di questo va in cache.
   */
  async #collegamentoOffline(sportello: Pick<Centro, "flusso">, segnale: AbortSignal): Promise<void> {
    const chiave = this.#chiave;
    const scarto = chiave === undefined ? 0 : (this.#cache.indice(chiave)?.ultimo ?? 0);
    const rinumera = (evento: EventoArchiviato): string => JSON.stringify(evento.n > 0 ? { ...evento, n: evento.n + scarto } : evento);
    let storia: string[] | undefined = [];
    for await (const arrivato of sportello.flusso(`${this.#base}/eventi`, segnale)) {
      if (arrivato.nome === AZZERA) {
        storia = [];
        continue;
      }
      if (arrivato.nome === FINE_STORIA) {
        if (storia === undefined) continue;
        const indice = this.#indiceDa(arrivato.dati);
        const fine = { ultimo: scarto + (indice?.ultimo ?? 0), versione: `offline-${indice?.versione ?? ""}` };
        this.#vistoOffline = true;
        this.#spedisci([
          { nome: APERTO, dati: "" },
          ...(chiave === undefined ? [] : this.#storiaInCache(chiave)),
          ...storia.map(messaggio),
          { nome: FINE_STORIA, dati: JSON.stringify(fine) },
        ]);
        storia = undefined;
        continue;
      }
      if (arrivato.nome !== MESSAGGIO) {
        this.#spedisci([arrivato]);
        continue;
      }
      const evento = leggi(arrivato.dati);
      if (evento === undefined) continue;
      if (storia !== undefined) storia.push(rinumera(evento));
      else this.#spedisci([messaggio(rinumera(evento))]);
    }
  }

  #storiaInCache(chiave: Chiave): MessaggioDelFlusso[] {
    return [...this.#cache.righe(chiave), ...this.#cache.ricordati(chiave)].map(messaggio);
  }

  /**
   * Un collegamento al flusso del centro, dall'apertura a quando cade. `inAggiunta` dice che la
   * pagina ha già la storia della cache: ciò che arriva di nuovo si aggiunge senza ricominciare.
   */
  async #collegamento(inAggiunta: boolean, segnale: AbortSignal): Promise<void> {
    const copia = this.#chiave === undefined ? undefined : this.#cache.indice(this.#chiave);
    const domanda = copia === undefined ? "" : `?${new URLSearchParams({ dopo: String(copia.ultimo), versione: copia.versione }).toString()}`;
    this.#versione = copia?.versione;

    // Finché non arriva la fine della storia gli eventi si tengono da parte.
    let storia: { dati: string; evento: EventoArchiviato }[] | undefined = [];
    // Senza una copia il centro manda tutto da capo, senza dirlo.
    let daCapo = copia === undefined;

    for await (const arrivato of this.#centro.flusso(`${this.#base}/eventi${domanda}`, segnale)) {
      if (arrivato.nome === AZZERA) {
        // La copia non vale più, oppure la Home è passata a un altro argomento: arriva una storia intera.
        storia = [];
        daCapo = true;
        this.#azioniInCorso.clear();
        if (this.#dellaHome) {
          this.#chiave = undefined;
          this.#versione = undefined;
        } else if (this.#chiave !== undefined) {
          this.#cache.togli(this.#chiave);
        }
        continue;
      }

      if (arrivato.nome === FINE_STORIA) {
        if (storia === undefined) continue;
        const indice = this.#indiceDa(arrivato.dati);
        const passeggeri = storia.filter((voce) => voce.evento.n <= 0);
        this.#archivia(storia.map((voce) => voce.evento), indice, daCapo);
        this.#haRisposto = true;
        this.#risposte += 1;

        if (inAggiunta && !daCapo) {
          // La pagina ha già ciò che c'era in cache: riceve solo ciò che è venuto dopo.
          this.#spedisci(storia.map((voce) => messaggio(voce.dati)));
        } else if (daCapo || this.#chiave === undefined) {
          this.#spedisci([{ nome: APERTO, dati: "" }, ...storia.map((voce) => messaggio(voce.dati)), { nome: FINE_STORIA, dati: arrivato.dati }]);
        } else {
          // Dopo una caduta si ricomincia dalla cache, ora in pari: un testo che stava arrivando torna intero.
          this.#spedisci([
            { nome: APERTO, dati: "" },
            ...this.#cache.righe(this.#chiave).map(messaggio),
            ...passeggeri.map((voce) => messaggio(voce.dati)),
            { nome: FINE_STORIA, dati: arrivato.dati },
          ]);
        }
        storia = undefined;
        inAggiunta = false;
        daCapo = false;
        continue;
      }

      if (arrivato.nome !== MESSAGGIO) {
        this.#spedisci([arrivato]);
        continue;
      }
      const evento = leggi(arrivato.dati);
      if (evento === undefined) continue;
      if (storia !== undefined) {
        storia.push({ dati: arrivato.dati, evento });
        continue;
      }
      this.#scrivi(evento);
      this.#spedisci([arrivato]);
    }
  }

  #indiceDa(dati: string): IndiceArchivio | undefined {
    try {
      const letto = JSON.parse(dati) as Partial<IndiceArchivio>;
      return typeof letto.versione === "string" && typeof letto.ultimo === "number" ? { versione: letto.versione, ultimo: letto.ultimo } : undefined;
    } catch {
      return undefined;
    }
  }

  /** La storia appena arrivata va in cache: tutta, se è da capo; altrimenti in coda a ciò che c'era. */
  #archivia(eventi: EventoArchiviato[], indice: IndiceArchivio | undefined, daCapo: boolean): void {
    if (indice === undefined) return;
    this.#versione = indice.versione;
    if (this.#dellaHome && this.#chiave === undefined) {
      // Dopo un passaggio di argomento si sa quale è aperto solo quando il quadro lo dice con questa versione.
      const aperto = this.#quadro.argomentoAperto();
      if (aperto?.indice?.versione === indice.versione) this.#chiave = aperto.chiave;
    }
    if (this.#chiave === undefined) return;
    const archiviati = eventi.filter((evento) => evento.n > 0);
    if (daCapo) {
      this.#cache.togli(this.#chiave);
      this.#cache.aggiungi(this.#chiave, indice.versione, archiviati, indice.ultimo);
    } else {
      const copia = this.#cache.indice(this.#chiave);
      // In coda si aggiunge solo ciò che comincia dove la copia finisce: un buco lo riempie la sincronizzazione.
      const primo = archiviati[0]?.n;
      if (copia?.versione === indice.versione && (primo === undefined || primo === copia.ultimo + 1)) {
        this.#cache.aggiungi(this.#chiave, indice.versione, archiviati, primo === undefined ? copia.ultimo : undefined);
      }
    }
    for (const evento of eventi) this.#ricorda(evento);
  }

  /** Un evento arrivato in diretta: se è archiviato e continua la copia, entra in cache alleggerito. */
  #scrivi(evento: EventoArchiviato): void {
    if (this.#chiave === undefined && this.#dellaHome && this.#versione !== undefined) {
      const aperto = this.#quadro.argomentoAperto();
      if (aperto?.indice?.versione === this.#versione) this.#chiave = aperto.chiave;
    }
    const chiave = this.#chiave;
    if (chiave === undefined) return;
    if (evento.n <= 0) {
      this.#ricorda(evento);
      return;
    }
    const copia = this.#cache.indice(chiave);
    if (copia === undefined || copia.versione !== this.#versione || evento.n !== copia.ultimo + 1) return;
    this.#cache.aggiungi(chiave, copia.versione, [conclusioneLeggera(evento)]);
    if (evento.evento.tipo === "azione-iniziata") this.#azioniInCorso.set(evento.evento.idAzione, evento.n);
    if (evento.evento.tipo === "azione-conclusa") {
      const inizio = this.#azioniInCorso.get(evento.evento.idAzione);
      this.#azioniInCorso.delete(evento.evento.idAzione);
      const iniziata = inizio === undefined ? undefined : this.#cache.evento(chiave, inizio);
      if (iniziata !== undefined) this.#cache.riscrivi(chiave, inizioLeggero(iniziata));
    }
  }

  #ricorda(evento: EventoArchiviato): void {
    if (this.#chiave !== undefined && evento.n <= 0 && daRicordare(evento.evento)) {
      this.#cache.ricorda(this.#chiave, evento.evento.tipo, JSON.stringify(evento));
    }
  }
}
