/**
 * Il lavoro offline dallo sportello del nodo di questo PC (ADR 0011): come la pagina vede il quadro,
 * come segue un progetto senza centro e quando il centro torna, dove vanno le sue richieste e dove
 * nasce un progetto nuovo.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { EventoArchiviato } from "../../shinka/src/protocollo/eventi.ts";
import type { StatoDelloSportello } from "../../shinka/src/protocollo/offline.ts";
import type { StatoAmbienti } from "../../shinka/src/protocollo/nodi.ts";
import type { StatoProgetti } from "../../shinka/src/protocollo/progetti.ts";
import { Cache, chiaveDelProgetto } from "./cache.ts";
import { Centro, type Chiedi } from "./centro.ts";
import type { MessaggioDelFlusso } from "./flusso.ts";
import { rispondiAllePagine } from "./pagine.ts";
import { CentroFinto, GETTONE_FINTO, INDIRIZZO_FINTO, finche, messaggioDiProva } from "./prove/centro-finto.ts";
import { Seguite } from "./seguite.ts";
import { SportelloDiQui, quadroOffline } from "./sportello.ts";

const ID = "11111111-2222-3333-4444-555555555555";
const NATO = "66666666-7777-8888-9999-000000000000";

function statoSportello(collegato = false, occupato = false): StatoDelloSportello {
  return {
    idAmbiente: "nodo-portatile",
    nome: "Portatile",
    sistema: "Windows 11",
    radiceProgetti: "C:\\Progetti",
    collegato,
    progetti: [
      { id: ID, nome: "Videogioco", cartella: "C:\\Progetti\\videogioco", creatoIl: "2026-11-20T10:00:00.000Z", brief: "Un gioco.", occupato },
      { id: NATO, nome: "Appunti", cartella: "C:\\Progetti\\appunti", creatoIl: "2026-11-24T10:00:00.000Z", brief: "Appunti.", nuovo: true, occupato: false },
    ],
  };
}

test("offline la pagina vede attivo solo l'ambiente di questo PC, i suoi progetti come li dice lo sportello e quelli nati qui", () => {
  const stato = statoSportello(false, true);
  const ambienti: StatoAmbienti = {
    ambienti: [
      { id: "centro", nome: "Unraid", descrizione: "", sistema: "Linux", radiceProgetti: "/progetti", attivo: true, delCentro: true },
      { id: "nodo-portatile", nome: "Portatile", descrizione: "", sistema: "Windows 11", radiceProgetti: "C:\\Progetti", attivo: false, delCentro: false },
    ],
    richieste: [],
  };
  const visti = JSON.parse(quadroOffline({ nome: "ambienti", dati: JSON.stringify(ambienti) }, stato).dati) as StatoAmbienti;
  assert.deepEqual(visti.ambienti.map((ambiente) => [ambiente.id, ambiente.attivo]), [["centro", false], ["nodo-portatile", true]]);

  const progetti: StatoProgetti = {
    progetti: [
      { id: ID, nome: "Videogioco", cartella: "C:\\Progetti\\videogioco", idAmbiente: "nodo-portatile", creatoIl: "2026-11-20T10:00:00.000Z", brief: "Un gioco.", nomeAmbiente: "Portatile", condizione: "fermo", chat: [{ numero: 2, condizione: "fermo" }] },
      { id: "altro", nome: "Sito", cartella: "/progetti/sito", idAmbiente: "centro", creatoIl: "2026-11-19T10:00:00.000Z", brief: "Un sito.", nomeAmbiente: "Unraid", condizione: "fermo" },
    ],
  };
  const vista = JSON.parse(quadroOffline({ nome: "progetti", dati: JSON.stringify(progetti) }, stato).dati) as StatoProgetti;
  assert.deepEqual(
    vista.progetti.map((progetto) => [progetto.nome, progetto.condizione]),
    [["Appunti", "fermo"], ["Videogioco", "al-lavoro"], ["Sito", "ambiente-spento"]],
  );
  // Offline lavora solo la chat principale.
  assert.equal(vista.progetti.find((progetto) => progetto.id === ID)?.chat, undefined);
  // Gli altri messaggi restano come sono.
  const memoria = { nome: "memoria", dati: "{}" };
  assert.equal(quadroOffline(memoria, stato), memoria);
});

test("lo sportello si guarda finché c'è: se non risponde non c'è, e chi ascolta lo sa solo quando cambia", async () => {
  let acceso = true;
  let cambi = 0;
  const chiedi: Chiedi = async (indirizzo) => {
    if (!acceso) throw new TypeError("fetch failed");
    assert.equal(new URL(indirizzo).host, "127.0.0.1:41234");
    return Response.json(statoSportello());
  };
  const sportello = new SportelloDiQui({ chiedi, programma: "ShinkaDesktop/prova", indirizzo: () => ({ porta: 41234, gettone: "g", idAmbiente: "nodo-portatile", nome: "Portatile" }), alCambio: () => (cambi += 1) });
  await sportello.aggiorna();
  assert.equal(sportello.stato?.nome, "Portatile");
  assert.equal(sportello.progetto(ID)?.nome, "Videogioco");
  await sportello.aggiorna();
  assert.equal(cambi, 1);
  acceso = false;
  await sportello.aggiorna();
  assert.equal(sportello.stato, undefined);
  assert.equal(sportello.porta, undefined);
  assert.equal(cambi, 2);
});

/** Ciò che la pagina riceve, un gruppo per volta, ridotto a ciò che serve leggere. */
function pagina(): { gruppi: string[][]; manda: (messaggi: MessaggioDelFlusso[]) => void } {
  const gruppi: string[][] = [];
  return {
    gruppi,
    manda: (messaggi) =>
      gruppi.push(
        messaggi.map((messaggio) => {
          if (messaggio.nome === "storia") return `storia:${(JSON.parse(messaggio.dati) as { ultimo: number }).ultimo}`;
          if (messaggio.nome !== "message") return messaggio.nome;
          const { n, evento } = JSON.parse(messaggio.dati) as EventoArchiviato;
          return `${n}:${evento.tipo === "messaggio-proprietario" ? evento.testo : evento.tipo}`;
        }),
      ),
  };
}

