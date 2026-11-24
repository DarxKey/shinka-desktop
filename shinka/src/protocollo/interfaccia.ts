/**
 * Le estensioni dell'interfaccia (ADR 0054): un tema, delle pagine e dei pulsanti che Claude scrive
 * e il proprietario conferma. Le pagine stanno in un recinto e parlano con l'interfaccia solo con
 * `postMessage`, con i messaggi descritti qui.
 */

import { difettoDelNome } from "./estensioni.ts";

/** Quanto può essere lungo il tema, in caratteri. */
export const TEMA_MASSIMO = 60_000;
/** Quanto può essere lunga una pagina, in caratteri. */
export const PAGINA_MASSIMA = 300_000;
export const PAGINE_MASSIME = 12;
export const PULSANTI_MASSIMI = 8;
export const COMANDI_MASSIMI = 12;
/** Quante voci al massimo nell'elenco delle API che un'estensione usa. */
export const API_MASSIME = 40;
/** Quanto può essere lungo il testo che un pulsante manda. */
export const TESTO_PULSANTE_MASSIMO = 4000;
export const DESCRIZIONE_INTERFACCIA_MASSIMA = 600;

/**
 * I posti in cui una pagina può stare (ADR 0057). `menu` e `pannello` c'erano già (ADR 0054); gli
 * altri sono barre e riquadri intorno alla chat e nelle pagine Ambiente e Sicurezza.
 */
export const POSTI = [
  "menu",
  "pannello",
  "barra-destra",
  "barra-sinistra",
  "testata",
  "barra-di-stato",
  "sopra-scrittura",
  "sotto-scrittura",
  "flottante",
  "ambiente",
  "sicurezza",
] as const;
export type Posto = (typeof POSTI)[number];

/** Che cosa dice ogni posto, per la scheda e per chi scrive un'estensione. */
export const POSTI_IN_PAROLE: Record<Posto, string> = {
  menu: "una pagina nel menu delle pagine",
  pannello: "una scheda nel pannello dei progetti",
  "barra-destra": "la barra a destra, che si richiude",
  "barra-sinistra": "in fondo alla barra laterale",
  testata: "una striscia sotto la testata della chat",
  "barra-di-stato": "la barra di stato in fondo",
  "sopra-scrittura": "sopra il campo di scrittura",
  "sotto-scrittura": "sotto il campo di scrittura",
  flottante: "un pannello flottante, da un pulsante in basso",
  ambiente: "una sezione nella pagina di ogni ambiente",
  sicurezza: "una sezione nella pagina Sicurezza",
};

/** Dove vale un posto della chat: nella Home, nei progetti o in tutte e due. */
export const AMBITI = ["home", "progetti", "ovunque"] as const;
export type Ambito = (typeof AMBITI)[number];

/** In quale interfaccia: il sito, Shinka Desktop, o tutte e due. */
export const CLIENT_DELLE_ESTENSIONI = ["web", "desktop", "tutti"] as const;
export type ClientDellEstensione = (typeof CLIENT_DELLE_ESTENSIONI)[number];

export interface PostoDellaPagina {
  posto: Posto;
  ambito: Ambito;
  client: ClientDellEstensione;
}

/** Dove compare una pagina, nella forma di prima: il menu o il pannello dei progetti. */
export type DovePagina = "menu" | "pannello";
/** Dove compare un pulsante: nella Home, nei progetti, o in tutte e due. */
export type DovePulsante = "home" | "progetti" | "ovunque";

/**
 * Le parti dell'interfaccia che un'estensione può nascondere, o sostituire con una sua pagina. Ogni
 * parte ha anche `data-parte` nell'HTML, per i temi.
 */
export const PARTI = [
  "home-vuota",
  "stato-progetto",
  "pannello-modifiche",
  "pannello-file",
  "pannello-terminale",
  "pannello-anteprima",
  "ambiente-risorse",
  "pulsanti-estensioni",
] as const;
export type Parte = (typeof PARTI)[number];

