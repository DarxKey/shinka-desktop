import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { StatoProgetti } from "../../shinka/src/protocollo/progetti.ts";
import { buttaLaCache, cartellaDelleImmagini, fileDellaCache } from "./collegamento.ts";
import { Custodia, type Cifra } from "./dispositivo.ts";
import { Immagini } from "./immagini.ts";
import { cartellaSuQuestoPc, centroDelNodoDiQui, idDelNodoDiQui } from "./luogo.ts";
import { eInCasa, siPuoRaggiungere } from "./rete.ts";
import { Terminali, cartellaDiPartenza, trovaShell } from "./terminali.ts";

const DISPOSITIVO = { centro: "https://shinka.example", id: "dispositivo-1", nome: "PC di prova", gettone: "gettone-di-prova-0123456789" };

/** Una cifra finta: rovescia il testo. `chiave` cambia per fingere un altro utente. */
function cifra(stato: { chiave: string; daRicifrare: boolean; disponibile: boolean }): Cifra {
  return {
    disponibile: async () => stato.disponibile,
    cifra: async (testo) => Buffer.from(`${stato.chiave}:${[...testo].reverse().join("")}`),
    decifra: async (cifrato) => {
      const [chiave, resto] = cifrato.toString().split(":");
      if (chiave !== stato.chiave || resto === undefined) throw new Error("non si decifra");
      return { testo: [...resto].reverse().join(""), daRicifrare: stato.daRicifrare };
    },
  };
}

function nuovaCartella(): string {
  return mkdtempSync(join(tmpdir(), "shinka-desktop-prova-"));
}

test("il gettone sta su disco solo cifrato, e si rilegge", async () => {
  const file = join(nuovaCartella(), "profilo", "dispositivo.json");
  const stato = { chiave: "utente", daRicifrare: false, disponibile: true };
  const custodia = new Custodia(file, cifra(stato));
  assert.equal(await custodia.dispositivo(), undefined);
  await custodia.ricorda(DISPOSITIVO);
  assert.ok(!readFileSync(file, "utf8").includes(DISPOSITIVO.gettone));
  assert.deepEqual(await custodia.dispositivo(), DISPOSITIVO);
  assert.deepEqual(custodia.ultimo(), { centro: DISPOSITIVO.centro, nome: DISPOSITIVO.nome });

  // Cifrato da un altro utente non si legge: serve di nuovo l'accesso, ma si sa dov'era.
  stato.chiave = "altro";
  assert.equal(await custodia.dispositivo(), undefined);
  assert.deepEqual(custodia.ultimo(), { centro: DISPOSITIVO.centro, nome: DISPOSITIVO.nome });
});

test("un gettone rifiutato si butta e resta il centro; uscendo non resta nulla", async () => {
  const file = join(nuovaCartella(), "dispositivo.json");
  const custodia = new Custodia(file, cifra({ chiave: "utente", daRicifrare: false, disponibile: true }));
  await custodia.ricorda(DISPOSITIVO);
  custodia.scordaIlGettone();
  assert.equal(await custodia.dispositivo(), undefined);
  assert.deepEqual(custodia.ultimo(), { centro: DISPOSITIVO.centro, nome: DISPOSITIVO.nome });
  assert.ok(!readFileSync(file, "utf8").includes("gettone"));
  custodia.scordaTutto();
  assert.equal(custodia.ultimo(), undefined);
  assert.ok(!existsSync(file));
});

test("senza una cifra il gettone non si scrive, e se la chiave cambia lo si riscrive", async () => {
  const file = join(nuovaCartella(), "dispositivo.json");
  const stato = { chiave: "utente", daRicifrare: false, disponibile: false };
  const custodia = new Custodia(file, cifra(stato));
  await assert.rejects(custodia.ricorda(DISPOSITIVO), /non sa custodire/);
  assert.ok(!existsSync(file));

  stato.disponibile = true;
  await custodia.ricorda(DISPOSITIVO);
  const prima = readFileSync(file, "utf8");
  stato.daRicifrare = true;
  writeFileSync(file, prima.replace("PC di prova", "PC rinominato"));
  assert.equal((await custodia.dispositivo())?.nome, "PC rinominato");
  assert.match(readFileSync(file, "utf8"), /PC rinominato/);
});

test("in chiaro solo restando in casa", () => {
  for (const nome of ["localhost", "127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.10", "100.80.1.1", "nas", "nas.local", "[::1]", "fd12::1"]) assert.equal(eInCasa(nome), true, nome);
  for (const nome of ["shinka.example", "8.8.8.8", "172.32.0.1", "192.169.1.1", "2001:db8::1"]) assert.equal(eInCasa(nome), false, nome);
  assert.equal(siPuoRaggiungere("https://shinka.example"), true);
  assert.equal(siPuoRaggiungere("http://shinka.example"), false);
  assert.equal(siPuoRaggiungere("http://192.168.1.10:7850"), true);
  assert.equal(siPuoRaggiungere("ftp://192.168.1.10"), false);
});

