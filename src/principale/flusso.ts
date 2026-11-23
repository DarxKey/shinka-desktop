/**
 * Lettura di un flusso di eventi del centro (`text/event-stream`): il centro manda ogni dato come
 * `event: <nome>` e `data: <json>`, separati da una riga vuota, e ogni tanto un commento per tenere
 * vivo il collegamento. Un messaggio senza nome si chiama `message`, come per un browser.
 */

export interface MessaggioDelFlusso {
  nome: string;
  dati: string;
}

/** Il nome di un messaggio che il centro manda senza nome. */
export const MESSAGGIO = "message";

/** Ricompone i messaggi dai pezzi di testo che arrivano, comunque siano tagliati. */
export class LettoreDiFlusso {
  #resto = "";
  #nome = "";
  #dati: string[] = [];

  aggiungi(testo: string): MessaggioDelFlusso[] {
    const messaggi: MessaggioDelFlusso[] = [];
    const righe = (this.#resto + testo).split(/\r\n|\n|\r/);
    // L'ultima riga può essere a metà: resta da parte finché non arriva il suo a capo.
    this.#resto = righe.pop() ?? "";
    for (const riga of righe) {
      if (riga === "") {
        if (this.#dati.length > 0) messaggi.push({ nome: this.#nome === "" ? MESSAGGIO : this.#nome, dati: this.#dati.join("\n") });
        this.#nome = "";
        this.#dati = [];
        continue;
      }
      if (riga.startsWith(":")) continue;
      const due = riga.indexOf(":");
      const campo = due === -1 ? riga : riga.slice(0, due);
      let valore = due === -1 ? "" : riga.slice(due + 1);
      if (valore.startsWith(" ")) valore = valore.slice(1);
      if (campo === "event") this.#nome = valore;
      else if (campo === "data") this.#dati.push(valore);
    }
    return messaggi;
  }
}

/** I messaggi di un flusso, uno alla volta, finché il centro non lo chiude. */
export async function* leggiFlusso(corpo: ReadableStream<Uint8Array>): AsyncGenerator<MessaggioDelFlusso> {
  const lettore = new LettoreDiFlusso();
  const decodifica = new TextDecoder();
  const sorgente = corpo.getReader();
  try {
    for (;;) {
      const { done, value } = await sorgente.read();
      if (done) return;
      yield* lettore.aggiungi(decodifica.decode(value, { stream: true }));
    }
  } finally {
    sorgente.releaseLock();
  }
}
