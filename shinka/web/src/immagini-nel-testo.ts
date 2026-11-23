/**
 * Come si dispongono le immagini scritte nel testo di una risposta: un paragrafo o una voce di
 * elenco che comincia con un'immagine e continua con del testo è una scheda, con la foto a sinistra;
 * uno fatto solo di immagini le mostra grandi, una accanto all'altra.
 */

/** Il nodo dell'albero HTML che react-markdown passa ai componenti: qui servono solo i figli. */
export interface NodoHtml {
  type: string;
  tagName?: string;
  value?: string;
  children?: NodoHtml[];
}

function vuoto(nodo: NodoHtml): boolean {
  return nodo.type === "text" && (nodo.value ?? "").trim() === "";
}

/** Vero se il nodo è un'immagine, anche dentro un collegamento che contiene solo quella. */
function eImmagine(nodo: NodoHtml): boolean {
  if (nodo.type !== "element") return false;
  if (nodo.tagName === "img") return true;
  if (nodo.tagName !== "a") return false;
  const dentro = (nodo.children ?? []).filter((figlio) => !vuoto(figlio));
  return dentro.length === 1 && eImmagine(dentro[0]!);
}

/** La classe del paragrafo o della voce: "con-immagine", "solo-immagini", oppure nessuna. */
export function disposizioneImmagini(nodo: NodoHtml | undefined): string | undefined {
  // Gli a capo e la casella di una voce da spuntare non contano.
  const figli = (nodo?.children ?? []).filter((figlio) => !vuoto(figlio) && !(figlio.type === "element" && (figlio.tagName === "input" || figlio.tagName === "br")));
  const primo = figli[0];
  if (primo === undefined || !eImmagine(primo)) return undefined;
  return figli.every(eImmagine) ? "solo-immagini" : "con-immagine";
}
