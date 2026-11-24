/** Chiamate dal browser al centro. */

import type { StatoEstensioniDelProgetto } from "../../src/protocollo/progetti.ts";
import type { ChiImplementa, StatoChiImplementa } from "../../src/protocollo/incarichi.ts";
import type { ScelteAvvisi } from "../../src/protocollo/avvisi.ts";
import type { DettaglioDellAmbiente } from "../../src/protocollo/risorse.ts";
import type { StatoNotifiche } from "../../src/centro/notifiche-app.ts";
import type { EsitoPush } from "../../src/centro/web-push.ts";
import type { NuovoProgettoAMano, SchedaNuovoProgetto } from "../../src/protocollo/progetti.ts";
import type { NuovoProgrammato, StatoProgrammati } from "../../src/protocollo/programmati.ts";
import type { AccessiDiUnAmbiente, EsitoAccessi, ImpostazioniViste, RichiestaAccessi } from "../../src/protocollo/accessi.ts";
import type { Allegato } from "../../src/protocollo/allegati.ts";
import type { ElaboratoConsegnato } from "../../src/protocollo/elaborati.ts";
import type { AnteprimaRiavvolgimento, DecisionePermesso, RispostaAlleDomande, UscitaAttivita } from "../../src/protocollo/eventi.ts";
import type { StileDiRisposta } from "../../src/protocollo/stili.ts";
import type { ElencoCartella, FileTrovati } from "../../src/protocollo/file-progetto.ts";
import type { Archiviazione, Uso } from "../../src/protocollo/uso.ts";
import type { EsitoAnnullamento, VersioniDiUnFile } from "../../src/protocollo/modifiche.ts";
import type { AvvioApplicazione, StatoApplicazione } from "../../src/protocollo/applicazioni.ts";
import type { ModificaImpostazioni, Motore, SceltaDelProprietario } from "../../src/protocollo/impostazioni.ts";
import type { ConfermaProposta } from "../../src/protocollo/progetti.ts";
import type { PosizioneDalBrowser } from "./posizione.ts";
import type { StatoHttps } from "../../src/protocollo/https.ts";
import type { DettaglioSkill, VersioniSkill } from "../../src/protocollo/skill.ts";
import type { DettaglioVault } from "../../src/protocollo/vault.ts";
import type { StatoSicurezza } from "../../src/protocollo/sicurezza.ts";
import type { RichiestaDiPubblicazione, StatoDesktop } from "../../src/protocollo/desktop.ts";
import type { StatoCollegate } from "../../src/protocollo/progetti.ts";
import type { CopiaCaricata, CopiaPronta, EsitoTrasloco, ScelteDelTrasloco, StatoCopie } from "../../src/protocollo/copia.ts";

export interface StatoAccesso {
  configurato: boolean;
  autenticato: boolean;
  /** Vero se la password manca e il centro aspetta il codice di primo avvio. */
  primoAvvio?: boolean;
}

export class ErroreCentro extends Error {
  readonly stato: number;

  constructor(stato: number, messaggio: string) {
    super(messaggio);
    this.stato = stato;
  }
}

/** Indirizzo di base delle chiamate che riguardano la conversazione della Home. */
export const BASE_HOME = "/api/home";

/** Indirizzo di base delle chiamate che riguardano un argomento archiviato della Home. */
export function baseDellArgomento(idArgomento: string): string {
  return `/api/argomenti/${encodeURIComponent(idArgomento)}`;
}

/** Indirizzo di base delle chiamate che riguardano la conversazione di un progetto. */
export function baseDelProgetto(idProgetto: string): string {
  return `/api/progetti/${encodeURIComponent(idProgetto)}`;
}

/** L'indirizzo di base di una chat della Home: la principale, o una chat parallela (ADR 0052). */
export function baseDellaChatDellaHome(numero: number): string {
  return numero === 1 ? BASE_HOME : `${BASE_HOME}/chat/${numero}`;
}

/** Vero se l'indirizzo è quello di una chat della Home, principale o parallela. */
export function eDellaHome(base: string): boolean {
  return base === BASE_HOME || base.startsWith(`${BASE_HOME}/chat/`);
}

/** Apre una chat parallela nella Home, o con un progetto in quel progetto. Restituisce il suo numero. */
export async function apriChatParallela(idProgetto?: string): Promise<number> {
  const dati = (await chiama("POST", idProgetto === undefined ? `${BASE_HOME}/chat` : `${baseDelProgetto(idProgetto)}/chat`)) as { numero: number };
  return dati.numero;
}

/** Chiude una chat parallela della Home, o con un progetto di quel progetto. */
export async function chiudiChatParallela(numero: number, idProgetto?: string): Promise<void> {
  await chiama("DELETE", idProgetto === undefined ? `${BASE_HOME}/chat/${numero}` : `${baseDelProgetto(idProgetto)}/chat/${numero}`);
}

async function chiama(metodo: "GET" | "POST" | "PUT" | "DELETE", percorso: string, corpo?: unknown): Promise<unknown> {
  const risposta = await fetch(percorso, {
    method: metodo,
    credentials: "same-origin",
    ...(corpo === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }),
  });
  const dati: unknown = await risposta.json().catch(() => ({}));
  if (!risposta.ok) {
    const errore =
      typeof dati === "object" && dati !== null && "errore" in dati && typeof dati.errore === "string"
        ? dati.errore
        : `Il centro ha risposto ${risposta.status}.`;
    throw new ErroreCentro(risposta.status, errore);
  }
  return dati;
}

