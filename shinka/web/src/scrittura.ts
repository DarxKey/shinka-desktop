/**
 * Le regole del campo di scrittura e dei messaggi del proprietario: andare a capo continuando un
 * elenco, e mostrare un messaggio con i suoi a capo e i suoi elenchi. Funzioni pure.
 */

/** Una riga che comincia un elemento di elenco: rientro, segno (-, *, • o un numero) e testo. */
const ELEMENTO = /^(\s*)([-*•]|\d{1,3}[.)])(\s+)(.*)$/;

/**
 * Va a capo nel punto in cui c'è il cursore. Se la riga è un elemento di elenco, la riga nuova
 * comincia con lo stesso segno (un numero cresce di uno); se l'elemento è vuoto, l'elenco finisce
 * e il segno sparisce. Restituisce il testo nuovo e dove va il cursore.
 */
export function aCapo(testo: string, inizio: number, fine: number = inizio): { testo: string; cursore: number } {
  const prima = testo.slice(0, inizio);
  const dopo = testo.slice(fine);
  const inizioRiga = prima.lastIndexOf("\n") + 1;
  const riga = prima.slice(inizioRiga);
  const elemento = ELEMENTO.exec(riga);
  if (elemento === null) return { testo: `${prima}\n${dopo}`, cursore: inizio + 1 };
  const [, rientro = "", segno = "-", spazio = " ", contenuto = ""] = elemento;
  if (contenuto.trim() === "" && dopo.split("\n")[0]?.trim() === "") {
    // Un elemento vuoto chiude l'elenco: resta la riga, senza segno.
    return { testo: `${prima.slice(0, inizioRiga)}${dopo}`, cursore: inizioRiga };
  }
  const numero = /^(\d+)([.)])$/.exec(segno);
  const segnoNuovo = numero === null ? segno : `${Number(numero[1]) + 1}${numero[2]}`;
  const aggiunta = `\n${rientro}${segnoNuovo}${spazio}`;
  return { testo: `${prima}${aggiunta}${dopo}`, cursore: inizio + aggiunta.length };
}

/**
 * Il testo di un messaggio del proprietario pronto per il Markdown: ogni a capo resta un a capo,
 * come l'ha scritto. Il Markdown di suo unirebbe due righe vicine in una; dentro un blocco di
 * codice le righe restano come sono.
 */
export function conGliACapo(testo: string): string {
  const righe = testo.replace(/\r\n/g, "\n").split("\n");
  let nelCodice = false;
  return righe
    .map((riga, posizione) => {
      if (/^\s*(```|~~~)/.test(riga)) {
        nelCodice = !nelCodice;
        return riga;
      }
      const seguente = righe[posizione + 1];
      if (nelCodice || seguente === undefined || riga.trim() === "" || seguente.trim() === "") return riga;
      // Dopo un elenco, una riga che non ne fa parte comincia un paragrafo suo: senza la riga
      // vuota il Markdown la metterebbe dentro l'ultimo elemento.
      if (ELEMENTO.test(riga) && !ELEMENTO.test(seguente) && !/^\s/.test(seguente)) return `${riga}\n`;
      // Due spazi in fondo alla riga: per il Markdown è un a capo.
      return `${riga.replace(/\s+$/, "")}  `;
    })
    .join("\n");
}
