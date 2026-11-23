/**
 * L'app si aggiorna dal centro (ADR 0006). Il centro serve `latest.yml`, l'installer e il suo
 * .blockmap a chi ha il gettone del dispositivo (ADR 0049 di Shinka); `electron-updater`, con il
 * fornitore generico, li legge da lì, scarica in background e controlla la SHA-512. La versione
 * nuova si installa quando il proprietario sceglie «Riavvia per aggiornare», o quando esce dall'app:
 * l'app non si riavvia mai da sola, chiuderebbe i terminali aperti.
 *
 * Il centro dice in `/api/stato` quale protocollo parla. Se è più nuovo di quello per cui questa
 * versione è stata scritta, l'app passa in sola lettura, lo dice, e cerca subito un aggiornamento.
 *
 * Qui non si importa Electron: chi aggiorna davvero lo passa l'avvio, così le prove ne usano uno finto.
 */

/** Il protocollo dei clienti per cui questa versione è scritta (`PROTOCOLLO_DEI_CLIENTI` di Shinka). */
export const PROTOCOLLO = 1;

/** Ogni quanto si guarda se c'è una versione nuova. */
export const CONTROLLO_OGNI_MS = 4 * 60 * 60 * 1000;

/** Quanto si aspetta dopo l'avvio prima del primo controllo: l'app ha altro da fare, appena aperta. */
export const PRIMO_CONTROLLO_DOPO_MS = 20_000;

/** Ciò che serve di `electron-updater`. */
export interface Aggiornatore {
  setFeedURL(opzioni: { provider: "generic"; url: string }): void;
  requestHeaders: Record<string, string> | null;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(evento: string, ascolta: (...argomenti: never[]) => void): unknown;
}

/** A che punto è l'aggiornamento, per la pagina e per il menu dell'icona. */
export type StatoAggiornamento =
  | { fase: "nessuno" }
  | { fase: "scarica"; versione: string; percento?: number }
  | { fase: "pronta"; versione: string };

export interface OpzioniAggiornamenti {
  aggiornatore: Aggiornatore;
  /** Vero se l'app è installata: in prova non si aggiorna. */
  attivo: boolean;
  /** Che cosa dice il centro di sé, senza gettone: `/api/stato`. */
  statoDelCentro(centro: string): Promise<{ protocollo?: unknown }>;
  /** Lo stato è cambiato: va detto alla pagina. */
  alCambio(): void;
  /** Prima di installare: l'app deve sapere che sta uscendo, e la finestra si deve poter chiudere. */
  primaDiInstallare?(): void;
  /** Per le prove. */
  ogniMs?: number;
  primoDopoMs?: number;
}

/** Vero se il centro parla un protocollo che questa versione non conosce. */
export function protocolloTroppoNuovo(dichiarato: unknown): boolean {
  return typeof dichiarato === "number" && Number.isInteger(dichiarato) && dichiarato > PROTOCOLLO;
}

/** Il feed degli aggiornamenti di un centro. */
export function indirizzoDelFeed(centro: string): string {
  return `${centro.replace(/\/+$/, "")}/api/desktop/aggiornamenti`;
}

export class Aggiornamenti {
  readonly #o: OpzioniAggiornamenti;
  #centro: string | undefined;
  #sveglia: ReturnType<typeof setTimeout> | undefined;
  #stato: StatoAggiornamento = { fase: "nessuno" };
  #protocolloDelCentro: number | undefined;
  #inCorso: Promise<void> | undefined;

