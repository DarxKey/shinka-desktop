/**
 * L'identificativo di sessione di una conversazione, quando i motori sono due (ADR 0030). Ogni
 * motore ha la sua storia: la sessione di Claude Code, il thread di Codex. La conversazione li
 * ricorda tutti e due, e quale ha usato per ultimo, in un testo solo: così chi lo conserva (gli
 * argomenti della Home, i progetti, lo stato della Home) non deve sapere dei motori.
 *
 * Una conversazione che ha conosciuto solo Claude resta com'era, con l'identificativo della
 * sessione e basta: lo leggono anche i nodi di una versione precedente.
 */

import { eMotore, MOTORI, type Motore } from "./impostazioni.ts";

export interface SessioniDeiMotori {
  /** Il motore che ha lavorato per ultimo. */
  ultimo: Motore;
  /** La sessione di ciascun motore, se ne ha una. */
  sessioni: Partial<Record<Motore, string>>;
}

export function leggiSessioni(testo: string | undefined): SessioniDeiMotori | undefined {
  if (testo === undefined || testo === "") return undefined;
  if (!testo.startsWith("{")) return { ultimo: "claude", sessioni: { claude: testo } };
  try {
    const letto = JSON.parse(testo) as Record<string, unknown>;
    const sessioni: Partial<Record<Motore, string>> = {};
    for (const motore of MOTORI) {
      const valore = letto[motore];
      if (typeof valore === "string" && valore !== "") sessioni[motore] = valore;
    }
    const ultimo = eMotore(letto.ultimo) ? letto.ultimo : (MOTORI.find((motore) => sessioni[motore] !== undefined) ?? "claude");
    return { ultimo, sessioni };
  } catch {
    return undefined;
  }
}

export function scriviSessioni(dei: SessioniDeiMotori): string {
  const { ultimo, sessioni } = dei;
  const soloClaude = MOTORI.every((motore) => motore === "claude" || sessioni[motore] === undefined);
  if (soloClaude && ultimo === "claude" && sessioni.claude !== undefined) return sessioni.claude;
  return JSON.stringify({ ultimo, ...sessioni });
}
