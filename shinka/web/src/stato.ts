/**
 * Lo stato della chat nel browser, ricostruito dagli eventi della conversazione.
 * È una funzione pura: dato lo stato e un evento, restituisce lo stato nuovo.
 */

import { conICampiNuovi, type ComandoDiEstensione, type PaginaDiEstensione, type ParteCambiata, type PulsanteDiEstensione } from "../../src/protocollo/interfaccia.ts";
import type { Immagine } from "../../src/protocollo/allegati.ts";
import type { EstensioniDegliAmbienti, SkillDiPartenza } from "../../src/protocollo/avvio-progetto.ts";
import type { ContenutoPlugin, DefinizioneEstensione } from "../../src/protocollo/estensioni.ts";
import type { Domanda, EsitoApprovazione, EsitoDomande, EventoConversazione, FileDaPortare } from "../../src/protocollo/eventi.ts";
import type { ImpostazioniConversazione, ModelloDisponibile, StatoConversazione } from "../../src/protocollo/impostazioni.ts";
import type { DecisioneModifiche, FileModificato } from "../../src/protocollo/modifiche.ts";
import type { Attivita } from "../../src/protocollo/attivita.ts";

export type StatoPermesso = "in-attesa" | "approvato" | "negato";

export interface Permesso {
  id: string;
  stato: StatoPermesso;
  motivo?: string;
  /** Ciò che «Approva sempre» salverebbe, se l'harness lo propone. */
  regola?: string;
}

