/**
 * Ciò che il gateway, il centro e l'interfaccia si dicono sul vault e sulle sue credenziali.
 * In nessuno di questi tipi c'è il valore di una credenziale: quello non esce mai dal gateway.
 * Le eccezioni, scelte dal proprietario, sono due. `EsitoChiavi`: la chiave di un'estensione viene
 * consegnata al programma di quell'estensione, e solo le voci di quel tipo si possono consegnare.
 * `EsitoLettura`: una credenziale in chiaro, di prova o a basso rischio, la legge Claude, e solo
 * le voci inserite così si possono leggere (ADR 0034).
 */

import type { RecintoStack } from "./stack.ts";
import type { TelegramDalCentro } from "./telegram.ts";
import type { AggiornamentoDelGateway } from "./versione.ts";

/** La porta su cui il gateway ascolta, se non gliene viene indicata un'altra. */
export const PORTA_GATEWAY = 7851;

/** La porta di SSH, sottintesa quando un host è scritto senza. */
export const PORTA_SSH = 22;

/** Da impostare finché il proprietario non ha scelto la frase di sblocco; poi chiuso o aperto. */
export type CondizioneVault = "da-impostare" | "chiuso" | "aperto";

/**
 * Password e chiave servono per SSH; "sito" è nome utente e password per entrare in un sito;
 * "estensione" è la chiave che un'estensione di Shinka riceve quando parte.
 */
export type TipoCredenziale = "password" | "chiave" | "sito" | "estensione";

/** Quanto può essere lungo il nome di un ambiente scritto accanto alla chiave di un'estensione. */
export const AMBIENTE_MASSIMO = 80;

/** Quante chiavi un'estensione può chiedere in una volta. */
export const CHIAVI_PER_ESTENSIONE = 20;

/** Lettere minuscole, cifre e trattini: è il nome con cui Claude chiede la credenziale. */
export const NOME_CREDENZIALE = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** La frase di sblocco più corta che il vault accetta. */
export const FRASE_MINIMA = 12;

export const UTENTE_MASSIMO = 64;
/** In un sito il nome utente è spesso un indirizzo email. */
export const UTENTE_SITO_MASSIMO = 254;
export const HOST_PER_CREDENZIALE = 20;
export const SEGRETO_MASSIMO = 20_000;
export const COMANDO_SU_HOST_MASSIMO = 20_000;

/** Quanto può durare un comando su un host, in secondi: se non è detto, e al massimo. */
export const SECONDI_COMANDO_SU_HOST = 60;
export const SECONDI_COMANDO_SU_HOST_MASSIMI = 600;

/** Quanto resta valida la richiesta di approvazione di un comando su un host per gli stack. */
export const APPROVAZIONE_MS = 5 * 60 * 1000;

/** Quante approvazioni possono restare in attesa insieme: oltre, il gateway rifiuta la richiesta nuova. */
export const APPROVAZIONI_IN_ATTESA = 20;

/** Ciò che il proprietario decide di un'approvazione, o ciò che succede se non decide in tempo. */
export type DecisioneApprovazione = "approvata" | "negata" | "scaduta";

/** Una credenziale come la vede chiunque non sia il gateway: senza il suo valore. */
export interface CredenzialeInVista {
  nome: string;
  tipo: TipoCredenziale;
  utente: string;
  /**
   * Dove vale: gli host scritti come `nome:porta`, oppure, per una credenziale di tipo "sito",
   * i siti scritti come `https://nome`. Altrove il gateway la rifiuta. Per la chiave di
   * un'estensione sono i nomi degli ambienti in cui viene consegnata, e `utente` è il nome della
   * chiave: quello della variabile d'ambiente o dell'intestazione con cui l'estensione la riceve.
   */
  host: string[];
  /** Presente per la chiave di un'estensione: il nome dell'estensione che la riceve. */
  estensione?: string;
  /**
   * Presente se è una credenziale in chiaro: Claude ne può leggere il valore con leggi_credenziale,
   * per gli host o i siti in cui vale. Le altre sono protette: il valore non esce dal gateway.
   */
  inChiaro?: true;
  inseritaIl: string;
  /** L'ultima volta che è stata usata, se è successo. */
  usataIl?: string;
  /**
   * Presente se i suoi host sono host per gli stack di prova: le porte e la cartella dedicate.
   * Su quegli host Claude gestisce da solo i suoi stack; ogni altro comando chiede l'approvazione.
   */
  stack?: RecintoStack;
  /**
   * Presente se i suoi host sono il server su cui gira Shinka: lì ogni comando aspetta il sì del
   * proprietario, e quel sì lo raccoglie il gateway stesso, non il centro.
   */
  server?: true;
}

/** Ciò che il gateway dice di sé al centro. Le credenziali ci sono solo a vault aperto. */
export interface StatoDelGateway {
  condizione: CondizioneVault;
  credenziali: CredenzialeInVista[];
  /** La versione da cui il gateway gira; manca se non è scritta nella sua cartella. */
  versione?: string;
  /** Presente se il gateway è tenuto acceso dal suo guardiano, e quindi sa cambiare versione. */
  siAggiorna?: true;
  /** L'ultima versione che il centro gli ha proposto, finché c'è qualcosa da dirne. */
  aggiornamento?: AggiornamentoDelGateway;
}

