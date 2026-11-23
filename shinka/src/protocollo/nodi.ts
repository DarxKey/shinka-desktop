/**
 * Ciò che un nodo e il centro si dicono sul loro collegamento, e ciò che l'interfaccia
 * vede degli ambienti. Sono dati semplici, serializzabili in JSON.
 */

import type { AzioneInAmbiente, EsitoAzione } from "./azioni.ts";
import type { RichiestaAllaConversazione } from "./modifiche.ts";
import type { AnteprimaRiavvolgimento, DecisionePermesso, EventoConversazione, RispostaAParte, RispostaAlleDomande } from "./eventi.ts";
import type { Allegato, Immagine } from "./allegati.ts";
import type { ImpostazioniConversazione, Motore } from "./impostazioni.ts";
import type { EsitoAccessi, RichiestaAccessi } from "./accessi.ts";
import type { RisorseDellAmbiente } from "./risorse.ts";
import type { SkillDistribuita } from "./skill.ts";
import type { ChiaviConsegnate, EsitoProva, EstensioneDistribuita, EstensioniDellAmbiente } from "./estensioni.ts";
import type { ComandoAnteprima, RiferitoAnteprima } from "./anteprima.ts";
import type { ComandoApplicazione, RiferitoApplicazione } from "./applicazioni.ts";
import type { ComandoFile, RiferitoFile } from "./file-progetto.ts";
import type { ComandoTerminale, RiferitoTerminale } from "./terminale.ts";
import type { FileDiVersione } from "./versione.ts";
import type { EsitoPreparazione, PreparazioneDelProgetto } from "./avvio-progetto.ts";

/** Indirizzo, sul centro, a cui i nodi si collegano. */
export const PERCORSO_COLLEGAMENTO = "/api/nodi/collegamento";

/**
 * Il nome con cui un nodo chiede al centro, aprendo il collegamento cifrato, il certificato dei
 * nodi (ADR 0040): non è un nome della rete, e nessun browser lo chiede.
 */
export const NOME_TLS_DEI_NODI = "nodi.shinka.invalid";

/** Ogni quanto un nodo si fa sentire. */
export const INTERVALLO_BATTITO_MS = 15_000;

/** Dopo quanto silenzio il centro considera spento un ambiente. */
export const SILENZIO_MASSIMO_MS = 45_000;

/** Entro quanto tempo dal collegamento un nodo deve presentarsi. */
export const TEMPO_PER_PRESENTARSI_MS = 5_000;