export type Elemento =
  | {
      tipo: "proprietario";
      chiave: string;
      testo: string;
      /** Le immagini allegate al messaggio. */
      immagini?: Immagine[];
      /** I nomi degli altri file allegati. */
      file?: string[];
      /** Vero se il proprietario lo ha scritto da Telegram, e non da questa interfaccia. */
      daTelegram?: boolean;
      /** Non lo ha scritto adesso il proprietario: è la richiesta di un suo lavoro programmato. */
      programmato?: boolean;
      /** Vero se lo si può modificare: la conversazione ripartirebbe da qui. */
      modificabile?: true;
    }
  | { tipo: "testo"; chiave: string; testo: string; concluso: boolean }
  | {
      tipo: "azione";
      chiave: string;
      strumento: string;
      ingresso: unknown;
      conclusa: boolean;
      esito?: string;
      errore?: boolean;
      /** Le immagini prodotte dall'azione, per esempio uno screenshot. */
      immagini?: Immagine[];
      permesso?: Permesso;
      /** Vero se richiesta o esito sono solo un riassunto: il dettaglio intero si chiede al centro quando serve. */
      accorciata?: true;
    }
  /** La Home propone un progetto; `esito` manca finché il proprietario non ha deciso. */
  | {
      tipo: "proposta";
      chiave: string;
      nome: string;
      idAmbiente: string;
      brief: string;
      /** I file che l'argomento ha già prodotto, per ambiente: il progetto può nascere con quelli del suo. */
      file?: FileDaPortare[];
      /** La cartella esistente proposta dalla Home, che il proprietario può cambiare. */
      cartellaEsistente?: string;
      /** Le impostazioni con cui il progetto nascerebbe, e i modelli tra cui scegliere. */
      impostazioni?: ImpostazioniConversazione;
      modelli?: ModelloDisponibile[];
      avvisoCartella?: string;
      esito?: "confermata" | "annullata";
      /** Presenti quando la proposta è stata confermata: il progetto nato e il suo nome definitivo. */
      idProgetto?: string;
      nomeProgetto?: string;
      /** Quanti file dell'argomento sono stati copiati nel progetto. */
      filePortati?: number;
      /** La cartella esistente in cui il progetto è nato. */
      cartellaAdottata?: { percorso: string; git: boolean };
      /** Per ambiente, le estensioni che il progetto può avere: la scheda le fa scegliere. */
      estensioni?: EstensioniDegliAmbienti;
      /** Presenti quando la proposta è stata confermata: le estensioni scelte e la skill con cui è cominciato. */
      estensioniScelte?: string[];
      skillDiPartenza?: SkillDiPartenza;
    }
  /**
   * Claude chiede di eseguire un comando su un host che non gestisce da solo: parte solo se il
   * proprietario lo approva. `esito` manca finché non è deciso.
   */
  | {
      tipo: "approvazione";
      chiave: string;
      host: string;
      credenziale: string;
      comando: string;
      scadeIl: string;
      /** Vero se il sì lo raccoglie il gateway: da qui si può solo negare. */
      alGateway?: true;
      /** "credenziale" se è una credenziale in chiaro da salvare, non un comando. */
      genere?: "credenziale" | "programmato";
      esito?: EsitoApprovazione;
    }
  /** La Home propone di sviluppare un pezzo nuovo di Shinka; `esito` manca finché il proprietario non ha deciso. */
  | {
      tipo: "sviluppo";
      chiave: string;
      titolo: string;
      richiesta: string;
      /** Le impostazioni di sempre del progetto Shinka, da cui la scheda parte. */
      impostazioni?: ImpostazioniConversazione;
      modelli?: ModelloDisponibile[];
      esito?: "confermata" | "annullata";
      /** Presente quando la proposta è stata confermata: il progetto Shinka, dove il lavoro prosegue. */
      idProgetto?: string;
      /** Con quali impostazioni è partito il lavoro, e se valgono solo per lui. */
      usate?: ImpostazioniConversazione;
      soloPerQuestoLavoro?: boolean;
    }
  /**
   * Una versione di Shinka ha passato le prove e aspetta il proprietario: entra in funzione solo
   * se la approva. `esito` manca finché non è deciso.
   */
  | {
      tipo: "installazione";
      chiave: string;
      versione: string;
      riassunto: string;
      modifiche: string[];
      file: string[];
      quantiFile: number;
      avvisi: string[];
      esito?: EsitoApprovazione;
    }
  /**
   * La Home propone un'estensione: la scheda dice che cosa è, da dove viene, che cosa viene
   * eseguito e in quale ambiente. `esito` manca finché il proprietario non ha deciso e l'ambiente
   * non l'ha provata.
   */
  | {
      tipo: "estensione";
      chiave: string;
      nome: string;
      descrizione: string;
      definizione: DefinizioneEstensione;
      chiavi: string[];
      idAmbiente: string;
      nomeAmbiente: string;
      contenuto?: ContenutoPlugin;
      avvisi: string[];
      /** Vero se è già nell'elenco, e si tratta di accenderla in un altro ambiente. */
      giaInElenco?: true;
      esito?: "accesa" | "non-partita" | "annullata";
      strumenti?: string[];
      motivo?: string;
    }
  /** La proposta di un'estensione dell'interfaccia (ADR 0054), con le pagine da guardare in anteprima. */
  | {
      tipo: "interfaccia";
      chiave: string;
      nome: string;
      descrizione: string;
      sostituisce?: true;
      righeTema?: number;
      pagine: PaginaDiEstensione[];
      pulsanti: PulsanteDiEstensione[];
      /** Le API che le pagine useranno, i comandi e le parti nascoste o sostituite (ADR 0057). */
      api: string[];
      comandi: ComandoDiEstensione[];
      parti: ParteCambiata[];
      esito?: "confermata" | "annullata";
    }
  /** Com'è finita un'installazione: il centro lo dice quando è ripartito. */
  | { tipo: "installata"; chiave: string; versione: string; riuscita: boolean; motivo?: string }
  /**
   * La Home chiede se fare un lavoro lì o in un progetto. `superata` è vero da quando
   * il proprietario ha scritto dopo la domanda: i pulsanti non servono più.
   */
  | { tipo: "scelta"; chiave: string; lavoro: string; superata: boolean }
  /**
   * Claude pone al proprietario alcune domande prima di andare avanti. `esito` manca finché
   * aspettano; `risposte`, una per domanda, c'è se ha risposto dalla scheda.
   */
  | { tipo: "domande"; chiave: string; domande: Domanda[]; esito?: EsitoDomande; risposte?: string[] }
  /** Il ragionamento di Claude, riassunto: si vede solo nella vista della trascrizione che lo mostra. */
  | { tipo: "ragionamento"; chiave: string; testo: string }
  /**
   * Le cose da fare di Claude (TodoWrite): una scheda per turno, aggiornata sul posto a ogni nuova
   * versione della lista. `finito` dice che il turno si è chiuso: la scheda mostra il riepilogo.
   */
  | { tipo: "cose-da-fare"; chiave: string; voci: VoceDaFare[]; finito: boolean }
  /** Qui comincia o riprende un argomento della Home; `archiviato` è quello che era aperto prima. */
  | { tipo: "passaggio"; chiave: string; riaperto: boolean; archiviato?: { id: string; titolo: string }; ramo?: true }
  /** Qui l'argomento è stato archiviato. */
  | { tipo: "archiviato"; chiave: string; titolo: string; proseguito: boolean }
  /** Qualcosa è andato storto. */
  | { tipo: "avviso"; chiave: string; testo: string }
  /** Un'informazione che non è un errore, come una risposta interrotta dal proprietario. */
  | { tipo: "nota"; chiave: string; testo: string }
  /** I file che Claude ha cambiato in un turno, e che cosa ne ha deciso il proprietario. La chiave è il turno. */
  | { tipo: "modifiche"; chiave: string; file: FileModificato[]; decisi: Readonly<Record<string, DecisioneModifiche>>; altri?: number }
  /** Un file che la Home mostra nella chat: resta dov'è, e si ritrova nel pannello degli elaborati. */
  | {
      tipo: "elaborato";
      chiave: string;
      idArgomento: string;
      idAmbiente: string;
      nomeAmbiente: string;
      percorso: string;
      titolo?: string;
      aggiorna?: string;
    };

