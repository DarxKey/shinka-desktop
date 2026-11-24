/**
 * Ciò che la Home può far fare in un ambiente senza che serva un progetto:
 * eseguire un comando, scrivere un file, leggerlo. Dati semplici, serializzabili in JSON.
 */

import { percorsoDiElaboratoValido } from "./elaborati.ts";

/** Nome della cartella, dentro quella dei progetti, in cui stanno i file degli argomenti della Home. */
export const CARTELLA_HOME = "_home";

/** Quanto può durare un comando se non viene detto altro, e quanto al massimo. */
export const DURATA_COMANDO_MS = 120_000;
export const DURATA_MASSIMA_COMANDO_MS = 600_000;

/** Quanti percorsi al massimo riporta un elenco di file: il conto dice comunque quanti sono in tutto. */
export const FILE_ELENCATI_MASSIMO = 200;

const COMANDO_MASSIMO = 20_000;
const PERCORSO_MASSIMO = 1_000;
const CONTENUTO_MASSIMO = 1_000_000;

export type AzioneInAmbiente =
  /** Esegue un comando nella shell dell'ambiente, dalla cartella dell'argomento. */
  | { tipo: "esegui"; comando: string; durataMs?: number }
  /** Scrive un file di testo. Un percorso relativo parte dalla cartella dell'argomento. */
  | { tipo: "scrivi-file"; percorso: string; contenuto: string }
  | { tipo: "leggi-file"; percorso: string }
  /**
   * Cambia un pezzo di un file di testo: `vecchio` deve comparire una volta sola, o con `tutte`
   * ogni volta che compare. Per i progetti nelle cartelle collegate (ADR 0050).
   */
  | { tipo: "modifica-file"; percorso: string; vecchio: string; nuovo: string; tutte?: boolean }
  /** Dice se la cartella collegata c'è, e il suo percorso vero. Solo per le cartelle collegate. */
  | { tipo: "controlla-cartella" }
  /** Elenca i file della cartella dell'argomento, senza crearla se non c'è. */
  | { tipo: "elenca-file" }
  /**
   * Legge un elaborato per mostrarlo al proprietario, anche un'immagine: il contenuto torna in
   * base64. Il percorso parte dalla cartella dell'argomento e non ne esce.
   */
  | { tipo: "leggi-elaborato"; percorso: string };

export interface EsitoAzione {
  riuscita: boolean;
  /** L'uscita del comando, il contenuto del file, oppure che cosa è andato storto. */
  testo: string;
  /** Il percorso completo del file scritto o letto. */
  percorso?: string;
  /** I file elencati, con il percorso che parte dalla cartella dell'argomento e la barra dritta. */
  file?: string[];
  /** Quanti sono i file in tutto, anche oltre quelli elencati. */
  quantiFile?: number;
  /** Dimensione e data dei file elencati, nello stesso ordine. I nodi di prima non le danno. */
  dettagli?: DettaglioFile[];
}

export interface DettaglioFile {
  byte: number;
  modificatoIl: string;
}

/** I file che un argomento della Home ha in un ambiente. */
export interface ElencoFile {
  percorsi: string[];
  quanti: number;
  dettagli?: DettaglioFile[];
}

/**
 * Da dove vengono i file che un progetto porta con sé: un argomento della Home.
 * Nell'ambiente del centro la cartella può non essere al posto solito, e allora va detta.
 */
export interface OrigineFile {
  idArgomento: string;
  cartellaAlCentro?: string;
}

/** Un argomento si riconosce da un nome che può fare da cartella ovunque. */
export function idArgomentoValido(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
}

