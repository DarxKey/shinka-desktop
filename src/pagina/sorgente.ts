/**
 * Il sostituto di `EventSource` (ADR 0007). Le pagine prese da Shinka aprono un flusso di eventi
 * per il quadro e uno per ogni conversazione; qui quei flussi arrivano dal processo principale, che
 * prima manda ciò che ha in cache e poi ciò che viene dal centro. Così le pagine restano uguali a
 * quelle del sito, e una conversazione si vede subito.
 */

import type { MessaggioDelFlusso } from "../ponte/tipi.ts";
import { flussoDi } from "./flussi.ts";
import { ponte } from "./ponte.ts";

type Ascoltatore = (evento: MessageEvent<string>) => void;

class SorgenteDalPonte {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials = false;
  readyState = 0;
  onopen: ((evento: Event) => void) | null = null;
  onmessage: Ascoltatore | null = null;
  onerror: ((evento: Event) => void) | null = null;
  readonly #ascoltatori = new Map<string, Set<Ascoltatore>>();
  readonly #smetti: () => void;

  constructor(che: string, url: string) {
    this.url = url;
    this.#smetti = ponte.segui(che, (messaggi) => {
      for (const messaggio of messaggi) {
        if (this.readyState === this.CLOSED) return;
        try {
          this.#ricevi(messaggio);
        } catch (errore) {
          // Un ascoltatore che sbaglia non ferma gli altri messaggi.
          console.error(errore);
        }
      }
    });
  }

  #ricevi({ nome, dati }: MessaggioDelFlusso): void {
    if (nome === "open") {
      this.readyState = this.OPEN;
      const evento = new Event("open");
      this.onopen?.(evento);
      this.#avvisa("open", evento as MessageEvent<string>);
      return;
    }
    if (nome === "error") {
      // Il collegamento lo riprova l'app: per la pagina è un flusso che si sta ricollegando.
      this.readyState = this.CONNECTING;
      const evento = new Event("error");
      this.onerror?.(evento);
      this.#avvisa("error", evento as MessageEvent<string>);
      return;
    }
    const evento = new MessageEvent<string>(nome, { data: dati });
    if (nome === "message") this.onmessage?.(evento);
    this.#avvisa(nome, evento);
  }

  #avvisa(nome: string, evento: MessageEvent<string>): void {
    const ascoltatori = this.#ascoltatori.get(nome);
    if (ascoltatori !== undefined) for (const ascoltatore of [...ascoltatori]) ascoltatore(evento);
  }

  addEventListener(nome: string, ascoltatore: Ascoltatore): void {
    let ascoltatori = this.#ascoltatori.get(nome);
    if (ascoltatori === undefined) {
      ascoltatori = new Set();
      this.#ascoltatori.set(nome, ascoltatori);
    }
    ascoltatori.add(ascoltatore);
  }

  removeEventListener(nome: string, ascoltatore: Ascoltatore): void {
    this.#ascoltatori.get(nome)?.delete(ascoltatore);
  }

  close(): void {
    if (this.readyState === this.CLOSED) return;
    this.readyState = this.CLOSED;
    this.#smetti();
  }
}

/** Mette il sostituto al posto di `EventSource`: va fatto prima che le pagine ne aprano uno. */
export function sostituisciLeSorgenti(): void {
  const Vera = window.EventSource;
  class Sorgente {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    constructor(indirizzo: string | URL, opzioni?: EventSourceInit) {
      const che = flussoDi(String(indirizzo), window.location.href);
      // Un flusso che l'app non conosce passa dal centro così com'è.
      return (che === undefined ? new Vera(indirizzo, opzioni) : new SorgenteDalPonte(che, String(indirizzo))) as unknown as Sorgente;
    }
  }
  window.EventSource = Sorgente as unknown as typeof EventSource;
}