export const PARTI_IN_PAROLE: Record<Parte, string> = {
  "home-vuota": "il benvenuto della Home vuota",
  "stato-progetto": "il riquadro dello stato del progetto",
  "pannello-modifiche": "la scheda Modifiche del pannello",
  "pannello-file": "la scheda File del pannello",
  "pannello-terminale": "la scheda Terminale del pannello",
  "pannello-anteprima": "la scheda Anteprima del pannello",
  "ambiente-risorse": "le risorse nella pagina di un ambiente",
  "pulsanti-estensioni": "i pulsanti delle estensioni sopra il campo",
};

/** Una parte nascosta, o sostituita da una pagina dell'estensione. */
export interface ParteCambiata {
  parte: Parte;
  /** La pagina che prende il suo posto; senza, la parte si nasconde. */
  pagina?: string;
}

export interface PaginaDiEstensione {
  /** Breve, fatto di lettere minuscole, cifre e trattini: fa parte dell'indirizzo. */
  id: string;
  titolo: string;
  /** Dove compare. Una pagina senza posti si apre solo da un comando o al posto di una parte. */
  posti: PostoDellaPagina[];
  /** La forma di prima (ADR 0054), per le estensioni che l'avevano. */
  dove?: DovePagina;
}

export interface PulsanteDiEstensione {
  etichetta: string;
  /** Il messaggio che manda alla conversazione. */
  testo: string;
  dove: DovePulsante;
}

/** Un comando: nella palette (Ctrl+K) e, se ha i tasti, con una scorciatoia. */
export interface ComandoDiEstensione {
  etichetta: string;
  /** Per esempio "Ctrl+Shift+R"; senza, solo dalla palette. */
  tasti?: string;
  /** Che cosa fa: apre una pagina, manda un testo alla conversazione aperta, o dà un segnale alle pagine accese dell'estensione. */
  azione: { tipo: "pagina"; pagina: string } | { tipo: "messaggio"; testo: string } | { tipo: "segnale"; nome: string };
}

/** Un'estensione dell'interfaccia, come la vede l'interfaccia: il tema per intero, le pagine senza il loro HTML. */
export interface EstensioneInterfaccia {
  id: string;
  nome: string;
  descrizione: string;
  accesa: boolean;
  aggiunta: string;
  tema?: string;
  pagine: PaginaDiEstensione[];
  pulsanti: PulsanteDiEstensione[];
  /** Le API di Shinka che le sue pagine usano, come "GET /api/ambienti/*\/risorse", oppure "tutte" (ADR 0057). */
  api: string[];
  comandi: ComandoDiEstensione[];
  parti: ParteCambiata[];
}

export interface StatoInterfaccia {
  estensioni: EstensioneInterfaccia[];
}

/** Ciò che Claude propone: il tema e le pagine per intero. */
export interface RichiestaInterfaccia {
  nome: string;
  descrizione: string;
  tema?: string;
  pagine: (PaginaDiEstensione & { html: string })[];
  pulsanti: PulsanteDiEstensione[];
  api: string[];
  comandi: ComandoDiEstensione[];
  parti: ParteCambiata[];
}

/** Le pagine e le chat parlano con l'interfaccia con messaggi che hanno questo campo. */
export const CAMPO_DEL_PONTE = "shinka";

/** Dove è aperta una pagina, come lo riceve. */
export type QuiPerLaPagina =
  | { tipo: "pagina" }
  | { tipo: "home"; idArgomento?: string }
  | { tipo: "progetto"; id: string; nome: string; idAmbiente?: string; ambiente?: string; cartella?: string; condizione?: string }
  | { tipo: "ambiente"; id: string; nome: string }
  | { tipo: "sicurezza" };

/** Lo stato che una pagina riceve: niente credenziali, memoria o testo delle conversazioni. Il resto lo chiede alle API. */
export interface StatoPerLaPagina {
  /** Dove la pagina è aperta, e in quale posto. */
  qui: QuiPerLaPagina;
  posto?: Posto | "parte";
  /** Il sito o Shinka Desktop. */
  client: "web" | "desktop";
  tema: "chiaro" | "scuro";
  estensione: { id: string; nome: string; api: string[] };
  home: { condizione: string; idArgomento?: string };
  progetti: { id: string; nome: string; ambiente: string; idAmbiente: string; condizione: string }[];
  ambienti: { id: string; nome: string; attivo: boolean; sistema: string; delCentro: boolean }[];
}

