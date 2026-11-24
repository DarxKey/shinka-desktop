/**
 * Il lavoro offline sui progetti di un ambiente (ADR 0056): ciò che il centro dice a un nodo dei
 * suoi progetti, ciò che il nodo gli consegna quando torna, e lo sportello con cui Shinka Desktop,
 * sulla stessa macchina, parla con il nodo quando il centro non si raggiunge.
 */

import type { EventoArchiviato } from "./eventi.ts";
import { eMotore, leggiImpostazioni, type ImpostazioniConversazione, type Motore } from "./impostazioni.ts";

/** Un progetto di un ambiente come lo tiene il suo nodo, per riprenderlo senza centro. */
export interface ProgettoDelNodo {
  id: string;
  nome: string;
  /** Percorso completo della cartella, in questo ambiente. */
  cartella: string;
  brief: string;
  creatoIl: string;
  /** Le impostazioni della conversazione principale, già complete come le usa il centro. */
  impostazioni: ImpostazioniConversazione;
  /** Da dove riprendere la conversazione principale. */
  idSessione?: string;
  /** Le estensioni scelte per il progetto; senza, tutte quelle accese qui. */
  estensioni?: string[];
  /** Vero per il progetto Shinka. */
  diShinka?: true;
}

/** Un progetto nato offline, come il nodo lo consegna al centro perché lo registri. */
export interface ProgettoNatoOffline {
  id: string;
  nome: string;
  cartella: string;
  brief: string;
  creatoIl: string;
  impostazioni: ImpostazioniConversazione;
}

/** Quanti eventi al massimo in un pezzo consegnato al centro. */
export const PEZZO_OFFLINE = 200;

/** Uno strumento di Shinka usato offline, annotato per il centro: memoria e skill. */
export interface StrumentoAnnotato {
  id: string;
  idConversazione: string;
  nome: string;
  argomenti: Record<string, unknown>;
  quando: string;
}

/** Gli strumenti che offline si annotano e partono verso il centro al ritorno. */
export const STRUMENTI_DA_ANNOTARE: readonly string[] = ["ricorda", "correggi_memoria", "dimentica", "salva_skill"];

/** Il centro dice al nodo i progetti del suo ambiente, tutti, e il testo della memoria. */
export type ComandoOffline =
  | { tipo: "progetti"; progetti: ProgettoDelNodo[]; motorePredefinito?: Motore }
  | { tipo: "memoria"; testo?: string }
  /** Il centro ha preso gli eventi dell'archivio offline di un progetto fino a `fino`. */
  | { tipo: "offline-preso"; idProgetto: string; versione: string; fino: number }
  /** Il centro ha eseguito gli strumenti annotati offline con questi identificativi. */
  | { tipo: "annotati-presi"; id: string[] };

/** Ciò che il nodo consegna al centro del lavoro fatto offline. */
export type ConsegnaOffline =
  | {
      tipo: "offline-eventi";
      idProgetto: string;
      /** La versione dell'archivio offline: il centro ricorda fin dove l'ha preso, per versione. */
      versione: string;
      eventi: EventoArchiviato[];
      /** Il numero dell'ultimo evento dell'archivio: quando il centro arriva lì, la consegna è finita. */
      ultimo: number;
      /** Il progetto, se è nato offline. */
      nuovo?: ProgettoNatoOffline;
      /** Da dove riprendere la conversazione, com'è alla fine del lavoro offline. */
      idSessione?: string;
      /** Le impostazioni della conversazione, come sono alla fine del lavoro offline. */
      impostazioni?: ImpostazioniConversazione;
      /** Dove è stato fatto il lavoro, in parole: per la nota nella storia. */
      ambiente: string;
    }
  | { tipo: "offline-annotati"; strumenti: StrumentoAnnotato[] };

/** Il file, tra i dati del nodo, con cui chi sta sulla stessa macchina trova lo sportello. */
export const FILE_SPORTELLO = "sportello.json";

