/** I progetti nella barra laterale: i fissati in cima, poi raggruppati come sceglie il proprietario. */

import type { CondizioneProgetto, VoceProgetto } from "../../src/protocollo/progetti.ts";
import { condizioneInParole } from "./descrivi.ts";

export type ModoGruppi = "nessuno" | "ambiente" | "stato";

export interface GruppoDiProgetti {
  /** Manca per l'unico gruppo, quando non si raggruppa e nessuno è fissato. */
  titolo?: string;
  progetti: VoceProgetto[];
}

const ORDINE_DEGLI_STATI: CondizioneProgetto[] = ["aspetta-te", "al-lavoro", "fermo", "ambiente-spento"];

export function raggruppaProgetti(progetti: readonly VoceProgetto[], modo: ModoGruppi): GruppoDiProgetti[] {
  const fissati = progetti.filter((progetto) => progetto.fissato === true);
  const altri = progetti.filter((progetto) => progetto.fissato !== true);
  const gruppi: GruppoDiProgetti[] = fissati.length === 0 ? [] : [{ titolo: "Fissati", progetti: fissati }];
  if (modo === "nessuno") {
    if (altri.length > 0) gruppi.push({ ...(fissati.length === 0 ? {} : { titolo: "Gli altri" }), progetti: altri });
    return gruppi;
  }
  const chiavi = modo === "ambiente" ? [...new Set(altri.map((progetto) => progetto.nomeAmbiente))].sort((a, b) => a.localeCompare(b, "it")) : ORDINE_DEGLI_STATI;
  for (const chiave of chiavi) {
    const dentro = altri.filter((progetto) => (modo === "ambiente" ? progetto.nomeAmbiente : progetto.condizione) === chiave);
    if (dentro.length === 0) continue;
    const titolo = modo === "ambiente" ? chiave : condizioneInParole(chiave as CondizioneProgetto);
    gruppi.push({ titolo: titolo.charAt(0).toUpperCase() + titolo.slice(1), progetti: dentro });
  }
  return gruppi;
}

const CHIAVE = "shinka.barra.gruppi";

export function leggiModoGruppi(): ModoGruppi {
  try {
    const letto = window.localStorage.getItem(CHIAVE);
    return letto === "ambiente" || letto === "stato" ? letto : "nessuno";
  } catch {
    return "nessuno";
  }
}

export function scriviModoGruppi(modo: ModoGruppi): void {
  try {
    window.localStorage.setItem(CHIAVE, modo);
  } catch {
    // Senza memoria del browser la scelta vale finché la pagina resta aperta.
  }
}
