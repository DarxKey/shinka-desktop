import { IMPEGNI, type Impegno } from "./impostazioni.ts";

/**
 * Le estensioni: codice di terzi che aggiunge strumenti alle conversazioni. Shinka ne tiene un
 * elenco al centro, e per ognuna dice in quali ambienti è accesa. Sono dati semplici,
 * serializzabili in JSON: viaggiano tra centro, nodi e interfaccia.
 */

/** Che cosa viene eseguito, o a che cosa ci si collega: è ciò che il proprietario legge nella scheda. */
export type DefinizioneEstensione =
  /** Un programma che parte nell'ambiente e parla con la conversazione. */
  | {
      tipo: "mcp-locale";
      comando: string;
      argomenti: string[];
      /** Variabili d'ambiente che non sono segreti. Le chiavi stanno nel vault, non qui. */
      variabili: Record<string, string>;
    }
  /** Un indirizzo a cui la conversazione si collega. */
  | { tipo: "mcp-remoto"; indirizzo: string; trasporto: "http" | "sse" }
  /** Una cartella presa da un repository Git, ferma a un commit. */
  | {
      tipo: "plugin";
      repository: string;
      commit: string;
      /** La cartella del plugin dentro il repository, se non è la radice. */
      cartella?: string;
    }
  /**
   * Un modello che gira su questa macchina, con un server che parla come l'API di Anthropic (per
   * esempio llama-server): il nodo lo accende quando una conversazione lo vuole, e lo spegne quando
   * resta fermo (ADR 0051). Le conversazioni ci parlano con Claude Code.
   */
  | {
      tipo: "modello-locale";
      /** Il programma del server, avviato direttamente: per esempio il percorso di llama-server.exe. */
      comando: string;
      /** Gli argomenti; "{impegno}" diventa l'impegno con cui il server parte. */
      argomenti: string[];
      /** Variabili d'ambiente che non sono segreti. */
      variabili: Record<string, string>;
      /** La porta su cui il server ascolta, su 127.0.0.1. */
      porta: number;
      /** Il nome con cui il server chiama il modello. */
      modello: string;
      /** Quanti token di contesto ha il server. */
      contesto: number;
      /** Quanti token può scrivere una risposta, ragionamento compreso. */
      uscita: number;
      /** Gli impegni che il server accetta al posto di "{impegno}"; il primo è il predefinito. */
      impegni: Impegno[];
    };

export type TipoEstensione = DefinizioneEstensione["tipo"];

/** Un comando che un plugin fa partire da solo, senza che nessuno lo chieda. */
export interface AggancioDiPlugin {
  /** Quando parte, come lo chiama Claude Code: per esempio "PreToolUse". */
  evento: string;
  comando: string;
}

/** Che cosa c'è dentro un plugin, letto dai suoi file senza eseguire nulla. */
export interface ContenutoPlugin {
  nome?: string;
  versione?: string;
  descrizione?: string;
  skill: string[];
  comandi: string[];
  agenti: string[];
  agganci: AggancioDiPlugin[];
  /** I server MCP che il plugin dichiara: caricato da Shinka, l'harness non li avvia. */
  server: string[];
  /** Altro che il plugin porta con sé e che Shinka non sa descrivere meglio. */
  altro: string[];
}

/** Come sta un'estensione in un ambiente. */
export interface EstensioneInAmbiente {
  idAmbiente: string;
  accesa: boolean;
  /** Gli strumenti che ha offerto l'ultima volta che è stata provata lì. */
  strumenti: string[];
  /** Quando è stata provata lì l'ultima volta. */
  provata: string;
  /** Quanto pesano i suoi strumenti nel contesto di una conversazione, misurato nella prova; manca se non si è potuto. */
  token?: number;
  /**
   * Per un modello locale: il proprietario lo vuole raggiungibile dalle altre macchine, con una
   * chiave che Shinka tiene per sé, all'indirizzo di questo ambiente visto dal centro.
   */
  inRete?: { indirizzo: string };
}

export interface Estensione {
  id: string;
  /** Il nome con cui compare nelle conversazioni: i suoi strumenti si chiamano "mcp__nome__…". */
  nome: string;
  /** Che cosa fa, nelle parole di chi l'ha proposta. */
  descrizione: string;
  definizione: DefinizioneEstensione;
  /**
   * I nomi delle chiavi che vuole dal vault: variabili d'ambiente per un server locale,
   * intestazioni della richiesta per uno remoto.
   */
  chiavi: string[];
  /** Presente per un plugin: che cosa c'era dentro quando è stato proposto. */
  contenuto?: ContenutoPlugin;
  ambienti: EstensioneInAmbiente[];
  aggiunta: string;
}