/** La prima password di un'installazione nuova, con il codice di primo avvio. */
export async function primoAvvio(codice: string, password: string): Promise<void> {
  await chiama("POST", "/api/primo-avvio", { codice, password });
}

/** Dove si scarica il pacchetto per un'altra installazione di Shinka. */
export const INDIRIZZO_PACCHETTO = "/api/installazione/pacchetto";

export async function leggiStato(): Promise<StatoAccesso> {
  return (await chiama("GET", "/api/stato")) as StatoAccesso;
}

export async function entra(password: string): Promise<void> {
  await chiama("POST", "/api/accesso", { password });
}

export async function esci(): Promise<void> {
  await chiama("POST", "/api/uscita");
}

/** `base` dice a quale conversazione ci si rivolge: quella della Home o quella di un progetto. */
export async function inviaMessaggio(base: string, testo: string, allegati: Allegato[] = []): Promise<void> {
  await chiama("POST", `${base}/messaggi`, { testo, ...(allegati.length === 0 ? {} : { allegati }) });
}

/** Manda alla Home la posizione che il browser ha dato: arriva come un messaggio del proprietario. */
export async function inviaPosizione(base: string, posizione: PosizioneDalBrowser): Promise<void> {
  await chiama("POST", `${base}/posizione`, posizione);
}

/** Cambia modello, impegno o permessi della conversazione. La scelta resta salvata al centro. */
export async function cambiaImpostazioni(base: string, modifica: SceltaDelProprietario): Promise<void> {
  await chiama("POST", `${base}/impostazioni`, modifica);
}

/** L'indirizzo di un'immagine che il centro ha in custodia per questa conversazione. */
export function indirizzoImmagine(base: string, id: string): string {
  return `${base}/immagini/${encodeURIComponent(id)}`;
}

/** Un'immagine scritta nel testo con un indirizzo https: la passa il centro, che la scarica dal suo sito. */
export function indirizzoImmagineEsterna(indirizzo: string): string {
  return `/api/immagine-esterna?indirizzo=${encodeURIComponent(indirizzo)}`;
}

/** Un messaggio trovato cercando nelle conversazioni. */
export interface TrovatoNelleConversazioni {
  dove: { tipo: "home" } | { tipo: "argomento" | "progetto"; id: string };
  titolo: string;
  quando: string;
  chi: "proprietario" | "claude";
  estratto: string;
}

export async function cercaNelleConversazioni(cercato: string): Promise<TrovatoNelleConversazioni[]> {
  const dati = (await chiama("GET", `/api/cerca?q=${encodeURIComponent(cercato)}`)) as { risultati: TrovatoNelleConversazioni[] };
  return dati.risultati;
}

/** Quali file tornerebbero com'erano riprendendo da prima di quel messaggio. */
export async function leggiRiavvolgimento(base: string, idMessaggio: string): Promise<AnteprimaRiavvolgimento> {
  return (await chiama("GET", `${base}/messaggi/${encodeURIComponent(idMessaggio)}/riavvolgimento`)) as AnteprimaRiavvolgimento;
}

/** Modifica un messaggio già mandato: la conversazione riparte da prima di quello, con i file se si vuole. */
export async function modificaMessaggio(base: string, idMessaggio: string, testo: string, file: boolean): Promise<void> {
  await chiama("POST", `${base}/messaggi/${encodeURIComponent(idMessaggio)}/modifica`, { testo, file });
}

/** Cambia il nome di un progetto. */
export async function rinominaProgetto(idProgetto: string, nome: string): Promise<void> {
  await chiama("POST", `${baseDelProgetto(idProgetto)}/nome`, { nome });
}

/** Tiene un progetto in cima alla barra laterale, o lo rimette al suo posto. */
export async function fissaProgetto(idProgetto: string, fissato: boolean): Promise<void> {
  await chiama("POST", `${baseDelProgetto(idProgetto)}/fissato`, { fissato });
}

/**
 * Elimina un progetto da Shinka, fermando ciò che sta facendo. Con `cartella` se ne va anche la
 * cartella con i file; com'è andata, se lo si è chiesto.
 */
export async function eliminaProgetto(idProgetto: string, cartella = false): Promise<{ riuscita: boolean; testo: string } | undefined> {
  const risposta = (await chiama("DELETE", `${baseDelProgetto(idProgetto)}${cartella ? "?cartella=si" : ""}`)) as { cartella?: { riuscita: boolean; testo: string } };
  return risposta.cartella;
}

/** Elimina un argomento archiviato, con la sua cartella nell'ambiente del centro. */
export async function eliminaArgomento(idArgomento: string): Promise<void> {
  await chiama("DELETE", baseDellArgomento(idArgomento));
}

export async function leggiUso(): Promise<Uso> {
  return (await chiama("GET", "/api/uso")) as Uso;
}

export async function leggiArchiviazione(): Promise<Archiviazione> {
  return (await chiama("GET", "/api/archiviazione")) as Archiviazione;
}

