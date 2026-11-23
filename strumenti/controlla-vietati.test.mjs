import assert from "node:assert/strict";
import { test } from "node:test";
import { commitDaInviare, contieneVietati, controllaDifferenza, leggiElenco, righeAggiunte } from "./controlla-vietati.mjs";

const VIETATI = leggiElenco("# commento\n\n10.9.8.\nCasa.Esempio\n");

const DIFFERENZA = [
  "diff --git a/docs/nota.md b/docs/nota.md",
  "--- a/docs/nota.md",
  "+++ b/docs/nota.md",
  "@@ -3,0 +4,2 @@ titolo",
  "+una riga pulita",
  "+il centro sta su 10.9.8.7",
  "@@ -20 +22 @@",
  "-tolta: casa.esempio",
  "+rimessa pulita",
].join("\n");

test("l'elenco salta commenti e righe vuote, e non distingue le maiuscole", () => {
  assert.deepEqual(VIETATI, ["10.9.8.", "casa.esempio"]);
  assert.equal(contieneVietati("https://CASA.esempio/x", VIETATI), true);
  assert.equal(contieneVietati("https://shinka.example", VIETATI), false);
});

test("delle righe aggiunte si sa il file e il numero che avranno", () => {
  const { righe, file } = righeAggiunte(DIFFERENZA);
  assert.deepEqual(file, ["docs/nota.md"]);
  assert.deepEqual(
    righe.map((riga) => [riga.numero, riga.testo]),
    [
      [4, "una riga pulita"],
      [5, "il centro sta su 10.9.8.7"],
      [22, "rimessa pulita"],
    ],
  );
});

test("il rifiuto dice dove e non ripete che cosa; ciò che viene tolto non conta", () => {
  const trovati = controllaDifferenza(DIFFERENZA, VIETATI);
  assert.deepEqual(trovati, ["docs/nota.md:5"]);
  assert.equal(trovati.join(" ").includes("10.9.8."), false);
});

test("un file escluso non entra, nemmeno se è pulito", () => {
  const differenza = ["diff --git a/STATO.md b/STATO.md", "--- /dev/null", "+++ b/STATO.md", "@@ -0,0 +1 @@", "+tutto bene"].join("\n");
  assert.deepEqual(controllaDifferenza(differenza, VIETATI), ["STATO.md: è un file escluso, non va in Git"]);
});

test("un nome di file vietato viene fermato senza essere ripetuto", () => {
  const differenza = ["diff --git a/x b/casa.esempio.txt", "--- /dev/null", "+++ b/casa.esempio.txt", "@@ -0,0 +1 @@", "+pulito"].join("\n");
  const trovati = controllaDifferenza(differenza, VIETATI);
  assert.equal(trovati.length, 1);
  assert.equal(trovati[0].includes("casa.esempio"), false);
});

test("un ramo nuovo manda tutto ciò che il remoto non ha; uno già noto solo il tratto nuovo", () => {
  const chiesti = [];
  const elenca = (intervallo) => {
    chiesti.push(intervallo.join(" "));
    return ["aaa", "bbb"];
  };
  const zeri = "0".repeat(40);
  const righe = [`refs/heads/main 1111 refs/heads/main ${zeri}`, "refs/heads/altro 2222 refs/heads/altro 3333", `(delete) ${zeri} refs/heads/via 4444`].join("\n");
  assert.deepEqual(commitDaInviare(righe, elenca), ["aaa", "bbb"]);
  assert.deepEqual(chiesti, ["1111 --not --remotes", "3333..2222"]);
});
