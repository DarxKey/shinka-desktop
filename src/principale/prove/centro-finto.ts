/**
 * Un centro finto, in memoria, per le prove: risponde alle rotte che l'app usa come le descrive
 * l'ADR 0046 di Shinka (storia da un punto, flusso che riprende, indici nel quadro) e l'ADR 0047
 * (gettone di dispositivo). Non apre porte: si usa al posto di `fetch`.
 */

import { FINE_STORIA, type EventoArchiviato, type EventoConversazione, type IndiceArchivio, type PezzoDiStoria } from "../../../shinka/src/protocollo/eventi.ts";
import type { Chiedi } from "../centro.ts";

export const INDIRIZZO_FINTO = "https://shinka.example";
export const GETTONE_FINTO = "gettone-di-prova-0123456789";
export const PASSWORD_FINTA = "password-di-prova";

interface Archivio {
  versione: string;
  eventi: EventoArchiviato[];
}

interface FlussoAperto {
  chiave: string;
  scrivi: (testo: string) => void;
  chiudi: () => void;
}

const codifica = new TextEncoder();

function riga(dati: unknown, nome?: string): string {
  return `${nome === undefined ? "" : `event: ${nome}\n`}data: ${JSON.stringify(dati)}\n\n`;
}

export class CentroFinto {
  readonly archivi = new Map<string, Archivio>();
  /** Le richieste ricevute, come `METODO percorso`. */
  readonly richieste: string[] = [];
  /** Quante volte è stato aperto il flusso di una conversazione: sul centro vero prepara il motore. */
  readonly flussiAperti: string[] = [];
  /** L'argomento che la Home ha aperto. */
  idAperto = "2026-11-23-aperto";
  /** Ciò che il quadro manda a chi lo apre: nome e dati di ogni messaggio. */
  quadroAllApertura: [string, unknown][] = [];
  /** Vero per far cadere ogni richiesta, come senza rete. */
  spento = false;
  #versioni = 0;
  readonly #flussi = new Set<FlussoAperto>();
  readonly #quadri = new Set<FlussoAperto>();

  /** Crea o sostituisce un archivio con questi eventi, in una versione nuova. */
  archivio(chiave: string, eventi: EventoConversazione[]): Archivio {
    this.#versioni += 1;
    const archivio = { versione: `v${this.#versioni}`, eventi: eventi.map((evento, indice) => ({ n: indice + 1, quando: "2026-11-23T10:00:00.000Z", evento })) };
    this.archivi.set(chiave, archivio);
    return archivio;
  }

  indice(chiave: string): IndiceArchivio {
    const archivio = this.archivi.get(chiave);
    if (archivio === undefined) throw new Error(`Nel centro finto non c'è ${chiave}.`);
    return { versione: archivio.versione, ultimo: archivio.eventi.length };
  }

