import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventoArchiviato, EventoConversazione, IndiceArchivio } from "../../shinka/src/protocollo/eventi.ts";
import { Cache, chiaveDellArgomento, chiaveDelProgetto, type Chiave } from "./cache.ts";
import { Centro } from "./centro.ts";
import type { MessaggioDelFlusso } from "./flusso.ts";
import { CentroFinto, GETTONE_FINTO, INDIRIZZO_FINTO, finche, messaggioDiProva } from "./prove/centro-finto.ts";
import { Seguite, chiaveDellaBase } from "./seguite.ts";

interface Prova {
  finto: CentroFinto;
  cache: Cache;
  seguite: Seguite;
  /** L'argomento che il quadro dice aperto: le prove lo cambiano a mano. */
  aperto: { chiave: Chiave; indice?: IndiceArchivio } | undefined;
}

function prova(): Prova {
  const finto = new CentroFinto();
  const centro = new Centro({ indirizzo: INDIRIZZO_FINTO, gettone: GETTONE_FINTO, chiedi: finto.chiedi, programma: "ShinkaDesktop/prova" });
  const cache = Cache.apri(":memory:");
  const insieme: Prova = { finto, cache, aperto: undefined, seguite: undefined as unknown as Seguite };
  insieme.seguite = new Seguite({ centro, cache, quadro: { argomentoAperto: () => insieme.aperto }, attese: [5] });
  return insieme;
}

/** Ciò che la pagina riceve, un gruppo per volta, ridotto a ciò che serve leggere nelle prove. */
function pagina(): { gruppi: string[][]; manda: (messaggi: MessaggioDelFlusso[]) => void; tutti: () => string[] } {
  const gruppi: string[][] = [];
  return {
    gruppi,
    manda: (messaggi) => gruppi.push(messaggi.map(breve)),
    tutti: () => gruppi.flat(),
  };
}

function breve(messaggio: MessaggioDelFlusso): string {
  if (messaggio.nome !== "message") return messaggio.nome;
  const { n, evento } = JSON.parse(messaggio.dati) as EventoArchiviato;
  const cosa = evento.tipo === "messaggio-proprietario" ? evento.testo : evento.tipo;
  return `${n}:${cosa}`;
}

function messaggi(...testi: string[]): EventoConversazione[] {
  return testi.map(messaggioDiProva);
}

test("la base di una conversazione dice dove sta in cache", () => {
  assert.equal(chiaveDellaBase("/api/progetti/uno"), "progetti/uno");
  assert.equal(chiaveDellaBase("/api/argomenti/2026-11-23-a%20b"), "argomenti/2026-11-23-a b");
  assert.equal(chiaveDellaBase("/api/home"), undefined);
  assert.equal(chiaveDellaBase("/api/progetti/uno/altro"), undefined);
});

test("senza cache la storia arriva dal centro e resta in cache", async () => {
  const { finto, cache, seguite } = prova();
  finto.archivio("progetti/uno", messaggi("a", "b", "c"));
  const vista = pagina();
  const smetti = seguite.segui("/api/progetti/uno", vista.manda);
  await finche(() => vista.gruppi.length === 1, "arriva la storia");
  assert.deepEqual(vista.gruppi, [["open", "1:a", "2:b", "3:c", "storia"]]);
  assert.deepEqual(finto.richieste, ["GET /api/progetti/uno/eventi"]);
  assert.deepEqual(cache.indice(chiaveDelProgetto("uno")), { versione: "v1", ultimo: 3 });
  smetti();
  await finche(() => finto.flussiVivi === 0, "il flusso si chiude quando la pagina smette");
});

