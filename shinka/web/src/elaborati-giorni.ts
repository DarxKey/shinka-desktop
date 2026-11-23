/** Come la pagina degli elaborati li ritrova e li divide per giorno. */

import type { ElaboratoConsegnato } from "../../src/protocollo/elaborati.ts";
import type { RiferimentoElaborato } from "./api.ts";
import { giornoInBreve } from "./descrivi.ts";

/** La chiave con cui un elaborato si ritrova nell'indirizzo della pagina. */
export function chiaveElaborato(riferimento: Pick<RiferimentoElaborato, "idArgomento" | "idAmbiente" | "percorso">): string {
  return `${riferimento.idArgomento}~${riferimento.idAmbiente}~${riferimento.percorso}`;
}

/** Il giorno sotto cui sta un elaborato: oggi, ieri, oppure la data. */
export function giornoDelGruppo(quando: string, ora: Date = new Date()): string {
  const giorno = (data: Date): string => `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
  const data = new Date(quando);
  if (giorno(data) === giorno(ora)) return "Oggi";
  const ieri = new Date(ora);
  ieri.setDate(ora.getDate() - 1);
  if (giorno(data) === giorno(ieri)) return "Ieri";
  return giornoInBreve(quando, ora);
}

/** Gli elaborati divisi per giorno, nell'ordine in cui arrivano: dal più recente. */
export function perGiorno(elaborati: readonly ElaboratoConsegnato[], ora: Date = new Date()): { giorno: string; elaborati: ElaboratoConsegnato[] }[] {
  const gruppi: { giorno: string; elaborati: ElaboratoConsegnato[] }[] = [];
  for (const elaborato of elaborati) {
    const giorno = giornoDelGruppo(elaborato.quando, ora);
    const ultimo = gruppi.at(-1);
    if (ultimo?.giorno === giorno) ultimo.elaborati.push(elaborato);
    else gruppi.push({ giorno, elaborati: [elaborato] });
  }
  return gruppi;
}
