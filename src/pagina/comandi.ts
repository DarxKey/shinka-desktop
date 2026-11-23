/**
 * I comandi dell'app nella pagina: arrivano dalla tastiera, dal menu dell'app e dalla palette, e
 * li esegue chi li sa fare (i terminali, la cornice). L'elenco è in `src/ponte/scorciatoie.ts`.
 */

import { SCORCIATOIE, comandoDelTasto, tastiInParole, type Comando } from "../ponte/scorciatoie.ts";
import { ponte } from "./ponte.ts";

const ascoltatori = new Set<(comando: Comando) => void>();

export function esegui(comando: Comando): void {
  for (const ascoltatore of [...ascoltatori]) ascoltatore(comando);
}

/** Ascolta i comandi. Restituisce la funzione per smettere. */
export function alComando(ascolta: (comando: Comando) => void): () => void {
  ascoltatori.add(ascolta);
  return () => ascoltatori.delete(ascolta);
}

/** Il testo per il suggerimento di un pulsante, con i tasti che fanno lo stesso. */
export function conITasti(testo: string, comando: Comando): string {
  const voce = SCORCIATOIE.find((una) => una.comando === comando);
  return voce === undefined ? testo : `${testo} (${tastiInParole(voce.tasti)})`;
}

/** Porta a scrivere nella conversazione a schermo. */
export function tornaAllaChat(): void {
  document.querySelector<HTMLElement>(".desktop-shinka textarea")?.focus();
}

/** Vero se si sta scrivendo in un terminale: lì i tasti semplici sono della shell. */
export function nelTerminale(bersaglio: EventTarget | null): boolean {
  return bersaglio instanceof Element && bersaglio.closest(".terminali") !== null;
}

/** Da chiamare una volta, all'avvio della pagina. */
export function ascoltaTastieraEMenu(): void {
  ponte.alComando(esegui);
  // Prima di tutti: un tasto che è un comando non arriva né alla pagina né alla shell.
  window.addEventListener(
    "keydown",
    (evento) => {
      // Un tasto finto è la palette che si apre da un comando: vedi `vai-a` in AppDesktop.
      if (!evento.isTrusted || evento.isComposing) return;
      const comando = comandoDelTasto(evento, nelTerminale(evento.target));
      // La palette la apre la pagina di Shinka, che ascolta lo stesso tasto.
      if (comando === undefined || comando === "vai-a") return;
      evento.preventDefault();
      evento.stopPropagation();
      esegui(comando);
    },
    true,
  );
}
