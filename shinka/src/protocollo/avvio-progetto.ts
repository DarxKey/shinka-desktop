/**
 * Come comincia un progetto nuovo: con quali estensioni, con quale skill di partenza, e che cosa
 * va preparato nella sua cartella prima del primo messaggio. Le scelte le fa il proprietario nella
 * scheda della proposta; qui stanno i tipi e le regole, uguali per il centro e per l'interfaccia.
 */

import type { DefinizioneEstensione } from "./estensioni.ts";

/** Il plugin da cui vengono le skill di partenza. */
export const PLUGIN_DELLE_SKILL_DI_PARTENZA = "mattpocock-skills";

/** Le estensioni che una scheda propone già spuntate, dove ci sono. */
export const ESTENSIONI_CONSIGLIATE: readonly string[] = [PLUGIN_DELLE_SKILL_DI_PARTENZA, "codegraph"];

/** Le skill con cui il primo messaggio può cominciare: un'intervista serrata sul piano, con o senza documenti. */
export const SKILL_DI_PARTENZA = ["grill-me", "grill-with-docs"] as const;
export type SkillDiPartenza = (typeof SKILL_DI_PARTENZA)[number];

export const SPIEGAZIONE_SKILL: Record<SkillDiPartenza, string> = {
  "grill-me": "Un'intervista serrata sul piano, finché è tutto chiaro.",
  "grill-with-docs": "La stessa intervista, e intanto scrive glossario e decisioni (ADR) nel progetto.",
};

/** Ciò che va fatto nella cartella di un progetto nuovo perché un'estensione funzioni dal primo messaggio. */
export type PreparazioneDelProgetto = {
  /** CodeGraph costruisce il suo indice nella cartella, in `.codegraph/`. */
  tipo: "indice-codegraph";
  /** Il pacchetto npm da lanciare, con la sua versione se l'estensione la fissa. */
  pacchetto: string;
};

/** Com'è andata una preparazione. */
export interface EsitoPreparazione {
  tipo: PreparazioneDelProgetto["tipo"];
  riuscita: boolean;
  /** L'ultima parte dell'uscita, oppure che cosa è andato storto. */
  testo: string;
}

/** Legge gli esiti delle preparazioni arrivati da un nodo; undefined se non sono fatti come devono. */
export function leggiEsitiPreparazione(valore: unknown): EsitoPreparazione[] | undefined {
  if (!Array.isArray(valore) || valore.length > 10) return undefined;
  const esiti: EsitoPreparazione[] = [];
  for (const voce of valore as unknown[]) {
    const { tipo, riuscita, testo } = (voce ?? {}) as Record<string, unknown>;
    if (tipo !== "indice-codegraph" || typeof riuscita !== "boolean" || typeof testo !== "string") return undefined;
    esiti.push({ tipo, riuscita, testo: testo.slice(-2000) });
  }
  return esiti;
}

/** Quanto può durare una preparazione: per un repository grande l'indice chiede un po'. */
export const DURATA_PREPARAZIONE_MS = 3 * 60 * 1000;

const PACCHETTO_CODEGRAPH = /^@colbymchenry\/codegraph(@[0-9A-Za-z][0-9A-Za-z.+-]*)?$/;

/** Il pacchetto di CodeGraph, se è valido: è l'unico che una preparazione può lanciare. */
export function pacchettoCodegraphValido(pacchetto: unknown): pacchetto is string {
  return typeof pacchetto === "string" && PACCHETTO_CODEGRAPH.test(pacchetto);
}

/** La preparazione che un'estensione di Shinka chiede in un progetto nuovo, se ne chiede una. */
export function preparazioneDa(definizione: DefinizioneEstensione): PreparazioneDelProgetto | undefined {
  if (definizione.tipo !== "mcp-locale") return undefined;
  const pacchetto = [definizione.comando, ...definizione.argomenti].find((parte) => pacchettoCodegraphValido(parte));
  return pacchetto === undefined ? undefined : { tipo: "indice-codegraph", pacchetto };
}

/** La preparazione per un'estensione installata nell'ambiente fuori da Shinka, di cui si conosce solo il nome. */
export function preparazioneDelNome(nome: string): PreparazioneDelProgetto | undefined {
  return nome.toLowerCase() === "codegraph" ? { tipo: "indice-codegraph", pacchetto: "@colbymchenry/codegraph" } : undefined;
}

