/**
 * Che cosa fa il pulsante accanto al campo di scrittura: è uno solo, e cambia. Con qualcosa da
 * mandare manda, anche mentre Claude lavora; mentre Claude lavora e non c'è nulla da mandare lo
 * ferma; mentre un messaggio sta partendo aspetta.
 */
export type ModoDelPulsante = "invia" | "interrompi" | "in-invio" | "spento";

export function modoDelPulsante(stato: { occupata: boolean; invio: boolean; daMandare: boolean; bloccata: boolean }): ModoDelPulsante {
  if (stato.invio) return "in-invio";
  if (stato.bloccata) return "spento";
  if (stato.daMandare) return "invia";
  return stato.occupata ? "interrompi" : "spento";
}
