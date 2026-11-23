/** Il filtro della palette dei comandi: quali voci mostrare per ciò che è scritto. */

/** Le voci che contengono tutte le parole scritte, senza maiuscole né accenti; prima quelle che cominciano così. */
export function filtraPalette<T extends { etichetta: string; genere: string; dettaglio?: string }>(voci: readonly T[], scritto: string): T[] {
  const semplice = (testo: string): string => testo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const parole = semplice(scritto).split(/\s+/).filter((parola) => parola !== "");
  if (parole.length === 0) return [...voci];
  const trovate = voci.filter((voce) => {
    const testo = semplice(`${voce.etichetta} ${voce.genere} ${voce.dettaglio ?? ""}`);
    return parole.every((parola) => testo.includes(parola));
  });
  const prima = parole[0] ?? "";
  return [...trovate.filter((voce) => semplice(voce.etichetta).startsWith(prima)), ...trovate.filter((voce) => !semplice(voce.etichetta).startsWith(prima))];
}