test("con la cache la pagina vede subito la storia, e dal centro arriva solo il seguito", async () => {
  const { finto, cache, seguite } = prova();
  const archivio = finto.archivio("progetti/uno", messaggi("a", "b", "c", "d"));
  cache.aggiungi(chiaveDelProgetto("uno"), archivio.versione, archivio.eventi.slice(0, 2));
  finto.spento = true;

  const vista = pagina();
  const smetti = seguite.segui("/api/progetti/uno", vista.manda);
  // Prima ancora che il centro risponda: qui non risponde affatto.
  assert.deepEqual(vista.gruppi[0], ["open", "1:a", "2:b", "storia"]);
  await finche(() => vista.tutti().includes("error"), "la pagina sa che il centro non risponde");

  finto.spento = false;
  await finche(() => vista.tutti().includes("4:d"), "arriva il seguito");
  assert.deepEqual(vista.gruppi.at(-1), ["3:c", "4:d"]);
  assert.equal(finto.richieste.at(-1), "GET /api/progetti/uno/eventi?dopo=2&versione=v1");
  assert.deepEqual(cache.indice(chiaveDelProgetto("uno")), { versione: "v1", ultimo: 4 });
  smetti();
});

test("ciò che arriva in diretta entra in cache alleggerito; ciò che passa no", async () => {
  const { finto, cache, seguite } = prova();
  const chiave = chiaveDelProgetto("uno");
  finto.archivio("progetti/uno", messaggi("a"));
  const vista = pagina();
  const smetti = seguite.segui("/api/progetti/uno", vista.manda);
  await finche(() => vista.gruppi.length === 1, "arriva la storia");

  const lungo = "x".repeat(500);
  finto.pubblica("progetti/uno", { tipo: "azione-iniziata", idAzione: "az", strumento: "Bash", ingresso: { command: lungo } });
  finto.pubblica("progetti/uno", { tipo: "testo-frammento", idTesto: "t", frammento: "ciao" }, true);
  finto.pubblica("progetti/uno", { tipo: "stato", stato: "al-lavoro" } as unknown as EventoConversazione, true);
  finto.pubblica("progetti/uno", { tipo: "azione-conclusa", idAzione: "az", esito: lungo, errore: false });
  await finche(() => vista.tutti().includes("3:azione-conclusa"), "arrivano gli eventi in diretta");

  // La pagina li riceve interi, uno per uno.
  assert.deepEqual(vista.tutti().slice(-4), ["2:azione-iniziata", "0:testo-frammento", "0:stato", "3:azione-conclusa"]);
  assert.deepEqual(cache.indice(chiave), { versione: "v1", ultimo: 3 });
  const iniziata = cache.evento(chiave, 2)?.evento as { ingresso: { command: string }; accorciato?: true };
  const conclusa = cache.evento(chiave, 3)?.evento as { esito: string; accorciato?: true };
  assert.equal(iniziata.accorciato, true);
  assert.equal(iniziata.ingresso.command.length, 121);
  assert.equal(conclusa.accorciato, true);
  assert.equal(conclusa.esito.length, 121);
  // Dello stato resta l'ultimo, per mostrarlo alla prossima apertura; il frammento non resta.
  assert.deepEqual(cache.ricordati(chiave).map((riga) => (JSON.parse(riga) as EventoArchiviato).evento.tipo), ["stato"]);
  smetti();

  const dopo = pagina();
  finto.spento = true;
  const smettiAncora = seguite.segui("/api/progetti/uno", dopo.manda);
  assert.deepEqual(dopo.gruppi[0], ["open", "1:a", "2:azione-iniziata", "3:azione-conclusa", "0:stato", "storia"]);
  smettiAncora();
});

test("dopo una caduta la storia torna da capo, dalla cache in pari", async () => {
  const { finto, seguite } = prova();
  finto.archivio("progetti/uno", messaggi("a", "b"));
  const vista = pagina();
  const smetti = seguite.segui("/api/progetti/uno", vista.manda);
  await finche(() => vista.gruppi.length === 1, "arriva la storia");
  finto.pubblica("progetti/uno", messaggioDiProva("c"));
  await finche(() => vista.tutti().includes("3:c"), "arriva l'evento in diretta");

  finto.cadi();
  // Mentre il flusso è giù il centro va avanti.
  finto.pubblica("progetti/uno", messaggioDiProva("d"));
  await finche(() => vista.gruppi.at(-1)?.at(-1) === "storia" && vista.gruppi.length > 2, "la storia torna dopo la caduta");
  assert.ok(vista.tutti().includes("error"));
  assert.deepEqual(vista.gruppi.at(-1), ["open", "1:a", "2:b", "3:c", "4:d", "storia"]);
  assert.equal(finto.richieste.at(-1), "GET /api/progetti/uno/eventi?dopo=3&versione=v1");
  smetti();
});