  /** Un evento nuovo in una conversazione: archiviato se non è passeggero, e mandato a chi la segue. */
  pubblica(chiave: string, evento: EventoConversazione, passeggero = false): void {
    const archivio = this.archivi.get(chiave);
    if (archivio === undefined) throw new Error(`Nel centro finto non c'è ${chiave}.`);
    const archiviato: EventoArchiviato = { n: passeggero ? 0 : archivio.eventi.length + 1, quando: "2026-11-23T11:00:00.000Z", evento };
    if (!passeggero) archivio.eventi.push(archiviato);
    for (const flusso of this.#flussi) if (flusso.chiave === chiave) flusso.scrivi(riga(archiviato));
  }

  /** La Home passa a un altro argomento: chi la segue riceve `azzera` e la storia di quello nuovo. */
  passaAllArgomento(id: string): void {
    const prima = `argomenti/${this.idAperto}`;
    this.idAperto = id;
    const chiave = `argomenti/${id}`;
    for (const flusso of this.#flussi) {
      if (flusso.chiave !== prima) continue;
      flusso.chiave = chiave;
      flusso.scrivi(riga({}, "azzera"));
      for (const evento of this.archivi.get(chiave)?.eventi ?? []) flusso.scrivi(riga(evento));
      flusso.scrivi(riga(this.indice(chiave), FINE_STORIA));
    }
  }

  /** Fa cadere i flussi aperti, come una rete che va e viene. */
  cadi(): void {
    for (const flusso of [...this.#flussi, ...this.#quadri]) flusso.chiudi();
  }

  /** Manda un messaggio del quadro a chi lo sta guardando. */
  quadro(nome: string, dati: unknown): void {
    for (const flusso of this.#quadri) flusso.scrivi(riga(dati, nome));
  }

  get quadriAperti(): number {
    return this.#quadri.size;
  }

  get flussiVivi(): number {
    return this.#flussi.size;
  }

  /** Da usare al posto di `fetch`. */
  readonly chiedi: Chiedi = async (indirizzo, opzioni) => {
    if (this.spento) throw new TypeError("fetch failed");
    const url = new URL(indirizzo);
    const metodo = opzioni.method ?? "GET";
    this.richieste.push(`${metodo} ${url.pathname}${url.search}`);
    const intestazioni = new Headers(opzioni.headers);

    if (url.pathname === "/api/dispositivi" && metodo === "POST") {
      const corpo = JSON.parse(String(opzioni.body)) as { password: string; nome: string; genere: string };
      if (corpo.password !== PASSWORD_FINTA) return Response.json({ errore: "Password non valida." }, { status: 401 });
      return Response.json({ id: "dispositivo-1", token: GETTONE_FINTO }, { status: 201 });
    }
    if (intestazioni.get("authorization") !== `Bearer ${GETTONE_FINTO}`) {
      return Response.json({ errore: "Questo dispositivo non può più entrare: serve di nuovo la password." }, { status: 401 });
    }
    if (url.pathname === "/api/quadro/eventi") return this.#apri(this.#quadri, "quadro", opzioni.signal ?? undefined, (scrivi) => {
      for (const [nome, dati] of this.quadroAllApertura) scrivi(riga(dati, nome));
    });

    const trovato = /^\/api\/(home|(?:progetti|argomenti)\/[^/]+)\/(storia|eventi)$/.exec(url.pathname);
    if (trovato?.[1] === undefined) return Response.json({ errore: "Non trovato." }, { status: 404 });
    const chiave = trovato[1] === "home" ? `argomenti/${this.idAperto}` : decodeURIComponent(trovato[1]);
    const archivio = this.archivi.get(chiave);
    if (archivio === undefined) return Response.json({ errore: "Non trovato." }, { status: 404 });

    const dopo = Number(url.searchParams.get("dopo") ?? "0");
    const versione = url.searchParams.get("versione");
    const vale = versione === archivio.versione && dopo <= archivio.eventi.length;

    if (trovato[2] === "storia") {
      const daCapo = url.searchParams.has("versione") || url.searchParams.has("dopo") ? !vale && (versione !== null || dopo > archivio.eventi.length) : false;
      const partenza = daCapo ? 0 : versione === null ? Math.min(dopo, archivio.eventi.length) : dopo;
      const limite = Math.min(Number(url.searchParams.get("limite") ?? "1000"), 1000);
      const eventi = archivio.eventi.slice(partenza, partenza + limite);
      const pezzo: PezzoDiStoria = { versione: archivio.versione, ultimo: archivio.eventi.length, eventi, altri: partenza + eventi.length < archivio.eventi.length, daCapo };
      return Response.json(pezzo);
    }

    this.flussiAperti.push(chiave);
    return this.#apri(this.#flussi, chiave, opzioni.signal ?? undefined, (scrivi) => {
      const riprende = versione !== null && vale;
      if (versione !== null && !riprende) scrivi(riga({}, "azzera"));
      for (const evento of archivio.eventi.slice(riprende ? dopo : 0)) scrivi(riga(evento));
      scrivi(riga({ versione: archivio.versione, ultimo: archivio.eventi.length }, FINE_STORIA));
    });
  };

  #apri(insieme: Set<FlussoAperto>, chiave: string, segnale: AbortSignal | undefined, allInizio: (scrivi: (testo: string) => void) => void): Response {
    let aperto: FlussoAperto | undefined;
    const corpo = new ReadableStream<Uint8Array>({
      start: (controllo) => {
        const chiudi = (): void => {
          if (aperto === undefined || !insieme.delete(aperto)) return;
          try {
            controllo.close();
          } catch {
            // Già chiuso da chi leggeva.
          }
        };
        aperto = { chiave, scrivi: (testo) => controllo.enqueue(codifica.encode(testo)), chiudi };
        insieme.add(aperto);
        segnale?.addEventListener("abort", chiudi);
        allInizio(aperto.scrivi);
      },
      cancel: () => {
        if (aperto !== undefined) insieme.delete(aperto);
      },
    });
    return new Response(corpo, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }
}

/** Aspetta che una condizione diventi vera, guardandola ogni pochi millisecondi. */
export async function finche(condizione: () => boolean, che: string, msMassimi = 2000): Promise<void> {
  const inizio = Date.now();
  while (!condizione()) {
    if (Date.now() - inizio > msMassimi) throw new Error(`Non è successo in tempo: ${che}`);
    await new Promise((risolvi) => setTimeout(risolvi, 5));
  }
}

/** Un messaggio del proprietario, per riempire un archivio di prova. */
export function messaggioDiProva(testo: string): EventoConversazione {
  return { tipo: "messaggio-proprietario", id: `m-${testo}`, testo } as EventoConversazione;
}