test("offline un progetto si segue dalla cache e dallo sportello, con i numeri che continuano; tornato il centro, la storia si rimanda da lì", async () => {
  const centroFinto = new CentroFinto();
  const archivio = centroFinto.archivio(`progetti/${ID}`, ["a", "b", "c"].map(messaggioDiProva));
  const cache = Cache.apri(":memory:");
  cache.aggiungi(chiaveDelProgetto(ID), archivio.versione, archivio.eventi);
  centroFinto.spento = true;
  const sportelloFinto = new CentroFinto();
  sportelloFinto.archivio(`progetti/${ID}`, ["x", "y"].map(messaggioDiProva));
  const centro = new Centro({ indirizzo: INDIRIZZO_FINTO, gettone: GETTONE_FINTO, chiedi: centroFinto.chiedi, programma: "ShinkaDesktop/prova" });
  const porta = new Centro({ indirizzo: "http://127.0.0.1:41234", gettone: GETTONE_FINTO, chiedi: sportelloFinto.chiedi, programma: "ShinkaDesktop/prova" });
  let offline = true;
  const seguite = new Seguite({ centro, cache, quadro: { argomentoAperto: () => undefined }, attese: [5], sportello: () => (offline ? porta : undefined) });

  const vista = pagina();
  const smetti = seguite.segui(`/api/progetti/${ID}`, vista.manda);
  await finche(() => vista.gruppi.length >= 2, "arriva la storia dallo sportello");
  assert.deepEqual(vista.gruppi[1], ["open", "1:a", "2:b", "3:c", "4:x", "5:y", "storia:5"]);
  sportelloFinto.pubblica(`progetti/${ID}`, messaggioDiProva("z"));
  await finche(() => vista.gruppi.flat().includes("6:z"), "arriva il seguito dallo sportello");
  // Nulla del lavoro offline entra in cache: arriverà dal centro.
  assert.equal(cache.indice(chiaveDelProgetto(ID))?.ultimo, 3);

  // Il centro torna, con il lavoro offline già consegnato.
  for (const testo of ["x", "y", "z"]) centroFinto.pubblica(`progetti/${ID}`, messaggioDiProva(testo));
  centroFinto.spento = false;
  offline = false;
  seguite.cambiaStrada();
  await finche(() => vista.gruppi.at(-1)?.at(-1) === "storia:6", "la storia arriva dal centro");
  assert.deepEqual(vista.gruppi.at(-1), ["open", "1:a", "2:b", "3:c", "4:x", "5:y", "6:z", "storia:6"]);
  assert.equal(cache.indice(chiaveDelProgetto(ID))?.ultimo, 6);
  assert.ok(!vista.gruppi.flat().includes("error"), "cambiare strada non è una caduta");
  smetti();
});

