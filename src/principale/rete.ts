/**
 * Quando un centro si può raggiungere in chiaro. In https sempre; in http solo se sta su questo PC
 * o nella rete di casa, dove la password e il gettone non attraversano Internet.
 */

/** Vero se un nome o un indirizzo è di questo PC o di una rete privata. */
export function eInCasa(nome: string): boolean {
  const pulito = nome.toLowerCase().replace(/^\[|\]$/g, "");
  if (pulito === "localhost" || pulito.endsWith(".localhost") || pulito === "::1") return true;
  const parti = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(pulito);
  if (parti !== null) {
    const [a, b] = [Number(parti[1]), Number(parti[2])];
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (pulito.includes(":")) return /^f[cd]/.test(pulito) || pulito.startsWith("fe80:");
  // Un nome senza punti, o che finisce in `.local` o `.lan`, lo risolve la rete di casa.
  return !pulito.includes(".") || pulito.endsWith(".local") || pulito.endsWith(".lan") || pulito.endsWith(".home.arpa");
}

/** Vero se a questo indirizzo del centro ci si può collegare: in https, oppure in http restando in casa. */
export function siPuoRaggiungere(indirizzo: string): boolean {
  try {
    const { protocol, hostname } = new URL(indirizzo);
    return protocol === "https:" || (protocol === "http:" && eInCasa(hostname));
  } catch {
    return false;
  }
}