test("una copia che non vale più si butta: arriva la storia nuova, da capo", async () => {
  const { finto, cache, seguite } = prova();
  const chiave = chiaveDelProgetto("uno");
  const vecchio = finto.archivio("progetti/uno", messaggi("a", "b", "c"));
  cache.aggiungi(chiave, vecchio.versione, vecchio.eventi);
  finto.archivio("progetti/uno", messaggi("x", "y"));

  const vista = pagina();
  const smetti = seguite.segui("/api/progetti/uno", vista.manda);
  await finche(() => vista.gruppi.length === 2, "arriva la storia nuova");
  assert.deepEqual(vista.gruppi, [
    ["open", "1:a", "2:b", "3:c", "storia"],
    ["open", "1:x", "2:y", "storia"],
  ]);
  assert.deepEqual(cache.indice(chiave), { versione: "v2", ultimo: 2 });
  assert.equal(cache.righe(chiave).length, 2);
  smetti();
});

test("la Home segue l'argomento aperto, e quando cambia la cache non si confonde", async () => {
  const insieme = prova();
  const { finto, cache, seguite } = insieme;
  const primo = chiaveDellArgomento(finto.idAperto);
  finto.archivio(primo, messaggi("a", "b"));
  finto.archivio("argomenti/secondo", messaggi("s"));
  insieme.aperto = { chiave: primo, indice: finto.indice(primo) };
  cache.aggiungi(primo, "v1", finto.archivi.get(primo)?.eventi.slice(0, 1) ?? []);

  const vista = pagina();
  const smetti = seguite.segui("/api/home", vista.manda);
  assert.deepEqual(vista.gruppi[0], ["open", "1:a", "storia"]);
  await finche(() => vista.gruppi.length === 2, "arriva il seguito dell'argomento aperto");
  assert.deepEqual(vista.gruppi[1], ["2:b"]);
  assert.equal(finto.richieste.at(-1), "GET /api/home/eventi?dopo=1&versione=v1");

  // La Home passa a un altro argomento; il quadro non l'ha ancora detto.
  finto.passaAllArgomento("secondo");
  await finche(() => vista.gruppi.length === 3, "arriva la storia dell'altro argomento");
  assert.deepEqual(vista.gruppi[2], ["open", "1:s", "storia"]);
  // Nulla dell'argomento nuovo è finito nella copia di quello vecchio.
  assert.deepEqual(cache.indice(primo), { versione: "v1", ultimo: 2 });
  assert.equal(cache.indice(chiaveDellArgomento("secondo")), undefined);

  // Un evento in diretta prima che il quadro dica quale argomento è: alla pagina arriva, in cache no.
  finto.pubblica("argomenti/secondo", messaggioDiProva("t"));
  await finche(() => vista.tutti().includes("2:t"), "arriva l'evento in diretta");
  assert.equal(cache.indice(chiaveDellArgomento("secondo")), undefined);

  // Ora il quadro lo dice: da qui la diretta si scrive, ma solo se continua una copia che c'è.
  insieme.aperto = { chiave: chiaveDellArgomento("secondo"), indice: finto.indice("argomenti/secondo") };
  cache.aggiungi(chiaveDellArgomento("secondo"), "v2", finto.archivi.get("argomenti/secondo")?.eventi ?? []);
  finto.pubblica("argomenti/secondo", messaggioDiProva("u"));
  await finche(() => cache.indice(chiaveDellArgomento("secondo"))?.ultimo === 3, "la diretta entra nella copia dell'argomento nuovo");
  assert.deepEqual(cache.indice(primo), { versione: "v1", ultimo: 2 });
  smetti();
});

test("una conversazione che non c'è più non si riprova", async () => {
  const { finto, seguite } = prova();
  const vista = pagina();
  seguite.segui("/api/progetti/sparito", vista.manda);
  await finche(() => vista.tutti().includes("error"), "la pagina sa che non c'è");
  await new Promise((risolvi) => setTimeout(risolvi, 40));
  assert.deepEqual(finto.richieste, ["GET /api/progetti/sparito/eventi"]);
  assert.deepEqual(vista.tutti(), ["error"]);
});