/** La lettura di una voce dell'elenco delle API: un metodo (o *) e un percorso, con * per un pezzo e ** per il resto. */
function leggiVoceApi(voce: string): { metodo: string; percorso: string } | undefined {
  const trovata = /^(\*|GET|POST|PUT|DELETE|PATCH)\s+(\/api\/[^\s]*)$/i.exec(voce.trim());
  if (trovata === null) return undefined;
  return { metodo: (trovata[1] ?? "").toUpperCase(), percorso: trovata[2] ?? "" };
}

function percorsoCombacia(modello: string, percorso: string): boolean {
  const pezziModello = modello.split("/").filter((pezzo) => pezzo !== "");
  const pezzi = percorso.split("/").filter((pezzo) => pezzo !== "");
  for (let indice = 0; indice < pezziModello.length; indice += 1) {
    const pezzo = pezziModello[indice];
    if (pezzo === "**") return true;
    if (indice >= pezzi.length) return false;
    if (pezzo !== "*" && pezzo !== pezzi[indice]) return false;
  }
  return pezziModello.length === pezzi.length;
}

/**
 * Le rotte che un'estensione non usa mai, anche con "tutte" (ADR 0057). Due gruppi:
 * - quelle che toccano l'accesso a Shinka stessa: entrare e uscire, la password, sessioni e
 *   dispositivi, le copie dei dati, la pubblicazione di Shinka Desktop;
 * - le decisioni che la specifica riserva al proprietario: i permessi delle conversazioni, le
 *   approvazioni dei comandi sugli host, le proposte (di progetto, di sviluppo, di estensione, anche
 *   dell'interfaccia) e l'installazione di una versione.
 */
export function rottaEsclusa(metodo: string, percorso: string): boolean {
  const solo = percorso.split("?")[0] ?? "";
  const scrive = metodo.toUpperCase() !== "GET" && metodo.toUpperCase() !== "HEAD";
  if (/^\/api\/(accesso|uscita|dispositivi|primo-avvio)(\/|$)/.test(solo)) return true;
  if (/^\/api\/impostazioni\/password(\/|$)/.test(solo)) return true;
  if (!scrive) return false;
  return [
    /^\/api\/sicurezza\//,
    /^\/api\/copie\//,
    /^\/api\/desktop\//,
    /^\/api\/interfaccia\//,
    /^\/api\/estensioni\/proposte\//,
    /^\/api\/proposte\//,
    /^\/api\/sviluppo\//,
    /^\/api\/installazione\//,
    /^\/api\/approvazioni\//,
    /^\/api\/home(\/chat\/\d+)?\/permessi\//,
    /^\/api\/progetti\/[^/]+\/permessi\//,
  ].some((rotta) => rotta.test(solo));
}

/** Vero se l'elenco delle API di un'estensione comprende questa richiesta, e la rotta non è esclusa. */
export function apiConsentita(api: readonly string[], metodo: string, percorso: string): boolean {
  const solo = percorso.split("?")[0] ?? "";
  if (!solo.startsWith("/api/") || solo.includes("..") || rottaEsclusa(metodo, solo)) return false;
  return api.some((voce) => {
    if (voce.trim().toLowerCase() === "tutte") return true;
    const letta = leggiVoceApi(voce);
    return letta !== undefined && (letta.metodo === "*" || letta.metodo === metodo.toUpperCase()) && percorsoCombacia(letta.percorso, solo);
  });
}

