/**
 * Ciò che il gateway, il centro e l'interfaccia si dicono su Telegram.
 *
 * Il bot lo tiene il gateway: lì sta il suo token, che in nessuno di questi tipi compare, e lì
 * si decide chi è il proprietario. Al centro arrivano soltanto i messaggi e i pulsanti premuti
 * da lui; ciò che il centro manda arriva soltanto a lui.
 */

/**
 * - `da-configurare`: il proprietario non ha ancora scritto il token del bot;
 * - `da-abbinare`: il bot c'è, ma non sa ancora chi è il proprietario;
 * - `attivo`: riceve e consegna;
 * - `errore`: c'è tutto, ma Telegram non risponde come dovrebbe (`problema` dice perché).
 */
export type CondizioneTelegram = "da-configurare" | "da-abbinare" | "attivo" | "errore";

/** Telegram come lo vedono il centro e l'interfaccia di Shinka. */
export interface StatoTelegram {
  condizione: CondizioneTelegram;
  /** Il nome utente del bot, senza chiocciola. */
  bot?: string;
  /** In parole per il proprietario, che cosa non va. */
  problema?: string;
}

/** Telegram come lo vede l'interfaccia, attraverso il centro: può anche non esserci affatto. */
export type TelegramDalCentro = StatoTelegram | { condizione: "non-disponibile" };

/** Telegram come lo vede il proprietario nella pagina del gateway. */
export interface TelegramInVista extends StatoTelegram {
  /** L'account abbinato: l'unico che il bot ascolta. */
  proprietario?: { id: number; nome: string; utente?: string; abbinatoIl: string };
  /** Il codice da mandare al bot per abbinarsi, finché vale. */
  codice?: { valore: string; scadeIl: string };
  /** Quanti messaggi di altri mittenti sono stati ignorati da quando il gateway è acceso. */
  ignorati: number;
  ultimoIgnorato?: string;
}

/** Quanto può essere lungo un messaggio, contato senza i segni di formato. */
export const TESTO_TELEGRAM_MASSIMO = 4096;
/** Quanti byte può portare con sé un pulsante. */
export const DATO_PULSANTE_MASSIMO = 64;
export const TESTO_PULSANTE_MASSIMO = 40;
export const RIGHE_DI_PULSANTI = 6;
export const PULSANTI_PER_RIGA = 4;

/** Per quanto vale il codice di abbinamento, e quanti tentativi sbagliati sopporta. */
export const CODICE_TELEGRAM_MS = 10 * 60 * 1000;
export const TENTATIVI_CODICE_TELEGRAM = 5;

/**
 * Come comincia il dato dei pulsanti che il gateway crea per sé: il centro non può mandarne, e
 * quando il proprietario ne preme uno il gateway lo tiene per sé, senza passarlo al centro.
 */
export const PREFISSO_PULSANTE_DEL_GATEWAY = "gw:";

export interface PulsanteTelegram {
  testo: string;
  /** Torna al centro quando il proprietario preme il pulsante. */
  dato: string;
}

/** Un messaggio per il proprietario. */
export interface MessaggioTelegram {
  testo: string;
  /** Vero se il testo usa i segni di formato di Telegram (`<b>`, `<code>`, `<pre>`…). */
  html?: boolean;
  pulsanti?: PulsanteTelegram[][];
  /** Vero per consegnarlo senza suono. */
  silenzioso?: boolean;
}

/** Il file più grande che un bot può mandare: oltre, Telegram lo rifiuta. */
export const FILE_TELEGRAM_MASSIMO = 50 * 1024 * 1024;

/** La foto più grande che Telegram accetta come tale: oltre, si manda come documento. */
export const FOTO_TELEGRAM_MASSIMA = 10 * 1024 * 1024;

/** Quanto può essere lunga la riga che accompagna un file. */
export const DIDASCALIA_TELEGRAM_MASSIMA = 1024;

/** Un file per il proprietario: il contenuto viaggia a parte, così com'è. */
export interface FileTelegram {
  /** Il nome con cui arriva, senza cartelle. */
  nome: string;
  /** Il tipo del contenuto, per esempio application/pdf. */
  tipo: string;
  /** Una riga di testo sotto il file. */
  didascalia?: string;
  /** Vero per un'immagine da mostrare come foto; se Telegram non la accetta così, arriva come documento. */
  comeFoto?: boolean;
}

/**
 * Il nome di un file come può arrivare su Telegram: senza cartelle e senza caratteri di controllo.
 * Nulla se non resta un nome usabile.
 */
export function nomeFileTelegram(nome: string): string | undefined {
  const pulito = (nome.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  if (pulito === "" || pulito === "." || pulito === "..") return undefined;
  return pulito.length <= 200 ? pulito : pulito.slice(pulito.length - 200);
}

export type EsitoTelegram =
  /** Consegnato a Telegram: `messaggio` serve per modificarlo più tardi. */
  | { esito: "inviato"; messaggio: number }
  | { esito: "rifiutato" | "fallito"; motivo: string };

/** Ciò che il proprietario ha fatto nel bot. `n` cresce sempre: serve al centro per dire fin dove ha letto. */
export type EventoTelegram =
  | { n: number; quando: string; tipo: "messaggio"; testo: string }
  | { n: number; quando: string; tipo: "pulsante"; dato: string; messaggio: number }
  /**
   * Il proprietario ha condiviso la sua posizione. `posizione.quando` è l'ora del dato. Con
   * `aggiornamento` è il nuovo punto di una posizione condivisa dal vivo, che si aggiorna da sola.
   */
  | { n: number; quando: string; tipo: "posizione"; posizione: PosizioneDaTelegram; aggiornamento: boolean }
  /**
   * Il proprietario ha mandato un file: un documento, una foto, un video o un audio. Il contenuto
   * il centro lo chiede al gateway quando lo vuole, con `file.id`. I file di un album hanno lo stesso `gruppo`.
   */
  | { n: number; quando: string; tipo: "file"; file: FileRicevuto; didascalia?: string; gruppo?: string };

/** Un file che il proprietario ha mandato al bot. */
export interface FileRicevuto {
  id: string;
  nome: string;
  /** Il tipo del contenuto, per esempio application/pdf. */
  mime: string;
  byte: number;
}

/** Il file più grande che un bot può scaricare da Telegram. */
export const FILE_RICEVUTO_MASSIMO = 20 * 1024 * 1024;

/** Una posizione come la riferisce il gateway: la fonte è Telegram per forza. */
export interface PosizioneDaTelegram {
  lat: number;
  lon: number;
  precisioneM?: number;
  quando: string;
  dalVivo?: boolean;
  finoA?: string;
}

export interface EventiTelegram {
  stato: StatoTelegram;
  eventi: EventoTelegram[];
}

/** Scrive un testo qualunque in modo che Telegram lo mostri com'è, dentro un messaggio con formato. */
export function testoPerTelegram(testo: string): string {
  return testo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Toglie i segni di formato: ciò che resta è il testo che il proprietario leggerebbe. */
export function senzaFormato(html: string): string {
  return html
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