/** Riconosce un'azione arrivata dall'esterno; nulla se non è ben formata. */
export function leggiAzione(letta: unknown): AzioneInAmbiente | undefined {
  if (typeof letta !== "object" || letta === null) return undefined;
  const campi = letta as Record<string, unknown>;
  const testo = (nome: string, massimo: number, minimo = 1): string | undefined => {
    const valore = campi[nome];
    return typeof valore === "string" && valore.length >= minimo && valore.length <= massimo
      ? valore
      : undefined;
  };
  switch (campi.tipo) {
    case "esegui": {
      const comando = testo("comando", COMANDO_MASSIMO);
      if (comando === undefined || comando.trim() === "") return undefined;
      const durataMs = campi.durataMs;
      if (durataMs === undefined) return { tipo: "esegui", comando };
      if (typeof durataMs !== "number" || !Number.isFinite(durataMs) || durataMs < 1_000) return undefined;
      return { tipo: "esegui", comando, durataMs: Math.min(durataMs, DURATA_MASSIMA_COMANDO_MS) };
    }
    case "scrivi-file": {
      const percorso = testo("percorso", PERCORSO_MASSIMO);
      const contenuto = testo("contenuto", CONTENUTO_MASSIMO, 0);
      if (percorso === undefined || percorso.trim() === "" || contenuto === undefined) return undefined;
      return { tipo: "scrivi-file", percorso, contenuto };
    }
    case "leggi-file": {
      const percorso = testo("percorso", PERCORSO_MASSIMO);
      if (percorso === undefined || percorso.trim() === "") return undefined;
      return { tipo: "leggi-file", percorso };
    }
    case "modifica-file": {
      const percorso = testo("percorso", PERCORSO_MASSIMO);
      const vecchio = testo("vecchio", CONTENUTO_MASSIMO);
      const nuovo = testo("nuovo", CONTENUTO_MASSIMO, 0);
      if (percorso === undefined || percorso.trim() === "" || vecchio === undefined || nuovo === undefined || vecchio === nuovo) return undefined;
      return { tipo: "modifica-file", percorso, vecchio, nuovo, ...(campi.tutte === true ? { tutte: true } : {}) };
    }
    case "elenca-file":
      return { tipo: "elenca-file" };
    case "controlla-cartella":
      return { tipo: "controlla-cartella" };
    case "leggi-elaborato": {
      const percorso = campi.percorso;
      return percorsoDiElaboratoValido(percorso) ? { tipo: "leggi-elaborato", percorso } : undefined;
    }
    default:
      return undefined;
  }
}

/** Riconosce l'esito di un'azione riferito da un nodo. */
export function leggiEsito(letto: unknown): EsitoAzione | undefined {
  if (typeof letto !== "object" || letto === null) return undefined;
  const campi = letto as Record<string, unknown>;
  if (typeof campi.riuscita !== "boolean" || typeof campi.testo !== "string") return undefined;
  const file = Array.isArray(campi.file)
    ? campi.file.filter((voce): voce is string => typeof voce === "string").slice(0, FILE_ELENCATI_MASSIMO)
    : undefined;
  const quantiFile = campi.quantiFile;
  const dettagli =
    file !== undefined && Array.isArray(campi.dettagli) && campi.dettagli.length === file.length
      ? campi.dettagli.slice(0, FILE_ELENCATI_MASSIMO).map(leggiDettaglio)
      : undefined;
  return {
    riuscita: campi.riuscita,
    testo: campi.testo,
    ...(typeof campi.percorso === "string" ? { percorso: campi.percorso } : {}),
    ...(file === undefined ? {} : { file }),
    ...(typeof quantiFile === "number" && Number.isInteger(quantiFile) && quantiFile >= 0 ? { quantiFile } : {}),
    ...(dettagli === undefined || dettagli.some((d) => d === undefined) ? {} : { dettagli: dettagli as DettaglioFile[] }),
  };
}

function leggiDettaglio(letto: unknown): DettaglioFile | undefined {
  if (typeof letto !== "object" || letto === null) return undefined;
  const { byte, modificatoIl } = letto as Record<string, unknown>;
  if (typeof byte !== "number" || !Number.isInteger(byte) || byte < 0) return undefined;
  if (typeof modificatoIl !== "string" || Number.isNaN(Date.parse(modificatoIl))) return undefined;
  return { byte, modificatoIl };
}

/**
 * La cartella di un argomento della Home in un ambiente, scritta come la scrive quell'ambiente:
 * con la barra rovesciata se la cartella dei progetti è di Windows.
 */
export function cartellaDellArgomento(radiceProgetti: string, idArgomento: string): string {
  const separatore = diWindows(radiceProgetti) ? "\\" : "/";
  const radice = radiceProgetti.replace(/[\\/]+$/, "");
  return [radice, CARTELLA_HOME, idArgomento].join(separatore);
}

/**
 * Vero se il percorso resta tra i file degli argomenti della Home in quell'ambiente:
 * un percorso relativo, che parte dalla cartella dell'argomento, oppure uno completo
 * sotto la cartella degli argomenti. Un percorso che risale con ".." non vale mai.
 */
export function traIFileDellaHome(radiceProgetti: string, percorso: string): boolean {
  const pezzi = percorso.split(/[\\/]+/);
  if (pezzi.includes("..")) return false;
  const completo = /^([A-Za-z]:|[\\/])/.test(percorso);
  if (!completo) return true;
  const windows = diWindows(radiceProgetti);
  const uniforma = (testo: string): string => {
    const dritto = testo.replace(/\\/g, "/").replace(/\/+$/, "");
    return windows ? dritto.toLowerCase() : dritto;
  };
  const radice = `${uniforma(radiceProgetti)}/${CARTELLA_HOME}/`;
  return `${uniforma(percorso)}/`.startsWith(radice);
}

function diWindows(percorso: string): boolean {
  return /^[A-Za-z]:|\\/.test(percorso);
}
