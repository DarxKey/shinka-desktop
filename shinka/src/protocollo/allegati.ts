/** Immagini e file che viaggiano con una conversazione. Dati semplici, serializzabili in JSON. */

/** Un'immagine in una conversazione: prodotta da un'azione di Claude o allegata dal proprietario. */
export interface Immagine {
  /** Tipo del contenuto, per esempio `image/png`. */
  tipo: string;
  /** Il contenuto in base64: presente solo in viaggio, prima che il centro la prenda in custodia. */
  dati?: string;
  /** Il nome con cui il centro la conserva. */
  id?: string;
}

/** I soli tipi di immagine che Claude vede e che l'interfaccia mostra, con la loro estensione. */
export const TIPI_IMMAGINE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function eImmagine(tipo: string): boolean {
  return Object.hasOwn(TIPI_IMMAGINE, tipo);
}

/** Un file che il proprietario allega a un messaggio. */
export interface Allegato {
  nome: string;
  tipo: string;
  /** Il contenuto in base64. */
  dati: string;
}

export const ALLEGATI_MASSIMI = 8;

/** Peso massimo di tutti gli allegati di un messaggio, in caratteri di base64: circa 9 MB di file. */
export const PESO_MASSIMO_ALLEGATI = 12 * 1024 * 1024;

/** Riconosce gli allegati arrivati da fuori; nulla se non sono ben formati o pesano troppo. */
export function leggiAllegati(valore: unknown): Allegato[] | undefined {
  if (valore === undefined) return [];
  if (!Array.isArray(valore) || valore.length > ALLEGATI_MASSIMI) return undefined;
  const allegati: Allegato[] = [];
  let peso = 0;
  for (const voce of valore as unknown[]) {
    if (typeof voce !== "object" || voce === null) return undefined;
    const { nome, tipo, dati } = voce as Record<string, unknown>;
    if (typeof nome !== "string" || typeof tipo !== "string" || typeof dati !== "string") return undefined;
    if (nome.trim() === "" || nome.length > 200 || tipo.length > 100) return undefined;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dati)) return undefined;
    peso += dati.length;
    if (peso > PESO_MASSIMO_ALLEGATI) return undefined;
    allegati.push({ nome, tipo, dati });
  }
  return allegati;
}

/**
 * Il nome con cui un file allegato viene salvato: solo l'ultima parte del percorso,
 * senza caratteri che su Windows o Linux darebbero problemi, mai un nome nascosto o vuoto.
 */
export function nomeSicuro(nome: string): string {
  const ultimo = nome.split(/[\\/]/).at(-1) ?? "";
  const pulito = ultimo
    .normalize("NFC")
    .replace(/[\p{Cc}<>:"|?*]/gu, "_")
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "")
    .slice(0, 120);
  return pulito === "" ? "allegato" : pulito;
}
