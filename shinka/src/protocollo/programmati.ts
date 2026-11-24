/**
 * I lavori programmati (ADR 0035): richieste che il proprietario lascia a Shinka perché partano
 * da sole, a un orario o a intervalli, nella Home o in un progetto. Qui ciò che centro e
 * interfaccia si dicono, e il calcolo di quando tocca: gli orari sono quelli del fuso del
 * proprietario, non quelli del server.
 */

export const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;
export type Giorno = (typeof GIORNI)[number];

/** Quando parte un lavoro programmato. */
export type Pianificazione =
  /** A un'ora, nei giorni indicati della settimana; senza giorni, tutti. */
  | { tipo: "giorni"; ora: string; giorni: Giorno[] }
  /** A intervalli, contati dall'ultima volta che è partito. */
  | { tipo: "ogni"; minuti: number }
  /** Una volta sola, in un giorno (AAAA-MM-GG) a un'ora. */
  | { tipo: "una-volta"; data: string; ora: string }
  /**
   * Quando un altro sistema manda un evento all'indirizzo del lavoro (ADR 0036): non ha un orario.
   * Lo crea solo il proprietario, dalla pagina.
   */
  | { tipo: "evento" };

/** Il percorso a cui gli altri sistemi mandano gli eventi: la chiave del lavoro sta nell'indirizzo. */
export const PERCORSO_EVENTI = "/api/eventi";
/** Quanto può essere lungo un evento, quanti ne aspettano insieme per un lavoro, e quanti ne accetta in un'ora. */
export const EVENTO_MASSIMO = 16_000;
export const EVENTI_IN_ATTESA = 20;
export const EVENTI_PER_ORA = 60;

/** Dove lavora: nella Home, in un argomento suo, oppure nella conversazione di un progetto. */
export type DoveGira = { tipo: "home" } | { tipo: "progetto"; id: string };

/** Se la risposta finale arriva sempre al proprietario, o solo quando c'è qualcosa da dirgli. */
export const AVVISI = ["sempre", "se-serve"] as const;
export type Avviso = (typeof AVVISI)[number];

/** La riga con cui un lavoro che avvisa solo se serve dice che non c'è nulla da dire. */
export const NULLA_DA_SEGNALARE = "NULLA DA SEGNALARE";

/** Com'è andata l'ultima volta. */
export interface EsitoProgrammato {
  quando: string;
  esito: "fatto" | "nulla-da-segnalare" | "errore" | "saltato";
  /** Perché è stato saltato, o l'errore. */
  dettaglio?: string;
}

export interface LavoroProgrammato {
  id: string;
  titolo: string;
  /** La richiesta, com'è consegnata alla conversazione quando tocca. */
  istruzione: string;
  quando: Pianificazione;
  dove: DoveGira;
  avvisa: Avviso;
  /** Falso se è in pausa: resta nell'elenco e non parte. */
  attivo: boolean;
  creatoIl: string;
  /** Chi lo ha creato, in parole: "Proprietario", "Home", `Progetto "Nome"`. */
  creatoDa: string;
  /** La prossima volta che tocca; manca se è in pausa o se ha già fatto la sua unica volta. */
  prossima?: string;
  ultima?: EsitoProgrammato;
  /** Presente mentre sta lavorando. */
  inCorso?: true;
  /**
   * Presente se ha trovato esaurito il limite del piano, prima di partire o a metà: aspetta fin lì,
   * quando il limite si azzera, e poi riparte da solo, una volta.
   */
  riprendeIl?: string;
  /**
   * Per un lavoro che parte con un evento: l'indirizzo a cui mandarlo, con la sua chiave. Lo vede
   * solo il proprietario, nella pagina: alle conversazioni non viene detto.
   */
  indirizzo?: string;
  /** Quanti eventi aspettano di essere consegnati. */
  eventiInAttesa?: number;
  /** Il nome del progetto in cui gira, per chi lo mostra; manca se il progetto non c'è più. */
  nomeProgetto?: string;
}

export interface StatoProgrammati {
  /** Il fuso in cui valgono gli orari: quello del browser del proprietario, l'ultima volta che lo ha detto. */
  fuso: string;
  lavori: LavoroProgrammato[];
}

/** Ciò che serve per creare o cambiare un lavoro programmato. */
export interface NuovoProgrammato {
  titolo: string;
  istruzione: string;
  quando: Pianificazione;
  dove: DoveGira;
  avvisa: Avviso;
}

export const PROGRAMMATI_MASSIMI = 50;
export const TITOLO_PROGRAMMATO_MASSIMO = 80;
export const ISTRUZIONE_PROGRAMMATO_MASSIMA = 4000;
/** L'intervallo più corto e il più lungo: un quarto d'ora, una settimana. */
export const MINUTI_MINIMI = 15;
export const MINUTI_MASSIMI = 7 * 24 * 60;

const ORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vero se il fuso è uno di quelli che il sistema conosce, come "Europe/Rome". */
export function fusoValido(fuso: unknown): fuso is string {
  if (typeof fuso !== "string" || fuso === "" || fuso.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/** Legge una pianificazione arrivata da fuori: restituisce quella, in ordine, oppure che cosa non va. */
export function leggiPianificazione(valore: unknown): Pianificazione | string {
  if (typeof valore !== "object" || valore === null) return "Manca quando deve partire.";
  const { tipo, ora, giorni, minuti, data } = valore as Record<string, unknown>;
  if (tipo === "giorni") {
    if (typeof ora !== "string" || !ORA.test(ora)) return "L'ora va scritta come 07:30.";
    const scelti = Array.isArray(giorni) ? giorni : [];
    if (scelti.some((giorno) => !(GIORNI as readonly unknown[]).includes(giorno))) return `I giorni sono: ${GIORNI.join(", ")}.`;
    // Nell'ordine della settimana, senza ripetizioni; tutti e sette vale come nessuno indicato.
    const ordinati = GIORNI.filter((giorno) => scelti.includes(giorno));
    return { tipo, ora, giorni: ordinati.length === GIORNI.length ? [] : ordinati };
  }
  if (tipo === "ogni") {
    if (typeof minuti !== "number" || !Number.isInteger(minuti) || minuti < MINUTI_MINIMI || minuti > MINUTI_MASSIMI) {
      return `L'intervallo va da ${MINUTI_MINIMI} minuti a una settimana.`;
    }
    return { tipo, minuti };
  }
  if (tipo === "una-volta") {
    if (typeof ora !== "string" || !ORA.test(ora)) return "L'ora va scritta come 07:30.";
    const letta = typeof data === "string" ? DATA.exec(data) : null;
    if (letta === null || typeof data !== "string") return "Il giorno va scritto come 2026-12-31.";
    const [anno, mese, giorno] = [Number(letta[1]), Number(letta[2]), Number(letta[3])];
    const vero = new Date(Date.UTC(anno, mese - 1, giorno));
    if (vero.getUTCFullYear() !== anno || vero.getUTCMonth() !== mese - 1 || vero.getUTCDate() !== giorno) return "Quel giorno non esiste.";
    return { tipo, data, ora };
  }
  if (tipo === "evento") return { tipo };
  return "Un lavoro parte a un'ora in certi giorni, a intervalli, una volta sola, oppure quando arriva un evento.";
}

/** La pianificazione in parole, per il proprietario. */
export function pianificazioneInParole(quando: Pianificazione): string {
  if (quando.tipo === "evento") return "quando arriva un evento";
  if (quando.tipo === "giorni") return `${quando.giorni.length === 0 ? "ogni giorno" : quando.giorni.join(", ")} alle ${quando.ora}`;
  if (quando.tipo === "una-volta") {
    const [anno, mese, giorno] = quando.data.split("-");
    return `una volta, il ${giorno}/${mese}/${anno} alle ${quando.ora}`;
  }
  const { minuti } = quando;
  if (minuti % 1440 === 0) return minuti === 1440 ? "ogni 24 ore" : `ogni ${minuti / 1440} giorni`;
  if (minuti % 60 === 0) return minuti === 60 ? "ogni ora" : `ogni ${minuti / 60} ore`;
  return `ogni ${minuti} minuti`;
}

interface PartiLocali {
  anno: number;
  mese: number;
  giorno: number;
  ora: number;
  minuto: number;
}

/** Il giorno e l'ora che un istante ha in un fuso. */
function partiLocali(istante: Date, fuso: string): PartiLocali {
  const parti = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(istante);
  const numero = (tipo: string): number => Number(parti.find((parte) => parte.type === tipo)?.value ?? "0");
  return { anno: numero("year"), mese: numero("month"), giorno: numero("day"), ora: numero("hour"), minuto: numero("minute") };
}

/** L'istante in cui in un fuso sono quel giorno e quell'ora. Con l'ora legale che salta, il primo istante dopo. */
function istanteLocale(anno: number, mese: number, giorno: number, ora: number, minuto: number, fuso: string): Date {
  const voluto = Date.UTC(anno, mese - 1, giorno, ora, minuto);
  let istante = voluto;
  // Due passi: il secondo corregge quando il primo ha attraversato un cambio dell'ora.
  for (let passo = 0; passo < 2; passo += 1) {
    const visto = partiLocali(new Date(istante), fuso);
    istante += voluto - Date.UTC(visto.anno, visto.mese - 1, visto.giorno, visto.ora, visto.minuto);
  }
  return new Date(istante);
}

/**
 * La prima volta, dopo `dopo`, in cui tocca a questa pianificazione, nel fuso dato. Per gli
 * intervalli si conta da `dopo`. Undefined se non toccherà più: una volta sola, già passata.
 */
export function prossimaVolta(quando: Pianificazione, dopo: Date, fuso: string): Date | undefined {
  // Un lavoro che parte con un evento non ha un orario.
  if (quando.tipo === "evento") return undefined;
  if (quando.tipo === "ogni") return new Date(dopo.getTime() + quando.minuti * 60_000);
  const [ora, minuto] = quando.ora.split(":").map(Number) as [number, number];
  if (quando.tipo === "una-volta") {
    const [anno, mese, giorno] = quando.data.split("-").map(Number) as [number, number, number];
    const istante = istanteLocale(anno, mese, giorno, ora, minuto, fuso);
    return istante.getTime() > dopo.getTime() ? istante : undefined;
  }
  const oggi = partiLocali(dopo, fuso);
  for (let avanti = 0; avanti <= 7; avanti += 1) {
    const giorno = new Date(Date.UTC(oggi.anno, oggi.mese - 1, oggi.giorno + avanti));
    // getUTCDay conta dalla domenica; la settimana qui comincia dal lunedì.
    const nome = GIORNI[(giorno.getUTCDay() + 6) % 7] as Giorno;
    if (quando.giorni.length > 0 && !quando.giorni.includes(nome)) continue;
    const istante = istanteLocale(giorno.getUTCFullYear(), giorno.getUTCMonth() + 1, giorno.getUTCDate(), ora, minuto, fuso);
    if (istante.getTime() > dopo.getTime()) return istante;
  }
  return undefined;
}
