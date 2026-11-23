/**
 * La disposizione dei terminali di un luogo (ADR 0005): schede, e in ogni scheda uno o più
 * riquadri affiancati o impilati. È ciò che si ricorda tra un'apertura e l'altra dell'app: le
 * shell no, quelle ripartono nuove.
 */

export type Verso = "affiancati" | "impilati";

export interface Riquadro {
  id: string;
  /** La shell scelta, tra quelle di questo PC. Se manca, o non c'è più, parte quella predefinita. */
  shell?: string;
}

export interface Scheda {
  id: string;
  verso: Verso;
  riquadri: Riquadro[];
  /** Il riquadro in cui si stava scrivendo. */
  attivo: string;
}

export interface Disposizione {
  schede: Scheda[];
  /** La scheda in vista. */
  attiva: string | undefined;
}

/** Quanti riquadri può avere una scheda: oltre, non ci si legge più. */
export const RIQUADRI_MASSIMI = 4;
/** Quante schede può avere un luogo. */
export const SCHEDE_MASSIME = 12;

export const VUOTA: Disposizione = { schede: [], attiva: undefined };

let contatore = 0;

function nuovoId(): string {
  contatore += 1;
  return `r${Date.now().toString(36)}${contatore.toString(36)}`;
}

function riquadro(shell: string | undefined): Riquadro {
  return { id: nuovoId(), ...(shell === undefined ? {} : { shell }) };
}

/** Il luogo dei terminali per ciò che si sta guardando: un progetto ha i suoi, tutto il resto è la Home. */
export function luogoDi(vista: { tipo: string; id?: string }): string {
  return vista.tipo === "progetto" && typeof vista.id === "string" ? `progetto:${vista.id}` : "home";
}

/** L'identificativo del progetto di un luogo, se è un progetto. */
export function progettoDi(luogo: string): string | undefined {
  return luogo.startsWith("progetto:") ? luogo.slice("progetto:".length) : undefined;
}

export function conNuovaScheda(disposizione: Disposizione, shell?: string): Disposizione {
  if (disposizione.schede.length >= SCHEDE_MASSIME) return disposizione;
  const primo = riquadro(shell);
  const scheda: Scheda = { id: nuovoId(), verso: "affiancati", riquadri: [primo], attivo: primo.id };
  return { schede: [...disposizione.schede, scheda], attiva: scheda.id };
}

/** Divide la scheda in vista: un riquadro nuovo accanto o sotto a quello in cui si stava scrivendo. */
export function conDivisione(disposizione: Disposizione, verso: Verso, shell?: string): Disposizione {
  const scheda = disposizione.schede.find((voce) => voce.id === disposizione.attiva);
  if (scheda === undefined) return conNuovaScheda(disposizione, shell);
  if (scheda.riquadri.length >= RIQUADRI_MASSIMI) return disposizione;
  const nuovo = riquadro(shell ?? scheda.riquadri.find((voce) => voce.id === scheda.attivo)?.shell);
  const dove = scheda.riquadri.findIndex((voce) => voce.id === scheda.attivo);
  const riquadri = [...scheda.riquadri];
  riquadri.splice(dove < 0 ? riquadri.length : dove + 1, 0, nuovo);
  return { ...disposizione, schede: disposizione.schede.map((voce) => (voce.id === scheda.id ? { ...voce, verso, riquadri, attivo: nuovo.id } : voce)) };
}

/** Toglie un riquadro; una scheda rimasta senza riquadri se ne va, e in vista passa quella accanto. */
export function senzaRiquadro(disposizione: Disposizione, idRiquadro: string): Disposizione {
  const dove = disposizione.schede.findIndex((scheda) => scheda.riquadri.some((voce) => voce.id === idRiquadro));
  const scheda = disposizione.schede[dove];
  if (scheda === undefined) return disposizione;
  const riquadri = scheda.riquadri.filter((voce) => voce.id !== idRiquadro);
  if (riquadri.length === 0) return senzaScheda(disposizione, scheda.id);
  const attivo = scheda.attivo === idRiquadro ? (riquadri[Math.max(0, scheda.riquadri.findIndex((voce) => voce.id === idRiquadro) - 1)]?.id ?? "") : scheda.attivo;
  return { ...disposizione, schede: disposizione.schede.map((voce) => (voce.id === scheda.id ? { ...voce, riquadri, attivo } : voce)) };
}

export function senzaScheda(disposizione: Disposizione, idScheda: string): Disposizione {
  const dove = disposizione.schede.findIndex((scheda) => scheda.id === idScheda);
  if (dove < 0) return disposizione;
  const schede = disposizione.schede.filter((scheda) => scheda.id !== idScheda);
  const attiva = disposizione.attiva === idScheda ? (schede[Math.min(dove, schede.length - 1)]?.id ?? undefined) : disposizione.attiva;
  return { schede, attiva };
}

export function conSchedaInVista(disposizione: Disposizione, idScheda: string): Disposizione {
  return disposizione.schede.some((scheda) => scheda.id === idScheda) ? { ...disposizione, attiva: idScheda } : disposizione;
}

export function conRiquadroAttivo(disposizione: Disposizione, idRiquadro: string): Disposizione {
  const scheda = disposizione.schede.find((voce) => voce.riquadri.some((r) => r.id === idRiquadro));
  if (scheda === undefined || scheda.attivo === idRiquadro) return disposizione;
  return { ...disposizione, schede: disposizione.schede.map((voce) => (voce.id === scheda.id ? { ...voce, attivo: idRiquadro } : voce)) };
}

/**
 * Rilegge una disposizione salvata. I riquadri prendono identificativi nuovi: sono shell nuove.
 * Ciò che non si capisce si lascia perdere.
 */
export function daSalvata(testo: string | null): Disposizione {
  if (testo === null) return VUOTA;
  try {
    const letta = JSON.parse(testo) as { schede?: unknown; attiva?: unknown };
    if (!Array.isArray(letta.schede)) return VUOTA;
    const schede: Scheda[] = [];
    let attiva: string | undefined;
    for (const [indice, voce] of (letta.schede as { verso?: unknown; shell?: unknown }[]).slice(0, SCHEDE_MASSIME).entries()) {
      if (typeof voce !== "object" || voce === null || !Array.isArray(voce.shell)) continue;
      const riquadri = (voce.shell as unknown[]).slice(0, RIQUADRI_MASSIMI).map((shell) => riquadro(typeof shell === "string" ? shell : undefined));
      const primo = riquadri[0];
      if (primo === undefined) continue;
      const scheda: Scheda = { id: nuovoId(), verso: voce.verso === "impilati" ? "impilati" : "affiancati", riquadri, attivo: primo.id };
      schede.push(scheda);
      if (letta.attiva === indice) attiva = scheda.id;
    }
    return { schede, attiva: attiva ?? schede[0]?.id };
  } catch {
    return VUOTA;
  }
}

/** Ciò che di una disposizione si salva: per ogni scheda il verso e le shell dei riquadri. */
export function daSalvare(disposizione: Disposizione): string {
  return JSON.stringify({
    schede: disposizione.schede.map((scheda) => ({ verso: scheda.verso, shell: scheda.riquadri.map((voce) => voce.shell ?? null) })),
    attiva: disposizione.schede.findIndex((scheda) => scheda.id === disposizione.attiva),
  });
}
