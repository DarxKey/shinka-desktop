import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RIQUADRI_MASSIMI,
  VUOTA,
  conDivisione,
  conNuovaScheda,
  conRiquadroAttivo,
  conSchedaAccanto,
  conSchedaInVista,
  daSalvare,
  daSalvata,
  luogoDi,
  progettoDi,
  senzaRiquadro,
  senzaScheda,
} from "./disposizione.ts";
import { flussoDi } from "./flussi.ts";
import { SCORCIATOIE, comandoDelTasto, eUnComando, tastiInParole, type Tasto } from "../ponte/scorciatoie.ts";

test("ogni progetto ha i suoi terminali, tutto il resto usa quelli della Home", () => {
  assert.equal(luogoDi({ tipo: "progetto", id: "uno" }), "progetto:uno");
  assert.equal(luogoDi({ tipo: "argomento", id: "2026-11-23-x" }), "home");
  assert.equal(luogoDi({ tipo: "memoria" }), "home");
  assert.equal(progettoDi("progetto:uno"), "uno");
  assert.equal(progettoDi("home"), undefined);
});

test("schede e divisioni: il riquadro nuovo nasce accanto a quello in cui si scriveva", () => {
  let disposizione = conNuovaScheda(VUOTA, "pwsh");
  const prima = disposizione.schede[0];
  assert.ok(prima);
  assert.equal(disposizione.attiva, prima.id);

  disposizione = conDivisione(disposizione, "impilati");
  const divisa = disposizione.schede[0];
  assert.equal(divisa?.verso, "impilati");
  assert.equal(divisa?.riquadri.length, 2);
  // Il riquadro nuovo prende la shell di quello da cui nasce, e ci si scrive subito.
  assert.equal(divisa?.riquadri[1]?.shell, "pwsh");
  assert.equal(divisa?.attivo, divisa?.riquadri[1]?.id);

  // Tornando sul primo, la divisione successiva gli nasce accanto, non in fondo.
  disposizione = conRiquadroAttivo(disposizione, prima.attivo);
  disposizione = conDivisione(disposizione, "affiancati", "cmd");
  assert.deepEqual(disposizione.schede[0]?.riquadri.map((voce) => voce.shell), ["pwsh", "cmd", "pwsh"]);

  for (let giro = 0; giro < 5; giro += 1) disposizione = conDivisione(disposizione, "affiancati");
  assert.equal(disposizione.schede[0]?.riquadri.length, RIQUADRI_MASSIMI);
});

test("un riquadro che si chiude lascia il posto; l'ultimo porta via la scheda", () => {
  let disposizione = conDivisione(conNuovaScheda(VUOTA), "affiancati");
  disposizione = conNuovaScheda(disposizione);
  const [prima, seconda] = disposizione.schede;
  assert.ok(prima && seconda);
  assert.equal(disposizione.attiva, seconda.id);

  disposizione = senzaRiquadro(disposizione, prima.attivo);
  assert.equal(disposizione.schede[0]?.riquadri.length, 1);
  assert.equal(disposizione.schede[0]?.attivo, disposizione.schede[0]?.riquadri[0]?.id);

  // Chiudere la scheda in vista porta in vista quella accanto.
  disposizione = senzaRiquadro(disposizione, seconda.attivo);
  assert.equal(disposizione.schede.length, 1);
  assert.equal(disposizione.attiva, prima.id);
  disposizione = senzaScheda(disposizione, prima.id);
  assert.deepEqual(disposizione, { schede: [], attiva: undefined });
  assert.equal(conSchedaInVista(disposizione, "non-c-e"), disposizione);
});

test("la disposizione si ritrova, con riquadri nuovi", () => {
  let disposizione = conDivisione(conNuovaScheda(VUOTA, "pwsh"), "impilati", "cmd");
  disposizione = conNuovaScheda(disposizione);
  disposizione = conSchedaInVista(disposizione, disposizione.schede[0]?.id ?? "");
  const ritrovata = daSalvata(daSalvare(disposizione));
  assert.deepEqual(
    ritrovata.schede.map((scheda) => ({ verso: scheda.verso, shell: scheda.riquadri.map((voce) => voce.shell) })),
    [
      { verso: "impilati", shell: ["pwsh", "cmd"] },
      { verso: "affiancati", shell: [undefined] },
    ],
  );
  assert.equal(ritrovata.attiva, ritrovata.schede[0]?.id);
  // Le shell sono nuove: nessun identificativo è quello di prima.
  const prima = new Set(disposizione.schede.flatMap((scheda) => [scheda.id, ...scheda.riquadri.map((voce) => voce.id)]));
  assert.ok(ritrovata.schede.every((scheda) => !prima.has(scheda.id) && scheda.riquadri.every((voce) => !prima.has(voce.id))));

  assert.deepEqual(daSalvata(null), VUOTA);
  assert.deepEqual(daSalvata("non è json"), VUOTA);
  assert.deepEqual(daSalvata('{"schede":[{"verso":"x","shell":[]},{"shell":"no"}],"attiva":9}'), { schede: [], attiva: undefined });
});

