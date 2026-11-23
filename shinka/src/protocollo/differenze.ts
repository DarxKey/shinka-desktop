/**
 * Le differenze tra due versioni di un testo, riga per riga: quante righe sono state aggiunte e
 * tolte, e i pezzi cambiati con qualche riga intorno, come in un diff. Serve al nodo per contare le
 * modifiche di un turno e all'interfaccia per mostrarle. Algoritmo di Myers, con un tetto: oltre,
 * il testo vale come sostituito per intero.
 */

export type RigaDiDifferenza =
  | { tipo: "uguale"; testo: string; prima: number; dopo: number }
  | { tipo: "tolta"; testo: string; prima: number }
  | { tipo: "aggiunta"; testo: string; dopo: number };

/** Un pezzo cambiato, con le righe di contesto intorno. I numeri di riga partono da 1. */
export interface Blocco {
  righe: RigaDiDifferenza[];
}

/** Oltre questo numero di passi il confronto si arrende: il testo vale come sostituito per intero. */
const PASSI_MASSIMI = 2000;

export function righeDi(testo: string): string[] {
  if (testo === "") return [];
  const righe = testo.replace(/\r\n/g, "\n").split("\n");
  // L'a capo finale non fa una riga in più.
  if (righe.at(-1) === "") righe.pop();
  return righe;
}

/** Le righe dei due testi, nell'ordine, ciascuna uguale, tolta o aggiunta. */
export function confronta(prima: string, dopo: string): RigaDiDifferenza[] {
  const a = righeDi(prima);
  const b = righeDi(dopo);
  // Le righe uguali in testa e in coda non entrano nel confronto: è lì che di solito sta quasi tutto.
  let inizio = 0;
  while (inizio < a.length && inizio < b.length && a[inizio] === b[inizio]) inizio += 1;
  let fine = 0;
  while (fine < a.length - inizio && fine < b.length - inizio && a[a.length - 1 - fine] === b[b.length - 1 - fine]) fine += 1;
  const mezzo = myers(a.slice(inizio, a.length - fine), b.slice(inizio, b.length - fine));
  const esito: RigaDiDifferenza[] = [];
  for (let i = 0; i < inizio; i += 1) esito.push({ tipo: "uguale", testo: a[i] ?? "", prima: i + 1, dopo: i + 1 });
  let ia = inizio;
  let ib = inizio;
  for (const passo of mezzo) {
    if (passo === "=") {
      esito.push({ tipo: "uguale", testo: a[ia] ?? "", prima: ia + 1, dopo: ib + 1 });
      ia += 1;
      ib += 1;
    } else if (passo === "-") {
      esito.push({ tipo: "tolta", testo: a[ia] ?? "", prima: ia + 1 });
      ia += 1;
    } else {
      esito.push({ tipo: "aggiunta", testo: b[ib] ?? "", dopo: ib + 1 });
      ib += 1;
    }
  }
  for (let i = 0; i < fine; i += 1) esito.push({ tipo: "uguale", testo: a[ia + i] ?? "", prima: ia + i + 1, dopo: ib + i + 1 });
  return esito;
}

/** Quante righe sono state aggiunte e quante tolte. */
export function conta(prima: string, dopo: string): { aggiunte: number; tolte: number } {
  let aggiunte = 0;
  let tolte = 0;
  for (const riga of confronta(prima, dopo)) {
    if (riga.tipo === "aggiunta") aggiunte += 1;
    if (riga.tipo === "tolta") tolte += 1;
  }
  return { aggiunte, tolte };
}

/** I pezzi cambiati, ciascuno con `contesto` righe uguali prima e dopo; pezzi vicini si uniscono. */
export function blocchi(righe: readonly RigaDiDifferenza[], contesto = 3): Blocco[] {
  const cambiate = righe.flatMap((riga, posizione) => (riga.tipo === "uguale" ? [] : [posizione]));
  const esito: Blocco[] = [];
  let da = -1;
  let a = -1;
  for (const posizione of cambiate) {
    const inizio = Math.max(0, posizione - contesto);
    const fine = Math.min(righe.length - 1, posizione + contesto);
    if (da >= 0 && inizio <= a + 1) {
      a = Math.max(a, fine);
      continue;
    }
    if (da >= 0) esito.push({ righe: righe.slice(da, a + 1) });
    da = inizio;
    a = fine;
  }
  if (da >= 0) esito.push({ righe: righe.slice(da, a + 1) });
  return esito;
}

/** I passi per andare da `a` a `b`: "=" riga uguale, "-" tolta, "+" aggiunta. */
function myers(a: readonly string[], b: readonly string[]): string[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return Array<string>(m).fill("+");
  if (m === 0) return Array<string>(n).fill("-");
  const massimo = Math.min(n + m, PASSI_MASSIMI);
  const scostamento = massimo;
  let v = new Int32Array(2 * massimo + 2);
  const tracce: Int32Array[] = [];
  for (let d = 0; d <= massimo; d += 1) {
    // Di ogni passo serve solo la parte che il passo può aver toccato: così la memoria resta poca.
    tracce.push(v.slice(scostamento - d, scostamento + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[scostamento + k - 1] ?? 0) < (v[scostamento + k + 1] ?? 0))) x = v[scostamento + k + 1] ?? 0;
      else x = (v[scostamento + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[scostamento + k] = x;
      if (x >= n && y >= m) return ripercorri(tracce, n, m, d);
    }
  }
  // Troppo diversi: tutto tolto e tutto aggiunto.
  return [...Array<string>(n).fill("-"), ...Array<string>(m).fill("+")];
}

function ripercorri(tracce: Int32Array[], n: number, m: number, d: number): string[] {
  const passi: string[] = [];
  let x = n;
  let y = m;
  for (let passo = d; passo > 0; passo -= 1) {
    // La traccia del passo tiene i valori da -passo a passo: quello di k sta in k + passo.
    const v = tracce[passo] ?? new Int32Array(0);
    const k = x - y;
    const daSopra = k === -passo || (k !== passo && (v[k - 1 + passo] ?? 0) < (v[k + 1 + passo] ?? 0));
    const kPrima = daSopra ? k + 1 : k - 1;
    const xPrima = v[kPrima + passo] ?? 0;
    const yPrima = xPrima - kPrima;
    while (x > xPrima && y > yPrima) {
      passi.push("=");
      x -= 1;
      y -= 1;
    }
    passi.push(daSopra ? "+" : "-");
    x = xPrima;
    y = yPrima;
  }
  while (x > 0 && y > 0) {
    passi.push("=");
    x -= 1;
    y -= 1;
  }
  return passi.reverse();
}