/** Ciò che dice il file dello sportello. */
export interface IndirizzoDelloSportello {
  porta: number;
  gettone: string;
  idAmbiente: string;
  nome: string;
}

/** Come sta un progetto visto dallo sportello. */
export interface ProgettoAlloSportello {
  id: string;
  nome: string;
  cartella: string;
  creatoIl: string;
  brief: string;
  /** Vero se è nato offline e il centro non lo conosce ancora. */
  nuovo?: true;
  /** Vero se la sua conversazione offline lavora o aspetta il proprietario. */
  occupato: boolean;
  /** L'indice dell'archivio offline, se ce n'è uno. */
  offline?: { ultimo: number; versione: string };
}

/** La risposta di `GET /api/sportello`. */
export interface StatoDelloSportello {
  idAmbiente: string;
  nome: string;
  sistema: string;
  radiceProgetti: string;
  /** Vero se il nodo è collegato al centro: allora si passa da lì. */
  collegato: boolean;
  progetti: ProgettoAlloSportello[];
}

/** Il testo che risponde uno strumento che offline non si può usare. */
export const SENZA_CENTRO =
  "Il centro di Shinka non si raggiunge: questo PC lavora offline, e questo strumento passa dal centro. Riprova quando il PC è di nuovo collegato, e intanto vai avanti con il resto.";

/** Il testo che risponde uno strumento annotato offline. */
export const ANNOTATO_OFFLINE =
  "Annotato: questo PC lavora offline, e il cambiamento arriverà al centro di Shinka appena il PC si ricollega.";

/** Il testo della nota con cui la storia di un progetto riprende il lavoro fatto offline. */
export function notaDelLavoroOffline(ambiente: string, da: string): string {
  const quando = new Date(da).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  return `Da qui, lavoro fatto offline su ${ambiente}, senza il centro, cominciato il ${quando}.`;
}

/** Legge una consegna offline arrivata da un nodo; nulla se non ha la forma attesa. */
export function leggiConsegnaOffline(campi: Record<string, unknown>): ConsegnaOffline | undefined {
  const testo = (valore: unknown, massimo: number): string | undefined => (typeof valore === "string" && valore.length <= massimo ? valore : undefined);
  if (campi.tipo === "offline-eventi") {
    const idProgetto = testo(campi.idProgetto, 64);
    const versione = testo(campi.versione, 64);
    const ambiente = testo(campi.ambiente, 200);
    const ultimo = campi.ultimo;
    if (idProgetto === undefined || versione === undefined || ambiente === undefined) return undefined;
    if (typeof ultimo !== "number" || !Number.isInteger(ultimo) || ultimo < 0) return undefined;
    if (!Array.isArray(campi.eventi) || campi.eventi.length > PEZZO_OFFLINE) return undefined;
    const eventi: EventoArchiviato[] = [];
    for (const uno of campi.eventi as unknown[]) {
      if (typeof uno !== "object" || uno === null) return undefined;
      const { n, quando, evento } = uno as Record<string, unknown>;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || typeof quando !== "string" || Number.isNaN(Date.parse(quando))) return undefined;
      if (typeof evento !== "object" || evento === null || typeof (evento as { tipo?: unknown }).tipo !== "string") return undefined;
      eventi.push({ n, quando, evento: evento as EventoArchiviato["evento"] });
    }
    const nuovo = leggiProgettoNatoOffline(campi.nuovo);
    if (campi.nuovo !== undefined && (nuovo === undefined || nuovo.id !== idProgetto)) return undefined;
    const idSessione = testo(campi.idSessione, 200);
    const impostazioni = campi.impostazioni === undefined ? undefined : leggiImpostazioni(campi.impostazioni);
    return {
      tipo: "offline-eventi",
      idProgetto,
      versione,
      eventi,
      ultimo,
      ambiente,
      ...(nuovo === undefined ? {} : { nuovo }),
      ...(idSessione === undefined || idSessione === "" ? {} : { idSessione }),
      ...(impostazioni === undefined ? {} : { impostazioni }),
    };
  }
  if (campi.tipo === "offline-annotati") {
    if (!Array.isArray(campi.strumenti) || campi.strumenti.length > 1000) return undefined;
    const strumenti: StrumentoAnnotato[] = [];
    for (const uno of campi.strumenti as unknown[]) {
      if (typeof uno !== "object" || uno === null) return undefined;
      const { id, idConversazione, nome, argomenti, quando } = uno as Record<string, unknown>;
      const letto = { id: testo(id, 64), idConversazione: testo(idConversazione, 100), nome: testo(nome, 64), quando: testo(quando, 40) };
      if (letto.id === undefined || letto.idConversazione === undefined || letto.nome === undefined || letto.quando === undefined) return undefined;
      if (!STRUMENTI_DA_ANNOTARE.includes(letto.nome)) return undefined;
      if (typeof argomenti !== "object" || argomenti === null || Array.isArray(argomenti)) return undefined;
      strumenti.push({ id: letto.id, idConversazione: letto.idConversazione, nome: letto.nome, quando: letto.quando, argomenti: argomenti as Record<string, unknown> });
    }
    return { tipo: "offline-annotati", strumenti };
  }
  return undefined;
}

