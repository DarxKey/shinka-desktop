/** Quali indirizzi sono flussi che l'app serve dalla cache, invece di chiederli al centro così come sono. */

const BASE_DI_CONVERSAZIONE = /^(\/api\/(?:home|progetti\/[^/]+|argomenti\/[^/]+))\/eventi$/;

/**
 * Che cosa seguire per un indirizzo: `quadro`, la base di una conversazione, o nulla se non è uno
 * dei flussi dell'app. `pagina` è l'indirizzo della pagina che lo chiede.
 */
export function flussoDi(indirizzo: string, pagina: string): string | undefined {
  let url: URL;
  let qui: URL;
  try {
    qui = new URL(pagina);
    url = new URL(indirizzo, pagina);
  } catch {
    return undefined;
  }
  if (url.protocol !== qui.protocol || url.host !== qui.host || url.search !== "") return undefined;
  if (url.pathname === "/api/quadro/eventi") return "quadro";
  return BASE_DI_CONVERSAZIONE.exec(url.pathname)?.[1];
}
