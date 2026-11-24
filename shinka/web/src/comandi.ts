/** Il menu "/" del campo di scrittura: quali comandi mostrare mentre il proprietario scrive. */

import type { ComandoDisponibile } from "../../src/protocollo/impostazioni.ts";

/** Quanti comandi il menu mostra al massimo. */
export const COMANDI_MOSTRATI = 8;

/**
 * I comandi da proporre per ciò che c'è nel campo: solo se comincia con "/" e non c'è ancora uno
 * spazio. Prima quelli il cui nome comincia con ciò che è scritto, poi quelli che lo contengono.
 */
export function comandiPer(bozza: string, comandi: readonly ComandoDisponibile[]): ComandoDisponibile[] {
  const scritto = /^\/(\S*)$/.exec(bozza)?.[1];
  if (scritto === undefined) return [];
  const cercato = scritto.toLowerCase();
  const iniziano = comandi.filter((comando) => comando.nome.toLowerCase().startsWith(cercato));
  const contengono = comandi.filter((comando) => !comando.nome.toLowerCase().startsWith(cercato) && comando.nome.toLowerCase().includes(cercato));
  return [...iniziano, ...contengono].slice(0, COMANDI_MOSTRATI);
}

/** Che cosa scrivere nel campo scegliendo un comando: con uno spazio dopo, se vuole qualcosa. */
export function testoDelComando(comando: ComandoDisponibile): string {
  return comando.argomenti === undefined ? `/${comando.nome}` : `/${comando.nome} `;
}