/** Ciò che un nodo riferisce al centro mentre lavora. */
export type RiferitoDalNodo =
  /** Un evento di una conversazione che gira in questo ambiente. */
  | { tipo: "evento"; idConversazione: string; evento: EventoConversazione }
  /** L'harness ha assegnato o cambiato l'identificativo da cui riprendere la conversazione. */
  | { tipo: "id-sessione"; idConversazione: string; idSessione: string }
  /**
   * `filePortati` c'è quando il progetto doveva nascere con i file di un argomento della Home;
   * `git` quando la cartella è stata adottata, e dice se è già un repository.
   */
  | { tipo: "cartella-creata"; idRichiesta: string; percorso: string; filePortati?: number; git?: boolean }
  | { tipo: "cartella-non-creata"; idRichiesta: string; motivo: string }
  /** Com'è andato un riavvolgimento: l'anteprima dei file, oppure il motivo per cui non si può. */
  | { tipo: "riavvolgimento-esito"; idRichiesta: string; anteprima?: AnteprimaRiavvolgimento; motivo?: string }
  /** Ciò che la conversazione risponde a una richiesta sulle modifiche: il centro lo legge secondo la richiesta. */
  | { tipo: "risposta-della-conversazione"; idRichiesta: string; risposta: unknown }
  /** La risposta a una domanda a parte, oppure perché non è arrivata. */
  | { tipo: "a-parte-esito"; idRichiesta: string; risposta: RispostaAParte }
  /** Il nodo ha cominciato a preparare la cartella: un nodo di prima non lo dice, e il centro non lo aspetta oltre. */
  | { tipo: "preparazione-cominciata"; idRichiesta: string }
  /** Com'è andata la preparazione della cartella di un progetto nuovo. */
  | { tipo: "progetto-preparato"; idRichiesta: string; esiti: EsitoPreparazione[] }
  /** Com'è andata un'azione chiesta dalla Home. */
  | { tipo: "azione-conclusa"; idRichiesta: string; esito: EsitoAzione }
  /** Una conversazione di questo ambiente usa uno strumento di Shinka, che si esegue al centro. */
  | {
      tipo: "strumento";
      idRichiesta: string;
      idConversazione: string;
      nome: string;
      argomenti: Record<string, unknown>;
    }
  /** Com'è andata la prova di un'estensione in questo ambiente: è partita, oppure no. */
  | { tipo: "estensione-provata"; idRichiesta: string; esito: EsitoProva }
  /** Ciò che il proprietario ha già installato in questo ambiente, fuori da Shinka. */
  | { tipo: "estensioni-guardate"; idRichiesta: string; viste?: EstensioniDellAmbiente; motivo?: string }
  /** Un'estensione di questo ambiente sta per partire e vuole le sue chiavi dal vault. */
  | { tipo: "chiavi-richieste"; idRichiesta: string; estensione: string }
  /** La versione nuova è al suo posto accanto a quella in funzione: il nodo sta per ripartire con quella. */
  | { tipo: "aggiornamento-pronto"; idRichiesta: string }
  /** La versione nuova non si è potuta preparare: il nodo resta com'è. */
  | { tipo: "aggiornamento-non-riuscito"; idRichiesta: string; motivo: string }
  /** Com'è andata una richiesta sugli accessi dei motori in questo ambiente. */
  | { tipo: "accessi-esito"; idRichiesta: string; esito: EsitoAccessi }
  /** Le risorse di questo ambiente, lette adesso: per la sua pagina. */
  | { tipo: "risorse-esito"; idRichiesta: string; risorse: RisorseDellAmbiente }
  /** Ciò che esce dal terminale di un progetto di questo ambiente. */
  | RiferitoTerminale
  /** Ciò che risponde l'applicazione di un progetto di questo ambiente, per l'anteprima. */
  | RiferitoAnteprima
  /** L'applicazione di un progetto di questo ambiente. */
  | RiferitoApplicazione
  /** Ciò che il pannello File ha chiesto dei file di un progetto di questo ambiente. */
  | RiferitoFile;

/** Dal nodo al centro. */
export type MessaggioNodo =
  | {
      tipo: "presentazione";
      idNodo: string;
      /** Noto solo al nodo; al centro ne resta l'impronta. */
      segreto: string;
      /**
       * Il segreto con cui il nodo vuole sostituire il suo, perché quello è passato in chiaro: il
       * centro lo prende solo su un collegamento cifrato, e lo conferma nell'accoglienza.
       */
      segretoProssimo?: string;
      nome: string;
      /** Che cosa offre questo ambiente, per esempio "Unity, Blender". */
      descrizione: string;
      /** Sistema operativo, per esempio "Windows 11". */
      sistema: string;
      /** Cartella in cui nascono le cartelle dei progetti nuovi. */
      radiceProgetti: string;
      /** La versione di Shinka che questo nodo sta eseguendo, se lo sa. */
      versione?: string;
      /** Vero se questo nodo è tenuto acceso dal suo guardiano, e quindi sa cambiare versione da solo. */
      siAggiorna?: boolean;
      /** L'ultimo aggiornamento, se non è partito e il nodo è tornato alla versione di prima. */
      aggiornamentoFallito?: { versione: string; motivo: string };
    }
  | { tipo: "battito" }
  | RiferitoDalNodo;