/** Il messaggio modificato parte in un argomento nuovo della Home, con la storia fino a lì. */
export async function mandaInUnRamo(base: string, idMessaggio: string, testo: string): Promise<void> {
  await chiama("POST", `${base}/messaggi/${encodeURIComponent(idMessaggio)}/ramo`, { testo });
}

/** La parte finale dell'uscita di un'attività della conversazione. */
export async function leggiUscitaAttivita(base: string, idAttivita: string): Promise<UscitaAttivita> {
  return (await chiama("GET", `${base}/attivita/${encodeURIComponent(idAttivita)}/uscita`)) as UscitaAttivita;
}

/** Gli stili di risposta tra cui scegliere; `siCreano` dice se se ne possono aggiungere. */
export async function leggiStili(): Promise<{ stili: StileDiRisposta[]; siCreano: boolean }> {
  return (await chiama("GET", "/api/stili")) as { stili: StileDiRisposta[]; siCreano: boolean };
}

/** Uno stile nuovo: le istruzioni le scrive Claude dalla descrizione. */
export async function creaStile(nome: string, descrizione: string): Promise<StileDiRisposta> {
  return ((await chiama("POST", "/api/stili", { nome, descrizione })) as { stile: StileDiRisposta }).stile;
}

export async function rimuoviStile(id: string): Promise<void> {
  await chiama("DELETE", `/api/stili/${encodeURIComponent(id)}`);
}

/** Una cartella di un progetto, per il pannello File. */
export async function elencaFile(idProgetto: string, percorso: string): Promise<ElencoCartella> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/file?percorso=${encodeURIComponent(percorso)}`)) as ElencoCartella;
}

/** I file di un progetto il cui nome contiene il testo cercato. */
export async function cercaFile(idProgetto: string, testo: string): Promise<FileTrovati> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/file/cerca?q=${encodeURIComponent(testo)}`)) as FileTrovati;
}

/** L'indirizzo da cui il browser legge un file del progetto: per immagini, PDF, video e audio. */
/** Dove si scarica un file del progetto così com'è, o una cartella come ZIP; il percorso vuoto è il progetto intero. */
export function indirizzoDaScaricare(idProgetto: string, percorso: string): string {
  return `${baseDelProgetto(idProgetto)}/file/scarica?percorso=${encodeURIComponent(percorso)}`;
}

export function indirizzoDelFile(idProgetto: string, percorso: string): string {
  return `${baseDelProgetto(idProgetto)}/file/contenuto?percorso=${encodeURIComponent(percorso)}`;
}

/** Il testo di un file del progetto. */
export async function leggiTestoDelFile(idProgetto: string, percorso: string): Promise<string> {
  const risposta = await fetch(indirizzoDelFile(idProgetto, percorso), { credentials: "same-origin" });
  if (!risposta.ok) {
    const dati = (await risposta.json().catch(() => ({}))) as { errore?: unknown };
    throw new ErroreCentro(risposta.status, typeof dati.errore === "string" ? dati.errore : `Il centro ha risposto ${risposta.status}.`);
  }
  return risposta.text();
}

