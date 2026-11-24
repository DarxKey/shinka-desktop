/**
 * Le scelte del proprietario su una conversazione, e ciò che l'harness riferisce di essa.
 * Dati semplici, serializzabili in JSON.
 */

import { leggiStileScelto, type StileScelto } from "./stili.ts";
import type { FileDeiComandi } from "./modifiche.ts";

/** Quanto Claude si impegna in una risposta. I valori sono quelli di Claude Code. */
export const IMPEGNI = ["low", "medium", "high", "xhigh", "max"] as const;
export type Impegno = (typeof IMPEGNI)[number];

/**
 * Chi decide se un'azione di Claude si può fare.
 * - `chiedi`: ogni azione che non sia di sola lettura passa dal proprietario.
 * - `modifiche-libere`: le modifiche ai file della cartella non chiedono, il resto sì.
 * - `automatico`: decide un classificatore di Claude Code, che chiede al proprietario solo nel dubbio.
 * - `senza-permessi`: nessun controllo, Claude fa tutto ciò che decide di fare.
 */
export const MODI_PERMESSI = ["chiedi", "modifiche-libere", "automatico", "senza-permessi"] as const;
export type ModoPermessi = (typeof MODI_PERMESSI)[number];

/**
 * I motori che possono far lavorare una conversazione (sezione 4.12): Claude Code e Codex. Il
 * motore si sceglie per conversazione, come il modello.
 */
export const MOTORI = ["claude", "codex"] as const;
export type Motore = (typeof MOTORI)[number];

export const NOMI_MOTORI: Record<Motore, string> = { claude: "Claude", codex: "Codex" };

export function eMotore(valore: unknown): valore is Motore {
  return MOTORI.includes(valore as Motore);
}

export interface ImpostazioniConversazione {
  /** Se manca vale il motore predefinito dell'installazione. */
  motore?: Motore;
  /** Se manca vale il modello predefinito del motore. */
  modello?: string;
  /** Se manca vale l'impegno predefinito del modello. */
  impegno?: Impegno;
  permessi: ModoPermessi;
  /** Lo stile delle risposte; se manca Claude scrive come fa di solito. */
  stile?: StileScelto;
}

/**
 * Una modifica alle impostazioni: `null` riporta la voce al valore predefinito. Lo stile arriva
 * dal proprietario come identificativo, e chi tiene gli stili lo sostituisce con lo stile intero.
 */
export interface ModificaImpostazioni {
  motore?: Motore | null;
  modello?: string | null;
  impegno?: Impegno | null;
  permessi?: ModoPermessi;
  stile?: StileScelto | null;
}

/** La modifica come la manda l'interfaccia: lo stile per identificativo. */
export type SceltaDelProprietario = Omit<ModificaImpostazioni, "stile"> & { stile?: string | null };

export function applicaModifica(
  attuali: ImpostazioniConversazione,
  modifica: ModificaImpostazioni,
): ImpostazioniConversazione {
  const motore = modifica.motore === undefined ? attuali.motore : (modifica.motore ?? undefined);
  const modello = modifica.modello === undefined ? attuali.modello : (modifica.modello ?? undefined);
  const impegno = modifica.impegno === undefined ? attuali.impegno : (modifica.impegno ?? undefined);
  const stile = modifica.stile === undefined ? attuali.stile : (modifica.stile ?? undefined);
  return {
    ...(motore === undefined ? {} : { motore }),
    ...(modello === undefined || modello.trim() === "" ? {} : { modello: modello.trim() }),
    ...(impegno === undefined ? {} : { impegno }),
    permessi: modifica.permessi ?? attuali.permessi,
    ...(stile === undefined ? {} : { stile }),
  };
}

/** Riconosce impostazioni arrivate da fuori, per esempio da un file o dal centro; nulla se non lo sono. */
export function leggiImpostazioni(valore: unknown): ImpostazioniConversazione | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const campi = valore as Record<string, unknown>;
  const permessi = MODI_PERMESSI.find((modo) => modo === campi.permessi);
  if (permessi === undefined) return undefined;
  const impegno = IMPEGNI.find((livello) => livello === campi.impegno);
  const modello = typeof campi.modello === "string" && campi.modello.trim() !== "" ? campi.modello.trim() : undefined;
  const stile = leggiStileScelto(campi.stile);
  return {
    ...(eMotore(campi.motore) ? { motore: campi.motore } : {}),
    ...(modello === undefined ? {} : { modello }),
    ...(impegno === undefined ? {} : { impegno }),
    permessi,
    ...(stile === undefined ? {} : { stile }),
  };
}

/** Un modello tra cui il proprietario può scegliere, come lo descrive Claude Code. */
export interface ModelloDisponibile {
  valore: string;
  nome: string;
  descrizione: string;
  /** Gli impegni che il modello accetta; se manca, non si sa. */
  impegni?: Impegno[];
  /** Il motore a cui appartiene; se manca, quello della conversazione. */
  motore?: Motore;
}

/** Quanta parte di una finestra di utilizzo del piano è consumata. */
export interface FinestraDiUtilizzo {
  /** Da 0 a 100. */
  percento: number;
  /** Quando la finestra riparte da zero, se noto. */
  azzeraIl?: string;
}

/** Ciò che l'harness riferisce di una conversazione. Ogni voce manca finché non è nota. */
/** Un comando che si scrive con "/" all'inizio del messaggio. */
export interface ComandoDisponibile {
  nome: string;
  descrizione: string;
  /** Che cosa si scrive dopo il nome, se serve. */
  argomenti?: string;
}

export interface StatoConversazione {
  /** Il motore che fa lavorare la conversazione adesso. */
  motore?: Motore;
  /** Il modello che sta rispondendo davvero. */
  modello?: string;
  /** Quanta finestra di contesto è occupata. */
  contesto?: {
    usati: number;
    massimo: number;
    percento: number;
    /** Di che cosa è fatto: istruzioni, strumenti, messaggi, spazio libero, riserva per la compattazione. */
    parti?: { nome: string; token: number; genere: "usato" | "libero" | "riserva" }[];
  };
  /** I limiti del piano: le ultime cinque ore e gli ultimi sette giorni. */
  limiti?: { cinqueOre?: FinestraDiUtilizzo; setteGiorni?: FinestraDiUtilizzo };
  modelli?: ModelloDisponibile[];
  /** I comandi che si possono scrivere con "/" all'inizio del messaggio: skill, comandi dei plugin, quelli dell'harness. */
  comandi?: ComandoDisponibile[];
  /** Quanti comandi o agenti lanciati da Claude stanno lavorando in background. */
  inSfondo?: number;
  /** Se nel pannello Modifiche entrano i file cambiati dai comandi: lo si sa dopo la prima fotografia dei file. */
  fileDeiComandi?: FileDeiComandi;
  /** Il modello locale con cui parla la conversazione, se è uno di quelli, con il picco di memoria della scheda video (ADR 0051). */
  modelloLocale?: { modello: string; vramPiccoMb?: number };
}