test("le richieste di un progetto vanno allo sportello quando deve, e offline un progetto nuovo nasce solo su questo PC", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "shinka-desktop-sportello-"));
  mkdirSync(join(cartella, "pagina"), { recursive: true });
  writeFileSync(join(cartella, "pagina", "index.html"), "<!doctype html><title>Shinka Desktop</title>");
  const alCentro: string[] = [];
  const alloSportello: string[] = [];
  const centro = new Centro({
    indirizzo: INDIRIZZO_FINTO,
    gettone: GETTONE_FINTO,
    chiedi: async (indirizzo, opzioni) => {
      alCentro.push(`${opzioni.method ?? "GET"} ${new URL(indirizzo).pathname}`);
      throw new TypeError("fetch failed");
    },
    programma: "ShinkaDesktop/prova",
  });
  const porta = new Centro({
    indirizzo: "http://127.0.0.1:41234",
    gettone: GETTONE_FINTO,
    chiedi: async (indirizzo, opzioni) => {
      const url = new URL(indirizzo);
      const corpo = opzioni.body === undefined || opzioni.body === null ? "" : typeof opzioni.body === "string" ? opzioni.body : Buffer.from(opzioni.body as ArrayBuffer).toString("utf8");
      alloSportello.push(`${opzioni.method ?? "GET"} ${url.pathname} ${corpo}`);
      if (url.pathname === "/api/progetti") return Response.json({ id: NATO }, { status: 201 });
      return Response.json({ accettato: true }, { status: 202 });
    },
    programma: "ShinkaDesktop/prova",
  });
  let aggiornato = 0;
  const rispondi = rispondiAllePagine({
    cartella: join(cartella, "pagina"),
    centro: () => centro,
    immagini: () => undefined,
    esci: async () => {},
    sportelloPer: (id) => (id === ID ? porta : undefined),
    offline: () => ({ idAmbiente: "nodo-portatile", porta, aggiorna: async () => void (aggiornato += 1) }),
  });
  const chiedi = (percorso: string, opzioni: RequestInit = {}): Promise<Response> => rispondi(new Request(`shinka://app${percorso}`, opzioni));

  const mandato = await chiedi(`/api/progetti/${ID}/messaggi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testo: "Ciao" }) });
  assert.equal(mandato.status, 202);
  assert.deepEqual(alloSportello, [`POST /api/progetti/${ID}/messaggi {"testo":"Ciao"}`]);
  // Un progetto che non è dello sportello va al centro, come sempre.
  assert.equal((await chiedi("/api/progetti/altro/messaggi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testo: "Ciao" }) })).status, 503);
  assert.deepEqual(alCentro, ["POST /api/progetti/altro/messaggi"]);

  assert.equal((await chiedi("/api/nuovo-progetto")).status, 200);
  const altrove = await chiedi("/api/nuovo-progetto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: "Sito", idAmbiente: "centro", brief: "Un sito." }) });
  assert.equal(altrove.status, 409);
  const nato = await chiedi("/api/nuovo-progetto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: "Appunti", idAmbiente: "nodo-portatile", brief: "Appunti." }) });
  assert.equal(nato.status, 200);
  assert.deepEqual(await nato.json(), { idProgetto: NATO });
  assert.equal(alloSportello.at(-1), 'POST /api/progetti {"nome":"Appunti","brief":"Appunti."}');
  assert.equal(aggiornato, 1);
});
