/**
 * Le scelte di aspetto del proprietario, salvate nel browser: il tema (automatico, chiaro o scuro)
 * e la vista della trascrizione (normale, con il ragionamento, o dettagliata con tutte le azioni
 * aperte). Valgono in tutte le chat.
 */

import { useSyncExternalStore } from "react";

export const TEMI = ["automatico", "chiaro", "scuro"] as const;
export type Tema = (typeof TEMI)[number];

export const VISTE = ["normale", "ragionamento", "dettagliata"] as const;
export type VistaTrascrizione = (typeof VISTE)[number];

export const NOMI_TEMI: Record<Tema, string> = { automatico: "Automatico", chiaro: "Chiaro", scuro: "Scuro" };
export const NOMI_VISTE: Record<VistaTrascrizione, string> = {
  normale: "Normale",
  ragionamento: "Con il ragionamento",
  dettagliata: "Dettagliata",
};

export interface Aspetto {
  tema: Tema;
  vista: VistaTrascrizione;
}

const CHIAVE = "shinka.aspetto";
const PREDEFINITO: Aspetto = { tema: "automatico", vista: "normale" };

/** Il colore della barra del browser e del telefono per ciascun tema, come lo sfondo della testata. */
export const COLORE_DELLA_BARRA = { chiaro: "#ffffff", scuro: "#1f1f22" } as const;

/** Legge le scelte salvate; quelle che mancano o non valgono tornano alle predefinite. */
export function leggiAspetto(scritto: string | null): Aspetto {
  if (scritto === null) return PREDEFINITO;
  try {
    const letto = JSON.parse(scritto) as Partial<Record<keyof Aspetto, unknown>>;
    return {
      tema: TEMI.includes(letto.tema as Tema) ? (letto.tema as Tema) : PREDEFINITO.tema,
      vista: VISTE.includes(letto.vista as VistaTrascrizione) ? (letto.vista as VistaTrascrizione) : PREDEFINITO.vista,
    };
  } catch {
    return PREDEFINITO;
  }
}

let corrente: Aspetto = PREDEFINITO;
const ascoltatori = new Set<() => void>();

function memoria(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Mette il tema sulla pagina: l'attributo che lo stile guarda, e il colore della barra del browser. */
export function applicaTema(tema: Tema, documento: Document = document): void {
  if (tema === "automatico") delete documento.documentElement.dataset.tema;
  else documento.documentElement.dataset.tema = tema;
  for (const meta of documento.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scuro = meta.media.includes("dark");
    // Con un tema scelto a mano le due righe dicono lo stesso colore; in automatico ciascuna il suo.
    meta.content = tema === "automatico" ? COLORE_DELLA_BARRA[scuro ? "scuro" : "chiaro"] : COLORE_DELLA_BARRA[tema];
  }
}

/** All'avvio della pagina, prima di disegnare: così non lampeggia il tema sbagliato. */
export function avviaAspetto(): void {
  corrente = leggiAspetto(memoria()?.getItem(CHIAVE) ?? null);
  applicaTema(corrente.tema);
}

export function cambiaAspetto(modifica: Partial<Aspetto>): void {
  corrente = { ...corrente, ...modifica };
  try {
    memoria()?.setItem(CHIAVE, JSON.stringify(corrente));
  } catch {
    // Senza memoria del browser la scelta vale fino alla prossima apertura.
  }
  applicaTema(corrente.tema);
  for (const ascoltatore of ascoltatori) ascoltatore();
}

export function useAspetto(): Aspetto {
  return useSyncExternalStore(
    (ascoltatore) => {
      ascoltatori.add(ascoltatore);
      return () => ascoltatori.delete(ascoltatore);
    },
    () => corrente,
  );
}
