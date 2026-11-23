/**
 * Le pagine Uso e Archiviazione: quanti token hanno usato le conversazioni, giorno per giorno e una
 * per una, e quanto spazio occupano argomenti e progetti tra i dati di Shinka. Dati semplici, in JSON.
 */

import type { FinestraDiUtilizzo } from "./impostazioni.ts";

export interface UsoDelGiorno {
  /** AAAA-MM-GG, nel fuso del centro. */
  giorno: string;
  ingresso: number;
  uscita: number;
  turni: number;
}

export interface UsoDiUnaConversazione {
  /** "home" per un argomento della Home, "progetto" per un progetto. */
  genere: "home" | "progetto";
  id: string;
  nome: string;
  ingresso: number;
  uscita: number;
  turni: number;
}

export interface Uso {
  /** I giorni del periodo, dal più vecchio, anche quelli senza turni. */
  giorni: UsoDelGiorno[];
  /** Le conversazioni che hanno lavorato nel periodo, dalla più costosa. */
  conversazioni: UsoDiUnaConversazione[];
  limiti?: { cinqueOre?: FinestraDiUtilizzo; setteGiorni?: FinestraDiUtilizzo };
}

export interface SpazioDiUnaVoce {
  genere: "argomento" | "progetto";
  id: string;
  nome: string;
  /** La storia della conversazione. */
  byteStoria: number;
  /** I file che stanno tra i dati di Shinka: per un argomento la sua cartella nell'ambiente del centro, per un progetto le immagini. */
  byteFile: number;
  /** Per un argomento: archiviato, e quindi si può eliminare. Per un progetto: si può eliminare. */
  eliminabile: boolean;
  /** Quando è stato archiviato, o creato. */
  quando?: string;
}

export interface Archiviazione {
  voci: SpazioDiUnaVoce[];
  /** Vero se qualche cartella era troppo grande per contarla tutta: i numeri sono per difetto. */
  perDifetto: boolean;
}