/** Ciò che un ambiente deve sapere di un'estensione per usarla. */
export interface EstensioneDistribuita {
  id: string;
  nome: string;
  definizione: DefinizioneEstensione;
  chiavi: string[];
  /** Per un modello locale in rete: il server ascolta anche dalle altre macchine, e vuole questa chiave. */
  inRete?: { chiave: string };
}

/** Com'è andata la prova di un'estensione in un ambiente: è partita, e con quali strumenti, oppure no. */
export type EsitoProva =
  /** `token`, se si è potuto misurare, è quanto pesano i suoi strumenti nel contesto di una conversazione. */
  | { riuscita: true; strumenti: string[]; contenuto?: ContenutoPlugin; token?: number }
  /** `riprovabile` è vero quando manca solo qualcosa che il proprietario può mettere a posto, come una chiave nel vault. */
  | { riuscita: false; motivo: string; riprovabile?: true };

/** Come comincia il valore di un modello locale nella scelta del modello: "locale:" e il nome dell'estensione. */
export const PREFISSO_MODELLO_LOCALE = "locale:";

/** Il valore con cui si sceglie il modello locale di un'estensione. */
export function valoreDelModelloLocale(nomeEstensione: string): string {
  return `${PREFISSO_MODELLO_LOCALE}${nomeEstensione}`;
}

/** Il nome dell'estensione di un modello locale scelto, o nulla se il modello scelto non è locale. */
export function estensioneDelModello(modello: string | undefined): string | undefined {
  return modello?.startsWith(PREFISSO_MODELLO_LOCALE) === true ? modello.slice(PREFISSO_MODELLO_LOCALE.length) : undefined;
}

/** Quanto si aspetta che un modello locale si carichi e risponda. */
export const ATTESA_MODELLO_LOCALE_MS = 240_000;

/** Dopo quanto tempo senza conversazioni che lo usano un modello locale si spegne. */
export const MODELLO_LOCALE_FERMO_MS = 10 * 60 * 1000;

/** Le chiavi di un'estensione, consegnate dal vault nel momento in cui parte. */
export type ChiaviConsegnate = { valori: Record<string, string> } | { motivo: string };

/** Ciò che il proprietario ha già installato in un ambiente, fuori da Shinka: si vede, non si gestisce. */
export interface EstensioniDellAmbiente {
  /** Quando Shinka ha guardato. */
  quando: string;
  server: { nome: string; provenienza: string }[];
  plugin: { nome: string; versione?: string }[];
  /** Le prime skill e i primi comandi, e quanti sono in tutto. */
  skill: string[];
  quanteSkill: number;
}

/** Ciò che l'interfaccia vede delle estensioni. */
export interface StatoEstensioni {
  estensioni: Estensione[];
  /** Per ambiente, ciò che c'era già l'ultima volta che Shinka ha guardato. */
  dellAmbiente: Record<string, EstensioniDellAmbiente>;
}

/** Quanto si aspetta che un'estensione parta, quando la si prova. */
export const ATTESA_PROVA_MS = 90_000;

/** Quanto si aspetta che un ambiente risponda a una prova: il tempo della prova, più quello per prendere un plugin. */
export const ATTESA_AMBIENTE_MS = ATTESA_MODELLO_LOCALE_MS + 90_000;

/** Quante skill dell'ambiente si elencano per nome. */
export const SKILL_ELENCATE = 60;

/** Nomi che un'estensione non può avere: sono già di Shinka o dell'harness. */
export const NOMI_RISERVATI: readonly string[] = ["shinka", "claude-in-chrome", "claude", "ide", "sdk", "plugin"];

const NOME = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Perché un nome non va bene, oppure nulla se va bene. */
export function difettoDelNome(nome: string): string | undefined {
  if (!NOME.test(nome)) return "Il nome è fatto di lettere minuscole, cifre e trattini, al più quaranta caratteri, e non comincia con un trattino.";
  if (NOMI_RISERVATI.includes(nome)) return `Il nome "${nome}" è già usato da Shinka.`;
  return undefined;
}

/** Il nome di una chiave: quello di una variabile d'ambiente o di un'intestazione. */
const NOME_DI_CHIAVE = /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/;

