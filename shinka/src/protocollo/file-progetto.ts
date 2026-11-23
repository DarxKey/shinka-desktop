/**
 * I file di un progetto, per il pannello File: sfogliare una cartella, cercare un file per nome e
 * leggerne uno per l'anteprima. Solo lettura, e solo dentro la cartella del progetto. Qui stanno
 * ciò che il centro chiede a chi sta nell'ambiente e ciò che ne torna: dati semplici, in JSON.
 */

/** Una voce di una cartella. */
export interface VoceCartella {
  nome: string;
  cartella: boolean;
  /** In byte, per i file. */
  dimensione?: number;
}

export interface ElencoCartella {
  /** Relativo alla cartella del progetto, con "/"; vuoto per la cartella stessa. */
  percorso: string;
  voci: VoceCartella[];
}

export interface FileTrovati {
  percorsi: string[];
  /** Vero se ce n'erano di più, o se la ricerca si è fermata prima di guardare tutto. */
  incompleta: boolean;
}

export interface FileLetto {
  percorso: string;
  dimensione: number;
  /** Il contenuto, in base64. */
  dati: string;
}

/** Quanto può essere grande un file da mostrare in anteprima. */
export const FILE_LETTO_MASSIMO = 10 * 1024 * 1024;

/** Quanti file trova al massimo una ricerca, e quante voci guarda. */
export const TROVATI_MASSIMI = 200;
export const VOCI_GUARDATE_MASSIME = 50_000;

/** Le cartelle che la ricerca salta: dipendenze, costruzioni, repository. */
export const CARTELLE_SALTATE = new Set([".git", "node_modules", "dist", "build", ".venv", "venv", "__pycache__", ".next", "target", ".cache"]);

/** Ciò che il centro chiede a chi tiene i file dei progetti di un ambiente. */
export type ComandoFile =
  | { tipo: "file-elenca"; idRichiesta: string; cartella: string; percorso: string }
  | { tipo: "file-cerca"; idRichiesta: string; cartella: string; testo: string }
  | { tipo: "file-leggi"; idRichiesta: string; cartella: string; percorso: string };

/** Ciò che torna: l'esito, oppure un motivo. Il centro lo legge secondo ciò che aveva chiesto. */
export type RiferitoFile = { tipo: "file-esito"; idRichiesta: string; esito: unknown };

export interface PortaFile {
  esegui(comando: ComandoFile): void;
}

/** Un percorso relativo fatto come deve: niente che risalga, niente di assoluto. */
export function percorsoRelativoValido(percorso: unknown): percorso is string {
  if (typeof percorso !== "string" || percorso.length > 4000 || percorso.includes("\0")) return false;
  if (percorso === "") return true;
  if (/^[/\\]|^[A-Za-z]:/.test(percorso)) return false;
  return percorso.split(/[/\\]/).every((parte) => parte !== ".." && parte !== "");
}

function testo(campi: Record<string, unknown>, nome: string, massimo: number): string | undefined {
  const valore = campi[nome];
  return typeof valore === "string" && valore.length <= massimo ? valore : undefined;
}

export function leggiComandoFile(campi: Record<string, unknown>): ComandoFile | undefined {
  const idRichiesta = testo(campi, "idRichiesta", 100);
  const cartella = testo(campi, "cartella", 1000);
  if (idRichiesta === undefined || idRichiesta === "" || cartella === undefined || cartella === "") return undefined;
  switch (campi.tipo) {
    case "file-elenca":
    case "file-leggi":
      return percorsoRelativoValido(campi.percorso) ? { tipo: campi.tipo, idRichiesta, cartella, percorso: campi.percorso } : undefined;
    case "file-cerca": {
      const cercato = testo(campi, "testo", 200);
      return cercato === undefined || cercato.trim() === "" ? undefined : { tipo: "file-cerca", idRichiesta, cartella, testo: cercato };
    }
    default:
      return undefined;
  }
}

export function leggiRiferitoFile(campi: Record<string, unknown>): RiferitoFile | undefined {
  if (campi.tipo !== "file-esito") return undefined;
  const idRichiesta = testo(campi, "idRichiesta", 100);
  return idRichiesta === undefined ? undefined : { tipo: "file-esito", idRichiesta, esito: campi.esito };
}

