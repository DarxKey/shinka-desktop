import { createContext, useContext } from "react";
import { BASE_HOME, type RiferimentoElaborato } from "./api.ts";

/** Ciò che serve sapere della conversazione a chi, dentro la chat, deve chiamare il centro. */
export interface ContestoDellaChat {
  /** Indirizzo di base della conversazione: quella della Home, di un argomento o di un progetto. */
  base: string;
  /** Vero se la conversazione si può solo rileggere, come un argomento archiviato. */
  solaLettura: boolean;
  /** Apre accanto alla chat l'anteprima che Claude ha proposto. Manca dove l'anteprima non c'è. */
  apriAnteprima?: (porta: number, percorso: string) => void;
  /** Apre accanto alla chat un elaborato. Manca dove il pannello degli elaborati non c'è. */
  apriElaborato?: (riferimento: RiferimentoElaborato) => void;
  /** Apre il pannello Modifiche su un turno. Manca dove il pannello non c'è. */
  apriModifiche?: (idTurno: string) => void;
  /** Vero mentre Claude lavora: allora non si modifica nulla. */
  occupata?: boolean;
  /** L'ultimo messaggio del proprietario che si può modificare: "Rigenera" riparte da lì. */
  ultimoModificabile?: { id: string; testo: string };
  /** L'ultima risposta di Claude: lei sola ha "Rigenera". */
  ultimaRisposta?: string;
}

const ContestoChat = createContext<ContestoDellaChat>({ base: BASE_HOME, solaLettura: false });

export const FornitoreChat = ContestoChat.Provider;

/** A quale conversazione appartiene ciò che si vede nella chat. */
export function useBaseDellaChat(): string {
  return useContext(ContestoChat).base;
}

export function useSolaLettura(): boolean {
  return useContext(ContestoChat).solaLettura;
}

export function useApriAnteprima(): ((porta: number, percorso: string) => void) | undefined {
  return useContext(ContestoChat).apriAnteprima;
}

export function useModifiche(): { occupata: boolean; ultimoModificabile: { id: string; testo: string } | undefined; ultimaRisposta: string | undefined } {
  const contesto = useContext(ContestoChat);
  return { occupata: contesto.occupata === true, ultimoModificabile: contesto.ultimoModificabile, ultimaRisposta: contesto.ultimaRisposta };
}

export function useApriModifiche(): ((idTurno: string) => void) | undefined {
  return useContext(ContestoChat).apriModifiche;
}

export function useApriElaborato(): ((riferimento: RiferimentoElaborato) => void) | undefined {
  return useContext(ContestoChat).apriElaborato;
}
