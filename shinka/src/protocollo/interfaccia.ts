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
export const PAGINE_MASSIME = 6;
export const PULSANTI_MASSIMI = 8;
/** Quanto può essere lungo il testo che un pulsante manda. */
export const TESTO_PULSANTE_MASSIMO = 4000;
export const DESCRIZIONE_INTERFACCIA_MASSIMA = 600;

/** Dove compare una pagina: nel menu delle pagine, o come scheda del pannello dei progetti. */
export type DovePagina = "menu" | "pannello";
/** Dove compare un pulsante: nella Home, nei progetti, o in tutte e due. */
export type DovePulsante = "home" | "progetti" | "ovunque";

export interface PaginaDiEstensione {
  /** Breve, fatto di lettere minuscole, cifre e trattini: fa parte dell'indirizzo. */
  id: string;
  titolo: string;
  dove: DovePagina;
}

export interface PulsanteDiEstensione {
  etichetta: string;
  /** Il messaggio che manda alla conversazione. */
  testo: string;
  dove: DovePulsante;
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
}

/** Le pagine e le chat parlano con l'interfaccia con messaggi che hanno questo campo. */
export const CAMPO_DEL_PONTE = "shinka";

/** Lo stato che una pagina riceve: niente credenziali, memoria o testo delle conversazioni. */
export interface StatoPerLaPagina {
  /** Dove la pagina è aperta: nel menu, oppure nel pannello di un progetto. */
  qui: { tipo: "pagina" } | { tipo: "progetto"; id: string; nome: string };
  home: { condizione: string };
  progetti: { id: string; nome: string; ambiente: string; condizione: string }[];
  ambienti: { id: string; nome: string; attivo: boolean; sistema: string }[];
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
    const dove = pagina.dove === "pannello" ? "pannello" : pagina.dove === undefined || pagina.dove === "menu" ? "menu" : undefined;
    if (titolo === "" || !ID_PAGINA.test(id)) return { motivo: "Ogni pagina vuole un titolo e un id breve, di lettere minuscole, cifre e trattini." };
    if (dove === undefined) return { motivo: `La pagina «${titolo}» va nel "menu" o nel "pannello".` };
    if (html.trim() === "" || html.length > PAGINA_MASSIMA) return { motivo: `La pagina «${titolo}» vuole il suo HTML intero, al massimo ${PAGINA_MASSIMA} caratteri.` };
    if (pagine.some((altra) => altra.id === id)) return { motivo: `Due pagine hanno lo stesso id: ${id}.` };
    pagine.push({ id, titolo, dove, html });
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

  if (tema === undefined && pagine.length === 0 && pulsanti.length === 0) return { motivo: "Un'estensione dell'interfaccia vuole almeno un tema, una pagina o un pulsante." };
  return { nome, descrizione, ...(tema === undefined ? {} : { tema }), pagine, pulsanti };
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