/** Una voce delle cose da fare: il testo, quello da mostrare mentre è in corso, e com'è. */
export interface VoceDaFare {
  testo: string;
  inCorso: string;
  stato: "da-fare" | "in-corso" | "fatta";
}

/** Lo strumento con cui Claude tiene la sua lista delle cose da fare. */
export const STRUMENTO_COSE_DA_FARE = "TodoWrite";

/** Le voci della lista come le manda Claude; quelle fatte male si saltano. */
export function vociDaFare(ingresso: unknown): VoceDaFare[] {
  const elenco = (ingresso as { todos?: unknown } | null)?.todos;
  if (!Array.isArray(elenco)) return [];
  return elenco.flatMap((voce: unknown) => {
    const { content, activeForm, status } = (voce ?? {}) as Record<string, unknown>;
    if (typeof content !== "string" || content.trim() === "") return [];
    const statoVoce = status === "completed" ? "fatta" : status === "in_progress" ? "in-corso" : "da-fare";
    return [{ testo: content, inCorso: typeof activeForm === "string" && activeForm !== "" ? activeForm : content, stato: statoVoce }];
  });
}

export interface StatoChat {
  elementi: Elemento[];
  /** La scheda delle cose da fare del turno in corso, se Claude ne ha una: le versioni nuove la aggiornano. */
  coseDaFare?: string;
  /** Turni cominciati e non ancora conclusi. */
  turniAperti: number;
  /** Le scelte del proprietario su questa conversazione; mancano finché il centro non le manda. */
  impostazioni?: ImpostazioniConversazione;
  /** Ciò che l'harness riferisce: modello, contesto, limiti. Ogni voce manca finché non è nota. */
  stato?: StatoConversazione;
  /** Lo stato del progetto, come il progetto lo ha scritto l'ultima volta. Solo nelle chat dei progetti. */
  statoProgetto?: string;
  /** Le attività della conversazione: comandi in background e agenti, in corso e appena finiti. */
  attivita?: Attivita[];
}

