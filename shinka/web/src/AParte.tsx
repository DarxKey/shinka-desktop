/**
 * La domanda a parte ("/btw"): compare sopra il campo di scrittura con la sua risposta, e nella
 * conversazione non resta nulla. Si può fare anche mentre Claude lavora; una domanda nuova prende
 * il posto di quella di prima.
 */

import type { ReactNode } from "react";
import type { RispostaAParte } from "../../src/protocollo/eventi.ts";
import { Formattato } from "./Elementi.tsx";

export interface DomandaAParte {
  domanda: string;
  /** Manca finché Claude non ha risposto. */
  risposta?: RispostaAParte;
}

export function RiquadroAParte({ aParte, allaChiusura }: { aParte: DomandaAParte; allaChiusura: () => void }): ReactNode {
  const { domanda, risposta } = aParte;
  return (
    <section className="a-parte" aria-label="Domanda a parte" aria-live="polite">
      <header>
        <span className="titolo-a-parte">A parte</span>
        <span className="tenue">non resta nella conversazione</span>
        <button type="button" className="discreto chiudi-a-parte" aria-label="Chiudi la domanda a parte" onClick={allaChiusura}>
          ×
        </button>
      </header>
      <p className="domanda-a-parte">{domanda}</p>
      {risposta === undefined && <p className="tenue">Claude ci pensa…</p>}
      {risposta !== undefined && "testo" in risposta && (
        <div className="risposta-a-parte">
          <Formattato testo={risposta.testo} />
        </div>
      )}
      {risposta !== undefined && "motivo" in risposta && (
        <p className="errore" role="alert">
          {risposta.motivo}
        </p>
      )}
    </section>
  );
}
