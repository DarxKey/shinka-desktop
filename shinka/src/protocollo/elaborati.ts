/**
 * Gli elaborati: i file che la Home produce in un argomento, nella cartella che l'argomento ha in
 * ciascun ambiente. Il proprietario li rivede in un pannello accanto alla chat, e la Home ne mostra
 * uno nella chat quando lo consegna. Qui stanno i tipi condivisi da centro, nodi e interfaccia, e il
 * modo di riconoscere un elaborato dal nome.
 */

/** Il file più grande che si mostra o si scarica da un pannello: oltre, si apre nell'ambiente. */
export const ELABORATO_MASSIMO = 10 * 1024 * 1024;

/** Come si mostra un elaborato. */
export type GenereElaborato = "immagine" | "markdown" | "html" | "testo" | "altro";

const IMMAGINI: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

const TESTI = new Set([
  "txt", "text", "log", "csv", "tsv", "json", "jsonl", "geojson", "xml", "gpx", "kml", "yaml", "yml", "toml", "ini",
  "conf", "cfg", "env", "sh", "bash", "zsh", "ps1", "psm1", "psd1", "bat", "cmd", "py", "js", "mjs", "cjs", "ts",
  "tsx", "jsx", "css", "scss", "sql", "rb", "go", "rs", "java", "kt", "c", "h", "cpp", "hpp", "cs", "php", "lua",
  "r", "swift", "dockerfile", "makefile", "ics", "vcf", "srt", "tex", "rst", "org", "diff", "patch",
]);

const ALTRI: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function estensioneDi(percorso: string): string {
  const nome = percorso.split(/[\\/]/).pop() ?? "";
  const punto = nome.lastIndexOf(".");
  // Un file senza estensione, come Dockerfile o Makefile, si riconosce dal nome intero.
  return (punto <= 0 ? nome : nome.slice(punto + 1)).toLowerCase();
}

/** Il genere di un elaborato, dal nome: decide come il pannello lo mostra. */
export function genereDi(percorso: string): GenereElaborato {
  const estensione = estensioneDi(percorso);
  if (estensione in IMMAGINI) return "immagine";
  if (estensione === "md" || estensione === "markdown") return "markdown";
  if (estensione === "html" || estensione === "htm") return "html";
  if (TESTI.has(estensione) || estensione === "readme") return "testo";
  return "altro";
}

/** Il tipo con cui il centro manda un elaborato al browser. */
export function tipoMimeDi(percorso: string): string {
  const estensione = estensioneDi(percorso);
  switch (genereDi(percorso)) {
    case "immagine":
      return IMMAGINI[estensione] ?? "application/octet-stream";
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "html":
      return "text/html; charset=utf-8";
    case "testo":
      return "text/plain; charset=utf-8";
    case "altro":
      return ALTRI[estensione] ?? "application/octet-stream";
  }
}

/**
 * Vero se il percorso indica un file dentro la cartella dell'argomento: relativo, con la barra
 * dritta, senza risalire e senza pezzi vuoti. È così che i percorsi arrivano dagli elenchi.
 */
export function percorsoDiElaboratoValido(percorso: unknown): percorso is string {
  if (typeof percorso !== "string" || percorso.length === 0 || percorso.length > 1000) return false;
  if (percorso.includes("\\") || percorso.includes("\u0000") || /^[A-Za-z]:/.test(percorso)) return false;
  const pezzi = percorso.split("/");
  return pezzi.every((pezzo) => pezzo !== "" && pezzo !== "." && pezzo !== "..");
}

/** Un elaborato in un elenco. Dimensione e data mancano se il nodo dell'ambiente non le sa dire. */
export interface VoceElaborato {
  percorso: string;
  byte?: number;
  modificatoIl?: string;
}

/** Gli elaborati che un argomento ha in un ambiente. */
export interface ElaboratiInAmbiente {
  idAmbiente: string;
  nomeAmbiente: string;
  attivo: boolean;
  file: VoceElaborato[];
  /** Quanti sono in tutto, anche oltre quelli elencati. */
  quanti: number;
  /** Perché non si è potuto guardare: l'ambiente spento, o il suo nodo che non risponde. */
  problema?: string;
}

export interface ElaboratiDellArgomento {
  idArgomento: string;
  /** Solo gli ambienti in cui l'argomento ha file, o in cui non si è potuto guardare. */
  ambienti: ElaboratiInAmbiente[];
}

/**
 * Un elaborato definitivo: un file che la Home ha consegnato al proprietario mostrandolo. I file di
 * lavoro che non ha mostrato non ci sono.
 */
export interface ElaboratoConsegnato {
  idArgomento: string;
  /** Il titolo dell'argomento, se è archiviato; manca per quello aperto. */
  titoloArgomento?: string;
  idAmbiente: string;
  nomeAmbiente: string;
  percorso: string;
  titolo?: string;
  /** Il comando che lo rifà con i dati del momento, se la Home lo ha dato: parte con "Aggiorna". */
  aggiorna?: string;
  /** Quando la Home lo ha mostrato l'ultima volta. */
  quando: string;
}

/** Quanto può essere lungo il comando che rifà un elaborato, e quanto può durare. */
export const AGGIORNA_MASSIMO = 2000;
export const DURATA_AGGIORNA_MS = 180_000;

/** Quanto può essere grande un elaborato scritto a mano dal proprietario. */
export const MODIFICA_MASSIMA = 1_000_000;

/** Vero se il proprietario può modificare a mano l'elaborato: Markdown e testo. */
export function modificabileAMano(percorso: string): boolean {
  const genere = genereDi(percorso);
  return genere === "markdown" || genere === "testo";
}