/** Ciò che il centro chiede a un nodo di fare nel suo ambiente. */
export type ComandoPerNodo =
  /**
   * Crea la cartella di un progetto nuovo. Fallisce se esiste già. Con `daArgomento` ci copia
   * i file che quell'argomento della Home ha in questo ambiente.
   */
  | { tipo: "crea-cartella"; idRichiesta: string; nomeCartella: string; brief: string; daArgomento?: string }
  /** Prepara la cartella di un progetto nuovo per le estensioni scelte, prima del suo primo messaggio. */
  | { tipo: "prepara-progetto"; idRichiesta: string; cartella: string; preparazioni: PreparazioneDelProgetto[] }
  /**
   * Prende come cartella di un progetto una cartella che esiste già, senza toccarla: il nodo
   * controlla che ci sia e dice se è un repository Git. Un nodo di prima non lo conosce e tace.
   */
  | { tipo: "adotta-cartella"; idRichiesta: string; percorso: string }
  /** Prepara una conversazione di progetto in una cartella, riprendendola se esiste già. */
  | {
      tipo: "apri-conversazione";
      idConversazione: string;
      cartella: string;
      idSessione?: string;
      impostazioni: ImpostazioniConversazione;
      /** Le estensioni scelte per il progetto, tra quelle accese nell'ambiente. Senza, tutte. */
      estensioni?: string[];
      /** Il motore predefinito dell'installazione, che è del centro: vale se le impostazioni non ne scelgono uno. */
      motorePredefinito?: Motore;
    }
  /** Una richiesta sugli accessi dei motori in questo ambiente: com'è, entrare, uscire. */
  | { tipo: "accessi"; idRichiesta: string; richiesta: RichiestaAccessi }
  /** Il proprietario sta guardando la pagina di questo ambiente: come stanno le sue risorse. */
  | { tipo: "risorse"; idRichiesta: string }
  /** Cambia le impostazioni di una conversazione già aperta. */
  | { tipo: "imposta"; idConversazione: string; impostazioni: ImpostazioniConversazione }
  | { tipo: "messaggio"; idConversazione: string; testo: string; allegati?: Allegato[] }
  /** Aggiunge un'informazione al contesto di una conversazione, senza far rispondere Claude. */
  | { tipo: "annota"; idConversazione: string; testo: string }
  /** La risposta del centro a uno strumento di Shinka usato da una conversazione di questo ambiente. */
  | { tipo: "esito-strumento"; idRichiesta: string; testo: string; errore?: true; immagine?: Immagine }
  /** Le skill di Shinka come sono adesso, tutte: l'ambiente ne tiene una copia uguale. */
  | { tipo: "skill"; skill: SkillDistribuita[] }
  /** Le estensioni accese in questo ambiente, tutte: valgono per le conversazioni che partono da adesso. */
  | { tipo: "estensioni"; estensioni: EstensioneDistribuita[] }
  /** Avvia una volta un'estensione in questo ambiente e di' se parte e con quali strumenti. */
  | { tipo: "prova-estensione"; idRichiesta: string; estensione: EstensioneDistribuita }
  /** Guarda che cosa il proprietario ha già installato in questo ambiente. */
  | { tipo: "guarda-estensioni"; idRichiesta: string }
  /** La risposta del centro a `chiavi-richieste`: i valori, oppure perché non ci sono. */
  | { tipo: "chiavi-consegnate"; idRichiesta: string; chiavi: ChiaviConsegnate }
  /**
   * Passa a questa versione di Shinka: i file sono quelli della versione in funzione al centro.
   * Lo fa solo un nodo tenuto acceso dal suo guardiano, che torna indietro se la nuova non si collega.
   */
  | { tipo: "aggiorna"; idRichiesta: string; versione: string; file: FileDiVersione[] }
  | {
      tipo: "decidi-permesso";
      idConversazione: string;
      idPermesso: string;
      decisione: DecisionePermesso;
    }
  /**
   * Riprende una conversazione da prima di un messaggio del proprietario: con `prova` dice soltanto
   * quali file tornerebbero com'erano; altrimenti riparte, e con `file` li riporta.
   */
  | { tipo: "riavvolgi"; idRichiesta: string; idConversazione: string; idMessaggio: string; prova: boolean; file: boolean }
  /** Le versioni di un file cambiato in un turno, o il ritorno indietro di alcuni file. */
  | { tipo: "alla-conversazione"; idRichiesta: string; idConversazione: string; richiesta: RichiestaAllaConversazione }
  /** Una domanda a parte su una conversazione: non vi resta. */
  | { tipo: "a-parte"; idRichiesta: string; idConversazione: string; domanda: string }
  /** Le risposte del proprietario alle domande che Claude ha posto in una conversazione. */
  | { tipo: "rispondi-domande"; idConversazione: string; idDomande: string; risposta: RispostaAlleDomande }
  | { tipo: "interrompi"; idConversazione: string }
  | { tipo: "chiudi-conversazione"; idConversazione: string }
  /** Un'azione della Home in questo ambiente, nella cartella di un suo argomento. */
  | { tipo: "azione"; idRichiesta: string; idArgomento: string; azione: AzioneInAmbiente }
  /** Il terminale di un progetto di questo ambiente. */
  | ComandoTerminale
  /** L'anteprima dell'applicazione di un progetto di questo ambiente. */
  | ComandoAnteprima
  /** L'applicazione di un progetto di questo ambiente: avviarla, fermarla, sapere com'è. */
  | ComandoApplicazione
  /** I file di un progetto di questo ambiente, per il pannello File: solo lettura. */
  | ComandoFile;

