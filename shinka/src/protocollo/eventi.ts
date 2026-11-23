/**
 * Eventi di una conversazione, così come viaggiano dal nodo al centro e dal centro al browser.
 * Sono dati semplici, serializzabili in JSON: nessuna funzione, nessun riferimento all'SDK.
 */

import type { Allegato, Immagine } from "./allegati.ts";
import type { EstensioniDegliAmbienti, SkillDiPartenza } from "./avvio-progetto.ts";
import type { ContenutoPlugin, DefinizioneEstensione } from "./estensioni.ts";
import type { ImpostazioniConversazione, ModelloDisponibile, StatoConversazione } from "./impostazioni.ts";
import type { Attivita } from "./attivita.ts";
import type { DecisioneModifiche, EsitoAnnullamento, FileModificato, VersioniDiUnFile } from "./modifiche.ts";

export type DecisionePermesso = "approvato" | "negato";

/** Da dove arriva un messaggio del proprietario, quando non lo ha scritto nell'interfaccia. */
/** "programmato": non lo ha scritto adesso il proprietario, è la richiesta di un suo lavoro programmato. */
export type OrigineMessaggio = "telegram" | "programmato";

/** Una delle risposte che Claude propone a una sua domanda. */
export interface OpzioneDiDomanda {
  etichetta: string;
  descrizione?: string;
}

/** Una domanda che Claude pone al proprietario prima di andare avanti, con le risposte che propone. */
export interface Domanda {
  domanda: string;
  /** Un'etichetta breve, di poche parole. */
  intestazione: string;
  opzioni: OpzioneDiDomanda[];
  /** Se vero il proprietario può scegliere più risposte. */
  piuScelte: boolean;
}

/**
 * Che cosa il proprietario risponde alle domande di Claude: una risposta per domanda, nello stesso
 * ordine (le scelte multiple unite da ", ", oppure un testo suo), oppure niente risposte.
 */
export type RispostaAlleDomande = { tipo: "risposte"; risposte: string[] } | { tipo: "saltate" };

/** Quante domande l'harness pone al massimo in una volta, e quanto può essere lunga una risposta scritta. */
export const MASSIMO_DOMANDE = 4;
export const MASSIMO_RISPOSTA = 4000;

/** Legge una risposta alle domande arrivata da fuori; undefined se non è fatta come deve. */
export function leggiRispostaAlleDomande(dato: unknown): RispostaAlleDomande | undefined {
  if (typeof dato !== "object" || dato === null) return undefined;
  const { tipo, risposte } = dato as Record<string, unknown>;
  if (tipo === "saltate") return { tipo };
  if (tipo !== "risposte" || !Array.isArray(risposte)) return undefined;
  if (risposte.length === 0 || risposte.length > MASSIMO_DOMANDE) return undefined;
  if (!risposte.every((voce) => typeof voce === "string" && voce.trim() !== "" && voce.length <= MASSIMO_RISPOSTA)) return undefined;
  return { tipo, risposte: risposte as string[] };
}

/** Che cosa cambierebbe nei file riprendendo da un messaggio, oppure perché non si può. */
export type AnteprimaRiavvolgimento = { file: string[]; aggiunte: number; tolte: number } | { motivo: string };

/** Legge un'anteprima del riavvolgimento arrivata da un nodo; undefined se non è fatta come deve. */
export function leggiAnteprimaRiavvolgimento(valore: unknown): AnteprimaRiavvolgimento | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { file, aggiunte, tolte, motivo } = valore as Record<string, unknown>;
  if (typeof motivo === "string") return { motivo: motivo.slice(0, 2000) };
  if (!Array.isArray(file) || !file.every((voce) => typeof voce === "string") || typeof aggiunte !== "number" || typeof tolte !== "number") return undefined;
  return { file: (file as string[]).slice(0, 500), aggiunte, tolte };
}

/** I token di un turno: letti (anche dalla cache) e scritti. */
export interface TokenDelTurno {
  ingresso: number;
  uscita: number;
}

/** L'uscita di un'attività, nella sua parte finale. */
export interface UscitaAttivita {
  testo: string;
  /** Vero se l'inizio è stato tagliato. */
  troncata: boolean;
}

