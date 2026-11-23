import assert from "node:assert/strict";
import { test } from "node:test";
import { Cache, baseDi, chiaveDellArgomento, chiaveDelProgetto } from "./cache.ts";
import { Centro, ErroreCentro, NonRaggiungibile, aggiungiDispositivo, indirizzoDelCentro, indirizzoDelleApi } from "./centro.ts";
import { LettoreDiFlusso } from "./flusso.ts";
import { CentroFinto, GETTONE_FINTO, INDIRIZZO_FINTO, PASSWORD_FINTA, finche, messaggioDiProva } from "./prove/centro-finto.ts";
import { Quadro } from "./quadro.ts";
import { Sincronia } from "./sincronia.ts";

const PROGRAMMA = "ShinkaDesktop/prova";

function insieme(): { finto: CentroFinto; centro: Centro; cache: Cache; sincronia: Sincronia } {
  const finto = new CentroFinto();
  const centro = new Centro({ indirizzo: INDIRIZZO_FINTO, gettone: GETTONE_FINTO, chiedi: finto.chiedi, programma: PROGRAMMA });
  const cache = Cache.apri(":memory:");
  return { finto, centro, cache, sincronia: new Sincronia({ centro, cache }) };
}

function tanti(quanti: number, da = 1): ReturnType<typeof messaggioDiProva>[] {
  return Array.from({ length: quanti }, (_, indice) => messaggioDiProva(String(da + indice)));
}

test("un flusso si ricompone comunque arrivi tagliato, e i commenti non contano", () => {
  const lettore = new LettoreDiFlusso();
  assert.deepEqual(lettore.aggiungi("retry: 2000\n\n: battito\n\nevent: progetti\nda"), []);
  assert.deepEqual(lettore.aggiungi('ta: {"a":1}\n\ndata: {"n":1}\r\n\r\nevent: storia\ndata: {}\n'), [
    { nome: "progetti", dati: '{"a":1}' },
    { nome: "message", dati: '{"n":1}' },
  ]);
  assert.deepEqual(lettore.aggiungi("\n"), [{ nome: "storia", dati: "{}" }]);
});

test("l'indirizzo del centro si mette in forma, e ciò che non è un indirizzo si rifiuta", () => {
  assert.equal(indirizzoDelCentro("  shinka.example/qualcosa/ "), "https://shinka.example");
  assert.equal(indirizzoDelCentro("http://127.0.0.1:7850"), "http://127.0.0.1:7850");
  assert.equal(indirizzoDelCentro("ftp://shinka.example"), undefined);
  assert.equal(indirizzoDelCentro("https://utente:segreto@shinka.example"), undefined);
  assert.equal(indirizzoDelCentro(""), undefined);
});

test("la pagina può chiedere solo le API del suo centro", () => {
  assert.equal(indirizzoDelleApi(INDIRIZZO_FINTO, "/api/stato?x=1"), "https://shinka.example/api/stato?x=1");
  assert.equal(indirizzoDelleApi(INDIRIZZO_FINTO, "/api/../segreti"), undefined);
  assert.equal(indirizzoDelleApi(INDIRIZZO_FINTO, "//altrove.example/api/x"), undefined);
  assert.equal(indirizzoDelleApi(INDIRIZZO_FINTO, "https://altrove.example/api/x"), undefined);
  assert.equal(indirizzoDelleApi(INDIRIZZO_FINTO, "/altro"), undefined);
});

test("il gettone si ottiene con la password; una sbagliata dice perché", async () => {
  const finto = new CentroFinto();
  const opzioni = { indirizzo: INDIRIZZO_FINTO, chiedi: finto.chiedi, programma: PROGRAMMA };
  assert.deepEqual(await aggiungiDispositivo(opzioni, PASSWORD_FINTA, "PC di prova"), { id: "dispositivo-1", token: GETTONE_FINTO });
  await assert.rejects(aggiungiDispositivo(opzioni, "sbagliata", "PC di prova"), (errore: unknown) => errore instanceof ErroreCentro && errore.stato === 401 && errore.message === "Password non valida.");
});

