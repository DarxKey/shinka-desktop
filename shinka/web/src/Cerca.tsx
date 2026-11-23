/** La pagina Cerca: le parole nel testo di tutte le conversazioni, della Home, dei suoi argomenti e dei progetti. */

import { useEffect, useState, type ReactNode } from "react";
import { cercaNelleConversazioni, type TrovatoNelleConversazioni } from "./api.ts";
import { frammentoDi } from "./vista.ts";

/** Quanto si aspetta che il proprietario smetta di scrivere prima di cercare. */
const PAUSA_MS = 300;

function indirizzoDi(trovato: TrovatoNelleConversazioni): string {
  return trovato.dove.tipo === "home" ? frammentoDi({ tipo: "home" }) : frammentoDi({ tipo: trovato.dove.tipo, id: trovato.dove.id });
}

function quandoInBreve(quando: string): string {
  const data = new Date(quando);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** `parole`: quelle scritte nella barra laterale, da cui la ricerca comincia. */
export function PaginaCerca({ menu, parole = "" }: { menu: ReactNode; parole?: string }): ReactNode {
  const [cercato, setCercato] = useState(parole);
  const [trovati, setTrovati] = useState<TrovatoNelleConversazioni[]>();
  const [errore, setErrore] = useState<string>();

  useEffect(() => {
    if (cercato.trim() === "") {
      setTrovati(undefined);
      return;
    }
    let valida = true;
    const sveglia = setTimeout(() => {
      cercaNelleConversazioni(cercato)
        .then((risultati) => valida && (setTrovati(risultati), setErrore(undefined)))
        .catch((causa: unknown) => valida && setErrore(causa instanceof Error ? causa.message : "La ricerca non è riuscita."));
    }, PAUSA_MS);
    return () => {
      valida = false;
      clearTimeout(sveglia);
    };
  }, [cercato]);

  return (
    <div className="app pagina pagina-cerca">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Cerca</h1>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina">
          <input
            className="campo-cerca"
            type="search"
            autoFocus
            aria-label="Parole da cercare in tutte le conversazioni"
            placeholder="Cerca nelle conversazioni…"
            value={cercato}
            onChange={(evento) => setCercato(evento.target.value)}
          />
          {errore !== undefined && <p className="errore">{errore}</p>}
          {trovati !== undefined && trovati.length === 0 && <p className="tenue">Nessun messaggio contiene queste parole.</p>}
          {trovati !== undefined && trovati.length > 0 && (
            <ol className="risultati-cerca">
              {trovati.map((trovato, posizione) => (
                <li key={posizione}>
                  <a href={indirizzoDi(trovato)}>
                    <span className="dove-cerca">
                      <span className="titolo-cerca">{trovato.titolo}</span>
                      <span className="tenue">
                        {trovato.chi === "proprietario" ? "tu" : "Claude"} · {quandoInBreve(trovato.quando)}
                      </span>
                    </span>
                    <span className="estratto-cerca">{trovato.estratto}</span>
                  </a>
                </li>
              ))}
            </ol>
          )}
          {trovati === undefined && cercato.trim() === "" && (
            <p className="tenue">Cerca nei tuoi messaggi e nelle risposte di Claude, nella Home, negli argomenti archiviati e nei progetti.</p>
          )}
        </div>
      </div>
    </div>
  );
}