/**
 * Una domanda che il gateway fa al proprietario, lui stesso: su Telegram con un pulsante che solo
 * il gateway può creare, e nella pagina del vault. Il centro non può rispondere di sì al suo posto.
 */
export interface DomandaDelGateway {
  id: string;
  /** Che cosa si chiede: di installare una versione del gateway, o di eseguire un comando sul server. */
  tipo: "versione" | "comando";
  titolo: string;
  testo: string;
  /** La scritta del pulsante con cui il proprietario dice di sì. */
  si: string;
  scadeIl: string;
}

/** Il centro chiede di eseguire un comando su un host con una credenziale, per una conversazione. */
export interface RichiestaUso {
  credenziale: string;
  host: string;
  comando: string;
  secondi?: number;
  /** Per quale conversazione, in parole per il proprietario: finisce nel registro. */
  conversazione: string;
}

export type EsitoUso =
  | {
      esito: "eseguito";
      /** Il codice di uscita del comando; nullo se è stato fermato prima che finisse. */
      codice: number | null;
      uscita: string;
      errori: string;
      /** Vero se il comando è stato fermato perché durava troppo. */
      scaduto: boolean;
      durataMs: number;
    }
  /**
   * L'host è un host per gli stack, e questo comando non è un'operazione su uno stack di Shinka:
   * il gateway lo tiene da parte finché il proprietario non lo approva, e lo esegue com'è.
   */
  | {
      esito: "da-approvare";
      approvazione: string;
      scadeIl: string;
      /** Vero se il sì lo raccoglie il gateway: il centro può solo aspettare, o negare. */
      alGateway?: true;
    }
  /** Rifiutato dal gateway prima di qualunque collegamento, oppure non riuscito. */
  | { esito: "rifiutato" | "fallito"; motivo: string };

/** Il centro chiede le chiavi di un'estensione che sta per partire in un ambiente. */
export interface RichiestaChiavi {
  /** Il nome dell'estensione, com'è nell'elenco di Shinka. */
  estensione: string;
  /** Il nome dell'ambiente in cui parte. */
  ambiente: string;
  /** I nomi delle chiavi che l'estensione dichiara. */
  chiavi: string[];
}

/**
 * Le chiavi di un'estensione, con il loro valore: vanno al programma dell'estensione e a nessun
 * altro. Il gateway le consegna solo tutte insieme, e scrive nel registro ogni consegna.
 */
export type EsitoChiavi =
  | { esito: "consegnate"; valori: Record<string, string> }
  | { esito: "rifiutato" | "fallito"; motivo: string };

/** I tipi di credenziale che possono essere in chiaro: quelle per gli host e per i siti. */
export const TIPI_IN_CHIARO = ["password", "chiave", "sito"] as const;
export type TipoInChiaro = (typeof TIPI_IN_CHIARO)[number];

/**
 * Claude propone di salvare una credenziale in chiaro, per esempio una password che ha generato
 * per un laboratorio: il gateway la tiene da parte e la mette nel vault solo se il proprietario
 * la approva dalla scheda nella conversazione.
 */
export interface RichiestaInChiaro {
  /** Per quale conversazione, in parole per il proprietario: finisce nel registro. */
  conversazione: string;
  nome: string;
  tipo: TipoInChiaro;
  utente: string;
  /** Gli host, o per un sito i siti, in cui vale. */
  host: string[];
  segreto: string;
  fraseDellaChiave?: string;
}

export type EsitoInChiaro =
  | { esito: "salvata"; credenziale: CredenzialeInVista }
  /** Tenuta da parte: il centro mostra la scheda, e riferisce la decisione con il nome dell'attesa. */
  | { esito: "da-approvare"; approvazione: string; scadeIl: string; credenziale: CredenzialeInVista }
  | { esito: "rifiutato"; motivo: string };

/** Claude chiede il valore di una credenziale in chiaro, per un host o un sito in cui vale. */
export interface RichiestaLettura {
  conversazione: string;
  credenziale: string;
  /** L'host (nome:porta) o il sito (https://nome) in cui la userà. */
  dove: string;
}

export type EsitoLettura =
  | { esito: "letta"; nome: string; tipo: TipoInChiaro; utente: string; segreto: string; fraseDellaChiave?: string; host: string[] }
  | { esito: "rifiutato"; motivo: string };

/** Che cosa Claude può fare in una pagina aperta nel browser del gateway. */
export const AZIONI_NEL_SITO = ["clicca", "scrivi", "scegli", "premi", "indietro", "scorri"] as const;
export type AzioneNelSito = (typeof AZIONI_NEL_SITO)[number];

export const INDIRIZZO_SITO_MASSIMO = 2_000;
export const TESTO_NEL_SITO_MASSIMO = 5_000;

