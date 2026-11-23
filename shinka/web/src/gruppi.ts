/**
 * Le azioni che Claude compie una dopo l'altra vengono mostrate come un gruppo solo,
 * da aprire se interessa il dettaglio: così la conversazione resta leggibile anche in un lavoro lungo.
 */

import { etichettaDi, STRUMENTO_ANTEPRIMA } from "./descrivi.ts";
import type { Elemento } from "./stato.ts";

export type Azione = Extract<Elemento, { tipo: "azione" }>;

export interface Gruppo {
  tipo: "gruppo";
  chiave: string;
  azioni: Azione[];
}

export type Voce = Elemento | Gruppo;

/**
 * Un'azione che aspetta il proprietario resta sempre in vista, fuori dai gruppi; e così la
 * proposta di un'anteprima, che porta con sé il pulsante per aprirla.
 */
function inAttesa(elemento: Elemento): boolean {
  if (elemento.tipo !== "azione") return false;
  return elemento.permesso?.stato === "in-attesa" || elemento.strumento === STRUMENTO_ANTEPRIMA || elemento.strumento === STRUMENTO_PIANO;
}

/** Lo strumento con cui Claude presenta il suo piano prima di mettersi al lavoro: si legge, non si raggruppa. */
export const STRUMENTO_PIANO = "ExitPlanMode";

/** Raggruppa le azioni consecutive. Un'azione da sola resta com'è. */
export function raggruppa(elementi: Elemento[]): Voce[] {
  const voci: Voce[] = [];
  let serie: Azione[] = [];
  const chiudiSerie = (): void => {
    const prima = serie[0];
    if (prima === undefined) return;
    if (serie.length === 1) voci.push(prima);
    // La chiave è quella della prima azione: il gruppo resta lo stesso mentre se ne aggiungono altre.
    else voci.push({ tipo: "gruppo", chiave: `gruppo-${prima.chiave}`, azioni: serie });
    serie = [];
  };
  for (const elemento of elementi) {
    if (elemento.tipo === "azione" && !inAttesa(elemento)) {
      serie.push(elemento);
      continue;
    }
    chiudiSerie();
    voci.push(elemento);
  }
  chiudiSerie();
  return voci;
}

/** Che cosa contiene un gruppo, in una riga: quante azioni e di che genere. */
export function riassuntoDi(azioni: Azione[]): string {
  const conteggi = new Map<string, number>();
  for (const azione of azioni) {
    const etichetta = etichettaDi(azione.strumento);
    conteggi.set(etichetta, (conteggi.get(etichetta) ?? 0) + 1);
  }
  const generi = [...conteggi].map(([etichetta, quante]) => (quante === 1 ? etichetta : `${etichetta} ×${quante}`));
  return `${azioni.length} azioni: ${generi.join(", ")}`;
}

/** Come è andato il gruppo nel suo insieme. */
export function esitoDi(azioni: Azione[]): { classe: string; testo: string } {
  if (azioni.some((azione) => !azione.conclusa && azione.permesso?.stato !== "negato")) {
    return { classe: "in-corso", testo: "in corso" };
  }
  const fallite = azioni.filter((azione) => azione.errore === true).length;
  const negate = azioni.filter((azione) => azione.permesso?.stato === "negato").length;
  if (fallite + negate === 0) return { classe: "riuscita", testo: "fatte" };
  const parti = [
    ...(fallite === 0 ? [] : [fallite === 1 ? "1 non riuscita" : `${fallite} non riuscite`]),
    ...(negate === 0 ? [] : [negate === 1 ? "1 negata" : `${negate} negate`]),
  ];
  return { classe: "fallita", testo: parti.join(", ") };
}