/** Un'estensione del formato di prima, letta dai dati: i campi nuovi vuoti, e i posti dal vecchio `dove`. */
export function conICampiNuovi<T extends { pagine: (Partial<PaginaDiEstensione> & { id: string; titolo: string })[]; api?: string[]; comandi?: ComandoDiEstensione[]; parti?: ParteCambiata[] }>(
  estensione: T,
): T & { pagine: PaginaDiEstensione[]; api: string[]; comandi: ComandoDiEstensione[]; parti: ParteCambiata[] } {
  return {
    ...estensione,
    pagine: estensione.pagine.map((pagina) => ({
      ...pagina,
      posti: Array.isArray(pagina.posti) ? pagina.posti : [{ posto: pagina.dove === "pannello" ? "pannello" : "menu", ambito: "ovunque", client: "tutti" }],
    })) as PaginaDiEstensione[],
    api: Array.isArray(estensione.api) ? estensione.api : [],
    comandi: Array.isArray(estensione.comandi) ? estensione.comandi : [],
    parti: Array.isArray(estensione.parti) ? estensione.parti : [],
  };
}

const ID_PAGINA = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Riconosce la proposta di Claude e dice che cosa non va, in parole per lui. Il nome segue le regole
 * di quello delle altre estensioni.
 */
export function leggiRichiestaInterfaccia(valore: unknown): RichiestaInterfaccia | { motivo: string } {
  if (typeof valore !== "object" || valore === null) return { motivo: "La proposta non è un oggetto." };
  const campi = valore as Record<string, unknown>;
  const nome = typeof campi.nome === "string" ? campi.nome.trim() : "";
  const difetto = difettoDelNome(nome);
  if (difetto !== undefined) return { motivo: difetto };
  const descrizione = typeof campi.descrizione === "string" ? campi.descrizione.trim().slice(0, DESCRIZIONE_INTERFACCIA_MASSIMA) : "";
  if (descrizione === "") return { motivo: "Serve una descrizione: che cosa cambia o aggiunge, in poche parole per il proprietario." };
  const tema = typeof campi.tema === "string" && campi.tema.trim() !== "" ? campi.tema : undefined;
  if (tema !== undefined && tema.length > TEMA_MASSIMO) return { motivo: `Il tema è troppo lungo: al massimo ${TEMA_MASSIMO} caratteri.` };
  if (tema !== undefined && /@import|url\(\s*['"]?\s*(?:https?:|\/\/)/i.test(tema)) {
    return { motivo: "Il tema non può caricare nulla da altri siti (né @import né url() verso un indirizzo): l'interfaccia lo bloccherebbe comunque." };
  }

  const pagine: RichiestaInterfaccia["pagine"] = [];
  const pagineDate = campi.pagine === undefined ? [] : campi.pagine;
  if (!Array.isArray(pagineDate) || pagineDate.length > PAGINE_MASSIME) return { motivo: `Le pagine sono un elenco, al massimo ${PAGINE_MASSIME}.` };
  for (const una of pagineDate) {
    const pagina = (typeof una === "object" && una !== null ? una : {}) as Record<string, unknown>;
    const titolo = typeof pagina.titolo === "string" ? pagina.titolo.trim().slice(0, 60) : "";
    const id = typeof pagina.id === "string" ? pagina.id.trim() : "";
    const html = typeof pagina.html === "string" ? pagina.html : "";
    if (titolo === "" || !ID_PAGINA.test(id)) return { motivo: "Ogni pagina vuole un titolo e un id breve, di lettere minuscole, cifre e trattini." };
    if (html.trim() === "" || html.length > PAGINA_MASSIMA) return { motivo: `La pagina «${titolo}» vuole il suo HTML intero, al massimo ${PAGINA_MASSIMA} caratteri.` };
    if (pagine.some((altra) => altra.id === id)) return { motivo: `Due pagine hanno lo stesso id: ${id}.` };
    // I posti: "posti" con posto, ambito e client; oppure, come prima, "dove" (menu o pannello).
    const posti: PostoDellaPagina[] = [];
    const postiDati = pagina.posti === undefined ? (pagina.dove === undefined ? ["menu"] : [pagina.dove]) : pagina.posti;
    if (!Array.isArray(postiDati) || postiDati.length > POSTI.length) return { motivo: `I posti della pagina «${titolo}» sono un elenco.` };
    for (const uno of postiDati) {
      const voce = (typeof uno === "string" ? { posto: uno } : typeof uno === "object" && uno !== null ? uno : {}) as Record<string, unknown>;
      const posto = POSTI.find((nome) => nome === voce.posto);
      const ambito = voce.ambito === undefined ? "ovunque" : AMBITI.find((nome) => nome === voce.ambito);
      const client = voce.client === undefined ? "tutti" : CLIENT_DELLE_ESTENSIONI.find((nome) => nome === voce.client);
      if (posto === undefined) return { motivo: `La pagina «${titolo}» ha un posto che non c'è. I posti sono: ${POSTI.join(", ")}.` };
      if (ambito === undefined) return { motivo: `L'ambito di un posto è "home", "progetti" o "ovunque".` };
      if (client === undefined) return { motivo: `Il client di un posto è "web", "desktop" o "tutti".` };
      if (!posti.some((altro) => altro.posto === posto)) posti.push({ posto, ambito, client });
    }
    pagine.push({ id, titolo, posti, html });
  }

  const pulsanti: PulsanteDiEstensione[] = [];
  const pulsantiDati = campi.pulsanti === undefined ? [] : campi.pulsanti;
  if (!Array.isArray(pulsantiDati) || pulsantiDati.length > PULSANTI_MASSIMI) return { motivo: `I pulsanti sono un elenco, al massimo ${PULSANTI_MASSIMI}.` };
  for (const uno of pulsantiDati) {
    const pulsante = (typeof uno === "object" && uno !== null ? uno : {}) as Record<string, unknown>;
    const etichetta = typeof pulsante.etichetta === "string" ? pulsante.etichetta.trim().slice(0, 40) : "";
    const testo = typeof pulsante.testo === "string" ? pulsante.testo.trim() : "";
    const dove = pulsante.dove === "home" || pulsante.dove === "progetti" ? pulsante.dove : pulsante.dove === undefined || pulsante.dove === "ovunque" ? "ovunque" : undefined;
    if (etichetta === "" || testo === "") return { motivo: "Ogni pulsante vuole un'etichetta e il testo che manda." };
    if (testo.length > TESTO_PULSANTE_MASSIMO) return { motivo: `Il testo del pulsante «${etichetta}» è troppo lungo.` };
    if (dove === undefined) return { motivo: `Il pulsante «${etichetta}» va nella "home", nei "progetti" o "ovunque".` };
    pulsanti.push({ etichetta, testo, dove });
  }

  // Le API che le pagine usano: "tutte", o voci come "GET /api/ambienti/*/risorse".
  const apiDate = campi.api === undefined ? [] : campi.api;
  if (!Array.isArray(apiDate) || apiDate.length > API_MASSIME) return { motivo: `Le API sono un elenco, al massimo ${API_MASSIME} voci.` };
  const api: string[] = [];
  for (const una of apiDate) {
    const voce = typeof una === "string" ? una.trim() : "";
    if (voce.toLowerCase() === "tutte") {
      api.push("tutte");
      continue;
    }
    if (leggiVoceApi(voce) === undefined) {
      return { motivo: `«${voce.slice(0, 80)}» non è una voce delle API: si scrive come "GET /api/ambienti/*/risorse" (metodo o *, poi il percorso, con * per un pezzo e ** per il resto), oppure "tutte".` };
    }
    if (!api.includes(voce)) api.push(voce);
  }
  if (api.length > 0 && pagine.length === 0) return { motivo: "Le API le usano le pagine: senza pagine l'elenco delle API non serve." };

  const comandi: ComandoDiEstensione[] = [];
  const comandiDati = campi.comandi === undefined ? [] : campi.comandi;
  if (!Array.isArray(comandiDati) || comandiDati.length > COMANDI_MASSIMI) return { motivo: `I comandi sono un elenco, al massimo ${COMANDI_MASSIMI}.` };
  for (const uno of comandiDati) {
    const comando = (typeof uno === "object" && uno !== null ? uno : {}) as Record<string, unknown>;
    const etichetta = typeof comando.etichetta === "string" ? comando.etichetta.trim().slice(0, 60) : "";
    if (etichetta === "") return { motivo: "Ogni comando vuole un'etichetta." };
    const tasti = typeof comando.tasti === "string" && comando.tasti.trim() !== "" ? comando.tasti.trim() : undefined;
    if (tasti !== undefined && !TASTI.test(tasti)) return { motivo: `I tasti del comando «${etichetta}» si scrivono come "Ctrl+Shift+R" (con Ctrl o Alt, e una lettera, una cifra o F1-F12).` };
    const azione = (typeof comando.azione === "object" && comando.azione !== null ? comando.azione : {}) as Record<string, unknown>;
    let letta: ComandoDiEstensione["azione"] | undefined;
    if (azione.tipo === "pagina" && typeof azione.pagina === "string" && pagine.some((pagina) => pagina.id === azione.pagina)) letta = { tipo: "pagina", pagina: azione.pagina };
    if (azione.tipo === "messaggio" && typeof azione.testo === "string" && azione.testo.trim() !== "" && azione.testo.length <= TESTO_PULSANTE_MASSIMO) letta = { tipo: "messaggio", testo: azione.testo.trim() };
    if (azione.tipo === "segnale" && typeof azione.nome === "string" && /^[a-z0-9-]{1,40}$/.test(azione.nome)) letta = { tipo: "segnale", nome: azione.nome };
    if (letta === undefined) {
      return { motivo: `L'azione del comando «${etichetta}» è { tipo: "pagina", pagina: <id di una sua pagina> }, { tipo: "messaggio", testo } oppure { tipo: "segnale", nome }.` };
    }
    comandi.push({ etichetta, ...(tasti === undefined ? {} : { tasti }), azione: letta });
  }

  const parti: ParteCambiata[] = [];
  const partiDate = campi.parti === undefined ? [] : campi.parti;
  if (!Array.isArray(partiDate) || partiDate.length > PARTI.length) return { motivo: "Le parti sono un elenco." };
  for (const una of partiDate) {
    const voce = (typeof una === "string" ? { parte: una } : typeof una === "object" && una !== null ? una : {}) as Record<string, unknown>;
    const parte = PARTI.find((nome) => nome === voce.parte);
    if (parte === undefined) return { motivo: `Una parte che non c'è. Le parti sono: ${PARTI.join(", ")}.` };
    if (voce.pagina !== undefined && !(typeof voce.pagina === "string" && pagine.some((pagina) => pagina.id === voce.pagina))) {
      return { motivo: `La parte ${parte} va sostituita con una delle pagine dell'estensione, indicata con il suo id.` };
    }
    if (!parti.some((altra) => altra.parte === parte)) parti.push({ parte, ...(typeof voce.pagina === "string" ? { pagina: voce.pagina } : {}) });
  }

  if (tema === undefined && pagine.length === 0 && pulsanti.length === 0 && comandi.length === 0 && parti.length === 0) {
    return { motivo: "Un'estensione dell'interfaccia vuole almeno un tema, una pagina, un pulsante, un comando o una parte nascosta." };
  }
  return { nome, descrizione, ...(tema === undefined ? {} : { tema }), pagine, pulsanti, api, comandi, parti };
}

/** Come si scrivono i tasti di un comando: Ctrl o Alt (con Shift a piacere), poi una lettera, una cifra o un tasto funzione. */
const TASTI = /^(Ctrl\+|Alt\+)(Shift\+|Alt\+)?([A-Z0-9]|F[1-9]|F1[0-2])$/;

/** Vero se un evento della tastiera corrisponde ai tasti scritti come "Ctrl+Shift+R". */
export function tastiCombaciano(tasti: string, evento: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  const pezzi = tasti.split("+");
  const tasto = (pezzi.pop() ?? "").toLowerCase();
  const vuole = (nome: string): boolean => pezzi.includes(nome);
  return (
    evento.key.toLowerCase() === tasto &&
    (evento.ctrlKey || evento.metaKey) === vuole("Ctrl") &&
    evento.altKey === vuole("Alt") &&
    evento.shiftKey === vuole("Shift")
  );
}

/**
 * La politica con cui il centro serve una pagina: un'origine opaca, solo il suo codice e le sue
 * immagini scritte dentro, nessuna richiesta in rete, e solo in un riquadro di Shinka.
 */
export const POLITICA_PAGINA_ESTENSIONE = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
