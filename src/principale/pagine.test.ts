import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Centro, type Chiedi } from "./centro.ts";
import { Immagini } from "./immagini.ts";
import { rispondiAllePagine } from "./pagine.ts";

const GETTONE = "gettone-di-prova-0123456789";

interface Vista {
  indirizzo: string;
  metodo: string;
  intestazioni: Headers;
  corpo: string;
}

/** Un centro che risponde ciò che gli si dice, e tiene nota di ciò che gli arriva. */
function prova(rispondi: (vista: Vista) => Response = () => Response.json({ va: "bene" })) {
  const viste: Vista[] = [];
  let spento = false;
  const chiedi: Chiedi = async (indirizzo, opzioni) => {
    if (spento) throw new TypeError("fetch failed");
    const corpo = opzioni.body === undefined || opzioni.body === null ? "" : Buffer.from(opzioni.body as ArrayBuffer).toString("utf8");
    const vista = { indirizzo, metodo: opzioni.method ?? "GET", intestazioni: new Headers(opzioni.headers), corpo };
    viste.push(vista);
    return rispondi(vista);
  };
  const cartella = mkdtempSync(join(tmpdir(), "shinka-desktop-pagine-"));
  mkdirSync(join(cartella, "pagina", "assets"), { recursive: true });
  writeFileSync(join(cartella, "pagina", "index.html"), "<!doctype html><title>Shinka Desktop</title>");
  writeFileSync(join(cartella, "pagina", "assets", "codice.js"), "export {};");
  writeFileSync(join(cartella, "segreto.txt"), "non deve uscire");
  const stato = { centro: new Centro({ indirizzo: "https://shinka.example", gettone: GETTONE, chiedi, programma: "ShinkaDesktop/prova" }) as Centro | undefined, uscite: 0 };
  const immagini = new Immagini(join(cartella, "immagini"));
  const rispondiAllaPagina = rispondiAllePagine({
    cartella: join(cartella, "pagina"),
    centro: () => stato.centro,
    immagini: () => immagini,
    esci: async () => {
      stato.uscite += 1;
      stato.centro = undefined;
    },
  });
  return {
    viste,
    stato,
    spegni: (si: boolean) => (spento = si),
    chiedi: (percorso: string, opzioni: RequestInit = {}) => rispondiAllaPagina(new Request(`shinka://app${percorso}`, opzioni)),
  };
}

test("i file dell'interfaccia vengono dalla cartella dell'app, e da nessun'altra", async () => {
  const { chiedi } = prova();
  const pagina = await chiedi("/");
  assert.equal(pagina.status, 200);
  assert.match(pagina.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(pagina.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(await pagina.text(), /Shinka Desktop/);

  const codice = await chiedi("/assets/codice.js");
  assert.match(codice.headers.get("content-type") ?? "", /^text\/javascript/);
  assert.equal(codice.headers.get("content-security-policy"), null);

  assert.equal((await chiedi("/assets/manca.js")).status, 404);
  assert.equal((await chiedi("/..%2Fsegreto.txt")).status, 404);
  assert.equal((await chiedi("/%2e%2e/segreto.txt")).status, 404);
  assert.equal((await chiedi("/", { method: "POST", body: "x" })).status, 405);
});

test("solo shinka://app risponde", async () => {
  const rispondi = rispondiAllePagine({ cartella: tmpdir(), centro: () => undefined, immagini: () => undefined, esci: async () => {} });
  assert.equal((await rispondi(new Request("shinka://altrove/"))).status, 404);
});

test("le API vanno al centro con il gettone aggiunto qui, e senza ciò che racconta la pagina", async () => {
  const { chiedi, viste } = prova();
  const risposta = await chiedi("/api/progetti/uno/messaggi?x=1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "sessione=abc", Origin: "shinka://app", Authorization: "Bearer della-pagina" },
    body: JSON.stringify({ testo: "ciao" }),
  });
  assert.equal(risposta.status, 200);
  assert.deepEqual(await risposta.json(), { va: "bene" });
  const vista = viste[0];
  assert.ok(vista);
  assert.equal(vista.indirizzo, "https://shinka.example/api/progetti/uno/messaggi?x=1");
  assert.equal(vista.metodo, "POST");
  assert.equal(vista.intestazioni.get("authorization"), `Bearer ${GETTONE}`);
  assert.equal(vista.intestazioni.get("content-type"), "application/json");
  assert.equal(vista.intestazioni.get("cookie"), null);
  assert.equal(vista.intestazioni.get("origin"), null);
  assert.equal(vista.corpo, '{"testo":"ciao"}');
});

test("i biscotti del centro non arrivano alla pagina, e il gettone nemmeno", async () => {
  const { chiedi } = prova(() => new Response("{}", { status: 201, headers: { "Content-Type": "application/json", "Set-Cookie": "sessione=abc", "X-Altro": "resta" } }));
  const risposta = await chiedi("/api/uso");
  assert.equal(risposta.status, 201);
  assert.equal(risposta.headers.get("set-cookie"), null);
  assert.equal(risposta.headers.get("x-altro"), "resta");
  assert.ok(![...risposta.headers.values()].some((valore) => valore.includes(GETTONE)));
});

test("l'accesso lo tiene l'app: lo stato si sa senza centro, e uscire passa da lei", async () => {
  const { chiedi, viste, stato, spegni } = prova();
  spegni(true);
  assert.deepEqual(await (await chiedi("/api/stato")).json(), { configurato: true, autenticato: true });
  assert.equal((await chiedi("/api/accesso", { method: "POST", body: "{}" })).status, 404);

  const senzaRete = await chiedi("/api/uso");
  assert.equal(senzaRete.status, 503);
  assert.match(((await senzaRete.json()) as { errore: string }).errore, /senza connessione si può solo leggere/);

  assert.equal((await chiedi("/api/uscita", { method: "POST" })).status, 200);
  assert.equal(stato.uscite, 1);
  assert.deepEqual(await (await chiedi("/api/stato")).json(), { configurato: true, autenticato: false });
  assert.equal((await chiedi("/api/uso")).status, 401);
  assert.deepEqual(viste, []);
});

test("un'immagine di una conversazione si scarica una volta, poi viene dal disco anche senza rete", async () => {
  const punti = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
  const { chiedi, viste, spegni } = prova(() => new Response(new Uint8Array(punti), { headers: { "Content-Type": "image/png" } }));
  const percorso = "/api/progetti/uno/immagini/0f8fad5b-d9cb-469f-a165-70867728950e.png";
  const prima = await chiedi(percorso);
  assert.deepEqual(Buffer.from(await prima.arrayBuffer()), punti);
  spegni(true);
  const dopo = await chiedi(percorso);
  assert.equal(dopo.status, 200);
  assert.equal(dopo.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await dopo.arrayBuffer()), punti);
  assert.equal(viste.length, 1);
  // Ciò che non è un'immagine di conversazione si chiede ogni volta.
  assert.equal((await chiedi("/api/progetti/uno/file/contenuto?percorso=a.png")).status, 503);
});