/** La risposta a una domanda a parte, oppure perché non è arrivata. */
export type RispostaAParte = { testo: string } | { motivo: string };

/** Quanto può essere lunga una domanda a parte. */
export const DOMANDA_A_PARTE_MASSIMA = 4000;

/**
 * Una conversazione nuova nata da un punto di un'altra: la sessione dell'harness da cui riprende,
 * oppure nessuna se il punto è il primo messaggio. O perché non si può.
 */
export type EsitoBiforcazione = { riuscita: true; idSessione?: string } | { riuscita: false; motivo: string };

/** Com'è finito un gruppo di domande: con le risposte, con un messaggio in chat, senza risposta, o perché il turno è finito prima. */
export type EsitoDomande = "risposte" | "in-chat" | "saltate" | "annullate";

/** Com'è finita la richiesta di approvare un comando su un host per gli stack. */
export type EsitoApprovazione = "approvata" | "negata" | "scaduta";

export type EventoConversazione =
  /** Il proprietario ha scritto un messaggio. */
  | {
      tipo: "messaggio-proprietario";
      id: string;
      testo: string;
      /** Le immagini allegate, che Claude vede direttamente. */
      immagini?: Immagine[];
      /** I nomi degli altri file allegati, salvati nella cartella della conversazione. */
      file?: string[];
      /** Presente se il messaggio non è stato scritto nell'interfaccia: dice da dove arriva. */
      origine?: OrigineMessaggio;
      /**
       * Vero se l'harness conosce il messaggio con questo stesso identificativo: allora lo si può
       * modificare, e la conversazione può ripartire da lì. I messaggi di prima non lo sono.
       */
      modificabile?: true;
    }
  /** Claude ha cominciato a rispondere. */
  | { tipo: "turno-iniziato" }
  /** Comincia un blocco di testo di Claude. */
  | { tipo: "testo-iniziato"; idTesto: string }
  /** Un frammento di quel blocco, in tempo reale. Non viene archiviato. */
  | { tipo: "testo-frammento"; idTesto: string; frammento: string }
  /** Il blocco è completo: `testo` lo contiene per intero. */
  | { tipo: "testo-concluso"; idTesto: string; testo: string }
  /**
   * La conversazione riparte da prima di questo messaggio del proprietario: quello che viene dopo,
   * lui compreso, non c'è più per Claude, e l'interfaccia lo toglie. L'archivio lo conserva.
   */
  | { tipo: "riavvolto"; idMessaggio: string; fileRiportati?: string[] }
  /** Le attività della conversazione, in corso e appena finite: comandi in background e agenti. Vale l'ultimo. */
  | { tipo: "attivita"; attivita: Attivita[] }
  /**
   * I file cambiati in un turno, da Claude con i suoi strumenti di modifica o dai comandi che ha
   * eseguito: arriva a fine turno. `altri` conta quelli cambiati senza che se ne tenga la versione.
   */
  | { tipo: "modifiche"; idTurno: string; file: FileModificato[]; altri?: number }
  /** Il proprietario ha accettato alcune modifiche di un turno, o ha riportato quei file a com'erano. */
  | { tipo: "modifiche-decise"; idTurno: string; percorsi: string[]; esito: DecisioneModifiche }
  /** Il ragionamento di Claude prima di rispondere o di agire, quando l'harness lo riferisce. */
  | { tipo: "ragionamento"; idRagionamento: string; testo: string }
  /** Claude ha deciso di usare uno strumento. */
  /** `accorciato` c'è nella storia mandata all'interfaccia, quando la richiesta è solo un riassunto. */
  | { tipo: "azione-iniziata"; idAzione: string; strumento: string; ingresso: unknown; accorciato?: true }
  /** Lo strumento ha finito, bene o male. `accorciato` come sopra, per l'esito. */
  | { tipo: "azione-conclusa"; idAzione: string; esito: string; errore: boolean; immagini?: Immagine[]; accorciato?: true }
  /** Serve il consenso del proprietario prima di eseguire un'azione. */
  | {
      tipo: "permesso-richiesto";
      idPermesso: string;
      idAzione: string;
      strumento: string;
      ingresso: unknown;
      motivo?: string;
    }
  | { tipo: "permesso-deciso"; idPermesso: string; decisione: DecisionePermesso }
  /** Claude chiede al proprietario di rispondere ad alcune domande prima di andare avanti. */
  | { tipo: "domande-poste"; idDomande: string; domande: Domanda[] }
  /** Le domande non aspettano più: `risposte`, una per domanda, c'è se il proprietario ha risposto dalla scheda. */
  | { tipo: "domande-chiuse"; idDomande: string; esito: EsitoDomande; risposte?: string[] }
  /**
   * Un comando su un host per gli stack di prova tocca i servizi del proprietario: il gateway lo
   * tiene da parte, e lo esegue com'è scritto qui solo se il proprietario lo approva in tempo.
   */
  | {
      tipo: "approvazione-richiesta";
      idApprovazione: string;
      host: string;
      credenziale: string;
      comando: string;
      /** Fino a quando si può approvare. */
      scadeIl: string;
      /**
       * Vero se l'host è il server su cui gira Shinka: il sì lo raccoglie il gateway (su Telegram,
       * con un messaggio suo, o nella pagina del vault). Da qui il proprietario può solo negare.
       */
      alGateway?: true;
      /**
       * "credenziale" se non è un comando ma una credenziale in chiaro che Claude propone di salvare:
       * `credenziale` è il suo nome, `host` dove vale, `comando` che cosa contiene, senza il valore.
       * "programmato" se è un lavoro programmato che Claude propone: `credenziale` è il titolo,
       * `host` quando parte e dove gira, `comando` la richiesta.
       */
      genere?: "credenziale" | "programmato";
    }
  | { tipo: "approvazione-decisa"; idApprovazione: string; esito: EsitoApprovazione }
  /** Claude ha finito di rispondere. `interrotto` è vero se lo ha fermato il proprietario. */
  | {
      tipo: "turno-concluso";
      riuscito: boolean;
      durataMs: number;
      errore?: string;
      interrotto?: boolean;
      /** I token del turno, come li conta l'harness: per la pagina Uso. Mancano nei turni di prima. */
      token?: TokenDelTurno;
    }
  /** Qualcosa è andato storto fuori dal normale corso del turno. */
  | { tipo: "errore"; messaggio: string }
  /** Un'informazione di Shinka nella conversazione, che non è né di Claude né del proprietario. */
  | { tipo: "nota"; testo: string }
  /** La Home propone di aprire un progetto: nulla nasce finché il proprietario non conferma. */
  | {
      tipo: "proposta-progetto";
      idProposta: string;
      nome: string;
      idAmbiente: string;
      brief: string;
      /** I file che l'argomento ha in ciascun ambiente: il progetto può nascere con quelli del suo. */
      file?: FileDaPortare[];
      /** Una cartella che esiste già nell'ambiente: il progetto nasce lì, senza toccarla. */
      cartellaEsistente?: string;
      /** Ciò che il proprietario deve sapere di quella cartella, per esempio che non è un repository Git. */
      avvisoCartella?: string;
      /** Le impostazioni con cui il progetto nascerebbe se il proprietario non cambia nulla. */
      impostazioni?: ImpostazioniConversazione;
      /** I modelli tra cui scegliere, come li ha riferiti l'harness. */
      modelli?: ModelloDisponibile[];
      /** Per ambiente, le estensioni che il progetto può avere: la scheda le fa scegliere. */
      estensioni?: EstensioniDegliAmbienti;
    }
  /** Il proprietario ha confermato o annullato una proposta. */
  | {
      tipo: "proposta-decisa";
      idProposta: string;
      esito: "confermata" | "annullata";
      /** Presenti quando la proposta è stata confermata. */
      idProgetto?: string;
      nome?: string;
      /** Quanti file dell'argomento il progetto ha portato con sé, se ne ha portati. */
      filePortati?: number;
      /** Presente se il progetto ha adottato una cartella esistente. */
      cartellaAdottata?: { percorso: string; git: boolean };
      /** Le estensioni di Shinka scelte per il progetto, e la skill con cui è cominciato. */
      estensioni?: string[];
      skillDiPartenza?: SkillDiPartenza;
    }
  /**
   * La Home propone di sviluppare un pezzo nuovo di Shinka: il lavoro parte nel progetto Shinka
   * solo se il proprietario conferma.
   */
  | {
      tipo: "sviluppo-proposto";
      idProposta: string;
      titolo: string;
      richiesta: string;
      /** Le impostazioni con cui il progetto Shinka lavorerebbe se il proprietario non cambia nulla. */
      impostazioni?: ImpostazioniConversazione;
      /** I modelli tra cui scegliere, come li ha riferiti l'harness. */
      modelli?: ModelloDisponibile[];
    }
  /** Il proprietario ha confermato o annullato una proposta di sviluppo. */
  | {
      tipo: "sviluppo-deciso";
      idProposta: string;
      esito: "confermata" | "annullata";
      idProgetto?: string;
      /** Con quali impostazioni lavora il progetto Shinka su questa richiesta. */
      impostazioni?: ImpostazioniConversazione;
      /** Vero se valgono solo per questo lavoro, e poi tornano quelle di sempre. */
      soloPerQuestoLavoro?: boolean;
    }
  /**
   * Il progetto Shinka chiede di mettere in funzione una versione che ha superato le prove:
   * viene installata solo se il proprietario lo approva in tempo, ed è quella indicata qui.
   */
  | {
      tipo: "installazione-richiesta";
      idInstallazione: string;
      /** La versione, come la conosce il repository di Shinka, in breve. */
      versione: string;
      /** Che cosa cambia, nelle parole di chi l'ha sviluppata. */
      riassunto: string;
      /** Le modifiche registrate nel repository dalla versione in funzione a questa. */
      modifiche: string[];
      /** I primi file cambiati, e quanti sono in tutto. */
      file: string[];
      quantiFile: number;
      /** Ciò che il proprietario deve sapere prima di approvare: per esempio che il gateway non si installa da qui. */
      avvisi: string[];
      /** C'è solo nelle richieste di prima del 16 novembre 2026, che scadevano: oggi una richiesta aspetta finché il proprietario non decide. */
      scadeIl?: string;
    }
  | { tipo: "installazione-decisa"; idInstallazione: string; esito: EsitoApprovazione }
  /**
   * La Home mostra al proprietario un elaborato dell'argomento: un file della sua cartella in un
   * ambiente, con un percorso relativo a quella cartella. Il file resta dov'è, e anche nel pannello.
   */
  | {
      tipo: "elaborato-mostrato";
      idArgomento: string;
      idAmbiente: string;
      nomeAmbiente: string;
      percorso: string;
      titolo?: string;
      /** Il comando che rifà l'elaborato con i dati del momento, nella cartella dell'argomento: parte quando il proprietario preme "Aggiorna". */
      aggiorna?: string;
    }
  /** Com'è finita un'installazione approvata: la versione è in funzione, oppure è tornata quella di prima. */
  | { tipo: "installazione-conclusa"; versione: string; esito: "installata" | "tornata-indietro"; motivo?: string }
  /**
   * La Home propone di accendere un'estensione in un ambiente: nulla viene installato né avviato
   * finché il proprietario non conferma, e ciò che parte è quello scritto qui.
   */
  | {
      tipo: "estensione-proposta";
      idProposta: string;
      nome: string;
      descrizione: string;
      definizione: DefinizioneEstensione;
      /** I nomi delle chiavi che vuole dal vault. */
      chiavi: string[];
      idAmbiente: string;
      nomeAmbiente: string;
      /** Presente per un plugin: che cosa c'è dentro. */
      contenuto?: ContenutoPlugin;
      /** Ciò che il proprietario deve sapere prima di confermare. */
      avvisi: string[];
      /** Vero se l'estensione è già nell'elenco di Shinka, accesa altrove: qui la si accende in un altro ambiente. */
      giaInElenco?: true;
    }
  /**
   * Com'è finita la proposta di un'estensione. Confermata, l'ambiente la avvia una volta:
   * resta accesa solo se parte.
   */
  | {
      tipo: "estensione-decisa";
      idProposta: string;
      esito: "accesa" | "non-partita" | "annullata";
      /** Gli strumenti che ha offerto, se è partita. */
      strumenti?: string[];
      /** Perché non è partita. */
      motivo?: string;
    }
  /** Il progetto ha riscritto il proprio stato: a che punto è, cosa è deciso, cosa aspetta. */
  | { tipo: "stato-progetto"; testo: string }
  /** Nel dubbio la Home chiede al proprietario se fare il lavoro lì o aprire un progetto. */
  | { tipo: "scelta-richiesta"; idScelta: string; lavoro: string }
  /**
   * Comincia o riprende un argomento della Home. `archiviato` è l'argomento che era aperto
   * fino a quel momento, se aveva qualcosa da conservare. `ramo` dice che il nuovo è nato da un
   * messaggio di quello: ne ha la storia fino a lì, e da lì prende un'altra strada.
   */
  | { tipo: "passaggio-argomento"; riaperto: boolean; archiviato?: { id: string; titolo: string }; ramo?: true }
  /**
   * L'argomento è stato archiviato. `proseguito` è vero se l'ultimo messaggio del proprietario
   * ha aperto l'argomento successivo, dove ha avuto risposta.
   */
  | { tipo: "argomento-archiviato"; titolo: string; proseguito: boolean }
  /** La Home chiede all'interfaccia di spostarsi su un progetto. Non viene archiviato. */
  | { tipo: "apri-progetto"; idProgetto: string }
  /** Ciò che l'harness riferisce della conversazione: modello, contesto, limiti. Vale l'ultimo. */
  | { tipo: "stato"; stato: StatoConversazione }
  /** Le scelte del proprietario su questa conversazione. Vale l'ultimo. */
  | { tipo: "impostazioni"; impostazioni: ImpostazioniConversazione };