/** Dal centro al nodo. */
export type MessaggioCentro =
  /** Il nodo è registrato: il suo ambiente è attivo. */
  | { tipo: "accolto"; nome: string; /** Vero se il centro ha preso il segreto nuovo del nodo. */ segretoCambiato?: true }
  /** Il nodo non è ancora registrato: aspetta il consenso del proprietario. */
  | { tipo: "in-attesa"; codice: string }
  | { tipo: "rifiutato"; motivo: string }
  /**
   * Il centro accetta solo collegamenti cifrati, e questo non lo è: il nodo non viene ascoltato.
   * Non è un rifiuto del nodo: con il collegamento cifrato sarà accolto.
   */
  | { tipo: "solo-cifrato" }
  | ComandoPerNodo;

/** Un ambiente come lo vede l'interfaccia. */
export interface Ambiente {
  id: string;
  nome: string;
  descrizione: string;
  sistema: string;
  /** Cartella in cui nascono le cartelle dei progetti nuovi. */
  radiceProgetti: string;
  /** Vero quando il suo nodo è collegato al centro. */
  attivo: boolean;
  /** Vero per l'ambiente in cui gira il centro stesso. */
  delCentro: boolean;
  /** La versione di Shinka in funzione lì, in breve. Manca se non è scritta, o se il nodo è spento. */
  versione?: string;
  /** Vero se il nodo è collegato con una versione che non è quella del centro, o senza dire quale. */
  indietro?: boolean;
  /** Vero se il nodo sa cambiare versione da solo quando il centro glielo chiede. */
  siAggiorna?: boolean;
  /** Per un nodo collegato: vero se il suo collegamento con il centro è cifrato, falso se è in chiaro. */
  cifrato?: boolean;
  /** A che punto è l'aggiornamento chiesto a questo nodo, se ce n'è uno. */
  aggiornamento?: AggiornamentoDelNodo;
}

/** L'aggiornamento di un nodo alla versione del centro: in corso, oppure non riuscito. */
export type AggiornamentoDelNodo =
  | { stato: "in-corso"; versione: string }
  | { stato: "non-riuscito"; versione: string; motivo: string };

/** Un nodo che chiede di collegarsi e aspetta il consenso del proprietario. */
export interface RichiestaCollegamento {
  id: string;
  nome: string;
  descrizione: string;
  sistema: string;
  /** Lo stesso codice compare sul nodo: se coincidono, è davvero quella macchina. */
  codice: string;
  quando: string;
}

export interface StatoAmbienti {
  ambienti: Ambiente[];
  richieste: RichiestaCollegamento[];
}