/** Il nome dello strumento con cui Claude pone domande al proprietario. */
const STRUMENTO_DELLE_DOMANDE = "AskUserQuestion";

/** Vero se nella conversazione qualcosa aspetta una risposta del proprietario: un permesso, una domanda, una scheda da decidere. */
export function aspettaIlProprietario(elementi: readonly Elemento[]): boolean {
  return elementi.some((e) => {
    switch (e.tipo) {
      case "azione":
        return e.permesso?.stato === "in-attesa";
      case "domande":
      case "approvazione":
      case "proposta":
      case "sviluppo":
      case "installazione":
      case "estensione":
      case "interfaccia":
        return e.esito === undefined;
      case "scelta":
        return !e.superata;
      default:
        return false;
    }
  });
}

export const statoIniziale: StatoChat = { elementi: [], turniAperti: 0 };

export function alLavoro(stato: StatoChat): boolean {
  return stato.turniAperti > 0;
}

export function applica(stato: StatoChat, evento: EventoConversazione): StatoChat {
  switch (evento.tipo) {
    case "messaggio-proprietario":
      // Con un messaggio il proprietario ha risposto anche alle domande rimaste aperte.
      return aggiungi(superaLeScelte(stato), {
        tipo: "proprietario",
        ...(evento.origine === "telegram" ? { daTelegram: true } : {}),
        ...(evento.origine === "programmato" ? { programmato: true } : {}),
        chiave: evento.id,
        testo: evento.testo,
        ...(evento.immagini === undefined ? {} : { immagini: evento.immagini }),
        ...(evento.file === undefined ? {} : { file: evento.file }),
        ...(evento.modificabile === true ? { modificabile: true as const } : {}),
      });

    case "attivita":
      return { ...stato, attivita: evento.attivita };

    case "modifiche":
      if (trova(stato, evento.idTurno) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "modifiche",
        chiave: evento.idTurno,
        file: evento.file,
        decisi: {},
        ...(typeof evento.altri === "number" && evento.altri > 0 ? { altri: evento.altri } : {}),
      });

    case "modifiche-decise":
      return {
        ...stato,
        elementi: stato.elementi.map((elemento) =>
          elemento.tipo === "modifiche" && elemento.chiave === evento.idTurno
            ? { ...elemento, decisi: { ...elemento.decisi, ...Object.fromEntries(evento.percorsi.map((percorso) => [percorso, evento.esito])) } }
            : elemento,
        ),
      };

    case "riavvolto": {
      // La conversazione riparte da prima di quel messaggio: ciò che viene dopo, lui compreso, sparisce.
      const posizione = stato.elementi.findIndex((e) => e.tipo === "proprietario" && e.chiave === evento.idMessaggio);
      if (posizione < 0) return stato;
      const riportati = evento.fileRiportati?.length ?? 0;
      const { coseDaFare: _lista, ...senzaLista } = stato;
      return {
        ...senzaLista,
        elementi: [
          ...stato.elementi.slice(0, posizione),
          {
            tipo: "nota",
            chiave: `riavvolto-${evento.idMessaggio}`,
            testo:
              riportati === 0
                ? "La conversazione riparte da qui."
                : `La conversazione riparte da qui, con ${riportati === 1 ? "un file riportato" : `${riportati} file riportati`} a com'erano.`,
          },
        ],
      };
    }

    case "turno-iniziato":
      return { ...stato, turniAperti: stato.turniAperti + 1 };

    case "testo-iniziato":
      if (trova(stato, evento.idTesto) !== undefined) return stato;
      return aggiungi(stato, { tipo: "testo", chiave: evento.idTesto, testo: "", concluso: false });

    case "testo-frammento": {
      if (trova(stato, evento.idTesto) === undefined) {
        return aggiungi(stato, {
          tipo: "testo",
          chiave: evento.idTesto,
          testo: evento.frammento,
          concluso: false,
        });
      }
      return cambia(stato, evento.idTesto, (e) =>
        e.tipo === "testo" ? { ...e, testo: e.testo + evento.frammento } : e,
      );
    }

    case "testo-concluso": {
      const esistente = trova(stato, evento.idTesto);
      if (evento.testo === "") {
        // Un blocco rimasto vuoto non merita una riga; uno interrotto resta com'è.
        if (esistente?.tipo === "testo" && esistente.testo === "") {
          return { ...stato, elementi: stato.elementi.filter((e) => e.chiave !== evento.idTesto) };
        }
        return cambia(stato, evento.idTesto, (e) => (e.tipo === "testo" ? { ...e, concluso: true } : e));
      }
      if (esistente === undefined) {
        return aggiungi(stato, {
          tipo: "testo",
          chiave: evento.idTesto,
          testo: evento.testo,
          concluso: true,
        });
      }
      return cambia(stato, evento.idTesto, (e) =>
        e.tipo === "testo" ? { ...e, testo: evento.testo, concluso: true } : e,
      );
    }

    case "ragionamento":
      if (trova(stato, evento.idRagionamento) !== undefined) return stato;
      return aggiungi(stato, { tipo: "ragionamento", chiave: evento.idRagionamento, testo: evento.testo });

    case "azione-iniziata": {
      // Lo strumento delle domande si vede come la sua scheda, non come un'azione.
      if (evento.strumento === STRUMENTO_DELLE_DOMANDE) return stato;
      // Così le cose da fare: una scheda per turno, che si aggiorna invece di ripetersi.
      if (evento.strumento === STRUMENTO_COSE_DA_FARE) {
        const voci = vociDaFare(evento.ingresso);
        if (stato.coseDaFare !== undefined && trova(stato, stato.coseDaFare) !== undefined) {
          return cambia(stato, stato.coseDaFare, (e) => (e.tipo === "cose-da-fare" ? { ...e, voci } : e));
        }
        const chiave = `cose-${evento.idAzione}`;
        return { ...aggiungi(stato, { tipo: "cose-da-fare", chiave, voci, finito: false }), coseDaFare: chiave };
      }
      if (trova(stato, evento.idAzione) === undefined) {
        return aggiungi(stato, {
          tipo: "azione",
          chiave: evento.idAzione,
          strumento: evento.strumento,
          ingresso: evento.ingresso,
          conclusa: false,
          ...(evento.accorciato === true ? { accorciata: true } : {}),
        });
      }
      return cambia(stato, evento.idAzione, (e) =>
        e.tipo === "azione"
          ? { ...e, strumento: evento.strumento, ingresso: evento.ingresso, ...(evento.accorciato === true ? { accorciata: true as const } : {}) }
          : e,
      );
    }

    case "azione-conclusa":
      return cambia(stato, evento.idAzione, (e) =>
        e.tipo === "azione"
          ? {
              ...e,
              conclusa: true,
              esito: evento.esito,
              errore: evento.errore,
              ...(evento.immagini === undefined ? {} : { immagini: evento.immagini }),
              ...(evento.accorciato === true ? { accorciata: true as const } : {}),
            }
          : e,
      );

    case "permesso-richiesto": {
      const permesso: Permesso = {
        id: evento.idPermesso,
        stato: "in-attesa",
        ...(evento.motivo === undefined ? {} : { motivo: evento.motivo }),
        ...(evento.regola === undefined ? {} : { regola: evento.regola }),
      };
      // La richiesta può arrivare prima dell'azione a cui si riferisce.
      if (trova(stato, evento.idAzione) === undefined) {
        return aggiungi(stato, {
          tipo: "azione",
          chiave: evento.idAzione,
          strumento: evento.strumento,
          ingresso: evento.ingresso,
          conclusa: false,
          permesso,
        });
      }
      return cambia(stato, evento.idAzione, (e) => (e.tipo === "azione" ? { ...e, permesso } : e));
    }

    case "permesso-deciso":
      return {
        ...stato,
        elementi: stato.elementi.map((e) =>
          e.tipo === "azione" && e.permesso?.id === evento.idPermesso
            ? { ...e, permesso: { ...e.permesso, stato: evento.decisione } }
            : e,
        ),
      };

    case "approvazione-richiesta":
      if (trova(stato, evento.idApprovazione) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "approvazione",
        chiave: evento.idApprovazione,
        host: evento.host,
        credenziale: evento.credenziale,
        comando: evento.comando,
        scadeIl: evento.scadeIl,
        ...(evento.alGateway === true ? { alGateway: true as const } : {}),
        ...(evento.genere === undefined ? {} : { genere: evento.genere }),
      });

    case "domande-poste":
      if (trova(stato, evento.idDomande) !== undefined) return stato;
      return aggiungi(stato, { tipo: "domande", chiave: evento.idDomande, domande: evento.domande });

    case "domande-chiuse":
      return cambia(stato, evento.idDomande, (e) =>
        e.tipo === "domande" ? { ...e, esito: evento.esito, ...(evento.risposte === undefined ? {} : { risposte: evento.risposte }) } : e,
      );

    case "approvazione-decisa":
      return cambia(stato, evento.idApprovazione, (e) => (e.tipo === "approvazione" ? { ...e, esito: evento.esito } : e));

    case "turno-concluso": {
      // Finito il turno, la scheda delle cose da fare mostra il riepilogo, e la prossima lista ne apre un'altra.
      const chiusi = stato.elementi.map((e) =>
        e.tipo === "testo" && !e.concluso
          ? { ...e, concluso: true }
          : e.tipo === "cose-da-fare" && e.chiave === stato.coseDaFare
            ? { ...e, finito: true }
            : e,
      );
      const turniAperti = Math.max(0, stato.turniAperti - 1);
      const { coseDaFare: _chiusa, ...senzaLista } = stato;
      stato = senzaLista;
      if (evento.interrotto === true) {
        const nota: Elemento = {
          tipo: "nota",
          chiave: `nota-${chiusi.length}`,
          testo: "Risposta interrotta.",
        };
        return { ...stato, elementi: [...chiusi, nota], turniAperti };
      }
      const conAvviso =
        evento.riuscito || evento.errore === undefined || ultimoAvviso(chiusi) === evento.errore
          ? chiusi
          : [...chiusi, avviso(chiusi.length, evento.errore)];
      return { ...stato, elementi: conAvviso, turniAperti };
    }

    case "nota":
      return aggiungi(stato, { tipo: "nota", chiave: `nota-${stato.elementi.length}`, testo: evento.testo });

    case "errore":
      if (ultimoAvviso(stato.elementi) === evento.messaggio) return stato;
      return aggiungi(stato, avviso(stato.elementi.length, evento.messaggio));

    case "proposta-progetto":
      if (trova(stato, evento.idProposta) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "proposta",
        chiave: evento.idProposta,
        nome: evento.nome,
        idAmbiente: evento.idAmbiente,
        brief: evento.brief,
        ...(evento.file === undefined ? {} : { file: evento.file }),
        ...(evento.cartellaEsistente === undefined ? {} : { cartellaEsistente: evento.cartellaEsistente }),
        ...(evento.avvisoCartella === undefined ? {} : { avvisoCartella: evento.avvisoCartella }),
        ...(evento.impostazioni === undefined ? {} : { impostazioni: evento.impostazioni }),
        ...(evento.modelli === undefined ? {} : { modelli: evento.modelli }),
        ...(evento.estensioni === undefined ? {} : { estensioni: evento.estensioni }),
      });

    case "proposta-decisa":
      return cambia(stato, evento.idProposta, (e) =>
        e.tipo === "proposta"
          ? {
              ...e,
              esito: evento.esito,
              ...(evento.idProgetto === undefined ? {} : { idProgetto: evento.idProgetto }),
              ...(evento.nome === undefined ? {} : { nomeProgetto: evento.nome }),
              ...(evento.filePortati === undefined ? {} : { filePortati: evento.filePortati }),
              ...(evento.cartellaAdottata === undefined ? {} : { cartellaAdottata: evento.cartellaAdottata }),
              ...(evento.estensioni === undefined ? {} : { estensioniScelte: evento.estensioni }),
              ...(evento.skillDiPartenza === undefined ? {} : { skillDiPartenza: evento.skillDiPartenza }),
            }
          : e,
      );

    case "sviluppo-proposto":
      if (trova(stato, evento.idProposta) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "sviluppo",
        chiave: evento.idProposta,
        titolo: evento.titolo,
        richiesta: evento.richiesta,
        ...(evento.impostazioni === undefined ? {} : { impostazioni: evento.impostazioni }),
        ...(evento.modelli === undefined ? {} : { modelli: evento.modelli }),
      });

    case "sviluppo-deciso":
      return cambia(stato, evento.idProposta, (e) =>
        e.tipo === "sviluppo"
          ? {
              ...e,
              esito: evento.esito,
              ...(evento.idProgetto === undefined ? {} : { idProgetto: evento.idProgetto }),
              ...(evento.impostazioni === undefined ? {} : { usate: evento.impostazioni }),
              ...(evento.soloPerQuestoLavoro === true ? { soloPerQuestoLavoro: true } : {}),
            }
          : e,
      );

    case "estensione-proposta":
      if (trova(stato, evento.idProposta) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "estensione",
        chiave: evento.idProposta,
        nome: evento.nome,
        descrizione: evento.descrizione,
        definizione: evento.definizione,
        chiavi: evento.chiavi,
        idAmbiente: evento.idAmbiente,
        nomeAmbiente: evento.nomeAmbiente,
        ...(evento.contenuto === undefined ? {} : { contenuto: evento.contenuto }),
        avvisi: evento.avvisi,
        ...(evento.giaInElenco === true ? { giaInElenco: true as const } : {}),
      });

    case "interfaccia-proposta":
      if (trova(stato, evento.idProposta) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "interfaccia",
        chiave: evento.idProposta,
        nome: evento.nome,
        descrizione: evento.descrizione,
        ...(evento.sostituisce === true ? { sostituisce: true as const } : {}),
        ...(evento.righeTema === undefined ? {} : { righeTema: evento.righeTema }),
        // Una proposta di prima dell'ADR 0057 ha i posti nel vecchio "dove", e nessuna API.
        ...conICampiNuovi({ pagine: evento.pagine, ...(evento.api === undefined ? {} : { api: evento.api }), ...(evento.comandi === undefined ? {} : { comandi: evento.comandi }), ...(evento.parti === undefined ? {} : { parti: evento.parti }) }),
        pulsanti: evento.pulsanti,
      });

    case "interfaccia-decisa":
      return cambia(stato, evento.idProposta, (e) => (e.tipo === "interfaccia" ? { ...e, esito: evento.esito } : e));

    case "estensione-decisa":
      return cambia(stato, evento.idProposta, (e) =>
        e.tipo === "estensione"
          ? {
              ...e,
              esito: evento.esito,
              ...(evento.strumenti === undefined ? {} : { strumenti: evento.strumenti }),
              ...(evento.motivo === undefined ? {} : { motivo: evento.motivo }),
            }
          : e,
      );

    case "installazione-richiesta":
      if (trova(stato, evento.idInstallazione) !== undefined) return stato;
      return aggiungi(stato, {
        tipo: "installazione",
        chiave: evento.idInstallazione,
        versione: evento.versione,
        riassunto: evento.riassunto,
        modifiche: evento.modifiche,
        file: evento.file,
        quantiFile: evento.quantiFile,
        avvisi: evento.avvisi,
      });

    case "installazione-decisa":
      return cambia(stato, evento.idInstallazione, (e) => (e.tipo === "installazione" ? { ...e, esito: evento.esito } : e));

    case "installazione-conclusa":
      return aggiungi(stato, {
        tipo: "installata",
        chiave: `installata-${stato.elementi.length}`,
        versione: evento.versione,
        riuscita: evento.esito === "installata",
        ...(evento.motivo === undefined ? {} : { motivo: evento.motivo }),
      });

    case "scelta-richiesta":
      if (trova(stato, evento.idScelta) !== undefined) return stato;
      return aggiungi(stato, { tipo: "scelta", chiave: evento.idScelta, lavoro: evento.lavoro, superata: false });

    case "passaggio-argomento":
      return aggiungi(superaLeScelte(stato), {
        tipo: "passaggio",
        chiave: `passaggio-${stato.elementi.length}`,
        riaperto: evento.riaperto,
        ...(evento.archiviato === undefined ? {} : { archiviato: evento.archiviato }),
        ...(evento.ramo === true ? { ramo: true as const } : {}),
      });

    case "argomento-archiviato":
      return aggiungi(superaLeScelte(stato), {
        tipo: "archiviato",
        chiave: `archiviato-${stato.elementi.length}`,
        titolo: evento.titolo,
        proseguito: evento.proseguito,
      });

    case "elaborato-mostrato":
      return aggiungi(stato, {
        tipo: "elaborato",
        chiave: `elaborato-${stato.elementi.length}`,
        idArgomento: evento.idArgomento,
        idAmbiente: evento.idAmbiente,
        nomeAmbiente: evento.nomeAmbiente,
        percorso: evento.percorso,
        ...(evento.titolo === undefined ? {} : { titolo: evento.titolo }),
        ...(evento.aggiorna === undefined ? {} : { aggiorna: evento.aggiorna }),
      });

    case "stato":
      // Arriva a pezzi: ciò che un pezzo non dice resta com'era.
      return { ...stato, stato: { ...stato.stato, ...evento.stato } };

    case "impostazioni":
      return { ...stato, impostazioni: evento.impostazioni };

    case "stato-progetto":
      return { ...stato, statoProgetto: evento.testo };

    case "apri-progetto":
      // Sposta l'interfaccia, non cambia la conversazione: se ne occupa chi riceve l'evento.
      return stato;

    default:
      // Un evento che questa versione dell'interfaccia non conosce non deve romperla.
      return stato;
  }
}

function trova(stato: StatoChat, chiave: string): Elemento | undefined {
  return stato.elementi.find((e) => e.chiave === chiave);
}

function aggiungi(stato: StatoChat, elemento: Elemento): StatoChat {
  return { ...stato, elementi: [...stato.elementi, elemento] };
}

function cambia(stato: StatoChat, chiave: string, come: (e: Elemento) => Elemento): StatoChat {
  return { ...stato, elementi: stato.elementi.map((e) => (e.chiave === chiave ? come(e) : e)) };
}

function superaLeScelte(stato: StatoChat): StatoChat {
  if (!stato.elementi.some((e) => e.tipo === "scelta" && !e.superata)) return stato;
  return {
    ...stato,
    elementi: stato.elementi.map((e) => (e.tipo === "scelta" && !e.superata ? { ...e, superata: true } : e)),
  };
}

function avviso(posizione: number, testo: string): Elemento {
  return { tipo: "avviso", chiave: `avviso-${posizione}`, testo };
}

function ultimoAvviso(elementi: Elemento[]): string | undefined {
  const ultimo = elementi.at(-1);
  return ultimo?.tipo === "avviso" ? ultimo.testo : undefined;
}
