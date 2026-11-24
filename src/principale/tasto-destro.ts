/**
 * Il menu del tasto destro nella finestra dell'app, come in un browser: taglia, copia, incolla e
 * seleziona tutto dove ha senso, i suggerimenti per una parola scritta male, e copiare l'indirizzo di
 * un collegamento. Nei terminali il tasto destro lo usa la pagina (incolla, o copia la selezione),
 * come in PowerShell, e questo menu non compare.
 */

import type { ContextMenuParams, MenuItemConstructorOptions } from "electron";

/** Ciò che serve sapere del punto in cui si è premuto il tasto destro. */
export type DoveSiClicca = Pick<ContextMenuParams, "isEditable" | "selectionText" | "linkURL" | "misspelledWord" | "dictionarySuggestions"> & {
  editFlags: Pick<ContextMenuParams["editFlags"], "canCut" | "canCopy" | "canPaste" | "canSelectAll">;
};

export interface AzioniDelMenu {
  /** Mette un testo negli appunti. */
  copia(testo: string): void;
  /** Sostituisce la parola scritta male con quella scelta. */
  sostituisci(parola: string): void;
}

/** Le voci del menu per quel punto; nessuna se non c'è nulla da fare lì. */
export function vociDelTastoDestro(dove: DoveSiClicca, azioni: AzioniDelMenu): MenuItemConstructorOptions[] {
  const voci: MenuItemConstructorOptions[] = [];
  if (dove.isEditable && dove.misspelledWord !== "") {
    for (const parola of dove.dictionarySuggestions.slice(0, 5)) voci.push({ label: parola, click: () => azioni.sostituisci(parola) });
    if (voci.length > 0) voci.push({ type: "separator" });
  }
  if (dove.linkURL !== "" && /^https?:/i.test(dove.linkURL)) {
    voci.push({ label: "Copia l'indirizzo del collegamento", click: () => azioni.copia(dove.linkURL) });
    voci.push({ type: "separator" });
  }
  if (dove.isEditable) {
    voci.push(
      { label: "Taglia", role: "cut", enabled: dove.editFlags.canCut },
      { label: "Copia", role: "copy", enabled: dove.editFlags.canCopy },
      { label: "Incolla", role: "paste", enabled: dove.editFlags.canPaste },
      { type: "separator" },
      { label: "Seleziona tutto", role: "selectAll", enabled: dove.editFlags.canSelectAll },
    );
  } else if (dove.selectionText.trim() !== "") {
    voci.push({ label: "Copia", role: "copy" }, { type: "separator" }, { label: "Seleziona tutto", role: "selectAll" });
  }
  // Niente menu fatto di soli separatori.
  while (voci.at(-1)?.type === "separator") voci.pop();
  return voci;
}
