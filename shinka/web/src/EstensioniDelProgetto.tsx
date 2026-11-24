/**
 * Le estensioni di un progetto, nella scheda della sessione: quelle accese nel suo ambiente, con
 * una casella ciascuna, anche a progetto avviato. Cambiate, la conversazione riparte con quelle
 * nuove appena non sta lavorando, dalla stessa sessione. Un modello locale scelto qui si può usare
 * come modello del progetto o come chi implementa.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { StatoEstensioniDelProgetto } from "../../src/protocollo/progetti.ts";
import { cambiaEstensioniDelProgetto, leggiEstensioniDelProgetto } from "./api.ts";

export function EstensioniDelProgetto({ idProgetto }: { idProgetto: string }): ReactNode {
  const [stato, setStato] = useState<StatoEstensioniDelProgetto>();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [cambiate, setCambiate] = useState(false);

  useEffect(() => {
    leggiEstensioniDelProgetto(idProgetto)
      .then(setStato)
      .catch(() => setStato(undefined));
  }, [idProgetto]);

  if (stato === undefined || stato.voci.length === 0) return null;
  const scelte = stato.scelte ?? stato.voci.map((voce) => voce.nome);

  const cambia = (nome: string, accesa: boolean): void => {
    const nuove = accesa ? [...scelte, nome] : scelte.filter((una) => una !== nome);
    setLavoro(true);
    setErrore(undefined);
    cambiaEstensioniDelProgetto(idProgetto, nuove)
      .then((nuovo) => {
        setStato(nuovo);
        setCambiate(true);
      })
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è cambiato."))
      .finally(() => setLavoro(false));
  };

  return (
    <div className="estensioni-del-progetto">
      <h4>Estensioni</h4>
      <ul>
        {stato.voci.map((voce) => (
          <li key={voce.nome}>
            <label title={voce.descrizione}>
              <input type="checkbox" checked={scelte.includes(voce.nome)} disabled={lavoro} onChange={(evento) => cambia(voce.nome, evento.target.checked)} />
              <span>
                {voce.nome} <span className="tenue">· {voce.tipo}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {cambiate && <p className="tenue">La conversazione riparte con queste appena non sta lavorando.</p>}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
