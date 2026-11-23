/**
 * I commenti del proprietario: sulle righe dei file di un progetto, nati nel pannello File, e sugli
 * elaborati della Home, nati nella pagina Elaborati. Aspettano sopra il campo di scrittura e partono
 * con il messaggio successivo, scritti in testa. Restano nel browser, per conversazione, finché non
 * partono o non vengono tolti.
 */

import { useSyncExternalStore } from "react";

export interface CommentoSuUnaRiga {
  /** Relativo alla cartella del progetto, o dell'argomento per un elaborato. */
  percorso: string;
  /** Da 1; 0 per un commento sul file intero. */
  riga: number;
  /** Il testo della riga, o il pezzo scelto, per Claude e per il proprietario. Vuoto se non c'è. */
  testoDellaRiga: string;
  commento: string;
  /** Dove sta il file, se non basta il percorso: per un elaborato, l'ambiente e l'argomento. */
  dove?: string;
}

const PREFISSO = "shinka-commenti:";
const ascoltatori = new Set<() => void>();
/** Le letture già fatte, perché ogni disegno riceva lo stesso elenco finché non cambia. */
const letti = new Map<string, CommentoSuUnaRiga[]>();

function leggi(base: string): CommentoSuUnaRiga[] {
  const gia = letti.get(base);
  if (gia !== undefined) return gia;
  let valore: CommentoSuUnaRiga[] = [];
  try {
    const salvato = JSON.parse(localStorage.getItem(PREFISSO + base) ?? "[]") as unknown;
    if (Array.isArray(salvato)) valore = salvato.filter(commentoValido);
  } catch {
    // Un valore rovinato vale come nessun commento.
  }
  letti.set(base, valore);
  return valore;
}

function commentoValido(valore: unknown): valore is CommentoSuUnaRiga {
  if (typeof valore !== "object" || valore === null) return false;
  const { percorso, riga, testoDellaRiga, commento } = valore as Record<string, unknown>;
  return typeof percorso === "string" && typeof riga === "number" && typeof testoDellaRiga === "string" && typeof commento === "string";
}

function scrivi(base: string, commenti: CommentoSuUnaRiga[]): void {
  letti.set(base, commenti);
  try {
    if (commenti.length === 0) localStorage.removeItem(PREFISSO + base);
    else localStorage.setItem(PREFISSO + base, JSON.stringify(commenti));
  } catch {
    // Senza spazio nel browser i commenti valgono finché la pagina resta aperta.
  }
  for (const ascoltatore of ascoltatori) ascoltatore();
}

export function aggiungiCommento(base: string, commento: CommentoSuUnaRiga): void {
  const testo = commento.commento.trim();
  if (testo === "") return;
  scrivi(base, [...leggi(base), { ...commento, commento: testo }]);
}

export function togliCommento(base: string, posizione: number): void {
  scrivi(base, leggi(base).filter((_, indice) => indice !== posizione));
}

export function svuotaCommenti(base: string): void {
  if (leggi(base).length > 0) scrivi(base, []);
}

export function useCommenti(base: string): CommentoSuUnaRiga[] {
  return useSyncExternalStore(
    (alCambio) => {
      ascoltatori.add(alCambio);
      return () => ascoltatori.delete(alCambio);
    },
    () => leggi(base),
  );
}

/** Il messaggio con i commenti in testa, come lo legge Claude. Senza commenti resta com'è. */
export function conICommenti(testo: string, commenti: readonly CommentoSuUnaRiga[]): string {
  if (commenti.length === 0) return testo;
  const righe = commenti.map(({ percorso, riga, testoDellaRiga, commento, dove }) => {
    const pezzo = testoDellaRiga.trim().replace(/\s+/g, " ");
    const citata = pezzo === "" ? "" : riga > 0 ? ` (\`${pezzo.slice(0, 200)}\`)` : ` («${pezzo.slice(0, 300)}»)`;
    const file = `${percorso}${riga > 0 ? `:${riga}` : ""}${dove === undefined ? "" : ` (${dove})`}`;
    return `- ${file}${citata}: ${commento}`;
  });
  const commentiInTesta = `[Commenti del proprietario]\n${righe.join("\n")}`;
  return testo.trim() === "" ? commentiInTesta : `${commentiInTesta}\n\n${testo}`;
}