test("dal nodo di questo PC si leggono solo l'identificativo e il centro", () => {
  const casa = nuovaCartella();
  assert.equal(idDelNodoDiQui({}, casa), undefined);
  assert.equal(centroDelNodoDiQui({}, casa), undefined);
  const dati = join(casa, "Shinka", "nodo", "dati-nodo");
  mkdirSync(dati, { recursive: true });
  writeFileSync(join(dati, "identita.json"), JSON.stringify({ idNodo: "nodo-di-qui", segreto: "non-si-tocca" }));
  writeFileSync(join(dati, "nodo.json"), JSON.stringify({ centro: "http://192.168.1.10:7850/", nome: "PC" }));
  assert.equal(idDelNodoDiQui({}, casa), "nodo-di-qui");
  assert.equal(centroDelNodoDiQui({}, casa), "http://192.168.1.10:7850");
  // Un nodo installato altrove lo dice la variabile che Shinka usa per installarlo.
  assert.equal(idDelNodoDiQui({ SHINKA_CARTELLA: join(casa, "altrove") }, casa), undefined);

  const progetti = { progetti: [{ id: "qui", idAmbiente: "nodo-di-qui", cartella: "C:\\Lavori\\qui" }, { id: "la", idAmbiente: "altro-nodo", cartella: "/home/la" }] } as unknown as StatoProgetti;
  assert.equal(cartellaSuQuestoPc(progetti, "qui", "nodo-di-qui"), "C:\\Lavori\\qui");
  assert.equal(cartellaSuQuestoPc(progetti, "la", "nodo-di-qui"), undefined);
  assert.equal(cartellaSuQuestoPc(progetti, "qui", undefined), undefined);
  assert.equal(cartellaSuQuestoPc(undefined, "qui", "nodo-di-qui"), undefined);
});

test("le immagini tenute hanno un tetto, e uscendo da un centro la sua cache sparisce", () => {
  const cartella = nuovaCartella();
  const centro = "https://shinka.example";
  const immagini = new Immagini(cartellaDelleImmagini(cartella, centro), 250);
  const dati = Buffer.alloc(100, 7);
  immagini.tieni("/api/progetti/a/immagini/1.png", "image/png", dati);
  immagini.tieni("/api/progetti/a/immagini/2.png", "image/png; charset=binary", dati);
  immagini.tieni("/api/progetti/a/immagini/pagina.html", "text/html", dati);
  assert.equal(immagini.peso, 200);
  assert.equal(immagini.leggi("/api/progetti/a/immagini/pagina.html"), undefined);
  // La terza supera il tetto: esce quella usata meno di recente, che è la seconda.
  assert.ok(immagini.leggi("/api/progetti/a/immagini/1.png"));
  immagini.tieni("/api/progetti/a/immagini/3.png", "image/png", dati);
  assert.equal(immagini.peso, 200);
  assert.equal(immagini.leggi("/api/progetti/a/immagini/2.png"), undefined);

  // Riaprendo l'app le immagini tenute si ritrovano.
  const riaperte = new Immagini(cartellaDelleImmagini(cartella, centro), 250);
  assert.equal(riaperte.leggi("/api/progetti/a/immagini/3.png")?.tipo, "image/png");

  writeFileSync(fileDellaCache(cartella, centro), "");
  buttaLaCache(cartella, centro);
  assert.ok(!existsSync(fileDellaCache(cartella, centro)));
  assert.ok(!existsSync(cartellaDelleImmagini(cartella, centro)));
});

test("le shell sono quelle che questo PC ha, e la pagina non ne sceglie altre", () => {
  const radice = nuovaCartella();
  const crea = (...parti: string[]): string => {
    const file = join(radice, ...parti);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "");
    return file;
  };
  const cmd = crea("Windows", "System32", "cmd.exe");
  crea("Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  crea("Programmi", "Git", "bin", "bash.exe");
  const shell = trovaShell({ SystemRoot: join(radice, "Windows"), ProgramFiles: join(radice, "Programmi"), ComSpec: cmd, PATH: "" });
  assert.deepEqual(shell.map((voce) => voce.id), ["powershell", "cmd", "git-bash"]);

  assert.equal(cartellaDiPartenza(radice), radice);
  assert.notEqual(cartellaDiPartenza(join(radice, "non-esiste")), join(radice, "non-esiste"));

  const avviati: { file: string; cwd: string | undefined; colonne: number | undefined }[] = [];
  let allUscita: ((esito: { exitCode: number }) => void) | undefined;
  let alDato: ((dati: string) => void) | undefined;
  const avvia = ((file: string, _argomenti: string[], opzioni: { cwd?: string; cols?: number }) => {
    avviati.push({ file, cwd: opzioni.cwd, colonne: opzioni.cols });
    return {
      onData: (ascolta: (dati: string) => void) => (alDato = ascolta),
      onExit: (ascolta: (esito: { exitCode: number }) => void) => (allUscita = ascolta),
      write: () => {},
      resize: () => {},
      kill: () => allUscita?.({ exitCode: 0 }),
    };
  }) as unknown as typeof import("node-pty").spawn;
  const terminali = new Terminali(avvia, shell);
  const scritti: string[] = [];
  const finiti: string[] = [];
  const aperto = terminali.apri("terminale-1", { shell: "programma-qualsiasi.exe", cartella: radice, colonne: 9999, righe: 30 }, (_id, dati) => scritti.push(dati), (id) => finiti.push(id));
  // Una shell che non è tra quelle trovate diventa la prima dell'elenco.
  assert.equal(aperto.shell.id, "powershell");
  assert.equal(avviati[0]?.cwd, radice);
  assert.equal(avviati[0]?.colonne, 500);
  assert.throws(() => terminali.apri("terminale-1", { colonne: 80, righe: 24 }, () => {}, () => {}), /non valido/);
  assert.throws(() => terminali.apri("../x", { colonne: 80, righe: 24 }, () => {}, () => {}), /non valido/);

  alDato?.("uno ");
  alDato?.("due");
  terminali.chiudi("terminale-1");
  // Ciò che la shell ha scritto prima di chiudersi arriva comunque, tutto insieme.
  assert.deepEqual(scritti, ["uno due"]);
  assert.deepEqual(finiti, ["terminale-1"]);
});