/** Com'era un file prima di un turno e com'è alla fine. */
export async function leggiVersioniModificate(idProgetto: string, idTurno: string, percorso: string): Promise<VersioniDiUnFile> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/modifiche/${encodeURIComponent(idTurno)}/versioni?percorso=${encodeURIComponent(percorso)}`)) as VersioniDiUnFile;
}

/** Riporta a com'erano prima del turno i file indicati, o tutti quelli del turno. */
export async function annullaModifiche(idProgetto: string, idTurno: string, percorsi?: string[]): Promise<EsitoAnnullamento> {
  return (await chiama("POST", `${baseDelProgetto(idProgetto)}/modifiche/${encodeURIComponent(idTurno)}/annulla`, percorsi === undefined ? {} : { percorsi })) as EsitoAnnullamento;
}

/** Un'azione per intero: nella storia la chat ne ha solo un riassunto. */
export async function leggiAzione(base: string, id: string): Promise<{ ingresso: unknown; esito?: string }> {
  return (await chiama("GET", `${base}/azioni/${encodeURIComponent(id)}`)) as { ingresso: unknown; esito?: string };
}

export async function decidiPermesso(base: string, id: string, decisione: DecisionePermesso, sempre = false): Promise<void> {
  await chiama("POST", `${base}/permessi/${encodeURIComponent(id)}`, { decisione, ...(sempre ? { sempre: true } : {}) });
}

/** Risponde alle domande che Claude ha posto in questa conversazione, oppure le salta. */
export async function rispondiDomande(base: string, id: string, risposta: RispostaAlleDomande): Promise<void> {
  await chiama("POST", `${base}/domande/${encodeURIComponent(id)}`, { risposta });
}

/** Approva o nega un comando che aspetta il proprietario: vale per quel comando, così com'è scritto nella scheda. */
export async function decidiApprovazione(id: string, decisione: "approvata" | "negata"): Promise<void> {
  await chiama("POST", `/api/approvazioni/${encodeURIComponent(id)}`, { decisione });
}

/**
 * Conferma o annulla una proposta di sviluppo di Shinka. Confermata, restituisce il progetto
 * Shinka, a cui la richiesta è passata.
 */
export async function decidiSviluppo(
  id: string,
  esito: "confermata" | "annullata",
  /** Le impostazioni scelte nella scheda, solo per questo lavoro. */
  scelta: ModificaImpostazioni = {},
): Promise<string | undefined> {
  const dati = await chiama("POST", `/api/sviluppo/proposte/${encodeURIComponent(id)}`, { esito, ...(esito === "confermata" ? scelta : {}) });
  if (typeof dati === "object" && dati !== null && "idProgetto" in dati && typeof dati.idProgetto === "string") {
    return dati.idProgetto;
  }
  return undefined;
}

/** Approva o nega l'installazione di una versione di Shinka: approvata, Shinka si riavvia. */
export async function decidiInstallazione(id: string, decisione: "approvata" | "negata"): Promise<void> {
  await chiama("POST", `/api/sviluppo/installazioni/${encodeURIComponent(id)}`, { decisione });
}

/**
 * Conferma o annulla la proposta di un'estensione. Confermata, la risposta arriva quando l'ambiente
 * ha finito di provarla; se manca solo qualcosa da mettere a posto, è un errore che lo dice.
 */
export async function decidiEstensione(id: string, esito: "confermata" | "annullata"): Promise<void> {
  await chiama("POST", `/api/estensioni/proposte/${encodeURIComponent(id)}`, { esito });
}

/** Accende o spegne in un ambiente un'estensione dell'elenco. Accenderla la prova di nuovo, lì. */
/** Il proprietario conferma o annulla la proposta di un'estensione dell'interfaccia. */
export async function decidiInterfaccia(idProposta: string, esito: "confermata" | "annullata"): Promise<void> {
  await chiama("POST", `/api/interfaccia/proposte/${encodeURIComponent(idProposta)}`, { esito });
}

/** Accende o spegne un'estensione dell'interfaccia. */
export async function accendiInterfaccia(id: string, accesa: boolean): Promise<void> {
  await chiama("POST", `/api/interfaccia/${encodeURIComponent(id)}`, { accesa });
}

/** Toglie un'estensione dell'interfaccia dall'elenco. */
export async function togliInterfaccia(id: string): Promise<void> {
  await chiama("DELETE", `/api/interfaccia/${encodeURIComponent(id)}`);
}

/** L'indirizzo di una pagina di un'estensione dell'interfaccia, o di una proposta per l'anteprima. */
export function indirizzoPaginaEstensione(id: string, idPagina: string, proposta = false): string {
  return `/api/interfaccia/${proposta ? "proposte/" : ""}${encodeURIComponent(id)}/pagine/${encodeURIComponent(idPagina)}`;
}

/** Sceglie la risposta massima di un modello locale, che decide la riserva per la compattazione. */
export async function impostaUscita(id: string, uscita: number): Promise<void> {
  await chiama("POST", `/api/estensioni/${encodeURIComponent(id)}/uscita`, { uscita });
}

/** Mette in rete un modello locale acceso in un ambiente, all'indirizzo indicato, o con nulla lo toglie dalla rete. */
export async function mettiInRete(id: string, idAmbiente: string, indirizzo: string | null): Promise<void> {
  await chiama("POST", `/api/estensioni/${encodeURIComponent(id)}/ambienti/${encodeURIComponent(idAmbiente)}/rete`, { indirizzo });
}

export async function accendiEstensione(
  id: string,
  idAmbiente: string,
  accesa: boolean,
): Promise<{ stato: "accesa" | "spenta" | "non-partita"; motivo?: string }> {
  const dati = await chiama("POST", `/api/estensioni/${encodeURIComponent(id)}/ambienti/${encodeURIComponent(idAmbiente)}`, { accesa });
  return dati as { stato: "accesa" | "spenta" | "non-partita"; motivo?: string };
}

/** Toglie un'estensione dall'elenco: si spegne in ogni ambiente. */
export async function rimuoviEstensione(id: string): Promise<void> {
  await chiama("POST", `/api/estensioni/${encodeURIComponent(id)}/rimozione`);
}

/** Guarda adesso ciò che un ambiente ha già per conto suo. Il risultato arriva con il quadro. */
export async function guardaEstensioniDellAmbiente(idAmbiente: string): Promise<void> {
  await chiama("POST", `/api/estensioni/ambienti/${encodeURIComponent(idAmbiente)}/sguardo`);
}

export async function interrompi(base: string): Promise<void> {
  await chiama("POST", `${base}/interrompi`);
}

/** Chiude l'argomento aperto in una chat della Home, di suo la principale, e ne comincia uno nuovo. */
export async function nuovoArgomento(base: string = BASE_HOME): Promise<void> {
  await chiama("POST", `${base}/argomento-nuovo`);
}

/** Riprende un argomento archiviato: quello aperto viene archiviato al suo posto. */
export async function riapriArgomento(idArgomento: string): Promise<void> {
  await chiama("POST", `${baseDellArgomento(idArgomento)}/riapertura`);
}

/** Conferma una proposta di progetto. Restituisce l'identificativo del progetto nato. */
export async function confermaProposta(id: string, scelte: ConfermaProposta): Promise<string> {
  const dati = await chiama("POST", `/api/proposte/${encodeURIComponent(id)}`, {
    esito: "confermata",
    ...scelte,
  });
  if (typeof dati === "object" && dati !== null && "idProgetto" in dati && typeof dati.idProgetto === "string") {
    return dati.idProgetto;
  }
  throw new ErroreCentro(500, "Il centro non ha detto quale progetto è nato.");
}

/** Ciò che serve alla scheda con cui il proprietario crea un progetto da sé. */
export async function leggiSchedaNuovoProgetto(): Promise<SchedaNuovoProgetto> {
  return (await chiama("GET", "/api/nuovo-progetto")) as SchedaNuovoProgetto;
}

/** Crea un progetto senza passare dalla Home: restituisce il suo identificativo. */
export async function creaProgettoAMano(nuovo: NuovoProgettoAMano): Promise<string> {
  const dati = await chiama("POST", "/api/nuovo-progetto", nuovo);
  if (typeof dati === "object" && dati !== null && "idProgetto" in dati && typeof dati.idProgetto === "string") return dati.idProgetto;
  throw new ErroreCentro(500, "Il centro non ha detto quale progetto è nato.");
}

export async function annullaProposta(id: string): Promise<void> {
  await chiama("POST", `/api/proposte/${encodeURIComponent(id)}`, { esito: "annullata" });
}

/** Il proprietario aggiunge a mano una voce alla memoria. */
export async function aggiungiVoce(testo: string): Promise<void> {
  await chiama("POST", "/api/memoria", { testo });
}

export async function correggiVoce(id: string, testo: string): Promise<void> {
  await chiama("POST", `/api/memoria/${encodeURIComponent(id)}`, { testo });
}

export async function cancellaVoce(id: string): Promise<void> {
  await chiama("POST", `/api/memoria/${encodeURIComponent(id)}/cancellazione`);
}

/** Una skill con il suo testo e la sua storia. */
export async function leggiSkill(nome: string): Promise<DettaglioSkill> {
  return (await chiama("GET", `/api/skill/${encodeURIComponent(nome)}`)) as DettaglioSkill;
}

/** Com'era la skill prima e dopo una modifica. */
export async function leggiVersioni(nome: string, idModifica: string): Promise<VersioniSkill> {
  return (await chiama(
    "GET",
    `/api/skill/${encodeURIComponent(nome)}/modifiche/${encodeURIComponent(idModifica)}`,
  )) as VersioniSkill;
}

/** Riporta la skill a com'era prima di una modifica. */
export async function annullaModifica(nome: string, idModifica: string): Promise<void> {
  await chiama(
    "POST",
    `/api/skill/${encodeURIComponent(nome)}/modifiche/${encodeURIComponent(idModifica)}/annullamento`,
  );
}

/** Il vault come lo vede il centro: stato, nomi delle credenziali e registro degli usi. Mai un valore. */
export async function leggiVault(): Promise<DettaglioVault> {
  return (await chiama("GET", "/api/vault")) as DettaglioVault;
}

/** L'HTTPS del centro: com'è adesso e che cosa è scelto per il prossimo avvio. */
export async function leggiHttps(): Promise<StatoHttps> {
  return (await chiama("GET", "/api/https")) as StatoHttps;
}

/** Salva la scelta sull'HTTPS; con `riparti` Shinka riparte subito per applicarla. */
export async function scegliHttps(scelta: { attivo: boolean; nomi: string[]; reindirizza: boolean; riparti: boolean }): Promise<StatoHttps & { riparte: boolean }> {
  return (await chiama("POST", "/api/https", scelta)) as StatoHttps & { riparte: boolean };
}

/** L'indirizzo del collegamento con il terminale di un progetto. */
export function indirizzoDelTerminale(idProgetto: string, scheda = 1): string {
  const schema = window.location.protocol === "https:" ? "wss" : "ws";
  return `${schema}://${window.location.host}${baseDelProgetto(idProgetto)}/terminale${scheda > 1 ? `?scheda=${scheda}` : ""}`;
}

