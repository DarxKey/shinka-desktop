/**
 * Le notifiche dell'app (ADR 0037): Shinka aggiunta alla schermata Home del telefono, o aperta in
 * un browser, riceve gli stessi avvisi che arrivano su Telegram: una richiesta che aspetta il
 * proprietario, un lavoro finito, la risposta di un lavoro programmato. Ogni dispositivo si
 * iscrive dalla pagina Impostazioni; il centro tiene le iscrizioni e la sua coppia di chiavi tra i
 * dati, e manda ogni notifica cifrata per il dispositivo che la riceverà.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { leggiScelte, scelteDiPartenza, type CanaleAvviso, type GenereAvviso, type ScelteAvvisi } from "../protocollo/avvisi.ts";
import { mandaPush, NOTIFICA_MASSIMA, nuoveChiaviVapid, servizioConosciuto, type ChiaviVapid, type EsitoPush, type IscrizionePush } from "./web-push.ts";

/** Un avviso da mostrare sul dispositivo. */
export interface AvvisoApp {
  titolo: string;
  corpo: string;
  /** Dove porta il tocco sulla notifica: la parte dell'indirizzo dopo il cancelletto, come "/progetti/…"; vuoto per la Home. */
  vai?: string;
  /** Vero se qualcosa aspetta il proprietario: arriva subito anche a telefono in risparmio. */
  urgente?: boolean;
  /** Quante cose aspettano il proprietario, per il numero sull'icona dell'app. */
  distintivo?: number;
}

/** Un dispositivo iscritto, come lo vede la pagina: l'indirizzo dell'iscrizione dice quale è «questo». */
export interface DispositivoIscritto {
  endpoint: string;
  nome: string;
  iscrittoIl: string;
  /** L'ultima volta che una notifica non è partita, e perché. */
  problema?: string;
}

export interface StatoNotifiche {
  /** La chiave pubblica con cui un browser si iscrive. */
  chiave: string;
  dispositivi: DispositivoIscritto[];
  /** Ciò che il centro dichiara di sé ai servizi di notifiche, che lo chiedono. */
  contatto: string;
  /** Vero se il contatto è ancora quello generico: il servizio di Apple non lo accetta. */
  contattoGenerico: boolean;
  /** Quali avvisi arrivano come notifiche dell'app, e quali su Telegram. */
  scelte: ScelteAvvisi;
}

interface Custodito extends IscrizionePush {
  nome: string;
  iscrittoIl: string;
  problema?: string;
}

interface Salvato {
  chiavi: ChiaviVapid;
  contatto?: string;
  scelte?: ScelteAvvisi;
  iscrizioni: Custodito[];
}

/** I servizi di notifiche vogliono un contatto nel gettone: uno generico, che non dice chi è il proprietario. */
export const CONTATTO_GENERICO = "mailto:notifiche@shinka.invalid";
const DISPOSITIVI_MASSIMI = 10;

export class NotificaRifiutata extends Error {}

export class NotificheApp {
  readonly #file: string;
  readonly #manda: typeof mandaPush;
  #dati: Salvato;

