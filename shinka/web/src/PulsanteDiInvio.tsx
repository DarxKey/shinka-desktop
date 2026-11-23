import type { ReactNode } from "react";
import { modoDelPulsante, type ModoDelPulsante } from "./invio.ts";

export { modoDelPulsante };

const ETICHETTE: Record<ModoDelPulsante, string> = {
  invia: "Invia",
  interrompi: "Interrompi",
  "in-invio": "Invio in corso",
  spento: "Invia",
};

/** Il pulsante unico accanto al campo: una freccia per mandare, un quadrato per fermare Claude. */
export function PulsanteDiInvio({ modo, alInterrompi }: { modo: ModoDelPulsante; alInterrompi: () => void }): ReactNode {
  const ferma = modo === "interrompi";
  return (
    <button
      type={ferma ? "button" : "submit"}
      className={ferma ? "pulsante-invio interrompi" : "pulsante-invio"}
      aria-label={ETICHETTE[modo]}
      title={ETICHETTE[modo]}
      disabled={modo === "spento" || modo === "in-invio"}
      onClick={ferma ? alInterrompi : undefined}
    >
      {ferma ? (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <rect x="4" y="4" width="12" height="12" rx="2.5" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className={modo === "in-invio" ? "in-volo" : undefined}>
          <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