  constructor(opzioni: OpzioniAggiornamenti) {
    this.#o = opzioni;
    const aggiornatore = opzioni.aggiornatore;
    aggiornatore.autoDownload = true;
    aggiornatore.autoInstallOnAppQuit = true;
    aggiornatore.on("update-available", ((info: { version: string }) => this.#cambia({ fase: "scarica", versione: info.version })) as never);
    aggiornatore.on("download-progress", ((avanzamento: { percent: number }) => {
      if (this.#stato.fase !== "scarica") return;
      const percento = Math.floor(avanzamento.percent);
      if (percento !== this.#stato.percento) this.#cambia({ ...this.#stato, percento });
    }) as never);
    aggiornatore.on("update-downloaded", ((info: { version: string }) => this.#cambia({ fase: "pronta", versione: info.version })) as never);
    // Un errore (centro irraggiungibile, nessuna versione pubblicata, impronta sbagliata) non si mostra:
    // si riprova al prossimo controllo. Una versione già pronta resta pronta.
    aggiornatore.on("error", (() => {
      if (this.#stato.fase === "scarica") this.#cambia({ fase: "nessuno" });
    }) as never);
  }

  get stato(): StatoAggiornamento {
    return this.#stato;
  }

  /** Vero se il centro parla un protocollo più nuovo: l'app non scrive finché non si aggiorna. */
  get soloLettura(): boolean {
    return this.#protocolloDelCentro !== undefined && this.#protocolloDelCentro > PROTOCOLLO;
  }

  get protocolloDelCentro(): number | undefined {
    return this.#protocolloDelCentro;
  }

  /** Questo PC è collegato a un centro: da lì vengono gli aggiornamenti, con il gettone. */
  collega(centro: string, gettone: string, programma: string): void {
    this.scollega();
    this.#centro = centro;
    this.#o.aggiornatore.setFeedURL({ provider: "generic", url: indirizzoDelFeed(centro) });
    this.#o.aggiornatore.requestHeaders = { Authorization: `Bearer ${gettone}`, "User-Agent": programma };
    this.#programma(this.#o.primoDopoMs ?? PRIMO_CONTROLLO_DOPO_MS);
  }

  /** Il PC non è più collegato: niente controlli. Una versione già scaricata si installa comunque all'uscita. */
  scollega(): void {
    if (this.#sveglia !== undefined) clearTimeout(this.#sveglia);
    this.#sveglia = undefined;
    this.#centro = undefined;
    this.#o.aggiornatore.requestHeaders = null;
    if (this.#protocolloDelCentro !== undefined) {
      this.#protocolloDelCentro = undefined;
      this.#o.alCambio();
    }
  }

  /**
   * Guarda il protocollo del centro e se c'è una versione nuova. Va chiamato anche quando il centro
   * torna raggiungibile: potrebbe essere stato aggiornato nel frattempo. Non lancia mai.
   */
  controlla(): Promise<void> {
    this.#inCorso ??= this.#controlla().finally(() => {
      this.#inCorso = undefined;
    });
    return this.#inCorso;
  }

  /** Installa la versione scaricata e riapre l'app. Falso se non ce n'è una pronta. */
  riavviaPerAggiornare(): boolean {
    if (this.#stato.fase !== "pronta") return false;
    this.#o.primaDiInstallare?.();
    this.#o.aggiornatore.quitAndInstall(true, true);
    return true;
  }

  async #controlla(): Promise<void> {
    const centro = this.#centro;
    if (centro === undefined) return;
    try {
      const { protocollo } = await this.#o.statoDelCentro(centro);
      const prima = this.soloLettura;
      this.#protocolloDelCentro = typeof protocollo === "number" && Number.isInteger(protocollo) ? protocollo : undefined;
      if (this.soloLettura !== prima) this.#o.alCambio();
    } catch {
      // Il centro non risponde: il protocollo resta quello che si sapeva.
    }
    if (!this.#o.attivo || this.#stato.fase !== "nessuno" || this.#centro !== centro) return;
    try {
      await this.#o.aggiornatore.checkForUpdates();
    } catch {
      // Lo dice l'evento "error"; si riprova al prossimo controllo.
    }
  }

  #programma(traMs: number): void {
    this.#sveglia = setTimeout(() => {
      void this.controlla().finally(() => {
        if (this.#centro !== undefined) this.#programma(this.#o.ogniMs ?? CONTROLLO_OGNI_MS);
      });
    }, traMs);
    this.#sveglia.unref?.();
  }

  #cambia(stato: StatoAggiornamento): void {
    this.#stato = stato;
    this.#o.alCambio();
  }
}