export function nomeDiChiaveValido(nome: string): boolean {
  return NOME_DI_CHIAVE.test(nome);
}

/** Come cominciano i nomi degli strumenti di un'estensione dentro una conversazione. */
export function prefissoDegliStrumenti(nome: string): string {
  return `mcp__${nome}__`;
}

/** La definizione in una riga, com'è scritta: il comando, l'indirizzo, oppure repository e commit. */
export function inUnaRiga(definizione: DefinizioneEstensione): string {
  switch (definizione.tipo) {
    case "mcp-locale":
      return [definizione.comando, ...definizione.argomenti].map((parte) => (/\s/.test(parte) ? `"${parte}"` : parte)).join(" ");
    case "mcp-remoto":
      return definizione.indirizzo;
    case "plugin":
      return `${definizione.repository} @ ${definizione.commit.slice(0, 12)}${definizione.cartella === undefined ? "" : ` (${definizione.cartella})`}`;
    case "modello-locale":
      return [definizione.comando, ...definizione.argomenti].map((parte) => (/\s/.test(parte) ? `"${parte}"` : parte)).join(" ");
    default:
      // Un tipo che questa versione non conosce, arrivato da un centro più nuovo: lo si mostra com'è.
      return JSON.stringify(definizione);
  }
}

/**
 * La definizione per intero, riga per riga: ciò che viene eseguito, o a che cosa ci si collega,
 * senza nulla di abbreviato. È ciò che il proprietario legge prima di confermare.
 */
export function definizioneInChiaro(definizione: DefinizioneEstensione): string[] {
  switch (definizione.tipo) {
    case "mcp-locale":
      return [inUnaRiga(definizione), ...Object.entries(definizione.variabili).map(([nome, valore]) => `${nome}=${valore}`)];
    case "mcp-remoto":
      return [`${definizione.indirizzo} (${definizione.trasporto})`];
    case "plugin":
      return [
        definizione.repository,
        `commit ${definizione.commit}`,
        ...(definizione.cartella === undefined ? [] : [`cartella ${definizione.cartella}`]),
      ];
    case "modello-locale":
      return [
        inUnaRiga(definizione),
        ...Object.entries(definizione.variabili).map(([nome, valore]) => `${nome}=${valore}`),
        `modello ${definizione.modello} su 127.0.0.1:${definizione.porta}, contesto ${definizione.contesto} token, risposte fino a ${definizione.uscita}`,
        `impegni: ${definizione.impegni.join(", ")}`,
      ];
    default:
      return [JSON.stringify(definizione, null, 2)];
  }
}

function elencati(quanti: number, uno: string, tanti: string, nomi: string[]): string {
  return `${quanti === 1 ? uno : `${quanti} ${tanti}`}: ${nomi.join(", ")}`;
}

/** Che cosa c'è dentro un plugin, in righe da leggere. */
export function contenutoInRighe(contenuto: ContenutoPlugin): string[] {
  const righe: string[] = [];
  if (contenuto.skill.length > 0) righe.push(elencati(contenuto.skill.length, "Una skill", "skill", contenuto.skill));
  if (contenuto.comandi.length > 0) righe.push(elencati(contenuto.comandi.length, "Un comando", "comandi", contenuto.comandi));
  if (contenuto.agenti.length > 0) righe.push(elencati(contenuto.agenti.length, "Un agente", "agenti", contenuto.agenti));
  for (const aggancio of contenuto.agganci) righe.push(`Parte da solo (${aggancio.evento}): ${aggancio.comando}`);
  if (righe.length === 0) righe.push("Non contiene skill, comandi né agenti.");
  return righe;
}

/** Il tipo in parole. */
export function tipoInParole(tipo: TipoEstensione): string {
  switch (tipo) {
    case "mcp-locale":
      return "Server MCP locale";
    case "mcp-remoto":
      return "Server MCP remoto";
    case "plugin":
      return "Plugin di Claude Code";
    case "modello-locale":
      return "Modello locale";
    default:
      return String(tipo);
  }
}

/** I programmi che scaricano ed eseguono un pacchetto: lì conta che la versione sia scritta. */
const SCARICANO = new Set(["npx", "bunx", "uvx", "pipx", "pnpx"]);

/** Il nome di un programma senza la cartella e senza l'estensione che ha su Windows. */
function programma(parola: string): string {
  return (parola.split(/[\\/]/).pop() ?? parola).replace(/\.(cmd|exe)$/i, "").toLowerCase();
}

