/**
 * Ciò che la pagina può chiedere all'app attraverso il ponte: poche funzioni, senza Node e senza
 * il gettone del dispositivo (ADR 0002). Questo file lo leggono tutti e tre: il processo
 * principale, il ponte e la pagina.
 */

import type { Comando } from "./scorciatoie.ts";

/** Un messaggio di un flusso di eventi: `nome` come in un `EventSource`, `dati` il suo testo. */
export interface MessaggioDelFlusso {
  nome: string;
  dati: string;
}

/** Com'è il collegamento con il centro. */
export interface Situazione {
  /** Vero se il centro risponde adesso. */
  collegato: boolean;
  /** Quante conversazioni mancano ancora alla cache. */
  mancano: number;
  /** Vero se la sincronizzazione si è fermata per un errore: riparte al prossimo collegamento. */
  ferma: boolean;
  /** Senza centro, il nome dell'ambiente di questo PC: i suoi progetti si mandano avanti dal suo nodo. */
  offline?: string;
}

export interface StatoApp {
  versione: string;
  /** Vero se questo PC è collegato a un centro: c'è un gettone, anche senza connessione. */
  dentro: boolean;
  /** Il centro a cui è collegato, o quello da proporre nella schermata di accesso. */
  centro: string;
  /** Il nome di questo dispositivo, o quello da proporre. */
  nome: string;
  situazione: Situazione | undefined;
  /** Perché si è tornati alla schermata di accesso, se c'è qualcosa da dire. */
  avviso: string | undefined;
  /** Vero se l'app parte da sola all'accesso a Windows; manca dove non si può scegliere, cioè nell'app non installata. */
  avvioConWindows: boolean | undefined;
  /** Una versione nuova dell'app, presa dal centro: mentre si scarica, e quando è pronta da installare (ADR 0006). */
  aggiornamento: AggiornamentoInVista | undefined;
  /** Vero se il centro parla un protocollo più nuovo di quello di questa versione: si legge e basta. */
  soloLettura: boolean;
}

export type AggiornamentoInVista = { fase: "scarica"; versione: string; percento?: number } | { fase: "pronta"; versione: string };

export type EsitoAccesso = { riuscito: true } | { riuscito: false; errore: string; riprovaTraSecondi?: number };

export interface ShellDisponibile {
  id: string;
  nome: string;
}

export interface TerminaleAperto {
  shell: ShellDisponibile;
  cartella: string;
  /** Vero se la cartella è quella del progetto, che vive su questo PC. */
  delProgetto: boolean;
}

export interface Ponte {
  stato(): Promise<StatoApp>;
  /** Ogni volta che lo stato cambia. Restituisce la funzione per smettere di ascoltare. */
  alCambio(ascolta: (stato: StatoApp) => void): () => void;
  /** Collega questo PC al centro con la password del proprietario: serve solo qui, e non si conserva. */
  entra(centro: string, password: string, nome: string): Promise<EsitoAccesso>;
  /** Esce da questo centro: il dispositivo si toglie e le copie locali si buttano. */
  esci(): Promise<void>;
  /**
   * Segue un flusso: `quadro`, oppure la base di una conversazione (`/api/home`, `/api/progetti/<id>`,
   * `/api/argomenti/<id>`). I messaggi arrivano a gruppi. Restituisce la funzione per smettere.
   */
  segui(che: string, ricevi: (messaggi: MessaggioDelFlusso[]) => void): () => void;
  /** Un comando scelto dal menu dell'app: la pagina lo esegue come se fosse arrivato dalla tastiera. */
  alComando(ascolta: (comando: Comando) => void): () => void;
  /** Chiude la finestra: l'app resta nell'area di notifica. */
  chiudiLaFinestra(): void;
  /** Sceglie se l'app parte da sola all'accesso a Windows, nell'area di notifica. */
  avviaConWindows(si: boolean): Promise<void>;
  /** Installa la versione nuova già scaricata e riapre l'app: i terminali di questo PC si chiudono. */
  riavviaPerAggiornare(): void;
  /** Incolla gli appunti nel punto in cui si scrive: il terminale lo usa per il tasto destro. */
  incolla(): void;
  terminali: {
    shell(): Promise<ShellDisponibile[]>;
    /** Apre una shell su questo PC, nella cartella del progetto se vive qui. */
    apri(
      richiesta: { shell?: string; idProgetto?: string; colonne: number; righe: number },
      alDato: (dati: string) => void,
      allaFine: (codice: number) => void,
    ): { id: string; aperto: Promise<TerminaleAperto> };
    scrivi(id: string, dati: string): void;
    misura(id: string, colonne: number, righe: number): void;
    chiudi(id: string): void;
  };
}

/** I nomi dei canali tra la pagina e il processo principale. */
export const CANALI = {
  stato: "shinka:stato",
  cambio: "shinka:cambio",
  entra: "shinka:entra",
  esci: "shinka:esci",
  segui: "shinka:segui",
  smetti: "shinka:smetti",
  flusso: "shinka:flusso",
  shell: "shinka:terminali-shell",
  apri: "shinka:terminale-apri",
  scrivi: "shinka:terminale-scrivi",
  misura: "shinka:terminale-misura",
  chiudi: "shinka:terminale-chiudi",
  dati: "shinka:terminale-dati",
  fine: "shinka:terminale-fine",
  comando: "shinka:comando",
  chiudiFinestra: "shinka:chiudi-finestra",
  avvioConWindows: "shinka:avvio-con-windows",
  aggiorna: "shinka:aggiorna",
  incolla: "shinka:incolla",
} as const;

/** Il nome con cui il ponte compare nella pagina. */
export const NOME_DEL_PONTE = "shinkaDesktop";