/** Apre l'anteprima del progetto su una porta del suo ambiente: prende il posto di quella aperta prima. */
export async function apriAnteprima(idProgetto: string, porta: number, percorso = "/"): Promise<void> {
  await chiama("POST", `${baseDelProgetto(idProgetto)}/anteprima`, { porta, percorso });
}

export async function chiudiAnteprima(idProgetto: string): Promise<void> {
  await chiama("POST", `${baseDelProgetto(idProgetto)}/anteprima/chiusura`);
}

/** L'applicazione del progetto: come si avvia, se è voluta accesa, e com'è adesso. */
export interface VistaApplicazione {
  avvio?: AvvioApplicazione;
  voluta: boolean;
  stato?: StatoApplicazione;
  motivo?: string;
}

export async function leggiApplicazione(idProgetto: string): Promise<VistaApplicazione> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/applicazione`)) as VistaApplicazione;
}

export async function impostaApplicazione(idProgetto: string, avvio: { comando: string; porta: number; percorso?: string }): Promise<void> {
  await chiama("PUT", `${baseDelProgetto(idProgetto)}/applicazione`, avvio);
}

/** Avvia o ferma l'applicazione; avviandola dal pulsante si apre anche l'anteprima. */
export async function comandaApplicazione(idProgetto: string, azione: "avvia" | "ferma"): Promise<StatoApplicazione> {
  const dati = (await chiama("POST", `${baseDelProgetto(idProgetto)}/applicazione/${azione}`)) as { stato: StatoApplicazione };
  return dati.stato;
}

export async function leggiNotifiche(): Promise<StatoNotifiche> {
  return (await chiama("GET", "/api/notifiche")) as StatoNotifiche;
}

export async function iscriviNotifiche(iscrizione: PushSubscriptionJSON, nome: string): Promise<void> {
  await chiama("POST", "/api/notifiche/iscrizioni", { iscrizione, nome });
}

export async function togliNotifiche(endpoint: string): Promise<void> {
  await chiama("POST", "/api/notifiche/iscrizioni/rimozione", { endpoint });
}

/** Che cosa arriva come notifica dell'app, e che cosa su Telegram. */
export async function impostaScelteNotifiche(scelte: ScelteAvvisi): Promise<void> {
  await chiama("POST", "/api/notifiche/scelte", { scelte });
}

export async function impostaContattoNotifiche(contatto: string): Promise<void> {
  await chiama("POST", "/api/notifiche/contatto", { contatto });
}

/** Manda una notifica di prova a un dispositivo, o a tutti: com'è andata con ciascuno. */
export async function provaNotifiche(endpoint?: string): Promise<{ nome: string; esito: EsitoPush }[]> {
  const dati = (await chiama("POST", "/api/notifiche/prova", endpoint === undefined ? {} : { endpoint })) as { esiti: { nome: string; esito: EsitoPush }[] };
  return dati.esiti;
}

/** Il fuso di questo browser: gli orari dei lavori programmati valgono lì. */
function fusoDiQui(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function leggiProgrammati(): Promise<StatoProgrammati> {
  return (await chiama("GET", `/api/programmati?fuso=${encodeURIComponent(fusoDiQui())}`)) as StatoProgrammati;
}

export async function creaProgrammato(lavoro: NuovoProgrammato): Promise<void> {
  await chiama("POST", "/api/programmati", { ...lavoro, fuso: fusoDiQui() });
}

export async function cambiaProgrammato(id: string, modifica: Partial<NuovoProgrammato> & { attivo?: boolean; nuovoIndirizzo?: true }): Promise<void> {
  await chiama("POST", `/api/programmati/${encodeURIComponent(id)}`, { ...modifica, fuso: fusoDiQui() });
}

export async function eseguiProgrammato(id: string): Promise<void> {
  await chiama("POST", `/api/programmati/${encodeURIComponent(id)}/esecuzione`);
}

export async function togliProgrammato(id: string): Promise<void> {
  await chiama("POST", `/api/programmati/${encodeURIComponent(id)}/rimozione`);
}

export async function decidiRichiesta(id: string, decisione: DecisionePermesso): Promise<void> {
  await chiama("POST", `/api/ambienti/richieste/${encodeURIComponent(id)}`, { decisione });
}

/** Come stanno adesso le risorse di un ambiente: lo chiede la sua pagina, finché è aperta. */
/** Termina un processo acceso da Shinka in un ambiente, con ciò che ha avviato. */
export async function terminaProcesso(idAmbiente: string, pid: number): Promise<void> {
  await chiama("POST", `/api/ambienti/${encodeURIComponent(idAmbiente)}/processi/${pid}/termina`);
}

export async function leggiRisorseAmbiente(id: string): Promise<DettaglioDellAmbiente> {
  return (await chiama("GET", `/api/ambienti/${encodeURIComponent(id)}/risorse`)) as DettaglioDellAmbiente;
}

/** Chiede al nodo di un ambiente di passare alla versione del centro. */
/** Fa partire un nodo Windows a ogni accesso, oppure no. */
export async function impostaAvvioConWindows(idAmbiente: string, attivo: boolean): Promise<{ attivo: boolean }> {
  return (await chiama("POST", `/api/ambienti/${encodeURIComponent(idAmbiente)}/avvio-con-windows`, { attivo })) as { attivo: boolean };
}

export async function aggiornaAmbiente(id: string): Promise<void> {
  await chiama("POST", `/api/ambienti/${encodeURIComponent(id)}/aggiornamento`);
}

/** Il comando di una riga che prepara un ambiente nuovo, e fino a quando vale il suo invito. */
export interface InvitoAmbiente {
  comando: string;
  sistema: "linux" | "windows";
  scade: string;
}

export async function invitaAmbiente(richiesta: { sistema: "linux" | "windows"; centro: string; nome: string; descrizione?: string }): Promise<InvitoAmbiente> {
  return (await chiama("POST", "/api/ambienti/inviti", richiesta)) as InvitoAmbiente;
}

export async function rimuoviAmbiente(id: string): Promise<void> {
  await chiama("POST", `/api/ambienti/${encodeURIComponent(id)}/rimozione`);
}

/** Un elaborato: un file nella cartella di un argomento della Home, in un ambiente. */
export interface RiferimentoElaborato {
  idArgomento: string;
  idAmbiente: string;
  nomeAmbiente: string;
  percorso: string;
  titolo?: string;
  /** Il comando che lo rifà con i dati del momento, se la Home lo ha dato. */
  aggiorna?: string;
}

/** Rifà un elaborato vivo con il suo comando: com'è andata, con la fine dell'uscita. */
export async function aggiornaElaborato(riferimento: RiferimentoElaborato): Promise<{ riuscita: boolean; uscita: string }> {
  return (await chiama("POST", `${baseDellArgomento(riferimento.idArgomento)}/elaborati/aggiorna`, {
    ambiente: riferimento.idAmbiente,
    percorso: riferimento.percorso,
  })) as { riuscita: boolean; uscita: string };
}

/** Salva un elaborato di testo riscritto a mano dal proprietario. */
export async function salvaElaborato(riferimento: RiferimentoElaborato, contenuto: string): Promise<void> {
  await chiama("PUT", `${baseDellArgomento(riferimento.idArgomento)}/elaborati/file`, {
    ambiente: riferimento.idAmbiente,
    percorso: riferimento.percorso,
    contenuto,
  });
}

/** Gli elaborati definitivi: quelli che la Home ha consegnato mostrandoli, dal più recente. */
export async function leggiConsegnati(): Promise<ElaboratoConsegnato[]> {
  return ((await chiama("GET", "/api/elaborati")) as { elaborati: ElaboratoConsegnato[] }).elaborati;
}

/** Dove il centro serve un elaborato così com'è; con `scarica` lo fa salvare. */
export function indirizzoElaborato(riferimento: RiferimentoElaborato, scarica = false): string {
  const domanda = new URLSearchParams({ ambiente: riferimento.idAmbiente, percorso: riferimento.percorso });
  if (scarica) domanda.set("scarica", "1");
  return `${baseDellArgomento(riferimento.idArgomento)}/elaborati/file?${domanda.toString()}`;
}

/** Ciò che la pagina Impostazioni mostra dell'installazione: il motore predefinito e l'ambiente del centro. */
export async function leggiImpostazioniInstallazione(): Promise<ImpostazioniViste> {
  return (await chiama("GET", "/api/impostazioni")) as ImpostazioniViste;
}

export async function cambiaMotorePredefinito(motore: Motore | null): Promise<ImpostazioniViste> {
  return (await chiama("PUT", "/api/impostazioni", { motore })) as ImpostazioniViste;
}

/** Sceglie se il centro accetta solo i nodi con il collegamento cifrato. */
export async function accettaSoloNodiCifrati(soloNodiCifrati: boolean): Promise<void> {
  await chiama("PUT", "/api/impostazioni", { soloNodiCifrati });
}

/** Nome e descrizione dell'ambiente del centro; `null` torna a quelli di partenza. */
export async function cambiaAmbienteDelCentro(ambiente: { nome: string | null; descrizione: string | null }): Promise<ImpostazioniViste> {
  return (await chiama("PUT", "/api/impostazioni", { ambiente })) as ImpostazioniViste;
}

/** Cambia la password di Shinka: le altre sessioni si chiudono, questa resta. */
export async function cambiaPassword(attuale: string, nuova: string): Promise<void> {
  await chiama("POST", "/api/impostazioni/password", { attuale, nuova });
}

/** Le sessioni aperte e il registro delle richieste al centro. */
export async function leggiSicurezza(soloDaGuardare: boolean): Promise<StatoSicurezza> {
  return (await chiama("GET", `/api/sicurezza${soloDaGuardare ? "?solo=da-guardare" : ""}`)) as StatoSicurezza;
}

/** Chiude una sessione dal suo identificativo: quel dispositivo dovrà rientrare. */
/** Le cartelle collegate di un progetto in altri ambienti, e gli ambienti in cui se ne può collegare una. */
export async function leggiCollegate(idProgetto: string): Promise<StatoCollegate> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/collegate`)) as StatoCollegate;
}

