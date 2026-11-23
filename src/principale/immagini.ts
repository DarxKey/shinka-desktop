/**
 * Le immagini delle conversazioni, tenute su disco dopo la prima volta che si vedono (ADR 0003):
 * hanno un nome che non cambia, quindi una volta scaricate non si richiedono più e si vedono anche
 * senza connessione. C'è un tetto: oltre, escono quelle usate meno di recente.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Quanto possono occupare in tutto le immagini tenute, se non si dice altro. */
export const TETTO_IMMAGINI = 5 * 1024 * 1024 * 1024;
/** Un'immagine più grande di così non si tiene. */
export const IMMAGINE_MASSIMA = 20 * 1024 * 1024;

const TIPO_IMMAGINE = /^image\/[a-z0-9.+-]{1,40}$/;
const PERCORSO_IMMAGINE = /^\/api\/(?:home|progetti\/[^/]+|argomenti\/[^/]+)\/immagini\/[^/]+$/;

/** Vero per i percorsi delle immagini che non cambiano mai: quelle delle conversazioni. */
export function siTiene(percorso: string): boolean {
  return PERCORSO_IMMAGINE.test(percorso);
}

interface Tenuta {
  file: string;
  tipo: string;
  peso: number;
  uso: number;
}

export class Immagini {
  readonly #cartella: string;
  readonly #tetto: number;
  readonly #tenute = new Map<string, Tenuta>();
  #peso = 0;
  #ultimoUso = 0;

  /** Un istante che cresce sempre: due usi nello stesso millisecondo restano in ordine. */
  #adesso(): number {
    this.#ultimoUso = Math.max(Date.now(), this.#ultimoUso + 1);
    return this.#ultimoUso;
  }

  constructor(cartella: string, tetto = TETTO_IMMAGINI) {
    this.#cartella = cartella;
    this.#tetto = tetto;
    mkdirSync(cartella, { recursive: true });
    for (const nome of readdirSync(cartella)) {
      // Il nome di un file dice che cos'è: `<impronta>.<tipo con un trattino al posto della barra>`.
      const punto = nome.indexOf(".");
      const tipo = nome.slice(punto + 1).replace("-", "/");
      if (punto !== 32 || !TIPO_IMMAGINE.test(tipo)) continue;
      try {
        const file = join(cartella, nome);
        const { size, mtimeMs } = statSync(file);
        this.#tenute.set(nome.slice(0, punto), { file, tipo, peso: size, uso: mtimeMs });
        this.#peso += size;
      } catch {
        // Sparito nel frattempo.
      }
    }
  }

  #impronta(percorso: string): string {
    return createHash("sha256").update(percorso).digest("hex").slice(0, 32);
  }

  leggi(percorso: string): { tipo: string; dati: Buffer } | undefined {
    const impronta = this.#impronta(percorso);
    const tenuta = this.#tenute.get(impronta);
    if (tenuta === undefined) return undefined;
    try {
      const dati = readFileSync(tenuta.file);
      tenuta.uso = this.#adesso();
      // La data del file ricorda l'ultimo uso anche alla prossima apertura dell'app.
      utimesSync(tenuta.file, new Date(), new Date());
      return { tipo: tenuta.tipo, dati };
    } catch {
      this.#tenute.delete(impronta);
      this.#peso -= tenuta.peso;
      return undefined;
    }
  }

  tieni(percorso: string, tipo: string, dati: Buffer): void {
    const pulito = tipo.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!TIPO_IMMAGINE.test(pulito) || dati.length === 0 || dati.length > IMMAGINE_MASSIMA) return;
    const impronta = this.#impronta(percorso);
    if (this.#tenute.has(impronta)) return;
    const file = join(this.#cartella, `${impronta}.${pulito.replace("/", "-")}`);
    try {
      writeFileSync(file, dati);
    } catch {
      return;
    }
    this.#tenute.set(impronta, { file, tipo: pulito, peso: dati.length, uso: this.#adesso() });
    this.#peso += dati.length;
    this.#sfoltisci();
  }

  /** Quanto occupano adesso. */
  get peso(): number {
    return this.#peso;
  }

  #sfoltisci(): void {
    if (this.#peso <= this.#tetto) return;
    const dalMenoUsato = [...this.#tenute.entries()].sort((a, b) => a[1].uso - b[1].uso);
    for (const [impronta, tenuta] of dalMenoUsato) {
      if (this.#peso <= this.#tetto) break;
      rmSync(tenuta.file, { force: true });
      this.#tenute.delete(impronta);
      this.#peso -= tenuta.peso;
    }
  }
}
