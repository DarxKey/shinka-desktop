import type { ReactNode } from "react";
import { NOMI_MOTORI, type ModelloDisponibile, type Motore } from "../../src/protocollo/impostazioni.ts";
import { chiaveDelModello, gruppiDiModelli, sceltaDaChiave } from "./motori.ts";

/**
 * Il menu del modello: con due motori, i modelli di ciascuno nel suo gruppo, e scegliere un modello
 * dell'altro motore cambia anche il motore.
 */
export function MenuDelModello({
  etichetta,
  titolo,
  modelli,
  motore,
  modello,
  disattivo,
  allaScelta,
}: {
  etichetta: string;
  titolo?: string;
  modelli: readonly ModelloDisponibile[];
  /** Il motore della conversazione, se si sa. */
  motore: Motore | undefined;
  modello: string | undefined;
  disattivo?: boolean;
  allaScelta: (scelta: { motore?: Motore; modello: string | null }) => void;
}): ReactNode {
  const gruppi = gruppiDiModelli(modelli);
  const conMotori = gruppi.length > 1;
  const chiaveScelta = chiaveDelModello(conMotori ? motore : undefined, modello);
  const voci = gruppi.flatMap((voce) => [
    ...(voce.motore === undefined ? [""] : [chiaveDelModello(voce.motore, undefined)]),
    ...voce.modelli.map((voceModello) => chiaveDelModello(voce.motore, voceModello.valore)),
  ]);
  return (
    <select
      aria-label={etichetta}
      {...(titolo === undefined ? {} : { title: titolo })}
      value={chiaveScelta}
      disabled={disattivo}
      onChange={(evento) => allaScelta(sceltaDaChiave(evento.target.value))}
    >
      {(!conMotori || motore === undefined) && <option value="">{conMotori ? "Motore predefinito" : "Modello predefinito"}</option>}
      {chiaveScelta !== "" && !voci.includes(chiaveScelta) && <option value={chiaveScelta}>{modello}</option>}
      {gruppi.map((gruppo) =>
        gruppo.motore === undefined ? (
          gruppo.modelli.map((voce) => (
            <option key={voce.valore} value={voce.valore} title={voce.descrizione}>
              {voce.nome}
            </option>
          ))
        ) : (
          <optgroup key={gruppo.motore} label={NOMI_MOTORI[gruppo.motore]}>
            <option value={chiaveDelModello(gruppo.motore, undefined)}>{NOMI_MOTORI[gruppo.motore]} predefinito</option>
            {gruppo.modelli.map((voce) => (
              <option key={voce.valore} value={chiaveDelModello(gruppo.motore, voce.valore)} title={voce.descrizione}>
                {voce.nome}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}