test("un gettone rifiutato lo si viene a sapere, e senza rete l'errore è un altro", async () => {
  const finto = new CentroFinto();
  let rifiuti = 0;
  const centro = new Centro({ indirizzo: INDIRIZZO_FINTO, gettone: "gettone-che-non-vale-piu", chiedi: finto.chiedi, programma: PROGRAMMA, alRifiuto: () => (rifiuti += 1) });
  await assert.rejects(centro.chiama("GET", "/api/progetti/x/storia"), (errore: unknown) => errore instanceof ErroreCentro && errore.stato === 401);
  assert.equal(rifiuti, 1);
  finto.spento = true;
  await assert.rejects(centro.chiama("GET", "/api/progetti/x/storia"), NonRaggiungibile);
  assert.equal(rifiuti, 1);
});

test("la cache butta una copia quando arriva un'altra versione", () => {
  const cache = Cache.apri(":memory:");
  const chiave = chiaveDelProgetto("uno");
  cache.aggiungi(chiave, "v1", [{ n: 1, quando: "", evento: messaggioDiProva("a") }, { n: 2, quando: "", evento: messaggioDiProva("b") }]);
  cache.ricorda(chiave, "stato", "{}");
  assert.deepEqual(cache.indice(chiave), { versione: "v1", ultimo: 2 });
  cache.aggiungi(chiave, "v2", [{ n: 1, quando: "", evento: messaggioDiProva("c") }]);
  assert.deepEqual(cache.indice(chiave), { versione: "v2", ultimo: 1 });
  assert.equal(cache.righe(chiave).length, 1);
  assert.deepEqual(cache.ricordati(chiave), []);
  assert.equal(baseDi(chiaveDellArgomento("2026-11-23-a b")), "/api/argomenti/2026-11-23-a%20b");
});

test("la prima sincronizzazione scarica tutto a pezzi, senza aprire flussi", async () => {
  const { finto, cache, sincronia } = insieme();
  finto.archivio("progetti/lungo", tanti(2500));
  finto.archivio("argomenti/corto", tanti(3));
  sincronia.dichiara([
    { chiave: chiaveDelProgetto("lungo"), indice: finto.indice("progetti/lungo") },
    { chiave: chiaveDellArgomento("corto"), indice: finto.indice("argomenti/corto") },
  ]);
  await sincronia.quiete();
  assert.deepEqual(cache.indice(chiaveDelProgetto("lungo")), { versione: "v1", ultimo: 2500 });
  assert.equal(cache.righe(chiaveDelProgetto("lungo")).length, 2500);
  assert.equal(cache.righe(chiaveDellArgomento("corto")).length, 3);
  // Tre pezzi da mille per il progetto, uno per l'argomento; nessun flusso, quindi nessun motore preparato.
  assert.equal(finto.richieste.filter((richiesta) => richiesta.includes("/progetti/lungo/storia")).length, 3);
  assert.deepEqual(finto.flussiAperti, []);
  assert.deepEqual(sincronia.stato, { mancano: 0, ferma: false });
});

test("poi arriva solo il nuovo, e una conversazione già in pari non si chiede", async () => {
  const { finto, cache, sincronia } = insieme();
  finto.archivio("progetti/uno", tanti(10));
  sincronia.dichiara([{ chiave: chiaveDelProgetto("uno"), indice: finto.indice("progetti/uno") }]);
  await sincronia.quiete();
  finto.richieste.length = 0;

  sincronia.dichiara([{ chiave: chiaveDelProgetto("uno"), indice: finto.indice("progetti/uno") }]);
  await sincronia.quiete();
  assert.deepEqual(finto.richieste, []);

  finto.pubblica("progetti/uno", messaggioDiProva("undici"));
  finto.pubblica("progetti/uno", messaggioDiProva("dodici"));
  sincronia.dichiara([{ chiave: chiaveDelProgetto("uno"), indice: finto.indice("progetti/uno") }]);
  await sincronia.quiete();
  assert.deepEqual(finto.richieste, ["GET /api/progetti/uno/storia?limite=1000&dopo=10&versione=v1"]);
  assert.equal(cache.righe(chiaveDelProgetto("uno")).length, 12);
  assert.equal((JSON.parse(cache.righe(chiaveDelProgetto("uno")).at(-1) ?? "{}") as { n: number }).n, 12);
});

