/**
 * La versione di Shinka: come la si scrive nella cartella in cui gira, come la si mostra, e il
 * pacchetto con cui il centro la passa a un nodo che deve aggiornarsi.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Il file, nella cartella di una versione, che dice quale versione è. */
export const FILE_VERSIONE = "versione.json";

/** Una versione, come la conosce il repository di Shinka. */
const VERSIONE = /^[0-9a-f]{7,64}$/;

export function versioneValida(valore: unknown): valore is string {
  return typeof valore === "string" && VERSIONE.test(valore);
}

/** La versione in breve, come la si mostra al proprietario. */
export function inBreve(versione: string): string {
  return versione.slice(0, 8);
}

/** La versione scritta nella cartella di una versione di Shinka; nulla se non c'è. */
export async function versioneDi(cartella: string): Promise<string | undefined> {
  try {
    const letto = JSON.parse(await readFile(join(cartella, FILE_VERSIONE), "utf8")) as { versione?: unknown };
    return versioneValida(letto.versione) ? letto.versione : undefined;
  } catch {
    return undefined;
  }
}

/** Un file di una versione, nel pacchetto che il centro passa a un nodo. */
export interface FileDiVersione {
  /** Il percorso dentro la cartella della versione, con le barre in avanti: "src/nodo/avvio.ts". */
  percorso: string;
  /** Il contenuto, in base64. */
  dati: string;
}

/** I file che stanno in cima alla cartella di una versione e che a un nodo servono. */
export const FILE_IN_CIMA = ["package.json", "package-lock.json", "tsconfig.json", FILE_VERSIONE] as const;

/** La cartella del codice: a un nodo arriva tutta, senza i test. */
export const CARTELLA_DEL_CODICE = "src";

/** Quanti file e quanto peso può avere un pacchetto: molto più di quanto pesi Shinka oggi. */
export const FILE_MASSIMI = 2000;
export const PESO_MASSIMO = 12 * 1024 * 1024;

/**
 * Vero se il percorso è uno di quelli che un pacchetto può portare: un file in cima tra quelli
 * previsti, oppure un file dentro la cartella del codice, senza uscirne.
 */
export function percorsoDiVersioneValido(percorso: unknown): percorso is string {
  if (typeof percorso !== "string" || percorso.length === 0 || percorso.length > 300) return false;
  if ((FILE_IN_CIMA as readonly string[]).includes(percorso)) return true;
  const pezzi = percorso.split("/");
  if (pezzi[0] !== CARTELLA_DEL_CODICE || pezzi.length < 2) return false;
  return pezzi.every((pezzo) => /^[A-Za-z0-9._-]+$/.test(pezzo) && pezzo !== "." && pezzo !== "..");
}

/** Le cartelle del codice che servono al gateway: la sua, ciò che si dice con il centro, e ciò che gli serve per cambiare versione. */
export const CARTELLE_DEL_GATEWAY = ["src/gateway", "src/protocollo", "src/guardiano"] as const;

/** Vero se il percorso è uno di quelli che il pacchetto per il gateway può portare. */
export function percorsoDelGatewayValido(percorso: unknown): percorso is string {
  if (!percorsoDiVersioneValido(percorso)) return false;
  if ((FILE_IN_CIMA as readonly string[]).includes(percorso)) return true;
  return CARTELLE_DEL_GATEWAY.some((cartella) => percorso.startsWith(`${cartella}/`));
}

/** Il centro propone al gateway una versione: i suoi file, e in parole che cosa cambia. */
export interface PropostaDiVersione {
  versione: string;
  /** Che cosa cambia, nelle parole che il centro ha mostrato al proprietario. */
  riassunto: string;
  file: FileDiVersione[];
}

/** Quanto può essere lungo il riassunto che accompagna una versione proposta al gateway. */
export const RIASSUNTO_DI_VERSIONE_MASSIMO = 2000;

/** Per quanto il gateway aspetta il sì del proprietario a una versione nuova. */
export const SI_ALLA_VERSIONE_MS = 30 * 60 * 1000;

export type EsitoProposta =
  /** I file del gateway sono già quelli: non c'è nulla da installare, e al proprietario non viene chiesto nulla. */
  | { esito: "uguale" }
  /** Il gateway ha chiesto il sì al proprietario, lui stesso: `cambiano` sono i file che cambierebbero. */
  | { esito: "da-approvare"; scadeIl: string; cambiano: string[] }
  | { esito: "rifiutato"; motivo: string };

/** A che punto è, nel gateway, l'ultima versione che il centro gli ha proposto. */
export type AggiornamentoDelGateway =
  | { stato: "in-attesa"; versione: string; scadeIl: string }
  | { stato: "in-corso"; versione: string }
  | { stato: "negato" | "scaduto"; versione: string }
  | { stato: "non-riuscito"; versione: string; motivo: string };

/** Riconosce i file di un pacchetto arrivato da fuori; nulla se anche uno solo non è come deve. */
export function leggiFileDiVersione(valore: unknown): FileDiVersione[] | undefined {
  if (!Array.isArray(valore) || valore.length === 0 || valore.length > FILE_MASSIMI) return undefined;
  const file: FileDiVersione[] = [];
  const visti = new Set<string>();
  let peso = 0;
  for (const voce of valore as unknown[]) {
    if (typeof voce !== "object" || voce === null) return undefined;
    const { percorso, dati } = voce as Record<string, unknown>;
    if (!percorsoDiVersioneValido(percorso) || typeof dati !== "string") return undefined;
    // Su Windows due nomi che cambiano solo per le maiuscole sono lo stesso file.
    const chiave = percorso.toLowerCase();
    if (visti.has(chiave)) return undefined;
    visti.add(chiave);
    peso += dati.length;
    if (peso > PESO_MASSIMO) return undefined;
    file.push({ percorso, dati });
  }
  return file;
}
