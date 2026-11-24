/**
 * I messaggi non ancora partiti: la bozza nel campo, che resta dopo un ricaricamento, e il
 * messaggio scritto quando il piano è al limite, che aspetta il momento in cui il limite si azzera
 * e intanto si può cambiare. Stanno nel browser, per conversazione.
 */


/** Un messaggio che aspetta il limite: il testo e quando partirà. */
export interface MessaggioInCoda {
  testo: string;
  partiAlle: string;
}

const chiaveBozza = (base: string): string => `shinka.bozza.${base}`;
const chiaveCoda = (base: string): string => `shinka.inCoda.${base}`;

function memoria(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function leggiBozza(base: string): string {
  return memoria()?.getItem(chiaveBozza(base)) ?? "";
}

export function scriviBozza(base: string, testo: string): void {
  try {
    if (testo.trim() === "") memoria()?.removeItem(chiaveBozza(base));
    else memoria()?.setItem(chiaveBozza(base), testo);
  } catch {
    // Senza memoria del browser la bozza vale finché la pagina resta aperta.
  }
}

export function leggiInCoda(base: string): MessaggioInCoda | undefined {
  try {
    const letto = JSON.parse(memoria()?.getItem(chiaveCoda(base)) ?? "null") as Partial<MessaggioInCoda> | null;
    return typeof letto?.testo === "string" && typeof letto.partiAlle === "string" ? { testo: letto.testo, partiAlle: letto.partiAlle } : undefined;
  } catch {
    return undefined;
  }
}

export function scriviInCoda(base: string, messaggio: MessaggioInCoda | undefined): void {
  try {
    if (messaggio === undefined) memoria()?.removeItem(chiaveCoda(base));
    else memoria()?.setItem(chiaveCoda(base), JSON.stringify(messaggio));
  } catch {
    // Senza memoria del browser il messaggio in coda vale finché la pagina resta aperta.
  }
}

/** Se il piano è al limite, quando si azzera: sta nel protocollo, perché lo usano anche i lavori programmati. */
export { quandoRiparte } from "../../src/protocollo/limiti.ts";
