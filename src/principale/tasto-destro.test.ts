import assert from "node:assert/strict";
import { test } from "node:test";
import { vociDelTastoDestro, type DoveSiClicca } from "./tasto-destro.ts";

const NIENTE: DoveSiClicca = {
  isEditable: false,
  selectionText: "",
  linkURL: "",
  misspelledWord: "",
  dictionarySuggestions: [],
  editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true },
};

const azioni = (copiati: string[] = [], sostituite: string[] = []) => ({ copia: (testo: string) => copiati.push(testo), sostituisci: (parola: string) => sostituite.push(parola) });

test("in un campo di testo il tasto destro taglia, copia, incolla e seleziona tutto", () => {
  const voci = vociDelTastoDestro({ ...NIENTE, isEditable: true, editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true } }, azioni());
  assert.deepEqual(
    voci.map((voce) => [voce.label ?? voce.type, voce.role, voce.enabled]),
    [
      ["Taglia", "cut", false],
      ["Copia", "copy", false],
      ["Incolla", "paste", true],
      ["separator", undefined, undefined],
      ["Seleziona tutto", "selectAll", true],
    ],
  );
});

test("su un testo selezionato copia; dove non c'è nulla da fare il menu non compare", () => {
  assert.deepEqual(vociDelTastoDestro({ ...NIENTE, selectionText: "ciao" }, azioni()).map((voce) => voce.label ?? voce.type), ["Copia", "separator", "Seleziona tutto"]);
  assert.deepEqual(vociDelTastoDestro(NIENTE, azioni()), []);
  assert.deepEqual(vociDelTastoDestro({ ...NIENTE, selectionText: "   " }, azioni()), []);
});

test("su un collegamento ne copia l'indirizzo; su una parola scritta male propone le giuste", () => {
  const copiati: string[] = [];
  const sostituite: string[] = [];
  const collegamento = vociDelTastoDestro({ ...NIENTE, linkURL: "https://example.com/a" }, azioni(copiati));
  assert.deepEqual(collegamento.map((voce) => voce.label ?? voce.type), ["Copia l'indirizzo del collegamento"]);
  collegamento[0]?.click?.(undefined as never, undefined, undefined as never);
  assert.deepEqual(copiati, ["https://example.com/a"]);
  // Un indirizzo interno dell'app non si offre da copiare.
  assert.deepEqual(vociDelTastoDestro({ ...NIENTE, linkURL: "shinka://app/#/x" }, azioni()), []);

  const parola = vociDelTastoDestro({ ...NIENTE, isEditable: true, misspelledWord: "progeto", dictionarySuggestions: ["progetto", "proietto"] }, azioni([], sostituite));
  assert.deepEqual(parola.slice(0, 3).map((voce) => voce.label ?? voce.type), ["progetto", "proietto", "separator"]);
  parola[0]?.click?.(undefined as never, undefined, undefined as never);
  assert.deepEqual(sostituite, ["progetto"]);
});
