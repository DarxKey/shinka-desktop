import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RIQUADRI_MASSIMI,
  VUOTA,
  conDivisione,
  conNuovaScheda,
  conRiquadroAttivo,
  conSchedaInVista,
  daSalvare,
  daSalvata,
  luogoDi,
  progettoDi,
  senzaRiquadro,
  senzaScheda,
} from "./disposizione.ts";
import { flussoDi } from "./flussi.ts";

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
