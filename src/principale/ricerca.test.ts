import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import type { EventoArchiviato, EventoConversazione } from "../../shinka/src/protocollo/eventi.ts";
import { Cache } from "./cache.ts";
import { cercaInCache, estrattoDi, paroleDi } from "./ricerca.ts";

let minuto = 0;

/** Un evento archiviato, ciascuno un minuto dopo quello di prima. */
function archiviato(n: number, evento: Record<string, unknown>): EventoArchiviato {
  minuto += 1;
  return { n, quando: new Date(Date.UTC(2026, 10, 23, 10, minuto)).toISOString(), evento: evento as unknown as EventoConversazione };
}

function delProprietario(n: number, testo: string): EventoArchiviato {
  return archiviato(n, { tipo: "messaggio-proprietario", id: `m${n}`, testo });
}

function diClaude(n: number, testo: string): EventoArchiviato {
  return archiviato(n, { tipo: "testo-concluso", idTesto: `t${n}`, testo });
}

function conIlQuadro(cache: Cache): Cache {
  cache.scriviQuadro("progetti", JSON.stringify({ progetti: [{ id: "orto", nome: "L'orto" }, { id: "barca", nome: "La barca" }] }));
  cache.scriviQuadro("argomenti", JSON.stringify({ idAperto: "2026-11-23-oggi", archiviati: [{ id: "2026-11-20-ieri", titolo: "Le ferie" }] }));
  return cache;
}

test("si cerca senza badare a maiuscole e accenti, e ogni parola deve stare nello stesso messaggio", () => {
  const cache = conIlQuadro(Cache.apri(":memory:"));
  cache.aggiungi("progetti/orto", "v1", [
    delProprietario(1, "Quando si piantano i pomodori? Perché l'anno scorso è andata male."),
    archiviato(2, { tipo: "turno-iniziato" }),
    diClaude(3, "I POMODORI si piantano a maggio."),
    delProprietario(4, "E le zucchine, perché no?"),
  ]);
  cache.aggiungi("argomenti/2026-11-23-oggi", "v1", [delProprietario(1, "Ricordami i pomodori domani")]);
  cache.aggiungi("argomenti/2026-11-20-ieri", "v1", [diClaude(1, "Per le ferie: città d'arte o mare?")]);

  // Dal più recente; la Home è l'argomento aperto.
  assert.deepEqual(
    cercaInCache(cache, "pomodori").map((trovato) => [trovato.dove, trovato.titolo, trovato.chi]),
    [
      [{ tipo: "home" }, "Home", "proprietario"],
      [{ tipo: "progetto", id: "orto" }, "L'orto", "claude"],
      [{ tipo: "progetto", id: "orto" }, "L'orto", "proprietario"],
    ],
  );
  // Un pezzo di parola basta, gli accenti non contano, e le parole vanno trovate tutte insieme.
  assert.deepEqual(cercaInCache(cache, "PERCHE pomod").map((trovato) => trovato.estratto), ["Quando si piantano i pomodori? Perché l'anno scorso è andata male."]);
  assert.deepEqual(cercaInCache(cache, "Città").map((trovato) => trovato.dove), [{ tipo: "argomento", id: "2026-11-20-ieri" }]);
  assert.equal(cercaInCache(cache, "pomodori zucchine").length, 0);
  assert.equal(cercaInCache(cache, "   ").length, 0);
  // Due lettere sole si cercano lo stesso; `%` e `_` sono lettere come le altre.
  assert.equal(cercaInCache(cache, "no").length, 3);
  assert.equal(cercaInCache(cache, "%").length, 0);
  assert.equal(cercaInCache(cache, "p_modori").length, 0);
});