  constructor(opzioni: { file: string; manda?: typeof mandaPush }) {
    this.#file = opzioni.file;
    this.#manda = opzioni.manda ?? mandaPush;
    let letto: Partial<Salvato> = {};
    if (existsSync(this.#file)) {
      try {
        letto = JSON.parse(readFileSync(this.#file, "utf8")) as Partial<Salvato>;
      } catch {
        // Un file rovinato: si riparte con chiavi nuove, e i dispositivi si iscrivono di nuovo.
      }
    }
    const nuove = letto.chiavi === undefined;
    this.#dati = {
      chiavi: letto.chiavi ?? nuoveChiaviVapid(),
      ...(typeof letto.contatto === "string" ? { contatto: letto.contatto } : {}),
      ...(letto.scelte === undefined ? {} : { scelte: leggiScelte(letto.scelte) }),
      iscrizioni: Array.isArray(letto.iscrizioni) ? letto.iscrizioni : [],
    };
    if (nuove) this.#salva();
  }

  stato(): StatoNotifiche {
    return {
      chiave: this.#dati.chiavi.pubblica,
      contatto: this.#dati.contatto ?? CONTATTO_GENERICO,
      contattoGenerico: this.#dati.contatto === undefined,
      scelte: this.#dati.scelte ?? scelteDiPartenza(),
      dispositivi: this.#dati.iscrizioni.map(({ endpoint, nome, iscrittoIl, problema }) => ({ endpoint, nome, iscrittoIl, ...(problema === undefined ? {} : { problema }) })),
    };
  }

  /** Vero se almeno un dispositivo riceve le notifiche. */
  get attive(): boolean {
    return this.#dati.iscrizioni.length > 0;
  }

  /** Un dispositivo si iscrive, o rinnova la sua iscrizione. Lancia `NotificaRifiutata` con il motivo. */
  iscrivi(iscrizione: unknown, nome: unknown): DispositivoIscritto {
    const { endpoint, keys } = (typeof iscrizione === "object" && iscrizione !== null ? iscrizione : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof endpoint !== "string" || endpoint.length > 2000 || typeof keys?.p256dh !== "string" || typeof keys.auth !== "string") {
      throw new NotificaRifiutata("L'iscrizione non è fatta come deve.");
    }
    if (!servizioConosciuto(endpoint)) throw new NotificaRifiutata("Questo browser usa un servizio di notifiche che Shinka non conosce.");
    if (Buffer.from(keys.p256dh, "base64url").length !== 65 || Buffer.from(keys.auth, "base64url").length !== 16) {
      throw new NotificaRifiutata("Le chiavi dell'iscrizione non sono fatte come devono.");
    }
    const pulito = (typeof nome === "string" ? nome : "").replace(/\s+/g, " ").trim().slice(0, 60) || "Dispositivo";
    const resto = this.#dati.iscrizioni.filter((una) => una.endpoint !== endpoint);
    if (resto.length >= DISPOSITIVI_MASSIMI) throw new NotificaRifiutata(`Ci sono già ${DISPOSITIVI_MASSIMI} dispositivi iscritti: toglierne qualcuno.`);
    const nuova: Custodito = { endpoint, p256dh: keys.p256dh, auth: keys.auth, nome: pulito, iscrittoIl: new Date().toISOString() };
    this.#dati.iscrizioni = [...resto, nuova];
    this.#salva();
    return { endpoint, nome: pulito, iscrittoIl: nuova.iscrittoIl };
  }

  togli(endpoint: unknown): boolean {
    const prima = this.#dati.iscrizioni.length;
    this.#dati.iscrizioni = this.#dati.iscrizioni.filter((una) => una.endpoint !== endpoint);
    if (this.#dati.iscrizioni.length === prima) return false;
    this.#salva();
    return true;
  }

  /**
   * Vero se un avviso di quel genere va mandato su quel canale. Su Telegram le scelte valgono
   * solo finché almeno un dispositivo riceve le notifiche dell'app: senza, tutto torna su
   * Telegram, perché il proprietario non resti senza avvisi.
   */
  vuole(canale: CanaleAvviso, genere: GenereAvviso): boolean {
    const scelte = this.#dati.scelte ?? scelteDiPartenza();
    if (canale === "telegram") return !this.attive || scelte.telegram[genere];
    return scelte.app[genere];
  }

  /** Il proprietario sceglie che cosa arriva dove: ciò che non dice resta com'è. */
  impostaScelte(scelte: unknown): void {
    this.#dati.scelte = leggiScelte(scelte, this.#dati.scelte ?? scelteDiPartenza());
    this.#salva();
  }

  /** Cambia ciò che il centro dichiara di sé ai servizi di notifiche; vuoto torna a quello generico. */
  impostaContatto(contatto: unknown): void {
    let scritto = typeof contatto === "string" ? contatto.trim() : "";
    // Un indirizzo email scritto così com'è vale come mailto:.
    if (/^[^\s@:]+@[^\s@]+\.[^\s@]+$/.test(scritto)) scritto = `mailto:${scritto}`;
    if (scritto === "") delete this.#dati.contatto;
    else if (/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(scritto) && scritto.length <= 200) this.#dati.contatto = scritto;
    else throw new NotificaRifiutata("Il contatto è un indirizzo email, come nome@esempio.it, oppure un indirizzo https://.");
    this.#salva();
  }

  /**
   * Manda un avviso a tutti i dispositivi iscritti, o a uno solo. Un'iscrizione che il servizio dice
   * scaduta viene tolta. Restituisce com'è andata con ciascuno.
   */
  async manda(avviso: AvvisoApp, soloA?: string): Promise<{ nome: string; esito: EsitoPush }[]> {
    const messaggio = JSON.stringify(inMisura(avviso));
    const destinatari = this.#dati.iscrizioni.filter((una) => soloA === undefined || una.endpoint === soloA);
    const esiti = await Promise.all(
      destinatari.map(async (iscrizione) => ({
        iscrizione,
        esito: await this.#manda(iscrizione, messaggio, this.#dati.chiavi, this.#dati.contatto ?? CONTATTO_GENERICO, { urgente: avviso.urgente === true }),
      })),
    );
    let cambiato = false;
    for (const { iscrizione, esito } of esiti) {
      if (esito.esito === "scaduta") {
        this.#dati.iscrizioni = this.#dati.iscrizioni.filter((una) => una.endpoint !== iscrizione.endpoint);
        cambiato = true;
      } else if (esito.esito === "fallita") {
        iscrizione.problema = esito.motivo;
        cambiato = true;
      } else if (iscrizione.problema !== undefined) {
        delete iscrizione.problema;
        cambiato = true;
      }
    }
    if (cambiato) this.#salva();
    return esiti.map(({ iscrizione, esito }) => ({ nome: iscrizione.nome, esito }));
  }

  #salva(): void {
    try {
      const provvisorio = `${this.#file}.tmp`;
      // Qui c'è la chiave privata con cui il centro si presenta: la legge solo chi fa girare Shinka.
      writeFileSync(provvisorio, `${JSON.stringify(this.#dati, null, 2)}\n`, { mode: 0o600 });
      renameSync(provvisorio, this.#file);
    } catch (errore) {
      console.error(`Notifiche dell'app non salvate: ${errore instanceof Error ? errore.message : String(errore)}`);
    }
  }
}

/** Accorcia un testo perché stia nei byte dati, senza spezzare un carattere. */
function entro(testo: string, byte: number): string {
  if (Buffer.byteLength(testo) <= byte) return testo;
  let corto = testo.slice(0, byte);
  while (Buffer.byteLength(corto) > byte - 3) corto = corto.slice(0, -1);
  return `${corto.trimEnd()}…`;
}

/** L'avviso nella misura che un servizio di notifiche accetta. */
function inMisura(avviso: AvvisoApp): AvvisoApp {
  const titolo = entro(avviso.titolo.replace(/\s+/g, " ").trim(), 200);
  const corpo = entro(avviso.corpo.trim(), Math.min(600, NOTIFICA_MASSIMA - 800));
  return { ...avviso, titolo, corpo };
}