function leggiProgettoNatoOffline(valore: unknown): ProgettoNatoOffline | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { id, nome, cartella, brief, creatoIl, impostazioni } = valore as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return undefined;
  if (typeof nome !== "string" || nome.trim() === "" || nome.length > 60) return undefined;
  if (typeof cartella !== "string" || cartella === "" || cartella.length > 1000) return undefined;
  if (typeof brief !== "string" || brief.length > 100_000) return undefined;
  if (typeof creatoIl !== "string" || Number.isNaN(Date.parse(creatoIl))) return undefined;
  const lette = leggiImpostazioni(impostazioni);
  if (lette === undefined) return undefined;
  return { id, nome: nome.trim(), cartella, brief, creatoIl: new Date(creatoIl).toISOString(), impostazioni: lette };
}

/** Legge un comando del centro sul lavoro offline; nulla se non ha la forma attesa. */
export function leggiComandoOffline(campi: Record<string, unknown>): ComandoOffline | undefined {
  switch (campi.tipo) {
    case "progetti": {
      if (!Array.isArray(campi.progetti) || campi.progetti.length > 10_000) return undefined;
      const progetti: ProgettoDelNodo[] = [];
      for (const uno of campi.progetti as unknown[]) {
        // Uno che non ha la forma attesa si salta: gli altri il nodo li deve avere lo stesso.
        const letto = leggiProgettoNatoOffline(uno);
        if (letto === undefined) continue;
        const { idSessione, estensioni, diShinka } = uno as Record<string, unknown>;
        const scelte = Array.isArray(estensioni) ? estensioni.filter((nome): nome is string => typeof nome === "string" && nome.length <= 64) : undefined;
        progetti.push({
          ...letto,
          ...(typeof idSessione === "string" && idSessione !== "" && idSessione.length <= 200 ? { idSessione } : {}),
          ...(scelte === undefined ? {} : { estensioni: scelte }),
          ...(diShinka === true ? { diShinka: true as const } : {}),
        });
      }
      const motore = campi.motorePredefinito;
      return { tipo: "progetti", progetti, ...(eMotore(motore) ? { motorePredefinito: motore } : {}) };
    }
    case "memoria":
      return typeof campi.testo === "string" && campi.testo.length <= 500_000 ? { tipo: "memoria", testo: campi.testo } : { tipo: "memoria" };
    case "offline-preso": {
      const { idProgetto, versione, fino } = campi;
      if (typeof idProgetto !== "string" || typeof versione !== "string" || typeof fino !== "number" || !Number.isInteger(fino) || fino < 0) return undefined;
      return { tipo: "offline-preso", idProgetto, versione, fino };
    }
    case "annotati-presi":
      return Array.isArray(campi.id) ? { tipo: "annotati-presi", id: campi.id.filter((id): id is string => typeof id === "string") } : undefined;
    default:
      return undefined;
  }
}