/** I file che un argomento della Home ha in un ambiente, per come li mostra una proposta. */
export interface FileDaPortare {
  idAmbiente: string;
  /** I primi percorsi, a partire dalla cartella dell'argomento. */
  percorsi: string[];
  quanti: number;
}

export type TipoEvento = EventoConversazione["tipo"];

/** Eventi che valgono solo nel momento in cui accadono: si distribuiscono ma non si archiviano. */
export function passeggero(evento: EventoConversazione): boolean {
  return evento.tipo === "testo-frammento" || evento.tipo === "apri-progetto" || daRicordare(evento);
}

/**
 * Eventi di cui conta solo l'ultimo: non entrano nella storia, ma chi si collega dopo
 * deve comunque riceverli, per sapere come stanno le cose adesso.
 */
export function daRicordare(evento: EventoConversazione): boolean {
  return evento.tipo === "stato" || evento.tipo === "impostazioni" || evento.tipo === "attivita";
}

/** Un evento con il suo numero d'ordine nell'archivio della conversazione. */
export interface EventoArchiviato {
  /** Progressivo a partire da 1. Gli eventi passeggeri, non archiviati, portano 0. */
  n: number;
  quando: string;
  evento: EventoConversazione;
}

/**
 * Fin dove arriva l'archivio di una conversazione, e in quale versione (ADR 0046). La versione
 * resta la stessa finché all'archivio si aggiungono eventi in fondo; cambia quando eventi già
 * dati potrebbero non valere più: chi ne ha una copia con un'altra versione la butta e la riscarica.
 */
