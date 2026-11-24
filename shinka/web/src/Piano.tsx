/**
 * Il lavoro di Claude reso leggibile: la lista delle cose da fare, una scheda che si aggiorna sul
 * posto con il riepilogo a fine turno, e il piano che Claude presenta prima di mettersi al lavoro.
 */

import type { ReactNode } from "react";
import { Formattato } from "./Elementi.tsx";
import type { Elemento } from "./stato.ts";

const SEGNO = { fatta: "✓", "in-corso": "●", "da-fare": "○" } as const;

export function SchedaCoseDaFare({ scheda }: { scheda: Extract<Elemento, { tipo: "cose-da-fare" }> }): ReactNode {
  const fatte = scheda.voci.filter((voce) => voce.stato === "fatta").length;
  const inCorso = scheda.voci.find((voce) => voce.stato === "in-corso");
  return (
    <div className={scheda.finito ? "riga cose-da-fare finito" : "riga cose-da-fare"}>
      <div className="testa-cose">
        <span className="titolo-cose">Cose da fare</span>
        <span className="conto-cose">
          {fatte} di {scheda.voci.length}
        </span>
      </div>
      <ol>
        {scheda.voci.map((voce, indice) => (
          <li key={indice} className={voce.stato}>
            <span className="segno" aria-hidden="true">
              {SEGNO[voce.stato]}
            </span>
            <span>{voce.stato === "in-corso" && !scheda.finito ? voce.inCorso : voce.testo}</span>
          </li>
        ))}
      </ol>
      {scheda.finito && (
        <div className="riepilogo-cose">
          {fatte === scheda.voci.length
            ? "Fatto tutto."
            : `Fatte ${fatte} di ${scheda.voci.length}${inCorso === undefined ? "" : `; si era fermato a: ${inCorso.testo}`}.`}
        </div>
      )}
    </div>
  );
}

/**
 * Le cose da fare mentre Claude lavora, sopra il campo di scrittura: a che punto è e che cosa sta
 * facendo, sempre in vista anche quando la scheda nella chat è scivolata in alto. Si apre per
 * vedere tutta la lista.
 */
export function CoseDaFareInVista({ scheda }: { scheda: Extract<Elemento, { tipo: "cose-da-fare" }> }): ReactNode {
  const fatte = scheda.voci.filter((voce) => voce.stato === "fatta").length;
  const inCorso = scheda.voci.find((voce) => voce.stato === "in-corso");
  return (
    <details className="cose-in-vista">
      <summary>
        <span className="conto-cose">
          {fatte} di {scheda.voci.length}
        </span>
        <span className="barra-cose" aria-hidden="true">
          <span style={{ width: `${scheda.voci.length === 0 ? 0 : (fatte / scheda.voci.length) * 100}%` }} />
        </span>
        <span className="ora-cose">{inCorso?.inCorso ?? inCorso?.testo ?? "Cose da fare"}</span>
      </summary>
      <ol>
        {scheda.voci.map((voce, indice) => (
          <li key={indice} className={voce.stato}>
            <span className="segno" aria-hidden="true">
              {SEGNO[voce.stato]}
            </span>
            <span>{voce.testo}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Il piano che Claude presenta (ExitPlanMode), da leggere come un documento. */
export function TestoDelPiano({ ingresso }: { ingresso: unknown }): ReactNode {
  const piano = (ingresso as { plan?: unknown } | null)?.plan;
  if (typeof piano !== "string" || piano.trim() === "") return null;
  return (
    <div className="piano">
      <Formattato testo={piano} />
    </div>
  );
}