/** Il centro chiede al browser del gateway un'operazione, per una conversazione. */
export type RichiestaBrowser = {
  /** Per quale conversazione, in parole per il proprietario: finisce nel registro. */
  conversazione: string;
  /** Il nome stabile della conversazione: ognuna ha la sua scheda nel browser. */
  chiave: string;
} & (
  | { operazione: "apri"; indirizzo: string }
  | { operazione: "leggi"; immagine?: boolean }
  | { operazione: "agisci"; azione: AzioneNelSito; elemento?: string; testo?: string; invio?: boolean }
  | { operazione: "inserisci"; credenziale: string; campoUtente?: string; campoPassword?: string }
  | { operazione: "chiudi" }
);

export type EsitoBrowser =
  /** Fatto: la pagina com'è adesso, in testo, e se chiesta la sua immagine in JPEG. */
  | { esito: "fatto"; testo: string; immagine?: string }
  /** Rifiutato dal gateway prima di toccare la pagina, oppure non riuscito. */
  | { esito: "rifiutato" | "fallito"; motivo: string };

/** Una riga del registro: ciò che il gateway ha fatto davvero, o ha rifiutato di fare. */
export interface VoceRegistro {
  quando: string;
  /** Vuota quando il gateway ha rifiutato un'azione in un sito che non usava una credenziale. */
  credenziale: string;
  /** L'host del comando, oppure il sito in cui la credenziale è stata inserita. */
  host: string;
  conversazione: string;
  /** Il comando eseguito, oppure in parole ciò che è stato fatto nel sito. */
  comando: string;
  /** Presente per ciò che è avvenuto nel browser del gateway. */
  nelBrowser?: true;
  esito: "eseguito" | "rifiutato" | "fallito";
  codice?: number | null;
  motivo?: string;
  durataMs?: number;
}

/** Il vault come lo vede l'interfaccia di Shinka, attraverso il centro. */
/**
 * Ciò che il gateway risponde al centro che viene a chiedere di un comando per cui il sì lo
 * raccoglie il gateway: l'esito, e ciò che il proprietario ha deciso da quando lo ha deciso.
 */
export type EsitoAttesa = EsitoUso & { decisione?: DecisioneApprovazione };

export interface StatoVault {
  /** Se il centro sa dov'è il gateway, e se gli risponde. */
  gateway: "non-configurato" | "irraggiungibile" | "attivo";
  condizione?: CondizioneVault;
  credenziali: CredenzialeInVista[];
  /** La versione del gateway, se la dice, e se sa cambiarla da solo. */
  versione?: string;
  siAggiorna?: true;
  aggiornamento?: AggiornamentoDelGateway;
  /** L'indirizzo della pagina del vault, servita dal gateway: lì il proprietario sblocca e inserisce. */
  pagina?: string;
}

/** Ciò che mostra la pagina Vault di Shinka: lo stato e le ultime righe del registro. */
export type DettaglioVault = StatoVault & {
  registro: VoceRegistro[];
  /** Il bot Telegram, che il gateway tiene accanto al vault. Manca se il gateway non è configurato. */
  telegram?: TelegramDalCentro;
};

/** Il vault in breve, per la barra laterale. */
export interface VaultInBreve {
  gateway: StatoVault["gateway"];
  condizione?: CondizioneVault;
  quante: number;
}

/**
 * Un host come lo intende il vault: nome o indirizzo in minuscolo, e la porta.
 * Restituisce nulla se non è scritto in un modo che si capisce.
 */
export function leggiHost(scritto: string): { nome: string; porta: number } | undefined {
  const pulito = scritto.trim().toLowerCase();
  // Un indirizzo IPv6 porta la porta fuori dalle parentesi quadre: [::1]:22.
  const trovato = /^\[([0-9a-f:.]+)\](?::(\d{1,5}))?$/.exec(pulito) ?? /^([a-z0-9][a-z0-9._-]*)(?::(\d{1,5}))?$/.exec(pulito);
  if (trovato?.[1] === undefined) return undefined;
  const porta = trovato[2] === undefined ? PORTA_SSH : Number(trovato[2]);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) return undefined;
  return { nome: trovato[1], porta };
}

/**
 * Un sito come lo intende il vault: la sua origine, cioè protocollo, nome e porta. Scritto senza
 * protocollo vale come https. Restituisce nulla se non è scritto in un modo che si capisce.
 */
export function leggiSito(scritto: string): string | undefined {
  const pulito = scritto.trim();
  if (pulito === "" || /\s/.test(pulito)) return undefined;
  let indirizzo: URL;
  try {
    indirizzo = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(pulito) ? pulito : `https://${pulito}`);
  } catch {
    return undefined;
  }
  if (indirizzo.protocol !== "https:" && indirizzo.protocol !== "http:") return undefined;
  if (indirizzo.username !== "" || indirizzo.password !== "" || indirizzo.hostname === "") return undefined;
  return indirizzo.origin;
}

/** L'host scritto sempre allo stesso modo, così due scritture dello stesso host coincidono. */
export function hostInChiaro(host: { nome: string; porta: number }): string {
  return host.nome.includes(":") ? `[${host.nome}]:${host.porta}` : `${host.nome}:${host.porta}`;
}
