/**
 * Gli accessi dei motori in un ambiente (ADR 0030, pagina Impostazioni): se Claude Code e Codex
 * hanno un abbonamento collegato, e come collegarlo dal browser. Nessuna password passa da Shinka:
 * per Codex il proprietario scrive sul sito di OpenAI il codice che Shinka gli mostra; per Claude
 * incolla in Shinka il codice che il sito di Anthropic gli dà, e Shinka lo passa al programma
 * senza conservarlo.
 */

import { eMotore, type Motore } from "./impostazioni.ts";

/** Se un motore ha l'accesso in un ambiente. */
export type AccessoDelMotore =
  /** `descrizione` dice con che cosa, per esempio "Claude Pro" o "ChatGPT Plus". */
  | { collegato: true; descrizione: string }
  /** Senza accesso, o non si è capito: `motivo` lo dice, se c'è qualcosa da dire. */
  | { collegato: false; motivo?: string };

/** Un accesso cominciato e non ancora concluso. */
export interface AccessoInCorso {
  motore: Motore;
  /** La pagina da aprire per entrare. */
  indirizzo: string;
  /** Il codice da scrivere su quella pagina (Codex). */
  codice?: string;
  /** Vero se, dopo l'accesso, il sito dà un codice da incollare in Shinka (Claude). */
  chiedeCodice: boolean;
}

/** Ciò che il centro chiede a un ambiente sugli accessi. */
export type RichiestaAccessi =
  | { tipo: "stato" }
  | { tipo: "avvia"; motore: Motore }
  | { tipo: "codice"; motore: Motore; codice: string }
  | { tipo: "annulla"; motore: Motore }
  | { tipo: "esci"; motore: Motore };

/** Ciò che l'ambiente risponde: com'è adesso, l'accesso cominciato, o perché non si è potuto. */
export interface EsitoAccessi {
  accessi?: Partial<Record<Motore, AccessoDelMotore>>;
  inCorso?: AccessoInCorso[];
  motivo?: string;
}

/** Il codice che il sito di Anthropic dà dopo l'accesso: lettere, cifre e pochi segni, su una riga. */
export const CODICE_MASSIMO = 500;

export function leggiRichiestaAccessi(valore: unknown): RichiestaAccessi | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { tipo, motore, codice } = valore as Record<string, unknown>;
  if (tipo === "stato") return { tipo };
  if (!eMotore(motore)) return undefined;
  if (tipo === "avvia" || tipo === "annulla" || tipo === "esci") return { tipo, motore };
  if (tipo === "codice" && typeof codice === "string" && codice.trim() !== "" && codice.length <= CODICE_MASSIMO && !/[\r\n]/.test(codice.trim())) {
    return { tipo, motore, codice: codice.trim() };
  }
  return undefined;
}

function leggiStato(valore: unknown): AccessoDelMotore | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { collegato, descrizione, motivo } = valore as Record<string, unknown>;
  if (collegato === true) return { collegato: true, descrizione: typeof descrizione === "string" ? descrizione.slice(0, 200) : "" };
  if (collegato === false) return { collegato: false, ...(typeof motivo === "string" ? { motivo: motivo.slice(0, 500) } : {}) };
  return undefined;
}

function leggiInCorso(valore: unknown): AccessoInCorso | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { motore, indirizzo, codice, chiedeCodice } = valore as Record<string, unknown>;
  if (!eMotore(motore) || typeof indirizzo !== "string" || !/^https:\/\//.test(indirizzo) || indirizzo.length > 4000) return undefined;
  return {
    motore,
    indirizzo,
    ...(typeof codice === "string" && codice.length <= 100 ? { codice } : {}),
    chiedeCodice: chiedeCodice === true,
  };
}

/** Legge un esito arrivato da un nodo; undefined se non è fatto come deve. */
export function leggiEsitoAccessi(valore: unknown): EsitoAccessi | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const campi = valore as Record<string, unknown>;
  const esito: EsitoAccessi = {};
  if (typeof campi.accessi === "object" && campi.accessi !== null) {
    const accessi: Partial<Record<Motore, AccessoDelMotore>> = {};
    for (const [motore, stato] of Object.entries(campi.accessi)) {
      const letto = leggiStato(stato);
      if (eMotore(motore) && letto !== undefined) accessi[motore] = letto;
    }
    esito.accessi = accessi;
  }
  if (Array.isArray(campi.inCorso)) {
    esito.inCorso = campi.inCorso.map(leggiInCorso).filter((voce): voce is AccessoInCorso => voce !== undefined);
  }
  if (typeof campi.motivo === "string") esito.motivo = campi.motivo.slice(0, 1000);
  return esito;
}

/** Gli accessi di un ambiente come li vede la pagina Impostazioni. */
export interface AccessiDiUnAmbiente {
  id: string;
  nome: string;
  /** Vero se il suo nodo è collegato (l'ambiente del centro lo è sempre). */
  attivo: boolean;
  delCentro: boolean;
  /** Ciò che l'ambiente ha risposto; manca se è spento. */
  esito?: EsitoAccessi;
}

/** Il motore predefinito dell'installazione, come lo mostra la pagina Impostazioni. */
export interface MotorePredefinitoVisto {
  /** Quello scelto nella pagina, se c'è. */
  scelto?: Motore;
  /** Quello della variabile SHINKA_MOTORE, che vale se nella pagina non se ne sceglie uno. */
  variabile: Motore;
}

/** Ciò che la pagina Impostazioni mostra dell'installazione. */
export interface ImpostazioniViste {
  motore: MotorePredefinitoVisto;
  /** L'ambiente del centro: nome e descrizione si cambiano dalla pagina, il resto no. */
  ambiente: {
    nome: string;
    descrizione: string;
    sistema: string;
    radiceProgetti: string;
    /** Vero se nome o descrizione sono stati scelti nella pagina, e non vengono dalle variabili. */
    nomeScelto: boolean;
    descrizioneScelta: boolean;
  };
}