test("i flussi che partono dalla cache sono il quadro e le conversazioni, e nient'altro", () => {
  const pagina = "shinka://app/#/progetti/uno";
  assert.equal(flussoDi("/api/quadro/eventi", pagina), "quadro");
  assert.equal(flussoDi("/api/home/eventi", pagina), "/api/home");
  assert.equal(flussoDi("/api/progetti/uno/eventi", pagina), "/api/progetti/uno");
  assert.equal(flussoDi("/api/argomenti/2026-11-23-a%20b/eventi", pagina), "/api/argomenti/2026-11-23-a%20b");
  assert.equal(flussoDi("/api/progetti/uno/eventi?dopo=3", pagina), undefined);
  assert.equal(flussoDi("/api/progetti/uno/altro/eventi", pagina), undefined);
  assert.equal(flussoDi("https://altrove.example/api/quadro/eventi", pagina), undefined);
});

test("le schede dei terminali si scorrono in tondo", () => {
  let disposizione = conNuovaScheda(conNuovaScheda(conNuovaScheda(VUOTA)));
  const [prima, seconda, terza] = disposizione.schede.map((scheda) => scheda.id);
  assert.equal(disposizione.attiva, terza);
  disposizione = conSchedaAccanto(disposizione, 1);
  assert.equal(disposizione.attiva, prima);
  disposizione = conSchedaAccanto(disposizione, -1);
  assert.equal(disposizione.attiva, terza);
  disposizione = conSchedaAccanto(disposizione, -1);
  assert.equal(disposizione.attiva, seconda);
  const sola = conNuovaScheda(VUOTA);
  assert.equal(conSchedaAccanto(sola, 1), sola);
  assert.equal(conSchedaAccanto(VUOTA, 1), VUOTA);
});

test("un tasto chiama un comando solo con i suoi modificatori, e nel terminale i tasti della shell restano suoi", () => {
  const tasto = (key: string, altri: Partial<Tasto> = {}): Tasto => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...altri });
  assert.equal(comandoDelTasto(tasto("k", { ctrlKey: true }), false), "vai-a");
  assert.equal(comandoDelTasto(tasto("T", { ctrlKey: true, shiftKey: true }), false), "nuovo-terminale");
  assert.equal(comandoDelTasto(tasto("t", { ctrlKey: true }), false), undefined);
  assert.equal(comandoDelTasto(tasto("ArrowLeft", { altKey: true }), false), "indietro");
  assert.equal(comandoDelTasto(tasto(",", { ctrlKey: true }), false), "impostazioni");
  assert.equal(comandoDelTasto(tasto("F1"), false), "scorciatoie");
  assert.equal(comandoDelTasto(tasto("Tab", { ctrlKey: true }), true), "scheda-dopo");
  assert.equal(comandoDelTasto(tasto("Tab", { ctrlKey: true, shiftKey: true }), true), "scheda-prima");
  // Con AltGr, che vale Ctrl e Alt insieme, si scrivono lettere.
  assert.equal(comandoDelTasto(tasto("j", { ctrlKey: true, altKey: true }), false), undefined);

  // Nel terminale Ctrl+K, Ctrl+W, Alt+← e Ctrl+, sono della shell; ciò che ha Maiusc o è un tasto funzione vale ancora.
  for (const [key, altri] of [["k", { ctrlKey: true }], ["w", { ctrlKey: true }], ["ArrowLeft", { altKey: true }], [",", { ctrlKey: true }]] as const) {
    assert.equal(comandoDelTasto(tasto(key, altri), true), undefined, key);
  }
  assert.equal(comandoDelTasto(tasto("J", { ctrlKey: true, shiftKey: true }), true), "fuoco");
  assert.equal(comandoDelTasto(tasto("j", { ctrlKey: true }), true), "terminali");
  // Ctrl+R non è di nessuno: nel terminale cerca tra i comandi già dati.
  assert.equal(comandoDelTasto(tasto("r", { ctrlKey: true }), false), undefined);

  // Ogni comando ha i suoi tasti, e nessuna coppia di comandi ha gli stessi.
  assert.equal(new Set(SCORCIATOIE.map((voce) => voce.tasti)).size, SCORCIATOIE.length);
  assert.equal(new Set(SCORCIATOIE.map((voce) => voce.comando)).size, SCORCIATOIE.length);
  assert.ok(eUnComando("fuoco") && !eUnComando("formatta-il-disco") && !eUnComando(7));
  assert.equal(tastiInParole("Ctrl+Shift+T"), "Ctrl+Maiusc+T");
  assert.equal(tastiInParole("Alt+Left"), "Alt+←");
});