/** Legge una preparazione arrivata da fuori; undefined se non è fatta come deve. */
export function leggiPreparazione(valore: unknown): PreparazioneDelProgetto | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { tipo, pacchetto } = valore as Record<string, unknown>;
  return tipo === "indice-codegraph" && pacchettoCodegraphValido(pacchetto) ? { tipo, pacchetto } : undefined;
}

/** Il comando che una preparazione lancia nella cartella del progetto. */
export function comandoDellaPreparazione(preparazione: PreparazioneDelProgetto): string {
  // Il pacchetto è controllato: lettere, cifre e pochi segni, niente che la shell interpreti.
  return `npx -y ${preparazione.pacchetto} init -y .`;
}

/** Un'estensione che un progetto nuovo può avere, per come la mostra la scheda della proposta. */
export interface EstensionePerProgetto {
  nome: string;
  genere: "plugin" | "server";
  /**
   * "shinka": è nell'elenco di Shinka, e si accende per il progetto se il proprietario la sceglie.
   * "ambiente": il proprietario l'ha installata nell'ambiente per conto suo, e c'è sempre.
   */
  provenienza: "shinka" | "ambiente";
  /** Per una di Shinka: se è accesa in quell'ambiente. Una spenta non si può scegliere. */
  accesa: boolean;
  descrizione?: string;
  /** Ciò che va fatto nella cartella del progetto quando nasce, se l'estensione è scelta. */
  preparazione?: PreparazioneDelProgetto;
}

/** Le estensioni che un progetto nuovo può avere in un ambiente. */
export interface EstensioniPerProgetto {
  voci: EstensionePerProgetto[];
  /** Quando Shinka ha guardato ciò che il proprietario ha installato lì per conto suo; manca se non l'ha mai fatto. */
  guardatoIl?: string;
}

/** Le estensioni che un progetto nuovo può avere, per ambiente. */
export type EstensioniDegliAmbienti = Record<string, EstensioniPerProgetto>;

/** Le estensioni spuntate all'inizio: le consigliate che nell'ambiente si possono scegliere. */
export function sceltePredefinite(disponibili: readonly EstensionePerProgetto[]): string[] {
  return disponibili
    .filter((una) => una.provenienza === "shinka" && una.accesa && ESTENSIONI_CONSIGLIATE.includes(una.nome))
    .map((una) => una.nome);
}

/** Le consigliate che in quell'ambiente non ci sono, né da Shinka accese né installate per conto suo. */
export function consigliateMancanti(disponibili: readonly EstensionePerProgetto[]): string[] {
  return ESTENSIONI_CONSIGLIATE.filter(
    (nome) => !disponibili.some((una) => una.nome === nome && (una.provenienza === "ambiente" || una.accesa)),
  );
}

/** Vero se, con quelle scelte, il progetto ha il plugin delle skill di partenza. */
export function haLeSkillDiPartenza(disponibili: readonly EstensionePerProgetto[], scelte: readonly string[]): boolean {
  return disponibili.some(
    (una) =>
      una.nome === PLUGIN_DELLE_SKILL_DI_PARTENZA && (una.provenienza === "ambiente" || (una.accesa && scelte.includes(una.nome))),
  );
}

/**
 * La skill di partenza consigliata: con una cartella che esiste già, dove di solito c'è da
 * documentare ciò che si trova, grill-with-docs; altrimenti grill-me.
 */
export function skillPredefinita(cartellaEsistente: string): SkillDiPartenza {
  return cartellaEsistente.trim() === "" ? "grill-me" : "grill-with-docs";
}

/**
 * Il primo messaggio al progetto: con una skill di partenza è il suo comando seguito dal brief,
 * così l'harness la avvia e le passa il brief. Le due skill si avviano solo così: Claude da solo
 * non può chiamarle.
 */
export function primoMessaggio(testo: string, skill?: SkillDiPartenza): string {
  return skill === undefined ? testo : `/${PLUGIN_DELLE_SKILL_DI_PARTENZA}:${skill} ${testo}`;
}

/** Le estensioni scelte per i progetti nati prima di questa scelta: undefined vuol dire "tutte quelle accese". */
export function leggiEstensioniScelte(valore: unknown): string[] | undefined {
  if (!Array.isArray(valore)) return undefined;
  const nomi = valore.filter((nome): nome is string => typeof nome === "string" && nome.length > 0 && nome.length <= 64);
  return nomi.length === valore.length && nomi.length <= 50 ? [...new Set(nomi)] : undefined;
}
