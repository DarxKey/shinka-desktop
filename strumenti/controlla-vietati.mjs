#!/usr/bin/env node
/**
 * Il controllo dei vietati: ferma un commit o un invio se in ciò che sta per entrare nel
 * repository compare un'espressione che non deve diventare pubblica (ADR 0008).
 *
 * L'elenco sta fuori dal repository, perché contiene proprio ciò che non deve uscire: una
 * espressione per riga, senza distinzione tra maiuscole e minuscole; le righe vuote e quelle che
 * cominciano con # non contano. Senza elenco non si registra e non si invia nulla.
 *
 * Il rifiuto dice dove, senza ripetere che cosa.
 *
 *   node strumenti/controlla-vietati.mjs indice              ciò che è pronto per il commit
 *   node strumenti/controlla-vietati.mjs messaggio <file>    il messaggio del commit
 *   node strumenti/controlla-vietati.mjs invio               i commit che stanno per essere inviati
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** I file che raccontano l'installazione del proprietario: restano nella cartella, mai in Git. */
export const ESCLUSI = ["BRIEF.md", "STATO.md"];

const ZERI = /^0+$/;

/** Dove sta l'elenco: lo dice SHINKA_DESKTOP_VIETATI, altrimenti la cartella di configurazione dell'utente. */
export function percorsoElenco(ambiente = process.env) {
  return ambiente.SHINKA_DESKTOP_VIETATI ?? join(homedir(), ".config", "shinka-desktop", "pubblicazione-vietati.txt");
}

/** Le espressioni dell'elenco, in minuscolo. */
export function leggiElenco(testo) {
  return testo
    .split(/\r?\n/)
    .map((riga) => riga.trim())
    .filter((riga) => riga !== "" && !riga.startsWith("#"))
    .map((riga) => riga.toLowerCase());
}

/** Vero se il testo contiene una delle espressioni vietate. */
export function contieneVietati(testo, vietati) {
  const minuscolo = testo.toLowerCase();
  return vietati.some((vietato) => minuscolo.includes(vietato));
}

/**
 * Le righe aggiunte da una differenza di Git, con il file e il numero di riga che avranno.
 * Legge anche i nomi dei file toccati, compresi quelli rinominati.
 */
export function righeAggiunte(differenza) {
  const righe = [];
  const file = new Set();
  let corrente;
  let numero = 0;
  for (const riga of differenza.split("\n")) {
    if (riga.startsWith("+++ ")) {
      corrente = riga === "+++ /dev/null" ? undefined : riga.slice(4).replace(/^b\//, "").trimEnd();
      if (corrente !== undefined) file.add(corrente);
      continue;
    }
    if (riga.startsWith("--- ") || riga.startsWith("diff --git ")) continue;
    const rinominato = /^rename to (.+)$/.exec(riga);
    if (rinominato?.[1] !== undefined) {
      file.add(rinominato[1].trimEnd());
      continue;
    }
    const blocco = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(riga);
    if (blocco?.[1] !== undefined) {
      numero = Number(blocco[1]);
      continue;
    }
    if (riga.startsWith("+") && corrente !== undefined) {
      righe.push({ file: corrente, numero, testo: riga.slice(1) });
      numero += 1;
    }
  }
  return { righe, file: [...file] };
}

/** I punti di una differenza in cui compare un vietato o un file escluso, detti senza ripetere l'espressione. */
export function controllaDifferenza(differenza, vietati, dove = "") {
  const trovati = [];
  const { righe, file } = righeAggiunte(differenza);
  for (const nome of file) {
    if (ESCLUSI.includes(nome)) trovati.push(`${dove}${nome}: è un file escluso, non va in Git`);
    if (contieneVietati(nome, vietati)) trovati.push(`${dove}nome del file ${file.indexOf(nome) + 1} tra quelli toccati`);
  }
  for (const riga of righe) {
    if (contieneVietati(riga.testo, vietati)) trovati.push(`${dove}${riga.file}:${riga.numero}`);
  }
  return trovati;
}

/** I commit che un invio porterebbe al remoto, dalle righe che Git passa a pre-push. */
export function commitDaInviare(righeDiInvio, elenca) {
  const commit = new Set();
  for (const riga of righeDiInvio.split("\n")) {
    const [, locale, , remoto] = riga.trim().split(/\s+/);
    if (locale === undefined || remoto === undefined || ZERI.test(locale)) continue;
    const intervallo = ZERI.test(remoto) ? [locale, "--not", "--remotes"] : [`${remoto}..${locale}`];
    for (const id of elenca(intervallo)) commit.add(id);
  }
  return [...commit];
}

function git(argomenti) {
  return execFileSync("git", argomenti, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function principale(argomenti) {
  let vietati;
  try {
    vietati = leggiElenco(readFileSync(percorsoElenco(), "utf8"));
  } catch {
    vietati = [];
  }
  if (vietati.length === 0) {
    console.error(`Manca l'elenco dei vietati (${percorsoElenco()}), oppure è vuoto: senza elenco non si registra e non si invia.`);
    return 1;
  }

  const [modo, file] = argomenti;
  let trovati = [];
  if (modo === "indice") {
    trovati = controllaDifferenza(git(["diff", "--cached", "--no-color", "-U0", "-M"]), vietati);
  } else if (modo === "messaggio" && file !== undefined) {
    if (contieneVietati(readFileSync(file, "utf8"), vietati)) trovati.push("il messaggio del commit");
  } else if (modo === "invio") {
    const elenca = (intervallo) => git(["rev-list", ...intervallo]).split("\n").filter((id) => id !== "");
    for (const id of commitDaInviare(readFileSync(0, "utf8"), elenca)) {
      const breve = id.slice(0, 8);
      if (contieneVietati(git(["log", "-1", "--format=%an%n%ae%n%cn%n%ce%n%B", id]), vietati)) {
        trovati.push(`commit ${breve}: autore o messaggio`);
      }
      trovati.push(...controllaDifferenza(git(["show", "--format=", "--no-color", "-U0", "-M", id]), vietati, `commit ${breve}: `));
    }
  } else {
    console.error("Uso: controlla-vietati.mjs indice | messaggio <file> | invio");
    return 2;
  }

  if (trovati.length === 0) return 0;
  console.error("Fermato dal controllo dei vietati. Qui c'è qualcosa che non deve diventare pubblico:");
  for (const dove of trovati) console.error(`  - ${dove}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = principale(process.argv.slice(2));
}
