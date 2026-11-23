import { createHash } from "node:crypto";

/**
 * Codice di verifica di un nodo che chiede di collegarsi.
 * Nodo e centro lo calcolano allo stesso modo: il proprietario lo confronta
 * prima di approvare, per essere sicuro che la richiesta venga dalla sua macchina.
 */
export function codiceDiVerifica(idNodo: string, segreto: string): string {
  const impronta = createHash("sha256").update(`${idNodo}:${segreto}`).digest();
  const cifre = String(impronta.readUInt32BE(0) % 1_000_000).padStart(6, "0");
  return `${cifre.slice(0, 3)} ${cifre.slice(3)}`;
}

/** Impronta del segreto di un nodo: è ciò che il centro conserva al posto del segreto. */
export function improntaDelSegreto(segreto: string): string {
  return createHash("sha256").update(segreto).digest("hex");
}
