/**
 * Ciò che la pagina chiede a `shinka://app/` (ADR 0002). I file dell'interfaccia vengono dalla
 * cartella dell'app; tutto ciò che sta sotto `/api/` va al centro, dal processo principale, con il
 * gettone del dispositivo aggiunto qui: la pagina non lo vede mai, e non può chiedere altro che le
 * API del suo centro.
 */

import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { ErroreCentro, NonRaggiungibile, type Centro, type Metodo } from "./centro.ts";
import { siTiene, type Immagini } from "./immagini.ts";

export const SCHEMA = "shinka";
export const ORIGINE = `${SCHEMA}://app`;

const TIPI: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

/** Ciò che la pagina dell'app può caricare: se stessa, e nient'altro dalla rete se non passando dal centro. */
const REGOLE_DELLA_PAGINA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob: https: http:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Le intestazioni della pagina che arrivano al centro: le altre racconterebbero l'app, o non servono. */
const DA_PORTARE = ["accept", "content-type", "range", "if-none-match", "if-modified-since"];
/** Le intestazioni del centro che non tornano alla pagina: i biscotti, e ciò che vale solo per un tratto. */
const DA_NON_RIPORTARE = new Set(["set-cookie", "content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "strict-transport-security"]);

const METODI = new Set<string>(["GET", "POST", "PUT", "DELETE", "HEAD"]);

function json(stato: number, dati: unknown): Response {
  return new Response(JSON.stringify(dati), { status: stato, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export interface PerLePagine {
  /** La cartella con l'interfaccia costruita. */
  cartella: string;
  /** Il centro a cui questo PC è collegato, se lo è. */
  centro(): Pick<Centro, "richiesta"> | undefined;
  immagini(): Immagini | undefined;
  /**
   * La ricerca nelle conversazioni tenute su questo PC. `completa` dice se la copia è in pari con
   * il centro: allora si risponde da qui, altrimenti si chiede al centro finché si raggiunge.
   */
  cerca?(cercato: string): { risultati: unknown[]; completa: boolean } | undefined;
  /** Il proprietario esce da questo centro: il dispositivo si toglie, la cache si butta. */
  esci(): Promise<void>;
  /**
   * Se il centro parla un protocollo più nuovo di questa versione dell'app, il motivo per cui non si
   * scrive: le richieste che cambiano qualcosa non partono (ADR 0006).
   */
  soloLettura?(): string | undefined;
  /** Lo sportello del nodo di questo PC, se le richieste di quel progetto vanno lì adesso (ADR 0011). */
  sportelloPer?(idProgetto: string): Pick<Centro, "richiesta"> | undefined;
  /** Senza centro, lo sportello del nodo di questo PC con il suo ambiente: lì nascono i progetti nuovi. */
  offline?(): { idAmbiente: string; porta: Pick<Centro, "chiama">; aggiorna(): Promise<void> } | undefined;
}

/** Le rotte di un progetto che lo sportello del nodo sa servire. */
const DEL_PROGETTO = /^\/api\/progetti\/([^/]+)\/(?:messaggi|interrompi|permessi\/[^/]+|domande\/[^/]+|impostazioni|azioni\/[^/]+|storia)$/;

/** Gira allo sportello una richiesta della pagina, così com'è. */
async function allOSportello(sportello: Pick<Centro, "richiesta">, richiesta: Request, metodo: string, percorso: string): Promise<Response> {
  const intestazioni: Record<string, string> = {};
  for (const nome of DA_PORTARE) {
    const valore = richiesta.headers.get(nome);
    if (valore !== null) intestazioni[nome] = valore;
  }
  try {
    const corpo = metodo === "GET" || metodo === "HEAD" ? undefined : await richiesta.arrayBuffer();
    const risposta = await sportello.richiesta(metodo as Metodo, percorso, {
      intestazioni,
      segnale: richiesta.signal,
      ...(corpo === undefined || corpo.byteLength === 0 ? {} : { corpo }),
    });
    const riportate = new Headers();
    for (const [nome, valore] of risposta.headers) if (!DA_NON_RIPORTARE.has(nome.toLowerCase())) riportate.set(nome, valore);
    return new Response(risposta.status === 204 || metodo === "HEAD" ? null : risposta.body, { status: risposta.status, headers: riportate });
  } catch {
    if (richiesta.signal.aborted) return new Response(null, { status: 499 });
    return json(503, { errore: "Il nodo di Shinka di questo PC non risponde." });
  }
}

/** Senza centro, la scheda e la nascita di un progetto nuovo: solo nell'ambiente di questo PC, con nome e brief. */
async function progettoNuovoOffline(offline: NonNullable<ReturnType<NonNullable<PerLePagine["offline"]>>>, richiesta: Request, metodo: string): Promise<Response> {
  if (metodo === "GET") return json(200, { impostazioni: { permessi: "modifiche-libere" } });
  if (metodo !== "POST") return json(405, { errore: "Metodo non ammesso." });
  let corpo: { nome?: unknown; brief?: unknown; idAmbiente?: unknown };
  try {
    corpo = (await richiesta.json()) as typeof corpo;
  } catch {
    return json(400, { errore: "Richiesta non valida." });
  }
  if (corpo.idAmbiente !== offline.idAmbiente) return json(409, { errore: "Senza collegamento con il centro un progetto nasce solo su questo PC." });
  try {
    const nato = await offline.porta.chiama<{ id: string }>("POST", "/api/progetti", { nome: corpo.nome, brief: corpo.brief }, richiesta.signal);
    // La barra laterale lo deve avere quando la pagina lo apre.
    await offline.aggiorna();
    return json(200, { idProgetto: nato.id });
  } catch (errore) {
    return json(errore instanceof ErroreCentro ? errore.stato : 503, { errore: errore instanceof Error ? errore.message : "Il progetto non è nato." });
  }
}

export function rispondiAllePagine(opzioni: PerLePagine): (richiesta: Request) => Promise<Response> {
  return async (richiesta) => {
    let indirizzo: URL;
    try {
      indirizzo = new URL(richiesta.url);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (indirizzo.protocol !== `${SCHEMA}:` || indirizzo.host !== "app") return new Response(null, { status: 404 });
    if (indirizzo.pathname === "/api" || indirizzo.pathname.startsWith("/api/")) return await api(opzioni, richiesta, indirizzo);
    if (richiesta.method !== "GET" && richiesta.method !== "HEAD") return new Response(null, { status: 405 });
    return await file(opzioni.cartella, indirizzo.pathname);
  };
}

async function file(cartella: string, percorso: string): Promise<Response> {
  let chiesto: string;
  try {
    chiesto = decodeURIComponent(percorso);
  } catch {
    return new Response(null, { status: 400 });
  }
  // Senza un nome di file è la pagina: l'interfaccia tiene la posizione dopo il cancelletto.
  const relativo = chiesto === "/" || extname(chiesto) === "" ? "index.html" : chiesto;
  const pieno = normalize(join(cartella, relativo));
  if (pieno !== cartella && !pieno.startsWith(cartella.endsWith(sep) ? cartella : `${cartella}${sep}`)) return new Response(null, { status: 404 });
  try {
    if (!(await stat(pieno)).isFile()) return new Response(null, { status: 404 });
    const dati = await readFile(pieno);
    const estensione = extname(pieno).toLowerCase();
    return new Response(new Uint8Array(dati), {
      status: 200,
      headers: {
        "Content-Type": TIPI[estensione] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        ...(estensione === ".html" ? { "Content-Security-Policy": REGOLE_DELLA_PAGINA, "Cache-Control": "no-store" } : {}),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function api(opzioni: PerLePagine, richiesta: Request, indirizzo: URL): Promise<Response> {
  const metodo = richiesta.method.toUpperCase();
  const percorso = indirizzo.pathname;
  const centro = opzioni.centro();

  // L'accesso lo tiene l'app: la pagina chiede solo se c'è.
  if (percorso === "/api/stato" && metodo === "GET") return json(200, { configurato: true, autenticato: centro !== undefined });
  if (percorso === "/api/uscita" && metodo === "POST") {
    await opzioni.esci();
    return json(200, {});
  }
  if (percorso === "/api/accesso" || percorso === "/api/dispositivi") return json(404, { errore: "Da qui l'accesso si fa dalla schermata dell'app." });
  if (centro === undefined) return json(401, { errore: "Questo PC non è collegato al centro." });
  if (!METODI.has(metodo)) return json(405, { errore: "Metodo non ammesso." });

  // I progetti di questo PC, quando vanno mandati avanti dal suo nodo: il centro non c'entra (ADR 0011).
  const delProgetto = DEL_PROGETTO.exec(percorso)?.[1];
  let idProgetto: string | undefined;
  try {
    idProgetto = delProgetto === undefined ? undefined : decodeURIComponent(delProgetto);
  } catch {
    idProgetto = undefined;
  }
  const sportello = idProgetto === undefined ? undefined : opzioni.sportelloPer?.(idProgetto);
  if (sportello !== undefined) return await allOSportello(sportello, richiesta, metodo, `${percorso}${indirizzo.search}`);
  const offline = percorso === "/api/nuovo-progetto" ? opzioni.offline?.() : undefined;
  if (offline !== undefined) return await progettoNuovoOffline(offline, richiesta, metodo);
  const fermo = metodo === "GET" || metodo === "HEAD" ? undefined : opzioni.soloLettura?.();
  if (fermo !== undefined) return json(409, { errore: fermo });

  // La ricerca: dalla copia locale se è in pari, e comunque quando il centro non si raggiunge.
  const cercato = percorso === "/api/cerca" && metodo === "GET" ? (indirizzo.searchParams.get("q") ?? "") : undefined;
  const trovatiQui = cercato === undefined ? undefined : opzioni.cerca?.(cercato);
  if (trovatiQui?.completa === true) return json(200, { risultati: trovatiQui.risultati });

  const immagini = metodo === "GET" && siTiene(percorso) && !richiesta.headers.has("range") ? opzioni.immagini() : undefined;
  const tenuta = immagini?.leggi(percorso);
  if (tenuta !== undefined) {
    return new Response(new Uint8Array(tenuta.dati), {
      status: 200,
      headers: { "Content-Type": tenuta.tipo, "Cache-Control": "private, max-age=86400", "Content-Security-Policy": "sandbox; default-src 'none'", "X-Content-Type-Options": "nosniff" },
    });
  }

  const intestazioni: Record<string, string> = {};
  for (const nome of DA_PORTARE) {
    const valore = richiesta.headers.get(nome);
    if (valore !== null) intestazioni[nome] = valore;
  }
  try {
    // Il corpo si legge per intero: sono messaggi e allegati, non flussi.
    const corpo = metodo === "GET" || metodo === "HEAD" ? undefined : await richiesta.arrayBuffer();
    const risposta = await centro.richiesta(metodo as Metodo, `${percorso}${indirizzo.search}`, {
      intestazioni,
      segnale: richiesta.signal,
      ...(corpo === undefined || corpo.byteLength === 0 ? {} : { corpo }),
    });
    const riportate = new Headers();
    for (const [nome, valore] of risposta.headers) if (!DA_NON_RIPORTARE.has(nome.toLowerCase())) riportate.set(nome, valore);

    if (immagini !== undefined && risposta.status === 200) {
      const dati = Buffer.from(await risposta.arrayBuffer());
      immagini.tieni(percorso, risposta.headers.get("content-type") ?? "", dati);
      return new Response(new Uint8Array(dati), { status: 200, headers: riportate });
    }
    // Una risposta senza corpo non ne può portare uno, nemmeno vuoto.
    const senzaCorpo = risposta.status === 204 || risposta.status === 205 || risposta.status === 304 || metodo === "HEAD";
    return new Response(senzaCorpo ? null : risposta.body, { status: risposta.status, headers: riportate });
  } catch (errore) {
    if (richiesta.signal.aborted) return new Response(null, { status: 499 });
    if (errore instanceof NonRaggiungibile && trovatiQui !== undefined) return json(200, { risultati: trovatiQui.risultati });
    if (errore instanceof NonRaggiungibile) return json(503, { errore: "Il centro non si raggiunge: senza connessione si può solo leggere." });
    return json(502, { errore: "La richiesta al centro non è riuscita." });
  }
}
