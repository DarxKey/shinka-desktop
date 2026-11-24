import type { EstensioniDegliAmbienti, SkillDiPartenza } from "./avvio-progetto.ts";
import type { Impegno, ImpostazioniConversazione, ModelloDisponibile, ModoPermessi, Motore } from "./impostazioni.ts";
import type { IndiceArchivio } from "./eventi.ts";

/** Ciò che l'interfaccia vede dei progetti. Dati semplici, serializzabili in JSON. */

export interface Progetto {
  id: string;
  nome: string;
  /** Percorso completo della cartella, nell'ambiente del progetto. */
  cartella: string;
  idAmbiente: string;
  creatoIl: string;
  /** La richiesta passata dalla Home come unico contesto iniziale. */
  brief: string;
  /** Vero per il progetto Shinka: la sua cartella è il codice di Shinka stessa. */
  diShinka?: true;
  /** Vero se il proprietario lo tiene in cima alla barra laterale. */
  fissato?: true;
}

/**
 * Una cartella di un altro ambiente collegata a un progetto (ADR 0050): il progetto vive nel suo
 * ambiente, con il suo motore, e lì lavora anche con gli strumenti di Shinka.
 */
export interface CartellaCollegata {
  idAmbiente: string;
  /** Il percorso completo, in quell'ambiente. */
  cartella: string;
}

/** Una cartella collegata come la vede chi guarda il progetto: con l'ambiente in parole e se è acceso. */
export interface CartellaCollegataInVista extends CartellaCollegata {
  nomeAmbiente: string;
  sistema: string;
  attivo: boolean;
}

/** Le cartelle collegate di un progetto, e gli ambienti in cui se ne può collegare una. */
export interface StatoCollegate {
  collegate: CartellaCollegataInVista[];
  /** Gli altri ambienti attivi, oltre a quello del progetto e a quelli già collegati. */
  possibili: { idAmbiente: string; nomeAmbiente: string; sistema: string }[];
}

/** Le estensioni di un progetto: quelle accese nel suo ambiente, e quali ha scelto il proprietario. */
export interface StatoEstensioniDelProgetto {
  voci: { nome: string; tipo: string; descrizione: string }[];
  /** Le estensioni scelte; manca se il progetto ha tutte quelle accese nel suo ambiente. */
  scelte?: string[];
}

/** Quante cartelle collegate può avere un progetto. */
export const COLLEGATE_MASSIME = 4;

/** Quanto può essere lungo il nome di un progetto. */
export const NOME_PROGETTO_MASSIMO = 60;

/** Il file, nella cartella di un progetto, in cui il progetto tiene il proprio stato. */
export const FILE_STATO_PROGETTO = "STATO.md";

/**
 * Lo stesso file per il progetto Shinka: nel suo repository `STATO.md` è già lo stato dei lavori
 * di Shinka, che è un altro documento.
 */
export const FILE_STATO_DELLO_SVILUPPO = "STATO-DEL-PROGETTO.md";

/** Il nome del progetto Shinka, e della sua cartella. */
export const NOME_PROGETTO_SHINKA = "Shinka";


/** Quanto dello stato di un progetto arriva al centro. */
export const STATO_PROGETTO_MASSIMO = 20_000;

/** In che condizione è un progetto, in una parola. */
export type CondizioneProgetto = "al-lavoro" | "aspetta-te" | "fermo" | "ambiente-spento";

/** Un progetto nell'elenco del quadro, con l'indice del suo archivio (ADR 0046). */
export interface VoceProgetto extends Progetto, Partial<IndiceArchivio> {
  nomeAmbiente: string;
  /** La condizione del progetto, con quella delle sue chat parallele. */
  condizione: CondizioneProgetto;
  /** Le chat parallele aperte (ADR 0052), con la condizione di ciascuna. */
  chat?: { numero: number; condizione: CondizioneProgetto }[];
}

/** I progetti. L'elenco è sempre completo: un progetto che non c'è è stato eliminato (ADR 0046). */
export interface StatoProgetti {
  progetti: VoceProgetto[];
}

/** Quanto può essere lungo il brief di un progetto. */
export const BRIEF_MASSIMO = 8000;

/**
 * Ciò che serve alla scheda con cui il proprietario crea un progetto da sé: le impostazioni con cui
 * nascerebbe, i modelli tra cui scegliere, e per ambiente le estensioni che può avere.
 */
export interface SchedaNuovoProgetto {
  impostazioni: ImpostazioniConversazione;
  modelli?: ModelloDisponibile[];
  estensioni?: EstensioniDegliAmbienti;
}

/** Un progetto che il proprietario crea da sé, senza passare da una proposta della Home. */
export type NuovoProgettoAMano = Omit<ConfermaProposta, "nome" | "idAmbiente" | "portaFile"> & {
  nome: string;
  idAmbiente: string;
  brief: string;
};

/** Ciò che il proprietario può cambiare quando conferma una proposta di progetto. */
export interface ConfermaProposta {
  nome?: string;
  idAmbiente?: string;
  /** Falso se il progetto deve nascere senza i file dell'argomento. Se manca, li porta. */
  portaFile?: boolean;
  /**
   * Il percorso completo di una cartella che esiste già, in cui far nascere il progetto. Vuota per
   * una cartella nuova anche se la Home ne aveva proposta una; se manca vale quella della proposta.
   */
  cartellaEsistente?: string;
  /** Motore, modello, effort e permessi con cui il progetto nasce, se il proprietario li cambia nella scheda. */
  motore?: Motore | null;
  modello?: string | null;
  impegno?: Impegno | null;
  permessi?: ModoPermessi;
  /**
   * Le estensioni di Shinka scelte per il progetto, tra quelle accese nel suo ambiente. Se manca
   * valgono quelle spuntate all'inizio nella scheda.
   */
  estensioni?: string[];
  /** La skill con cui comincia il primo messaggio; null per cominciare dal solo brief. Se manca vale quella consigliata. */
  skillDiPartenza?: SkillDiPartenza | null;
}

/**
 * Nome della cartella di un progetto, ricavato dal suo nome: minuscole, senza accenti,
 * solo lettere, cifre e trattini. Vale ovunque, quindi è sicuro sia su Windows sia su Linux.
 */
export function nomeCartellaDa(nome: string): string {
  const pulito = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return pulito === "" ? "progetto" : pulito;
}
