/**
 * Dove si trova il proprietario nell'interfaccia: nella Home, in un argomento archiviato
 * della Home, in un progetto, oppure nelle pagine della memoria, delle skill, delle estensioni e del vault. La posizione sta nell'indirizzo della pagina, dopo il
 * cancelletto: così il tasto indietro funziona e un progetto si può aprire in un'altra scheda.
 */

import { useSyncExternalStore } from "react";

export type Vista =
  | { tipo: "home" }
  | { tipo: "argomento"; id: string }
  | { tipo: "progetto"; id: string }
  | { tipo: "memoria" }
  | { tipo: "vault" }
  | { tipo: "estensioni" }
  /** L'elenco degli elaborati, oppure uno, aperto: la chiave dice argomento, ambiente e percorso. */
  | { tipo: "elaborati"; scelto?: string }
  /** L'elenco delle skill, oppure una skill con la sua storia. */
  | { tipo: "skill"; nome?: string }
  /** La ricerca nel testo di tutte le conversazioni, con le parole scritte nella barra laterale. */
  | { tipo: "cerca"; parole?: string }
  /** Un ambiente in dettaglio: risorse, processi, container. */
  | { tipo: "ambiente"; id: string }
  /** La scheda con cui il proprietario crea un progetto da sé. */
  | { tipo: "nuovo-progetto" }
  /** I lavori programmati: richieste che partono da sole. */
  | { tipo: "programmati" }
  /** I token usati e i limiti del piano. */
  | { tipo: "uso" }
  /** Lo spazio che occupano argomenti e progetti, con la pulizia. */
  | { tipo: "archiviazione" }
  /** Le sessioni aperte e il registro delle richieste al centro. */
  | { tipo: "sicurezza" }
  /** Il motore delle conversazioni nuove e gli accessi dei motori negli ambienti. */
  | { tipo: "impostazioni" };

const RADICI = { progetto: "progetti", argomento: "argomenti" } as const;

/** Legge la vista dalla parte dell'indirizzo dopo il cancelletto. Ciò che non si capisce è la Home. */
export function vistaDa(frammento: string): Vista {
  if (frammento === "#/memoria") return { tipo: "memoria" };
  if (frammento === "#/skill") return { tipo: "skill" };
  if (frammento === "#/vault") return { tipo: "vault" };
  if (frammento === "#/estensioni") return { tipo: "estensioni" };
  if (frammento === "#/elaborati") return { tipo: "elaborati" };
  if (frammento === "#/cerca") return { tipo: "cerca" };
  if (frammento === "#/nuovo-progetto") return { tipo: "nuovo-progetto" };
  if (frammento === "#/programmati") return { tipo: "programmati" };
  if (frammento === "#/uso") return { tipo: "uso" };
  if (frammento === "#/archiviazione") return { tipo: "archiviazione" };
  if (frammento === "#/sicurezza") return { tipo: "sicurezza" };
  if (frammento === "#/impostazioni") return { tipo: "impostazioni" };
  const elaborato = /^#\/elaborati\/(.+)$/.exec(frammento);
  if (elaborato?.[1] !== undefined) {
    try {
      return { tipo: "elaborati", scelto: decodeURIComponent(elaborato[1]) };
    } catch {
      return { tipo: "elaborati" };
    }
  }
  const cercato = /^#\/cerca\/(.+)$/.exec(frammento);
  if (cercato?.[1] !== undefined) {
    try {
      return { tipo: "cerca", parole: decodeURIComponent(cercato[1]) };
    } catch {
      return { tipo: "cerca" };
    }
  }
  const skill = /^#\/skill\/([a-z0-9-]+)$/.exec(frammento);
  if (skill?.[1] !== undefined) return { tipo: "skill", nome: skill[1] };
  const trovato = /^#\/(progetti|argomenti|ambienti)\/([^/?#]+)$/.exec(frammento);
  if (trovato?.[2] === undefined) return { tipo: "home" };
  try {
    const id = decodeURIComponent(trovato[2]);
    if (trovato[1] === "ambienti") return { tipo: "ambiente", id };
    return trovato[1] === RADICI.progetto ? { tipo: "progetto", id } : { tipo: "argomento", id };
  } catch {
    return { tipo: "home" };
  }
}

export function frammentoDi(vista: Vista): string {
  switch (vista.tipo) {
    case "home":
      return "#/";
    case "memoria":
      return "#/memoria";
    case "vault":
      return "#/vault";
    case "estensioni":
      return "#/estensioni";
    case "elaborati":
      return vista.scelto === undefined ? "#/elaborati" : `#/elaborati/${encodeURIComponent(vista.scelto)}`;
    case "skill":
      return vista.nome === undefined ? "#/skill" : `#/skill/${vista.nome}`;
    case "cerca":
      return vista.parole === undefined || vista.parole.trim() === "" ? "#/cerca" : `#/cerca/${encodeURIComponent(vista.parole.trim())}`;
    case "nuovo-progetto":
      return "#/nuovo-progetto";
    case "ambiente":
      return `#/ambienti/${encodeURIComponent(vista.id)}`;
    case "programmati":
      return "#/programmati";
    case "uso":
      return "#/uso";
    case "archiviazione":
      return "#/archiviazione";
    case "sicurezza":
      return "#/sicurezza";
    case "impostazioni":
      return "#/impostazioni";
    default:
      return `#/${RADICI[vista.tipo]}/${encodeURIComponent(vista.id)}`;
  }
}

function ascolta(alCambio: () => void): () => void {
  window.addEventListener("hashchange", alCambio);
  return () => window.removeEventListener("hashchange", alCambio);
}

/** Il frammento dell'indirizzo, tenuto aggiornato. È una stringa: non cambia identità a ogni lettura. */
export function useFrammento(): string {
  return useSyncExternalStore(ascolta, () => window.location.hash);
}

export function vaiA(vista: Vista): void {
  window.location.hash = frammentoDi(vista);
}