test("una versione nuova fa riscaricare da capo, e ciò che non è più negli elenchi esce", async () => {
  const { finto, cache, sincronia } = insieme();
  finto.archivio("argomenti/a", tanti(8));
  finto.archivio("argomenti/b", tanti(2));
  finto.archivio("progetti/p", tanti(2));
  sincronia.dichiara(["argomenti/a", "argomenti/b", "progetti/p"].map((chiave) => ({ chiave: chiave as ReturnType<typeof chiaveDelProgetto>, indice: finto.indice(chiave) })));
  await sincronia.quiete();

  // Il centro ha tagliato l'argomento: meno eventi, in una versione nuova.
  finto.archivio("argomenti/a", tanti(5, 100));
  sincronia.dichiara([{ chiave: chiaveDellArgomento("a"), indice: finto.indice("argomenti/a") }]);
  await sincronia.quiete();
  assert.deepEqual(cache.indice(chiaveDellArgomento("a")), { versione: "v4", ultimo: 5 });
  assert.equal(cache.righe(chiaveDellArgomento("a")).length, 5);

  // L'argomento b è stato eliminato: l'elenco completo non lo ha più. I progetti non c'entrano.
  sincronia.completo("argomenti", new Set([chiaveDellArgomento("a")]));
  assert.deepEqual(cache.chiavi().sort(), ["argomenti/a", "progetti/p"]);
});

test("senza rete la coda si ferma, e riparte alla prossima dichiarazione", async () => {
  const { finto, cache, sincronia } = insieme();
  finto.archivio("progetti/uno", tanti(4));
  finto.spento = true;
  sincronia.dichiara([{ chiave: chiaveDelProgetto("uno"), indice: finto.indice("progetti/uno") }]);
  await sincronia.quiete();
  assert.equal(sincronia.stato.ferma, true);
  assert.equal(cache.indice(chiaveDelProgetto("uno")), undefined);

  finto.spento = false;
  sincronia.dichiara([{ chiave: chiaveDelProgetto("uno"), indice: finto.indice("progetti/uno") }]);
  await sincronia.quiete();
  assert.equal(cache.righe(chiaveDelProgetto("uno")).length, 4);
});

test("il quadro resta in cache, mette in coda ciò che è cambiato e riprende dopo una caduta", async () => {
  const { finto, centro, cache, sincronia } = insieme();
  finto.archivio("progetti/p", tanti(3));
  finto.archivio(`argomenti/${finto.idAperto}`, tanti(2));
  finto.archivio("argomenti/vecchio", tanti(1));
  const collegamenti: boolean[] = [];
  const quadro = new Quadro({ centro, cache, sincronia, attese: [5], alCollegamento: (collegato) => collegamenti.push(collegato) });
  quadro.avvia();
  await finche(() => finto.quadriAperti === 1, "il quadro si apre");

  const progetti = { progetti: [{ id: "p", nome: "Progetto", ...finto.indice("progetti/p") }] };
  const argomenti = { idAperto: finto.idAperto, aperto: finto.indice(`argomenti/${finto.idAperto}`), archiviati: [{ id: "vecchio", titolo: "Vecchio", ...finto.indice("argomenti/vecchio") }] };
  finto.quadro("progetti", progetti);
  finto.quadro("argomenti", argomenti);
  await finche(() => cache.chiavi().length === 3, "le tre conversazioni arrivano in cache");
  await sincronia.quiete();
  assert.deepEqual(quadro.argomentoAperto(), { chiave: `argomenti/${finto.idAperto}`, indice: finto.indice(`argomenti/${finto.idAperto}`) });

  // Chi guarda il quadro dopo riceve subito l'ultima forma vista, anche senza centro.
  const visti: string[] = [];
  quadro.segui((messaggio) => visti.push(messaggio.nome));
  assert.deepEqual(visti, ["argomenti", "progetti"]);

  finto.cadi();
  await finche(() => finto.quadriAperti === 1 && collegamenti.at(-1) === false, "il quadro si riapre dopo la caduta");
  finto.quadro("progetti", { progetti: [] });
  await finche(() => !cache.chiavi().includes("progetti/p"), "il progetto eliminato esce dalla cache");
  assert.deepEqual(collegamenti, [true, false, true]);
  quadro.chiudi();
  await finche(() => finto.quadriAperti === 0, "il quadro si chiude");
});