/**
 * Ciò che il proprietario deve sapere prima di confermare, e che la definizione da sola non dice.
 * Vale per ogni tipo: lo calcola il centro, così la scheda non dipende da chi propone.
 */
export function avvisiDellaDefinizione(definizione: DefinizioneEstensione, contenuto?: ContenutoPlugin): string[] {
  const avvisi: string[] = [];
  if (definizione.tipo === "mcp-locale") {
    avvisi.push("È un programma di terzi che gira nell'ambiente con gli stessi accessi dei progetti: Shinka non controlla che cosa fa.");
    const parole = [definizione.comando, ...definizione.argomenti];
    const dove = parole.findIndex((parola) => SCARICANO.has(programma(parola)));
    if (dove !== -1) {
      // Dopo il programma che scarica, la prima parola che non è un'opzione è il pacchetto.
      const pacchetto = parole.slice(dove + 1).find((parola) => !parola.startsWith("-"));
      if (pacchetto !== undefined && !/.@\d/.test(pacchetto) && !/==\d/.test(pacchetto)) {
        avvisi.push(`La versione di "${pacchetto}" non è scritta nel comando: a ogni avvio può arrivare codice diverso da quello di oggi.`);
      }
    }
  } else if (definizione.tipo === "modello-locale") {
    avvisi.push(
      "È un programma che gira nell'ambiente con gli stessi accessi dei progetti: il nodo lo accende quando una conversazione sceglie questo modello, e lo spegne dopo dieci minuti senza nessuna che lo usi.",
    );
    avvisi.push("Usa la scheda video e la memoria di quella macchina mentre è acceso.");
    if (!definizione.argomenti.some((uno) => uno.includes("{impegno}"))) {
      avvisi.push("Negli argomenti non c'è \"{impegno}\": il server parte sempre allo stesso modo, e l'impegno non si può scegliere.");
    }
  } else if (definizione.tipo === "mcp-remoto") {
    avvisi.push("Ciò che le conversazioni mandano a questo indirizzo esce da Shinka: lo riceve chi gestisce quel servizio.");
    if (definizione.indirizzo.startsWith("http://")) avvisi.push("L'indirizzo non è cifrato (http): chi sta sulla stessa rete può leggere ciò che passa.");
  } else {
    avvisi.push("È codice di terzi preso da un repository: resta fermo al commit indicato, e aggiornarlo è una proposta nuova.");
    if (contenuto !== undefined) {
      if (contenuto.agganci.length > 0) {
        avvisi.push(
          `Contiene ${contenuto.agganci.length === 1 ? "un comando che parte da solo" : `${contenuto.agganci.length} comandi che partono da soli`} durante le conversazioni, senza chiedere il consenso.`,
        );
      }
      if (contenuto.server.length > 0) {
        avvisi.push(
          `Dichiara ${contenuto.server.length === 1 ? "un server MCP" : `${contenuto.server.length} server MCP`} (${contenuto.server.join(", ")}) che Shinka non avvia: se servono, vanno proposti a parte.`,
        );
      }
      if (contenuto.altro.length > 0) avvisi.push(`Porta con sé anche: ${contenuto.altro.join(", ")}.`);
    }
  }
  return avvisi;
}

// ── Ciò che arriva dal collegamento tra centro e nodo ────────────────────────
// Si controlla prima di usarlo: un messaggio senza la forma giusta non viene letto.

/** Quante chiavi può dichiarare un'estensione. */
export const CHIAVI_MASSIME = 20;

function oggetto(valore: unknown): Record<string, unknown> | undefined {
  return typeof valore === "object" && valore !== null && !Array.isArray(valore) ? (valore as Record<string, unknown>) : undefined;
}

/** Un elenco di testi, accorciato a quanto ha senso mostrare. Nulla se non è un elenco di testi. */
function testi(valore: unknown, quanti = 500, lunghezza = 300): string[] | undefined {
  if (!Array.isArray(valore) || !valore.every((uno) => typeof uno === "string")) return undefined;
  return (valore as string[]).slice(0, quanti).map((uno) => uno.slice(0, lunghezza));
}

