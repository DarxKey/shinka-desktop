/**
 * Le parole che la chat mostra mentre Claude lavora: una per volta, a caso, seguita dai puntini.
 * Sono solo dell'interfaccia: non entrano nei messaggi, nell'archivio né su Telegram.
 *
 * Il tono l'ha scelto il proprietario: slang tra amici, parolacce comprese. Bestemmie e insulti a
 * gruppi di persone no.
 *
 * Per cambiarle basta questo file: una voce per riga, che comincia con un gerundio, senza puntini.
 */
export const PAROLE_BUFFE: readonly string[] = [
  "Cazzeggiando",
  "Smanettando a cazzo",
  "Grattandomi le palle",
  "Sbattendomi",
  "Rompendomi le palle",
  "Spaccandomi il culo",
  "Facendo un culo così",
  "Sputando sangue",
  "Sgobbando come un mulo",
  "Sudando sette camicie",
  "Cagandomi addosso",
  "Smerdando i bug",
  "Sfanculando i bug",
  "Mandando a fanculo il compilatore",
  "Incazzandomi col codice",
  "Imprecando a bassa voce",
  "Stramaledicendo",
  "Sbroccando",
  "Sclerando",
  "Svalvolando",
  "Sbarellando",
  "Smattando",
  "Scazzando",
  "Rosicando",
  "Svaccando",
  "Ravanando",
  "Spippolando",
  "Arrabattandomi",
  "Arrangiandomi alla cazzo di cane",
  "Cavandomela alla meno peggio",
  "Tirando a campare",
  "Andando di culo",
  "Menandola",
  "Rincoglionendomi",
  "Rimbambendomi",
  "Fottendomi il cervello",
  "Fumandomi il cervello",
  "Sputtanando token",
  "Sputtanandomi la RAM",
  "Sbattendomene",
  "Fregandomene un attimo",
  "Paraculando",
  "Facendo il figo",
  "Sghignazzando",
  "Ruttando",
  "Scoreggiando di nascosto",
  "Scaccolandomi",
  "Sbavando sul codice",
  "Annaspando",
  "Arrancando",
  "Sguazzando nel casino",
  "Facendo casino",
  "Sgamando i bug",
  "Sciallando",
  "Flexando",
  "Spaccando",
  "Bombando",
  "Cringiando",
  "Stordendomi di caffè",
  "Minchioneggiando",
  "Smaronandomi",
  "Tirando giù il server di casa",
];

/** Ogni quanto la parola cambia. */
export const CAMBIO_PAROLA_MS = 3500;

/**
 * Una parola a caso, diversa da quella mostrata adesso: due volte di fila la stessa sembrerebbe
 * un'interfaccia ferma. Il caso arriva da fuori, tra 0 compreso e 1 escluso, così si può provare.
 */
export function altraParola(
  precedente?: string,
  caso: () => number = Math.random,
  parole: readonly string[] = PAROLE_BUFFE,
): string {
  const candidate = parole.length > 1 ? parole.filter((parola) => parola !== precedente) : parole;
  const indice = Math.min(candidate.length - 1, Math.max(0, Math.floor(caso() * candidate.length)));
  return candidate[indice] ?? "Cazzeggiando";
}

/** Da quanto silenzio in poi la riga lo dice. */
export const SILENZIO_DA_DIRE_MS = 2 * 60 * 1000;

/** Il silenzio in parole: "nessuna novità da 2 minuti"; undefined finché non è abbastanza lungo. */
export function silenzioInParole(silenzioMs: number): string | undefined {
  if (silenzioMs < SILENZIO_DA_DIRE_MS) return undefined;
  const minuti = Math.floor(silenzioMs / 60_000);
  return `nessuna novità da ${minuti} minut${minuti === 1 ? "o" : "i"}`;
}