export function leggiElenco(valore: unknown): ElencoCartella | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { percorso, voci } = valore as Record<string, unknown>;
  if (typeof percorso !== "string" || !Array.isArray(voci)) return undefined;
  return {
    percorso,
    voci: voci.flatMap((voce: unknown) => {
      if (typeof voce !== "object" || voce === null) return [];
      const { nome, cartella, dimensione } = voce as Record<string, unknown>;
      if (typeof nome !== "string" || typeof cartella !== "boolean") return [];
      return [{ nome, cartella, ...(typeof dimensione === "number" ? { dimensione } : {}) }];
    }),
  };
}

export function leggiTrovati(valore: unknown): FileTrovati | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { percorsi, incompleta } = valore as Record<string, unknown>;
  if (!Array.isArray(percorsi)) return undefined;
  return { percorsi: percorsi.filter((voce): voce is string => typeof voce === "string").slice(0, TROVATI_MASSIMI), incompleta: incompleta === true };
}

export function leggiFileLetto(valore: unknown): FileLetto | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { percorso, dimensione, dati } = valore as Record<string, unknown>;
  if (typeof percorso !== "string" || typeof dimensione !== "number" || typeof dati !== "string") return undefined;
  return { percorso, dimensione, dati };
}

/** Come si mostra un file, dal suo nome. */
export type GenereDiFile = "testo" | "markdown" | "immagine" | "pdf" | "video" | "audio" | "altro";

const GENERI: Record<string, { genere: GenereDiFile; tipo?: string }> = {
  md: { genere: "markdown" },
  markdown: { genere: "markdown" },
  png: { genere: "immagine", tipo: "image/png" },
  jpg: { genere: "immagine", tipo: "image/jpeg" },
  jpeg: { genere: "immagine", tipo: "image/jpeg" },
  gif: { genere: "immagine", tipo: "image/gif" },
  webp: { genere: "immagine", tipo: "image/webp" },
  avif: { genere: "immagine", tipo: "image/avif" },
  bmp: { genere: "immagine", tipo: "image/bmp" },
  ico: { genere: "immagine", tipo: "image/x-icon" },
  pdf: { genere: "pdf", tipo: "application/pdf" },
  mp4: { genere: "video", tipo: "video/mp4" },
  webm: { genere: "video", tipo: "video/webm" },
  mov: { genere: "video", tipo: "video/quicktime" },
  m4v: { genere: "video", tipo: "video/mp4" },
  mp3: { genere: "audio", tipo: "audio/mpeg" },
  wav: { genere: "audio", tipo: "audio/wav" },
  ogg: { genere: "audio", tipo: "audio/ogg" },
  m4a: { genere: "audio", tipo: "audio/mp4" },
  flac: { genere: "audio", tipo: "audio/flac" },
  zip: { genere: "altro" },
  gz: { genere: "altro" },
  tar: { genere: "altro" },
  exe: { genere: "altro" },
  dll: { genere: "altro" },
  so: { genere: "altro" },
  woff: { genere: "altro" },
  woff2: { genere: "altro" },
  ttf: { genere: "altro" },
  docx: { genere: "altro" },
  xlsx: { genere: "altro" },
  pptx: { genere: "altro" },
};

/** Il genere di un file e il tipo con cui il centro lo serve: il testo, anche HTML o SVG, sempre come testo. */
export function genereDelFile(nome: string): { genere: GenereDiFile; tipo: string } {
  const estensione = /\.([A-Za-z0-9]+)$/.exec(nome)?.[1]?.toLowerCase() ?? "";
  const noto = GENERI[estensione];
  if (noto === undefined || noto.genere === "markdown") return { genere: noto?.genere ?? "testo", tipo: "text/plain; charset=utf-8" };
  return { genere: noto.genere, tipo: noto.tipo ?? "application/octet-stream" };
}

/** Il linguaggio per il colore della sintassi, dal nome del file. */
export function linguaggioDi(nome: string): string {
  const estensione = /\.([A-Za-z0-9]+)$/.exec(nome)?.[1]?.toLowerCase() ?? "";
  if (/^dockerfile$/i.test(nome.split(/[/\\]/).pop() ?? "")) return "dockerfile";
  const noti: Record<string, string> = {
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    json: "json", py: "python", rs: "rust", go: "go", java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp",
    css: "css", html: "xml", htm: "xml", xml: "xml", svg: "xml", vue: "xml", yml: "yaml", yaml: "yaml", toml: "ini", ini: "ini",
    sh: "bash", bash: "bash", zsh: "bash", ps1: "powershell", sql: "sql", md: "markdown", diff: "diff", patch: "diff",
  };
  return noti[estensione] ?? "";
}