export function leggiDefinizione(valore: unknown): DefinizioneEstensione | undefined {
  const campi = oggetto(valore);
  if (campi === undefined) return undefined;
  switch (campi.tipo) {
    case "mcp-locale": {
      const variabili = oggetto(campi.variabili);
      if (typeof campi.comando !== "string" || campi.comando.trim() === "" || variabili === undefined) return undefined;
      if (!Array.isArray(campi.argomenti) || !campi.argomenti.every((uno) => typeof uno === "string")) return undefined;
      if (!Object.entries(variabili).every(([nome, scritto]) => nomeDiChiaveValido(nome) && typeof scritto === "string")) return undefined;
      return { tipo: "mcp-locale", comando: campi.comando, argomenti: campi.argomenti as string[], variabili: variabili as Record<string, string> };
    }
    case "mcp-remoto":
      if (typeof campi.indirizzo !== "string" || !/^https?:\/\/\S+$/.test(campi.indirizzo)) return undefined;
      if (campi.trasporto !== "http" && campi.trasporto !== "sse") return undefined;
      return { tipo: "mcp-remoto", indirizzo: campi.indirizzo, trasporto: campi.trasporto };
    case "plugin":
      // Né il repository né il commit devono poter diventare un'opzione di git.
      if (typeof campi.repository !== "string" || campi.repository.trim() === "" || campi.repository.startsWith("-")) return undefined;
      if (typeof campi.commit !== "string" || !/^[0-9a-f]{40}$/.test(campi.commit)) return undefined;
      if (campi.cartella !== undefined && typeof campi.cartella !== "string") return undefined;
      return {
        tipo: "plugin",
        repository: campi.repository,
        commit: campi.commit,
        ...(campi.cartella === undefined ? {} : { cartella: campi.cartella }),
      };
    case "modello-locale": {
      const variabili = oggetto(campi.variabili);
      if (typeof campi.comando !== "string" || campi.comando.trim() === "" || variabili === undefined) return undefined;
      if (!Array.isArray(campi.argomenti) || !campi.argomenti.every((uno) => typeof uno === "string")) return undefined;
      if (!Object.entries(variabili).every(([nome, scritto]) => nomeDiChiaveValido(nome) && typeof scritto === "string")) return undefined;
      const intero = (valore: unknown, minimo: number, massimo: number): valore is number =>
        typeof valore === "number" && Number.isInteger(valore) && valore >= minimo && valore <= massimo;
      if (!intero(campi.porta, 1, 65535) || !intero(campi.contesto, 1024, 10_000_000) || !intero(campi.uscita, 256, 1_000_000)) return undefined;
      if (typeof campi.modello !== "string" || !/^[A-Za-z0-9._:/-]{1,120}$/.test(campi.modello)) return undefined;
      if (!Array.isArray(campi.impegni) || campi.impegni.length === 0 || !campi.impegni.every((uno) => IMPEGNI.includes(uno as Impegno))) return undefined;
      return {
        tipo: "modello-locale",
        comando: campi.comando,
        argomenti: campi.argomenti as string[],
        variabili: variabili as Record<string, string>,
        porta: campi.porta,
        modello: campi.modello,
        contesto: campi.contesto,
        uscita: campi.uscita,
        impegni: [...new Set(campi.impegni as Impegno[])],
      };
    }
    default:
      return undefined;
  }
}

/** L'identificativo finisce nel nome di una cartella: solo lettere, cifre e trattini. */
const ID_ESTENSIONE = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export function leggiEstensioneDistribuita(valore: unknown): EstensioneDistribuita | undefined {
  const campi = oggetto(valore);
  if (campi === undefined) return undefined;
  const definizione = leggiDefinizione(campi.definizione);
  if (typeof campi.id !== "string" || !ID_ESTENSIONE.test(campi.id) || definizione === undefined) return undefined;
  if (typeof campi.nome !== "string" || difettoDelNome(campi.nome) !== undefined) return undefined;
  if (!Array.isArray(campi.chiavi) || campi.chiavi.length > CHIAVI_MASSIME) return undefined;
  if (!campi.chiavi.every((chiave) => typeof chiave === "string" && nomeDiChiaveValido(chiave))) return undefined;
  // La chiave di un modello locale in rete: solo caratteri sicuri da mettere in un argomento del server.
  const rete = oggetto(campi.inRete);
  const chiave = definizione.tipo === "modello-locale" && typeof rete?.chiave === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(rete.chiave) ? rete.chiave : undefined;
  return { id: campi.id, nome: campi.nome, definizione, chiavi: campi.chiavi as string[], ...(chiave === undefined ? {} : { inRete: { chiave } }) };
}

