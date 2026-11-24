/**
 * Il terminale di un progetto: ciò che il centro chiede a chi sta nell'ambiente, ciò che ne
 * torna, e ciò che il centro e il browser si dicono. Sono dati semplici, serializzabili in JSON.
 *
 * Un progetto ha fino a `SCHEDE_MASSIME` terminali, uno per scheda, che vivono nel suo ambiente: il
 * primo si riconosce dall'identificativo del progetto, gli altri da quello seguito da `~t` e dal
 * numero della scheda. Restano accesi anche quando nessuno li guarda.
 */

/** Quanti terminali può avere un progetto, uno per scheda. */
export const SCHEDE_MASSIME = 4;

/** L'identificativo del terminale di una scheda di un progetto: la prima è il progetto stesso. */
export function terminaleDellaScheda(idProgetto: string, scheda: number): string {
  return scheda <= 1 ? idProgetto : `${idProgetto}~t${scheda}`;
}

/** Il progetto di un terminale. */
export function progettoDelTerminale(idTerminale: string): string {
  return idTerminale.replace(/~t\d+$/, "");
}

/** Le misure che un terminale può avere. */
export const COLONNE_MASSIME = 500;
export const RIGHE_MASSIME = 300;

/** Quanto si può scrivere nel terminale con un messaggio solo. */
export const SCRITTURA_MASSIMA = 64 * 1024;

/** Quanta uscita recente il terminale tiene da parte per chi lo riapre. */
export const USCITA_DA_PARTE = 256 * 1024;

/** Dopo quanto tempo senza che nulla vi entri o ne esca un terminale si chiude da solo. */
export const INATTIVITA_MASSIMA_MS = 12 * 60 * 60 * 1000;

/** Quanti terminali può tenere accesi un ambiente. */
export const TERMINALI_MASSIMI = 12;

/** Ciò che il centro chiede a chi tiene i terminali di un ambiente. */
export type ComandoTerminale =
  /** Accende il terminale nella cartella, oppure ritrova quello già acceso e gli dà le misure nuove. */
  | { tipo: "terminale-apri"; idTerminale: string; cartella: string; colonne: number; righe: number }
  | { tipo: "terminale-scrivi"; idTerminale: string; dati: string }
  | { tipo: "terminale-misura"; idTerminale: string; colonne: number; righe: number }
  /** Spegne il terminale e ciò che vi gira. */
  | { tipo: "terminale-chiudi"; idTerminale: string };

/** Ciò che torna dall'ambiente. */
export type RiferitoTerminale =
  /** Il terminale è acceso: `finora` è l'uscita recente, per chi lo apre adesso. */
  | { tipo: "terminale-aperto"; idTerminale: string; finora: string }
  | { tipo: "terminale-uscita"; idTerminale: string; dati: string }
  /** Il terminale non c'è più, o non si è potuto accendere: `motivo` lo dice al proprietario. */
  | { tipo: "terminale-chiuso"; idTerminale: string; motivo: string };

/** Dal browser al centro, sul collegamento del terminale di un progetto. */
export type DalBrowserAlTerminale =
  | { tipo: "apri"; colonne: number; righe: number }
  | { tipo: "scrivi"; dati: string }
  | { tipo: "misura"; colonne: number; righe: number }
  | { tipo: "chiudi" };

/** Dal centro al browser. */
export type DalTerminaleAlBrowser =
  | { tipo: "aperto"; finora: string }
  | { tipo: "uscita"; dati: string }
  | { tipo: "chiuso"; motivo: string };

/** Chi tiene i terminali di un ambiente, visto dal centro. */
export interface PortaTerminali {
  esegui(comando: ComandoTerminale): void;
}

function testo(campi: Record<string, unknown>, nome: string, massimo: number): string | undefined {
  const valore = campi[nome];
  return typeof valore === "string" && valore.length <= massimo ? valore : undefined;
}

function misura(valore: unknown, massimo: number): number | undefined {
  return typeof valore === "number" && Number.isInteger(valore) && valore >= 1 && valore <= massimo ? valore : undefined;
}

/** Riconosce un comando per il terminale; nulla se non è scritto come deve. */
export function leggiComandoTerminale(campi: Record<string, unknown>): ComandoTerminale | undefined {
  const idTerminale = testo(campi, "idTerminale", 100);
  if (idTerminale === undefined || idTerminale === "") return undefined;
  switch (campi.tipo) {
    case "terminale-apri": {
      const cartella = testo(campi, "cartella", 1000);
      const colonne = misura(campi.colonne, COLONNE_MASSIME);
      const righe = misura(campi.righe, RIGHE_MASSIME);
      if (cartella === undefined || cartella === "" || colonne === undefined || righe === undefined) return undefined;
      return { tipo: "terminale-apri", idTerminale, cartella, colonne, righe };
    }
    case "terminale-scrivi": {
      const dati = testo(campi, "dati", SCRITTURA_MASSIMA);
      return dati === undefined ? undefined : { tipo: "terminale-scrivi", idTerminale, dati };
    }
    case "terminale-misura": {
      const colonne = misura(campi.colonne, COLONNE_MASSIME);
      const righe = misura(campi.righe, RIGHE_MASSIME);
      if (colonne === undefined || righe === undefined) return undefined;
      return { tipo: "terminale-misura", idTerminale, colonne, righe };
    }
    case "terminale-chiudi":
      return { tipo: "terminale-chiudi", idTerminale };
    default:
      return undefined;
  }
}

/** Riconosce ciò che un ambiente riferisce di un terminale; nulla se non è scritto come deve. */
export function leggiRiferitoTerminale(campi: Record<string, unknown>): RiferitoTerminale | undefined {
  const idTerminale = testo(campi, "idTerminale", 100);
  if (idTerminale === undefined || idTerminale === "") return undefined;
  switch (campi.tipo) {
    case "terminale-aperto": {
      const finora = testo(campi, "finora", USCITA_DA_PARTE * 2);
      return finora === undefined ? undefined : { tipo: "terminale-aperto", idTerminale, finora };
    }
    case "terminale-uscita": {
      const dati = testo(campi, "dati", USCITA_DA_PARTE * 2);
      return dati === undefined ? undefined : { tipo: "terminale-uscita", idTerminale, dati };
    }
    case "terminale-chiuso": {
      const motivo = testo(campi, "motivo", 2000);
      return motivo === undefined ? undefined : { tipo: "terminale-chiuso", idTerminale, motivo };
    }
    default:
      return undefined;
  }
}

/** Riconosce ciò che il browser manda sul collegamento del terminale; nulla se non è scritto come deve. */
export function leggiDalBrowser(scritto: string): DalBrowserAlTerminale | undefined {
  let letto: unknown;
  try {
    letto = JSON.parse(scritto);
  } catch {
    return undefined;
  }
  if (typeof letto !== "object" || letto === null) return undefined;
  const campi = letto as Record<string, unknown>;
  switch (campi.tipo) {
    case "apri":
    case "misura": {
      const colonne = misura(campi.colonne, COLONNE_MASSIME);
      const righe = misura(campi.righe, RIGHE_MASSIME);
      if (colonne === undefined || righe === undefined) return undefined;
      return { tipo: campi.tipo, colonne, righe };
    }
    case "scrivi": {
      const dati = testo(campi, "dati", SCRITTURA_MASSIMA);
      return dati === undefined ? undefined : { tipo: "scrivi", dati };
    }
    case "chiudi":
      return { tipo: "chiudi" };
    default:
      return undefined;
  }
}
