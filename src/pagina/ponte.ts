/** Il ponte verso l'app, come lo espone `src/ponte/ponte.ts`. */

import { NOME_DEL_PONTE, type Ponte } from "../ponte/tipi.ts";

const trovato = (window as unknown as Record<string, Ponte | undefined>)[NOME_DEL_PONTE];
if (trovato === undefined) throw new Error("Questa pagina funziona solo dentro Shinka Desktop.");

export const ponte: Ponte = trovato;