function leggiContenuto(valore: unknown): ContenutoPlugin | undefined {
  const campi = oggetto(valore);
  if (campi === undefined) return undefined;
  const [skill, comandi, agenti, server, altro] = [campi.skill, campi.comandi, campi.agenti, campi.server, campi.altro].map((uno) => testi(uno));
  if (skill === undefined || comandi === undefined || agenti === undefined || server === undefined || altro === undefined) return undefined;
  if (!Array.isArray(campi.agganci)) return undefined;
  const agganci: AggancioDiPlugin[] = [];
  for (const uno of campi.agganci.slice(0, 50)) {
    const aggancio = oggetto(uno);
    if (aggancio === undefined || typeof aggancio.evento !== "string" || typeof aggancio.comando !== "string") return undefined;
    agganci.push({ evento: aggancio.evento.slice(0, 100), comando: aggancio.comando.slice(0, 300) });
  }
  const scritto = (nome: "nome" | "versione" | "descrizione"): string | undefined => {
    const trovato = campi[nome];
    return typeof trovato === "string" ? trovato.slice(0, 500) : undefined;
  };
  const [nome, versione, descrizione] = [scritto("nome"), scritto("versione"), scritto("descrizione")];
  return {
    ...(nome === undefined ? {} : { nome }),
    ...(versione === undefined ? {} : { versione }),
    ...(descrizione === undefined ? {} : { descrizione }),
    skill,
    comandi,
    agenti,
    agganci,
    server,
    altro,
  };
}

export function leggiEsitoProva(valore: unknown): EsitoProva | undefined {
  const campi = oggetto(valore);
  if (campi === undefined) return undefined;
  if (campi.riuscita === true) {
    const strumenti = testi(campi.strumenti, 500, 200);
    const contenuto = campi.contenuto === undefined ? undefined : leggiContenuto(campi.contenuto);
    if (strumenti === undefined || (campi.contenuto !== undefined && contenuto === undefined)) return undefined;
    const token = typeof campi.token === "number" && Number.isInteger(campi.token) && campi.token >= 0 && campi.token < 10_000_000 ? campi.token : undefined;
    return { riuscita: true, strumenti, ...(contenuto === undefined ? {} : { contenuto }), ...(token === undefined ? {} : { token }) };
  }
  if (campi.riuscita !== false || typeof campi.motivo !== "string") return undefined;
  return { riuscita: false, motivo: campi.motivo.slice(0, 2000), ...(campi.riprovabile === true ? { riprovabile: true as const } : {}) };
}

export function leggiChiaviConsegnate(valore: unknown): ChiaviConsegnate | undefined {
  const campi = oggetto(valore);
  if (campi === undefined) return undefined;
  if (typeof campi.motivo === "string") return { motivo: campi.motivo };
  const valori = oggetto(campi.valori);
  if (valori === undefined || !Object.values(valori).every((uno) => typeof uno === "string")) return undefined;
  return { valori: valori as Record<string, string> };
}

export function leggiEstensioniDellAmbiente(valore: unknown): EstensioniDellAmbiente | undefined {
  const campi = oggetto(valore);
  const skill = testi(campi?.skill, SKILL_ELENCATE);
  if (campi === undefined || skill === undefined || typeof campi.quando !== "string" || Number.isNaN(Date.parse(campi.quando))) return undefined;
  if (typeof campi.quanteSkill !== "number" || !Number.isInteger(campi.quanteSkill) || campi.quanteSkill < 0) return undefined;
  if (!Array.isArray(campi.server) || !Array.isArray(campi.plugin)) return undefined;
  const server: EstensioniDellAmbiente["server"] = [];
  for (const uno of campi.server.slice(0, 200)) {
    const letto = oggetto(uno);
    if (letto === undefined || typeof letto.nome !== "string" || typeof letto.provenienza !== "string") return undefined;
    server.push({ nome: letto.nome.slice(0, 200), provenienza: letto.provenienza.slice(0, 200) });
  }
  const plugin: EstensioniDellAmbiente["plugin"] = [];
  for (const uno of campi.plugin.slice(0, 200)) {
    const letto = oggetto(uno);
    if (letto === undefined || typeof letto.nome !== "string") return undefined;
    plugin.push({ nome: letto.nome.slice(0, 200), ...(typeof letto.versione === "string" ? { versione: letto.versione.slice(0, 100) } : {}) });
  }
  return { quando: campi.quando, server, plugin, skill, quanteSkill: campi.quanteSkill };
}
