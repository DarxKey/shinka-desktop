/**
 * Ciò che il gateway, il centro e i nodi si dicono sugli stack di prova: i container che Claude
 * avvia sugli host Docker del lab, accanto ai servizi del proprietario.
 *
 * Uno stack è descritto con pochi campi, e il gateway ne ricava da sé ciò che Docker deve fare:
 * in questa descrizione non c'è modo di chiedere un container privilegiato, una rete dell'host
 * o il montaggio di un percorso qualunque.
 */

/** Il nome di uno stack: lettere minuscole, cifre e trattini. Su Docker diventa `shinka-nome`. */
export const NOME_STACK = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** Il nome di un servizio o di un volume dentro uno stack. */
export const NOME_NELLO_STACK = /^[a-z0-9][a-z0-9-]{0,30}$/;

/** Come cominciano, su Docker, i nomi di ciò che Shinka ha creato. */
export const PREFISSO_STACK = "shinka-";

/** L'etichetta che ogni container di uno stack di Shinka porta, con il nome dello stack. */
export const ETICHETTA_STACK = "shinka.stack";

/** Il file che segna come di Shinka la cartella di uno stack, sotto la radice dei volumi. */
export const SEGNO_DI_SHINKA = ".shinka-stack";

export const SERVIZI_PER_STACK = 8;
export const PORTE_PER_SERVIZIO = 10;
export const VOLUMI_PER_SERVIZIO = 10;
export const VARIABILI_PER_SERVIZIO = 40;
export const VALORE_VARIABILE_MASSIMO = 2_000;
export const PAROLE_DEL_COMANDO = 40;
export const FILE_PER_STACK = 20;
/** Quanti caratteri possono avere, tutti insieme, i file scritti con uno stack. */
export const FILE_STACK_MASSIMO = 60_000;

/** La memoria di un servizio, in MB: se non è detta, e i limiti. */
export const MEMORIA_SERVIZIO_MB = 1024;
export const MEMORIA_SERVIZIO_MINIMA_MB = 16;
export const MEMORIA_SERVIZIO_MASSIMA_MB = 8192;

/** Quante righe di uscita dei servizi tornano con `leggi`: se non è detto, e al massimo. */
export const RIGHE_STACK = 80;
export const RIGHE_STACK_MASSIME = 500;

/** Quanto può durare l'avvio di uno stack, in secondi: scaricare un'immagine richiede tempo. */
export const SECONDI_AVVIO_STACK = 600;
/** Quanto può durare ogni altra operazione su uno stack. */
export const SECONDI_OPERAZIONE_STACK = 120;

/** Quante porte può avere al massimo l'intervallo dedicato agli stack su un host. */
export const PORTE_DEL_RECINTO = 1000;

/** Il recinto di un host per gli stack: le porte dedicate e la cartella sotto cui stanno i volumi. */
export interface RecintoStack {
  porte: { da: number; a: number };
  radice: string;
}

export interface PortaStack {
  /** La porta sull'host: deve stare nell'intervallo dedicato. */
  host: number;
  container: number;
  protocollo: "tcp" | "udp";
}

export interface VolumeStack {
  /** Il nome del volume: è una cartella dello stack, sotto la radice dei volumi dell'host. */
  nome: string;
  /** Dove compare dentro il container. */
  percorso: string;
  solaLettura: boolean;
}

export interface ServizioStack {
  nome: string;
  immagine: string;
  comando?: string[];
  ambiente: Record<string, string>;
  porte: PortaStack[];
  volumi: VolumeStack[];
  dipendeDa: string[];
  memoriaMb: number;
}

/** Un file di testo scritto in un volume prima dell'avvio: una configurazione, una pagina, uno script. */
export interface FileStack {
  volume: string;
  /** Il percorso dentro il volume, senza barra iniziale. */
  percorso: string;
  contenuto: string;
}

/** Uno stack come il gateway lo ha letto e accettato. */
export interface DescrizioneStack {
  nome: string;
  servizi: ServizioStack[];
  file: FileStack[];
}

/** Il centro chiede al gateway un'operazione su uno stack, per una conversazione. */
export type RichiestaStack = {
  /** Per quale conversazione, in parole per il proprietario: finisce nel registro. */
  conversazione: string;
} & (
  | { operazione: "elenca"; host?: string }
  /** `stack` è la descrizione come l'ha scritta Claude: la legge e la controlla il gateway. */
  | { operazione: "avvia"; host: string; stack: unknown }
  | { operazione: "ferma"; host: string; nome: string }
  | { operazione: "leggi"; host: string; nome: string; righe?: number }
  | { operazione: "rimuovi"; host: string; nome: string; tieniDati?: boolean }
);

export const OPERAZIONI_STACK = ["elenca", "avvia", "ferma", "leggi", "rimuovi"] as const;

export type EsitoStack =
  /** Fatto: in parole, ciò che c'è adesso. */
  | { esito: "fatto"; testo: string }
  /** Rifiutato dal gateway prima di toccare l'host, oppure non riuscito. */
  | { esito: "rifiutato" | "fallito"; motivo: string };

/**
 * La radice dei volumi come la intende il gateway: un percorso assoluto di almeno due livelli,
 * fatto di lettere, cifre, punti, trattini e trattini bassi. Restituisce nulla se non lo è.
 */
export function leggiRadice(scritta: string): string | undefined {
  const pulita = scritta.trim().replace(/\/+$/, "");
  if (pulita.length > 200 || !/^(\/[A-Za-z0-9._-]+){2,}$/.test(pulita)) return undefined;
  if (pulita.split("/").some((parte) => parte === "." || parte === "..")) return undefined;
  return pulita;
}

/** Il recinto come lo scrive il proprietario, controllato. Restituisce il motivo se non va. */
export function leggiRecinto(scritto: unknown): RecintoStack | string {
  if (typeof scritto !== "object" || scritto === null) return "Mancano le porte e la cartella dei volumi.";
  const { porte, radice } = scritto as { porte?: { da?: unknown; a?: unknown }; radice?: unknown };
  const da = porte?.da;
  const a = porte?.a;
  if (typeof da !== "number" || typeof a !== "number" || !Number.isInteger(da) || !Number.isInteger(a) || da < 1024 || a > 65535 || da > a) {
    return "Le porte dedicate agli stack sono un intervallo tra 1024 e 65535, per esempio da 7900 a 7999.";
  }
  if (a - da + 1 > PORTE_DEL_RECINTO) return `L'intervallo delle porte ne contiene al massimo ${PORTE_DEL_RECINTO}.`;
  const letta = typeof radice === "string" ? leggiRadice(radice) : undefined;
  if (letta === undefined) {
    return "La cartella dei volumi è un percorso assoluto di almeno due livelli, senza spazi: per esempio /mnt/user/appdata/shinka-stack.";
  }
  return { porte: { da, a }, radice: letta };
}