test("l'estratto è il testo intorno alla prima parola, e i risultati hanno un tetto", () => {
  const lungo = `${"prima ".repeat(40)}eccola qui ${"dopo ".repeat(40)}`;
  const estratto = estrattoDi(lungo, "eccola");
  assert.match(estratto, /^….*eccola qui.*…$/);
  assert.ok(estratto.length < 160);
  assert.equal(estrattoDi("corto\n\ne   spezzato", "spezzato"), "corto e spezzato");
  assert.deepEqual(paroleDi("  Più  PAROLE\tinsieme "), ["piu", "parole", "insieme"]);

  const cache = conIlQuadro(Cache.apri(":memory:"));
  cache.aggiungi("progetti/barca", "v1", Array.from({ length: 70 }, (_, indice) => delProprietario(indice + 1, `La vela numero ${indice + 1}`)));
  const trovati = cercaInCache(cache, "vela");
  assert.equal(trovati.length, 50);
  assert.equal(trovati[0]?.estratto, "La vela numero 70");
});

test("ciò che esce dalla cache non si trova più, e lo stesso evento non si trova due volte", () => {
  const cache = conIlQuadro(Cache.apri(":memory:"));
  const messaggio = delProprietario(1, "La chiglia va riverniciata");
  cache.aggiungi("progetti/barca", "v1", [messaggio]);
  cache.aggiungi("progetti/barca", "v1", [messaggio, diClaude(2, "Con quale vernice?")]);
  assert.equal(cercaInCache(cache, "chiglia").length, 1);

  // Un'altra versione dell'archivio butta la copia, indice compreso.
  cache.aggiungi("progetti/barca", "v2", [delProprietario(1, "Si ricomincia dal timone")]);
  assert.equal(cercaInCache(cache, "chiglia").length, 0);
  assert.equal(cercaInCache(cache, "timone").length, 1);
  cache.togli("progetti/barca");
  assert.equal(cercaInCache(cache, "timone").length, 0);

  // Una conversazione che il quadro non ha più non si mostra.
  cache.aggiungi("progetti/sparito", "v1", [delProprietario(1, "Del timone non resta nulla")]);
  assert.equal(cercaInCache(cache, "timone").length, 0);
});

test("una cache di prima, senza indice, lo riceve all'apertura e tiene ciò che aveva", () => {
  const file = join(mkdtempSync(join(tmpdir(), "shinka-desktop-prova-")), "cache.sqlite");
  const vecchia = new DatabaseSync(file);
  vecchia.exec(`
    create table conversazioni (chiave text primary key, versione text not null, ultimo integer not null) without rowid;
    create table eventi (chiave text not null, n integer not null, riga text not null, primary key (chiave, n)) without rowid;
    create table ricordati (chiave text not null, tipo text not null, riga text not null, primary key (chiave, tipo)) without rowid;
    create table quadro (nome text primary key, dati text not null) without rowid;
    create table valori (nome text primary key, valore text not null) without rowid;
    pragma user_version = 1;
  `);
  vecchia.prepare("insert into conversazioni values (?, ?, ?)").run("progetti/orto", "v1", 2);
  vecchia.prepare("insert into eventi values (?, ?, ?)").run("progetti/orto", 1, JSON.stringify(delProprietario(1, "Le fragole di prima")));
  vecchia.prepare("insert into eventi values (?, ?, ?)").run("progetti/orto", 2, "non è json");
  vecchia.close();

  let cache = conIlQuadro(Cache.apri(file));
  assert.deepEqual(cache.indice("progetti/orto"), { versione: "v1", ultimo: 2 });
  assert.equal(cercaInCache(cache, "fragole").length, 1);
  cache.chiudi();
  // Riaperta, è già della forma nuova: non si indicizza un'altra volta.
  cache = Cache.apri(file);
  assert.equal(cercaInCache(cache, "fragole").length, 1);
  cache.chiudi();

  // Una forma sconosciuta si butta per intero, indice compreso.
  const altra = new DatabaseSync(file);
  altra.exec("pragma user_version = 99");
  altra.close();
  cache = Cache.apri(file);
  assert.equal(cache.indice("progetti/orto"), undefined);
  assert.equal(cercaInCache(conIlQuadro(cache), "fragole").length, 0);
  cache.chiudi();
});
