/**
 * Il dispositivo ricordato (ADR 0004): a quale centro è collegato questo PC, con quale nome, e il
 * suo gettone. Il gettone sta su disco cifrato da Windows per l'utente che ha fatto l'accesso
 * (DPAPI, attraverso `safeStorage` di Electron) e non arriva mai alla pagina.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Come si cifra per l'utente di questo PC. In Electron è `safeStorage`. */
export interface Cifra {
  disponibile(): Promise<boolean>;
  cifra(testo: string): Promise<Buffer>;
  /** `daRicifrare` dice che la chiave di Windows è cambiata: il testo va cifrato di nuovo e riscritto. */
  decifra(cifrato: Buffer): Promise<{ testo: string; daRicifrare: boolean }>;
}

export interface Dispositivo {
  /** L'indirizzo del centro, in forma (`https://nome`). */
  centro: string;
  /** L'identificativo che il centro ha dato a questo dispositivo. */
  id: string;
  /** Il nome con cui compare nell'elenco dei dispositivi del centro. */
  nome: string;
  gettone: string;
}

/** Ciò che resta dopo che il centro ha rifiutato il gettone: serve a riproporre l'accesso. */
export interface UltimoAccesso {
  centro: string;
  nome: string;
}

interface SuDisco {
  centro?: unknown;
  id?: unknown;
  nome?: unknown;
  /** Il gettone cifrato, in base64. */
  gettone?: unknown;
}

export class Custodia {
  readonly #file: string;
  readonly #cifra: Cifra;

  constructor(file: string, cifra: Cifra) {
    this.#file = file;
    this.#cifra = cifra;
  }

  #leggi(): SuDisco {
    try {
      const letto: unknown = JSON.parse(readFileSync(this.#file, "utf8"));
      return typeof letto === "object" && letto !== null ? (letto as SuDisco) : {};
    } catch {
      return {};
    }
  }

  #scrivi(dati: SuDisco): void {
    mkdirSync(dirname(this.#file), { recursive: true });
    const provvisorio = `${this.#file}.nuovo`;
    writeFileSync(provvisorio, JSON.stringify(dati, null, 2), "utf8");
    renameSync(provvisorio, this.#file);
  }

  /** Il dispositivo, se questo PC è collegato a un centro e il gettone si riesce a leggere. */
  async dispositivo(): Promise<Dispositivo | undefined> {
    const { centro, id, nome, gettone } = this.#leggi();
    if (typeof centro !== "string" || typeof id !== "string" || typeof nome !== "string" || typeof gettone !== "string" || gettone === "") return undefined;
    try {
      const { testo, daRicifrare } = await this.#cifra.decifra(Buffer.from(gettone, "base64"));
      const dispositivo = { centro, id, nome, gettone: testo };
      if (daRicifrare) await this.ricorda(dispositivo).catch(() => {});
      return dispositivo;
    } catch {
      // Cifrato da un altro utente o su un altro PC: non vale più.
      return undefined;
    }
  }

  /** Il centro e il nome dell'ultimo accesso, anche se il gettone non c'è più. */
  ultimo(): UltimoAccesso | undefined {
    const { centro, nome } = this.#leggi();
    return typeof centro === "string" && typeof nome === "string" ? { centro, nome } : undefined;
  }

  async ricorda(dispositivo: Dispositivo): Promise<void> {
    if (!(await this.#cifra.disponibile())) throw new Error("Questo PC non sa custodire il gettone del dispositivo.");
    const cifrato = await this.#cifra.cifra(dispositivo.gettone);
    this.#scrivi({ centro: dispositivo.centro, id: dispositivo.id, nome: dispositivo.nome, gettone: cifrato.toString("base64") });
  }

  /** Il centro ha rifiutato il gettone: lo si butta, e resta scritto dove si era collegati. */
  scordaIlGettone(): void {
    const { centro, nome } = this.#leggi();
    if (typeof centro === "string" && typeof nome === "string") this.#scrivi({ centro, nome });
    else this.scordaTutto();
  }

  /** Il proprietario è uscito da questo centro: non resta nulla. */
  scordaTutto(): void {
    if (existsSync(this.#file)) rmSync(this.#file, { force: true });
  }
}
