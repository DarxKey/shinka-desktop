/**
 * Dopo un'installazione il centro serve l'interfaccia nuova, ma la pagina già aperta continua a
 * usare quella con cui è stata caricata. Qui si capisce se le due sono diverse, dai nomi dei file
 * che la pagina servita adesso chiede: la costruzione li cambia quando cambia il loro contenuto.
 */

const RISORSA = /(?:src|href)="(\/assets\/[^"]+)"/g;

/** I file dell'interfaccia che una pagina chiede, in ordine. */
export function risorseDi(html: string): string[] {
  return [...html.matchAll(RISORSA)].map((trovata) => trovata[1] ?? "").sort();
}

/**
 * Vero se la pagina servita adesso chiede file diversi da quelli in uso. Falso anche quando non si
 * riesce a dirlo: una pagina senza file riconoscibili, come quella dello sviluppo, non invita a ricaricare.
 */
export function interfacciaCambiata(htmlServito: string, inUso: string[]): boolean {
  const serviti = risorseDi(htmlServito);
  const usati = inUso.filter((percorso) => percorso.startsWith("/assets/")).sort();
  if (serviti.length === 0 || usati.length === 0) return false;
  return serviti.length !== usati.length || serviti.some((percorso, indice) => percorso !== usati[indice]);
}

/** I file dell'interfaccia con cui questa pagina è stata caricata. */
export function risorseInUso(documento: Document): string[] {
  const percorsi: string[] = [];
  for (const elemento of documento.querySelectorAll('script[src], link[rel="stylesheet"][href]')) {
    const indirizzo = elemento.getAttribute("src") ?? elemento.getAttribute("href");
    if (indirizzo !== null) percorsi.push(new URL(indirizzo, documento.baseURI).pathname);
  }
  return percorsi;
}

/** Per quanto vale una risposta: più righe che lo chiedono insieme fanno una richiesta sola. */
const VALE_MS = 5_000;
let ultima: { quando: number; esito: Promise<boolean> } | undefined;

async function chiedi(): Promise<boolean> {
  try {
    const risposta = await fetch("/", { cache: "no-store", headers: { accept: "text/html" } });
    if (!risposta.ok) return false;
    return interfacciaCambiata(await risposta.text(), risorseInUso(document));
  } catch {
    return false;
  }
}

/** Chiede al centro la pagina com'è adesso e dice se l'interfaccia è cambiata rispetto a quella aperta. */
export function interfacciaDaRicaricare(): Promise<boolean> {
  if (ultima === undefined || Date.now() - ultima.quando > VALE_MS) ultima = { quando: Date.now(), esito: chiedi() };
  return ultima.esito;
}
