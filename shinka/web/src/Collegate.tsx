/**
 * Le cartelle collegate di un progetto, nella scheda della sessione (ADR 0050): le cartelle di altri
 * ambienti in cui il progetto lavora anche, per esempio il codice di un'app per Windows sul PC.
 * Il proprietario le collega con l'ambiente e il percorso completo, e le scollega.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { StatoCollegate } from "../../src/protocollo/progetti.ts";
import { collegaCartella, leggiCollegate, scollegaCartella } from "./api.ts";

export function CartelleCollegate({ idProgetto }: { idProgetto: string }): ReactNode {
  const [stato, setStato] = useState<StatoCollegate>();
  const [idAmbiente, setIdAmbiente] = useState("");
  const [cartella, setCartella] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    leggiCollegate(idProgetto)
      .then(setStato)
      .catch(() => setStato(undefined));
  }, [idProgetto]);

  const fai = (azione: () => Promise<StatoCollegate>): void => {
    setLavoro(true);
    setErrore(undefined);
    azione()
      .then((nuovo) => {
        setStato(nuovo);
        setCartella("");
        setAperto(false);
      })
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è riuscito."))
      .finally(() => setLavoro(false));
  };

  if (stato === undefined) return null;
  const scelto = idAmbiente !== "" ? idAmbiente : (stato.possibili[0]?.idAmbiente ?? "");
  return (
    <div className="cartelle-collegate">
      <h4>Cartelle collegate</h4>
      {stato.collegate.length === 0 && <p className="tenue">Nessuna: il progetto lavora solo nel suo ambiente.</p>}
      <ul>
        {stato.collegate.map((voce) => (
          <li key={voce.idAmbiente}>
            <span>
              <strong>{voce.nomeAmbiente}</strong>
              {!voce.attivo && <span className="tenue"> · spento</span>}
              <br />
              <code>{voce.cartella}</code>
            </span>
            <button type="button" className="mini discreto" disabled={lavoro} onClick={() => fai(() => scollegaCartella(idProgetto, voce.idAmbiente))}>
              Scollega
            </button>
          </li>
        ))}
      </ul>
      {stato.possibili.length > 0 &&
        (aperto ? (
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              fai(() => collegaCartella(idProgetto, scelto, cartella));
            }}
          >
            <label>
              Ambiente
              <select value={scelto} onChange={(evento) => setIdAmbiente(evento.target.value)} disabled={lavoro}>
                {stato.possibili.map((possibile) => (
                  <option key={possibile.idAmbiente} value={possibile.idAmbiente}>
                    {possibile.nomeAmbiente}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cartella, con il percorso completo
              <input value={cartella} onChange={(evento) => setCartella(evento.target.value)} placeholder="C:\Users\io\progetti\app" spellCheck={false} autoCapitalize="none" disabled={lavoro} required />
            </label>
            <div className="pulsanti">
              <button type="submit" className="mini approva" disabled={lavoro || cartella.trim() === ""}>
                {lavoro ? "Controllo…" : "Collega"}
              </button>
              <button type="button" className="mini discreto" disabled={lavoro} onClick={() => setAperto(false)}>
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="mini discreto" onClick={() => setAperto(true)}>
            Collega una cartella di un altro ambiente
          </button>
        ))}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