export async function collegaCartella(idProgetto: string, idAmbiente: string, cartella: string): Promise<StatoCollegate> {
  return (await chiama("POST", `${baseDelProgetto(idProgetto)}/collegate`, { idAmbiente, cartella })) as StatoCollegate;
}

export async function scollegaCartella(idProgetto: string, idAmbiente: string): Promise<StatoCollegate> {
  return (await chiama("DELETE", `${baseDelProgetto(idProgetto)}/collegate/${encodeURIComponent(idAmbiente)}`)) as StatoCollegate;
}

/** Le estensioni del progetto: quelle accese nel suo ambiente, e quali ha. */
export async function leggiEstensioniDelProgetto(idProgetto: string): Promise<StatoEstensioniDelProgetto> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/estensioni`)) as StatoEstensioniDelProgetto;
}

/** Sceglie le estensioni del progetto, anche a progetto avviato; null per averle tutte. */
export async function cambiaEstensioniDelProgetto(idProgetto: string, scelte: string[] | null): Promise<StatoEstensioniDelProgetto> {
  return (await chiama("PUT", `${baseDelProgetto(idProgetto)}/estensioni`, { scelte })) as StatoEstensioniDelProgetto;
}

/** Chi implementa gli incarichi del progetto (ADR 0051). */
export async function leggiChiImplementa(idProgetto: string): Promise<StatoChiImplementa> {
  return (await chiama("GET", `${baseDelProgetto(idProgetto)}/chi-implementa`)) as StatoChiImplementa;
}

/** Sceglie chi implementa, o con null torna a un modello solo. */
export async function cambiaChiImplementa(idProgetto: string, chiImplementa: ChiImplementa | null): Promise<StatoChiImplementa> {
  return (await chiama("PUT", `${baseDelProgetto(idProgetto)}/chi-implementa`, { chiImplementa })) as StatoChiImplementa;
}

/** La versione di Shinka Desktop che il centro serve agli aggiornamenti. */
export async function leggiDesktop(): Promise<StatoDesktop> {
  return (await chiama("GET", "/api/desktop")) as StatoDesktop;
}

/** Pubblica una versione di Shinka Desktop presa dalla cartella di un progetto. */
export async function pubblicaDesktop(richiesta: RichiestaDiPubblicazione): Promise<StatoDesktop> {
  return (await chiama("POST", "/api/desktop/pubblicazione", richiesta)) as StatoDesktop;
}

/** Toglie un dispositivo: il suo gettone non vale più. */
export async function togliDispositivo(id: string): Promise<void> {
  await chiama("POST", `/api/sicurezza/dispositivi/${encodeURIComponent(id)}/chiusura`);
}

export async function chiudiSessione(id: string): Promise<void> {
  await chiama("POST", `/api/sicurezza/sessioni/${encodeURIComponent(id)}/chiusura`);
}

export async function chiudiLeAltreSessioni(): Promise<void> {
  await chiama("POST", "/api/sicurezza/chiusura-delle-altre");
}

/** Gli accessi di Claude e Codex in ogni ambiente acceso. */
export async function leggiAccessi(): Promise<AccessiDiUnAmbiente[]> {
  return ((await chiama("GET", "/api/impostazioni/accessi")) as { ambienti: AccessiDiUnAmbiente[] }).ambienti;
}

/** Una richiesta sugli accessi di un ambiente: lo stato, entrare, il codice, annullare, uscire. */
export async function chiediAccessi(idAmbiente: string, richiesta: RichiestaAccessi): Promise<EsitoAccessi> {
  return (await chiama("POST", `/api/impostazioni/accessi/${encodeURIComponent(idAmbiente)}`, richiesta)) as EsitoAccessi;
}

/** Le copie di sicurezza: se ce n'è una caricata, com'è andato l'ultimo ripristino. */
export async function leggiCopie(): Promise<StatoCopie> {
  return (await chiama("GET", "/api/copie")) as StatoCopie;
}

/** Fa preparare al centro una copia dei dati, cifrata con questa password: poi la si scarica. */
export async function preparaCopia(password: string): Promise<CopiaPronta> {
  return (await chiama("POST", "/api/copie/preparazione", { password })) as CopiaPronta;
}

/** Dove si scarica una copia preparata. */
export function indirizzoDellaCopia(id: string): string {
  return `/api/copie/scaricamento/${encodeURIComponent(id)}`;
}

/** Carica una copia sul centro, dicendo via via a che punto è (da 0 a 1). */
export function caricaCopia(file: Blob, alProgresso: (parte: number) => void): Promise<CopiaCaricata> {
  return new Promise((risolvi, rifiuta) => {
    const richiesta = new XMLHttpRequest();
    richiesta.open("POST", "/api/copie/caricata");
    richiesta.setRequestHeader("Content-Type", "application/octet-stream");
    richiesta.upload.onprogress = (evento) => {
      if (evento.lengthComputable && evento.total > 0) alProgresso(evento.loaded / evento.total);
    };
    richiesta.onerror = () => rifiuta(new Error("Il caricamento si è interrotto."));
    richiesta.onload = () => {
      let dati: unknown = {};
      try {
        dati = JSON.parse(richiesta.responseText);
      } catch {
        // Una risposta che non è JSON: vale il suo stato.
      }
      if (richiesta.status >= 200 && richiesta.status < 300) return risolvi(dati as CopiaCaricata);
      const errore =
        typeof dati === "object" && dati !== null && "errore" in dati && typeof dati.errore === "string" ? dati.errore : `Il centro ha risposto ${richiesta.status}.`;
      rifiuta(new ErroreCentro(richiesta.status, errore));
    };
    richiesta.send(file);
  });
}

/** Apre la copia caricata con la sua password: dice che cosa c'è dentro. */
export async function apriCopiaCaricata(password: string): Promise<CopiaCaricata> {
  return (await chiama("POST", "/api/copie/apertura", { password })) as CopiaCaricata;
}

/** Porta qui memoria e skill della copia aperta, senza toccare il resto. */
export async function traslocaDallaCopia(scelte: ScelteDelTrasloco): Promise<EsitoTrasloco> {
  return (await chiama("POST", "/api/copie/trasloco", scelte)) as EsitoTrasloco;
}

/** Chiede il ripristino di tutti i dati dalla copia aperta, confermando con la password di Shinka. */
export async function ripristinaDallaCopia(password: string): Promise<{ riparte: boolean }> {
  return (await chiama("POST", "/api/copie/ripristino", { password })) as { riparte: boolean };
}

/** Toglie dal centro la copia caricata. */
export async function scartaCopiaCaricata(): Promise<StatoCopie> {
  return (await chiama("DELETE", "/api/copie/caricata")) as StatoCopie;
}

/** Toglie i dati di prima dell'ultimo ripristino, tenuti da parte. */
export async function eliminaDatiDiPrima(): Promise<StatoCopie> {
  return (await chiama("DELETE", "/api/copie/dati-di-prima")) as StatoCopie;
}
