/**
 * La ricerca nel testo delle conversazioni tenute su questo PC (ADR 0003). Dà gli stessi risultati
 * della ricerca del centro (`src/centro/ricerca.ts` di Shinka): si cerca in ciò che il proprietario
 * ha scritto e in ciò che Claude ha risposto; ogni parola deve comparire nello stesso messaggio,
 * senza badare a maiuscole e accenti; prima i messaggi più recenti.
 */

import type { EventoArchiviato } from "../../shinka/src/protocollo/eventi.ts";
import type { Cache, Chiave } from "./cache.ts";

/** Dove sta una conversazione, per portarci il proprietario. */
export type DoveSiTrova = { tipo: "home" } | { tipo: "argomento"; id: string } | { tipo: "progetto"; id: string };

/** Un messaggio trovato, come lo aspetta la pagina Cerca del sito. */
export interface Trovato {
  dove: DoveSiTrova;
  titolo: string;
  quando: string;
  chi: "proprietario" | "claude";
  /** Il pezzo di testo intorno alla prima parola trovata. */
  estratto: string;
}

/** Quanti risultati al massimo, quanto testo intorno alla parola, e quanto può essere lunga la richiesta. */
export const RISULTATI_MASSIMI = 50;
const INTORNO = 70;
const CERCATO_MASSIMO = 200;

/** Il testo senza accenti e in minuscolo: è così che si confronta. */
export function semplice(testo: string): string {
  return testo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Le parole da cercare, già semplificate. */
export function paroleDi(cercato: string): string[] {
  return semplice(cercato.slice(0, CERCATO_MASSIMO))
    .split(/\s+/)
    .filter((parola) => parola.length > 0);
}

/** Il testo in cui si cerca, se l'evento ne ha uno, e di chi è. */
export function testoDaCercare(archiviato: EventoArchiviato): { chi: "proprietario" | "claude"; testo: string } | undefined {
  const { evento } = archiviato;
  if (evento.tipo === "messaggio-proprietario") return { chi: "proprietario", testo: evento.testo };
  if (evento.tipo === "testo-concluso") return { chi: "claude", testo: evento.testo };
  return undefined;
}

export function estrattoDi(testo: string, parola: string): string {
  const pulito = testo.replace(/\s+/g, " ").trim();
  const dove = Math.max(0, semplice(pulito).indexOf(parola));
  const inizio = Math.max(0, dove - INTORNO);
  const fine = Math.min(pulito.length, dove + parola.length + INTORNO);
  return `${inizio > 0 ? "…" : ""}${pulito.slice(inizio, fine)}${fine < pulito.length ? "…" : ""}`;
}

interface VoceConTitolo {
  id?: unknown;
  nome?: unknown;
  titolo?: unknown;
}

/** Di ogni conversazione del quadro tenuto in cache, dove sta e come si chiama. */
function conversazioniDelQuadro(cache: Cache): Map<Chiave, { dove: DoveSiTrova; titolo: string }> {
  const conversazioni = new Map<Chiave, { dove: DoveSiTrova; titolo: string }>();
  for (const { nome, dati } of cache.quadro()) {
    let letto: { progetti?: unknown; idAperto?: unknown; archiviati?: unknown };
    try {
      letto = JSON.parse(dati) as typeof letto;
    } catch {
      continue;
    }
    if (nome === "progetti" && Array.isArray(letto.progetti)) {
      for (const voce of letto.progetti as VoceConTitolo[]) {
        if (typeof voce.id === "string") conversazioni.set(`progetti/${voce.id}`, { dove: { tipo: "progetto", id: voce.id }, titolo: typeof voce.nome === "string" ? voce.nome : "Progetto" });
      }
    }
    if (nome === "argomenti") {
      if (typeof letto.idAperto === "string") conversazioni.set(`argomenti/${letto.idAperto}`, { dove: { tipo: "home" }, titolo: "Home" });
      if (Array.isArray(letto.archiviati)) {
        for (const voce of letto.archiviati as VoceConTitolo[]) {
          if (typeof voce.id === "string") conversazioni.set(`argomenti/${voce.id}`, { dove: { tipo: "argomento", id: voce.id }, titolo: typeof voce.titolo === "string" ? voce.titolo : "Argomento" });
        }
      }
    }
  }
  return conversazioni;
}

/** Cerca le parole nelle conversazioni in cache; dai risultati più recenti. */
export function cercaInCache(cache: Cache, cercato: string): Trovato[] {
  const parole = paroleDi(cercato);
  const prima = parole[0];
  if (prima === undefined) return [];
  const conversazioni = conversazioniDelQuadro(cache);
  const trovati: Trovato[] = [];
  // Qualcuno in più: una conversazione che il quadro non ha più non si mostra.
  for (const { chiave, n, chi, quando } of cache.cerca(parole, RISULTATI_MASSIMI * 2)) {
    const conversazione = conversazioni.get(chiave);
    const archiviato = conversazione === undefined ? undefined : cache.evento(chiave, n);
    const testo = archiviato === undefined ? undefined : testoDaCercare(archiviato)?.testo;
    if (conversazione === undefined || testo === undefined) continue;
    trovati.push({ ...conversazione, quando, chi, estratto: estrattoDi(testo, prima) });
    if (trovati.length === RISULTATI_MASSIMI) break;
  }
  return trovati;
}