export interface IndiceArchivio {
  /** Il numero dell'ultimo evento archiviato; 0 se non ce n'è nessuno. */
  ultimo: number;
  versione: string;
}

/** Un pezzo della storia di una conversazione, da un punto in poi: per chi ne tiene una copia. */
export interface PezzoDiStoria extends IndiceArchivio {
  /** Gli eventi archiviati dopo il punto chiesto, in ordine, come nella storia leggera. */
  eventi: EventoArchiviato[];
  /** Vero se dopo questi ce ne sono altri: si chiedono dopo l'ultimo ricevuto. */
  altri: boolean;
  /**
   * Vero se il pezzo comincia dall'inizio anche se era stato chiesto da un punto: la versione
   * chiesta non era questa, o il punto era oltre la fine. La copia che si aveva va buttata.
   */
  daCapo: boolean;
}

/** Ciò che il centro si aspetta da una conversazione, ovunque essa giri. */
/** Un messaggio della storia di una conversazione, solo testo. */
export interface ScambioDellaStoria {
  chi: "proprietario" | "motore";
  testo: string;
}

export interface PortaConversazione {
  /** Avvia il processo dell'harness senza mandare nulla, per rispondere prima al primo messaggio. */
  prepara(): void;
  invia(testo: string, allegati?: Allegato[]): void;
  /** Aggiunge un'informazione al contesto senza far rispondere Claude. */
  annota(testo: string): void;
  /** Fa lavorare Claude su un'istruzione di Shinka, che non compare come messaggio del proprietario. */
  istruisci(testo: string): void;
  /**
   * Quali file tornerebbero com'erano riprendendo da prima di quel messaggio: non cambia nulla.
   * Le conversazioni che non lo sanno fare non ce l'hanno.
   */
  anteprimaRiavvolgimento?(idMessaggio: string): Promise<AnteprimaRiavvolgimento>;
  /**
   * Fa ripartire la conversazione da prima di quel messaggio, e con `file` riporta anche i file a
   * com'erano allora. Il motivo, se non si può; poi il messaggio nuovo si manda con `invia`.
   */
  riprendiDa?(idMessaggio: string, opzioni: { file: boolean }): Promise<string | undefined>;
  /**
   * Copia la storia dell'harness fino a prima di quel messaggio in una sessione nuova, da cui potrà
   * riprendere un'altra conversazione nella stessa cartella. Questa resta com'è.
   */
  biforca?(idMessaggio: string): Promise<EsitoBiforcazione>;
  /**
   * Una domanda a parte: Claude risponde sapendo ciò che sa della conversazione, senza strumenti, e
   * né la domanda né la risposta vi restano. Si può fare anche mentre Claude lavora.
   */
  chiediAParte?(domanda: string): Promise<RispostaAParte>;
  /** Com'era un file prima di un turno e com'è alla fine, oppure perché non si sa. */
  versioniModificate?(idTurno: string, percorso: string): Promise<VersioniDiUnFile | { motivo: string }>;
  /** La parte finale dell'uscita di un'attività, oppure perché non c'è. */
  uscitaAttivita?(idAttivita: string): Promise<UscitaAttivita | { motivo: string }>;
  /** Riporta a com'erano prima del turno i file indicati, o tutti quelli del turno. */
  annullaModifiche?(idTurno: string, percorsi?: readonly string[]): Promise<EsitoAnnullamento | { motivo: string }>;
  /**
   * I messaggi del proprietario e le risposte scritte, in ordine, come li ricorda il motore: per
   * passare la conversazione a un altro motore. Chi non lo sa fare non ce l'ha.
   */
  storia?(): Promise<ScambioDellaStoria[]>;
  /** Restituisce false se quel permesso non è più in attesa. */
  decidiPermesso(idPermesso: string, decisione: DecisionePermesso): boolean;
  /**
   * Risponde alle domande che Claude ha posto. Restituisce false se non aspettano più.
   * Un messaggio mandato con `invia` mentre aspettano vale anch'esso come risposta.
   */
  rispondiDomande?(idDomande: string, risposta: RispostaAlleDomande): boolean;
  /** Cambia modello, impegno o modo dei permessi. Vale dal messaggio successivo. */
  imposta(impostazioni: ImpostazioniConversazione): void;
  interrompi(): Promise<void>;
  chiudi(): void;
  /** Le skill di Shinka sono cambiate: chi ha un processo dell'harness aperto gliele fa rileggere. */
  ricaricaSkill?(): void;
  /** Le estensioni accese nell'ambiente sono cambiate: il processo dell'harness riparte con quelle nuove. */
  ricaricaEstensioni?(): void;
}

/**
 * Il nome dell'evento che, nel flusso di una chat, chiude la storia rimandata all'apertura e dopo
 * ogni "azzera": l'interfaccia la tiene da parte e la mostra tutta insieme, già in fondo.
 */
export const FINE_STORIA = "storia";
