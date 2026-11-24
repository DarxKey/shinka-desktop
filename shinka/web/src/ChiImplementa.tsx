/**
 * Chi implementa gli incarichi di un progetto, nella scheda della sessione (ADR 0051): il modello a
 * cui chi guida affida l'implementazione e i suoi test. Senza, il progetto lavora con un modello solo.
 * I modelli sono quelli che gli accessi dell'ambiente danno, come nel menu del modello.
 */

import { useEffect, useState, type ReactNode } from "react";
import { IMPEGNI, type Impegno, type ModelloDisponibile } from "../../src/protocollo/impostazioni.ts";
import type { ChiImplementa as Scelta, StatoChiImplementa } from "../../src/protocollo/incarichi.ts";
import { cambiaChiImplementa, leggiChiImplementa } from "./api.ts";
import { MODELLI_NOTI, NOMI_IMPEGNI } from "./Controlli.tsx";
import { MenuDelModello } from "./MenuDelModello.tsx";
import { gruppiDiModelli, nomeDelModello } from "./motori.ts";

export function ChiImplementa({ idProgetto, modelli }: { idProgetto: string; modelli: readonly ModelloDisponibile[] | undefined }): ReactNode {
  const [stato, setStato] = useState<StatoChiImplementa>();
  const [bozza, setBozza] = useState<Scelta>();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();

  useEffect(() => {
    leggiChiImplementa(idProgetto)
      .then(setStato)
      .catch(() => setStato(undefined));
  }, [idProgetto]);

  const salva = (scelta: Scelta | null): void => {
    setLavoro(true);
    setErrore(undefined);
    cambiaChiImplementa(idProgetto, scelta)
      .then((nuovo) => {
        setStato(nuovo);
        setBozza(undefined);
      })
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è riuscito."))
      .finally(() => setLavoro(false));
  };

  if (stato === undefined) return null;
  const elenco = modelli ?? MODELLI_NOTI;
  const gruppi = gruppiDiModelli(elenco);
  const scelto = stato.chiImplementa;
  const descrivi = (scelta: Scelta): string =>
    `${nomeDelModello(gruppi, scelta.motore, scelta.modello)}${scelta.impegno === undefined ? "" : ` · effort ${NOMI_IMPEGNI[scelta.impegno].toLowerCase()}`}`;

  if (bozza !== undefined) {
    const gruppo = gruppi.find((voce) => voce.motore === undefined || voce.motore === bozza.motore);
    const impegni = gruppo?.modelli.find((voce) => voce.valore === bozza.modello)?.impegni ?? IMPEGNI;
    return (
      <div className="chi-implementa">
        <h4>Chi implementa</h4>
        <div className="scelte">
          <MenuDelModello
            etichetta="Modello di chi implementa"
            modelli={elenco}
            motore={bozza.motore}
            modello={bozza.modello}
            disattivo={lavoro}
            allaScelta={({ motore, modello }) => {
              const { impegno } = bozza;
              setBozza({
                ...(motore === undefined ? (bozza.motore === undefined ? {} : { motore: bozza.motore }) : { motore }),
                ...(modello === null ? {} : { modello }),
                ...(impegno === undefined ? {} : { impegno }),
              });
            }}
          />
          <select
            aria-label="Effort di chi implementa"
            value={bozza.impegno ?? ""}
            disabled={lavoro}
            onChange={(evento) => {
              const { impegno: _, ...resto } = bozza;
              setBozza(evento.target.value === "" ? resto : { ...resto, impegno: evento.target.value as Impegno });
            }}
          >
            <option value="">Effort predefinito</option>
            {impegni.map((voce) => (
              <option key={voce} value={voce}>
                Effort: {NOMI_IMPEGNI[voce]}
              </option>
            ))}
          </select>
        </div>
        <div className="pulsanti">
          <button type="button" className="mini approva" disabled={lavoro} onClick={() => salva(bozza)}>
            {lavoro ? "Salvo…" : "Salva"}
          </button>
          <button type="button" className="mini discreto" disabled={lavoro} onClick={() => setBozza(undefined)}>
            Annulla
          </button>
        </div>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="chi-implementa">
      <h4>Chi implementa</h4>
      {scelto === undefined ? (
        <p className="tenue">Nessuno: il progetto lavora con un modello solo.</p>
      ) : (
        <p>
          <strong>{descrivi(scelto)}</strong>
          <br />
          <span className="tenue">Il modello del progetto pianifica e controlla, e affida a questo l'implementazione con i suoi test.</span>
        </p>
      )}
      <div className="pulsanti">
        <button type="button" className="mini discreto" disabled={lavoro} onClick={() => setBozza(scelto ?? {})}>
          {scelto === undefined ? "Scegli chi implementa" : "Cambia"}
        </button>
        {scelto !== undefined && (
          <button type="button" className="mini discreto" disabled={lavoro} onClick={() => salva(null)}>
            Un modello solo
          </button>
        )}
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
