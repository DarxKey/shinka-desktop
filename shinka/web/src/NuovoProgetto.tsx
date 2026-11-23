/**
 * La pagina con cui il proprietario crea un progetto da sé, senza passare dalla Home: la stessa
 * scheda di una proposta, con nome e brief scritti da lui.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { SchedaNuovoProgetto } from "../../src/protocollo/progetti.ts";
import { creaProgettoAMano, leggiSchedaNuovoProgetto } from "./api.ts";
import { PropostaInAttesa } from "./Proposta.tsx";
import { useQuadroCorrente } from "./Quadro.tsx";
import { vaiA } from "./vista.ts";

export function PaginaNuovoProgetto({ menu }: { menu: ReactNode }): ReactNode {
  const { ambienti } = useQuadroCorrente();
  const [scheda, setScheda] = useState<SchedaNuovoProgetto>();
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    document.title = "Nuovo progetto · Shinka";
    leggiSchedaNuovoProgetto()
      .then(setScheda)
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a preparare la scheda."));
  }, []);
  // Si parte dall'ambiente del centro, se è attivo; altrimenti dal primo attivo.
  const attivi = (ambienti?.ambienti ?? []).filter((ambiente) => ambiente.attivo);
  const iniziale = attivi.find((ambiente) => ambiente.delCentro) ?? attivi[0] ?? ambienti?.ambienti[0];

  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Nuovo progetto</h1>
          <span className="sottotitolo">Un lavoro lungo, con la sua cartella e la sua conversazione</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-nuovo-progetto">
          <p className="tenue">
            Di solito è la Home a proporre un progetto, quando le chiedi un lavoro lungo: ne scrive lei il brief da ciò che vi siete detti. Qui lo
            crei da te: scegli dove nasce e scrivi che cosa deve fare.
          </p>
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {(scheda === undefined || ambienti === undefined) && errore === undefined && <p className="tenue">Carico…</p>}
          {scheda !== undefined && ambienti !== undefined && (
            <PropostaInAttesa
              proposta={{ chiave: "nuovo-progetto", nome: "", brief: "", idAmbiente: iniziale?.id ?? "", ...scheda }}
              aMano={{
                crea: creaProgettoAMano,
                annulla: () => vaiA({ tipo: "home" }),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
