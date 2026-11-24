/**
 * Le fonti in fondo a una risposta: la sezione che comincia con «Fonti» (una riga, un titolo o una
 * parola in grassetto) e che contiene solo collegamenti. La chat la mostra chiusa sotto un pulsante,
 * per non allungare la risposta; il testo copiato resta intero.
 */

/** Come comincia la sezione: «Fonti:», «**Fonti**», «## Fonti», anche in inglese. */
const INIZIO = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:fonti|fonte|sources?)\s*(?:\*\*|__)?\s*:?\s*(?:\*\*|__)?\s*(.*)$/i;

/** Un collegamento in Markdown, o un indirizzo scritto così com'è. */
const COLLEGAMENTO = /\[[^\]]+\]\([^)\s]+\)|https?:\/\/\S+/g;

export interface ConFonti {
  corpo: string;
  /** La sezione delle fonti, senza la parola iniziale; manca se la risposta non ne ha. */
  fonti?: string;
  /** Quanti collegamenti ci sono. */
  quante: number;
}

/** Stacca dal fondo di una risposta la sezione delle fonti, se c'è ed è fatta solo di collegamenti. */
export function separaFonti(testo: string): ConFonti {
  const righe = testo.replace(/\s+$/, "").split("\n");
  for (let i = righe.length - 1; i >= 0 && i >= righe.length - 60; i--) {
    const trovato = INIZIO.exec(righe[i] ?? "");
    if (trovato === null) continue;
    const resto = [trovato[1] ?? "", ...righe.slice(i + 1)].filter((riga) => riga.trim() !== "");
    // Ogni riga dopo «Fonti» deve avere un collegamento: altrimenti è testo che parla di fonti.
    if (resto.length === 0 || !resto.every((riga) => (riga.match(COLLEGAMENTO)?.length ?? 0) > 0)) return { corpo: testo, quante: 0 };
    const quante = resto.reduce((somma, riga) => somma + (riga.match(COLLEGAMENTO)?.length ?? 0), 0);
    // Una riga sola con più fonti separate da virgole diventa un elenco.
    const fonti =
      resto.length === 1 && quante > 1 && !/^\s*[-*]\s/.test(resto[0] ?? "")
        ? (resto[0]?.match(COLLEGAMENTO) ?? []).map((uno) => `- ${uno}`).join("\n")
        : resto.join("\n");
    return { corpo: righe.slice(0, i).join("\n").replace(/\s+$/, ""), fonti, quante };
  }
  return { corpo: testo, quante: 0 };
}
