/**
 * Il menu del modello quando i motori sono due (ADR 0030): i modelli di Claude e di Codex in due
 * gruppi, e ogni voce dice motore e modello insieme. Con un motore solo il menu resta com'era.
 */

import { MOTORI, NOMI_MOTORI, type ModelloDisponibile, type Motore } from "../../src/protocollo/impostazioni.ts";

/** Un gruppo del menu: i modelli di un motore, o tutti se il motore non si distingue. */
export interface GruppoDiModelli {
  motore?: Motore;
  modelli: ModelloDisponibile[];
}

/** I gruppi del menu: uno per motore se i modelli vengono da più di un motore, altrimenti uno solo. */
export function gruppiDiModelli(modelli: readonly ModelloDisponibile[]): GruppoDiModelli[] {
  const utili = modelli.filter((modello) => modello.valore !== "default");
  const motori = MOTORI.filter((motore) => utili.some((modello) => modello.motore === motore));
  if (motori.length < 2) return [{ modelli: utili }];
  return motori.map((motore) => ({ motore, modelli: utili.filter((modello) => modello.motore === motore) }));
}

/** La voce del menu per un motore e un modello; il modello vuoto è il predefinito del motore. */
export function chiaveDelModello(motore: Motore | undefined, modello: string | undefined): string {
  return motore === undefined ? (modello ?? "") : `${motore}:${modello ?? ""}`;
}

/** Che cosa ha scelto il proprietario con quella voce. */
export function sceltaDaChiave(chiave: string): { motore?: Motore; modello: string | null } {
  const separatore = chiave.indexOf(":");
  const motore = MOTORI.find((voce) => voce === chiave.slice(0, separatore));
  if (separatore < 0 || motore === undefined) return { modello: chiave === "" ? null : chiave };
  const modello = chiave.slice(separatore + 1);
  return { motore, modello: modello === "" ? null : modello };
}

/** Come si chiama il modello scelto, nel riassunto delle scelte. */
export function nomeDelModello(
  gruppi: readonly GruppoDiModelli[],
  motore: Motore | undefined,
  modello: string | undefined,
): string {
  const gruppo = gruppi.find((voce) => voce.motore === undefined || voce.motore === motore);
  const trovato = gruppo?.modelli.find((voce) => voce.valore === modello);
  if (trovato !== undefined) return trovato.nome;
  if (modello !== undefined) return modello;
  return gruppi.length > 1 && motore !== undefined ? `${NOMI_MOTORI[motore]} predefinito` : "Modello predefinito";
}
