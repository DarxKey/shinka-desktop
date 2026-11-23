/** Ciò che l'interfaccia vede degli argomenti della Home. Dati semplici, serializzabili in JSON. */

/** Un argomento archiviato, come compare nell'elenco. */
import type { IndiceArchivio } from "./eventi.ts";

export interface VoceArgomento extends Partial<IndiceArchivio> {
  id: string;
  titolo: string;
  riassunto: string;
  apertoIl: string;
  archiviatoIl: string;
}

/**
 * Gli argomenti della Home. L'elenco è sempre completo: un argomento che non c'è è stato eliminato
 * o dimenticato (ADR 0046). Nel quadro ogni argomento ha anche l'indice del suo archivio
 * (`ultimo` e `versione`), e `aperto` è quello dell'argomento aperto.
 */
export interface StatoArgomenti {
  /** L'argomento aperto in questo momento nella Home. */
  idAperto: string;
  /** Gli argomenti archiviati, dal più recente. */
  archiviati: VoceArgomento[];
  /** L'indice dell'archivio dell'argomento aperto. */
  aperto?: IndiceArchivio;
}
