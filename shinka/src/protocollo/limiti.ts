/**
 * Il limite del piano: quando una conversazione lo ha esaurito, e quando si azzera. Lo usano
 * l'interfaccia, che tiene in coda il messaggio, e i lavori programmati, che aspettano e ripartono.
 */

import type { StatoConversazione } from "./impostazioni.ts";

/** Il turno si è fermato per il limite del piano; `azzeraIl` manca se non si sa quando si azzera. */
export interface LimiteRaggiunto {
  azzeraIl?: string;
}

/**
 * Se il piano è al limite, quando si azzera: il più lontano tra i limiti esauriti. Undefined se
 * non c'è limite raggiunto, o se non si sa quando si azzera.
 */
export function quandoRiparte(limiti: StatoConversazione["limiti"], adesso: Date = new Date()): string | undefined {
  const esauriti = [limiti?.cinqueOre, limiti?.setteGiorni].filter(
    (finestra) => finestra !== undefined && finestra.percento >= 100 && finestra.azzeraIl !== undefined && Date.parse(finestra.azzeraIl) > adesso.getTime(),
  );
  const momenti = esauriti.map((finestra) => finestra?.azzeraIl ?? "").sort();
  return momenti.at(-1);
}

/**
 * Se l'errore con cui un turno si è chiuso dice che il limite del piano è esaurito. L'harness lo
 * scrive in più modi: «Claude AI usage limit reached|<secondi>», con il momento in cui si azzera, o
 * «You've hit your limit · resets 3pm», di cui l'ora non si legge con certezza.
 */
export function limiteNelMessaggio(testo: string | undefined): LimiteRaggiunto | undefined {
  if (testo === undefined) return undefined;
  const conIlMomento = /usage limit reached\|(\d{9,11})/i.exec(testo);
  if (conIlMomento !== null) return { azzeraIl: new Date(Number(conIlMomento[1]) * 1000).toISOString() };
  if (/usage limit|hit your (?:[\w-]+ )*limit|limit reached|rate limit|limite (?:del piano|di utilizzo)/i.test(testo)) return {};
  return undefined;
}
