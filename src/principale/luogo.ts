/**
 * Ciò che l'app sa dal nodo di Shinka installato su questo PC, se ce n'è uno: dove si apre un
 * terminale (ADR 0005) e quale centro proporre al primo accesso (ADR 0004). Un progetto vive su
 * questo PC quando il suo ambiente è il nodo di qui.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StatoProgetti } from "../../shinka/src/protocollo/progetti.ts";
import { indirizzoDelCentro } from "./centro.ts";

/** Dove il nodo tiene i suoi dati: dove Shinka lo installa di solito, o nella cartella detta da `SHINKA_CARTELLA`. */
export function datiDelNodo(ambiente: NodeJS.ProcessEnv, casa: string): string {
  const cartella = ambiente.SHINKA_CARTELLA !== undefined && ambiente.SHINKA_CARTELLA !== "" ? ambiente.SHINKA_CARTELLA : join(casa, "Shinka", "nodo");
  return join(cartella, "dati-nodo");
}

function campo(file: string, nome: string): string | undefined {
  try {
    const valore = (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)[nome];
    return typeof valore === "string" && valore !== "" ? valore : undefined;
  } catch {
    return undefined;
  }
}

/**
 * L'identificativo del nodo di Shinka installato su questo PC. Dal file dell'identità si legge
 * solo questo: il segreto del nodo non serve all'app e non si tocca.
 */
export function idDelNodoDiQui(ambiente: NodeJS.ProcessEnv = process.env, casa: string = homedir()): string | undefined {
  return campo(join(datiDelNodo(ambiente, casa), "identita.json"), "idNodo");
}

/** Il centro a cui è collegato il nodo di questo PC, da proporre al primo accesso. */
export function centroDelNodoDiQui(ambiente: NodeJS.ProcessEnv = process.env, casa: string = homedir()): string | undefined {
  const scritto = campo(join(datiDelNodo(ambiente, casa), "nodo.json"), "centro");
  return scritto === undefined ? undefined : indirizzoDelCentro(scritto);
}

/** La cartella di un progetto, se il suo ambiente è questo PC. */
export function cartellaSuQuestoPc(progetti: StatoProgetti | undefined, idProgetto: string, idNodo: string | undefined): string | undefined {
  if (idNodo === undefined || progetti === undefined || !Array.isArray(progetti.progetti)) return undefined;
  const progetto = progetti.progetti.find((voce) => voce.id === idProgetto);
  return progetto !== undefined && progetto.idAmbiente === idNodo && typeof progetto.cartella === "string" && progetto.cartella !== "" ? progetto.cartella : undefined;
}
