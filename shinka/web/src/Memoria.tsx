import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { VOCE_MEMORIA_MASSIMA, type StatoMemoria, type VoceMemoria } from "../../src/protocollo/memoria.ts";
import { aggiungiVoce, cancellaVoce, correggiVoce } from "./api.ts";
import { giornoInBreve } from "./descrivi.ts";

function inParole(causa: unknown, ripiego: string): string {
  return causa instanceof Error ? causa.message : ripiego;
}

/**
 * La pagina della memoria: le voci che Claude ha annotato e che valgono in ogni conversazione.
 * Il proprietario le corregge, le cancella e ne aggiunge di sue.
 */
export function PaginaMemoria({ menu, stato }: { menu: ReactNode; stato: StatoMemoria | undefined }): ReactNode {
  const voci = stato?.voci;
  useEffect(() => {
    document.title = "Memoria · Shinka";
  }, []);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Memoria</h1>
          <span className="sottotitolo">Ciò che Claude sa di te in ogni conversazione</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina">
          <p className="tenue">
            Preferenze e fatti che valgono nella Home, in ogni progetto e in ogni ambiente. Claude li annota da solo
            quando gli dici qualcosa che vale sempre; qui li correggi o li cancelli. Una modifica vale dal messaggio
            successivo.
          </p>
          <NuovaVoce />
          {voci === undefined && <p className="tenue">Carico…</p>}
          {voci?.length === 0 && (
            <p className="tenue vuota">
              Ancora nulla. Prova a dire alla Home una preferenza, per esempio «d'ora in poi rispondimi in breve».
            </p>
          )}
          {voci !== undefined && voci.length > 0 && (
            <ul className="voci-memoria">
              {voci.map((voce) => (
                <VistaVoceMemoria key={voce.id} voce={voce} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function NuovaVoce(): ReactNode {
  const [testo, setTesto] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function aggiungi(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    if (testo.trim() === "" || inCorso) return;
    setInCorso(true);
    setErrore(undefined);
    try {
      await aggiungiVoce(testo);
      setTesto("");
    } catch (causa) {
      setErrore(inParole(causa, "Voce non aggiunta."));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form className="nuova-voce" onSubmit={(evento) => void aggiungi(evento)}>
      <input
        type="text"
        aria-label="Voce da aggiungere alla memoria"
        placeholder="Aggiungi una voce: una frase sola…"
        maxLength={VOCE_MEMORIA_MASSIMA}
        value={testo}
        onChange={(evento) => setTesto(evento.target.value)}
      />
      <button type="submit" disabled={testo.trim() === "" || inCorso}>
        Aggiungi
      </button>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </form>
  );
}

function VistaVoceMemoria({ voce }: { voce: VoceMemoria }): ReactNode {
  const [modo, setModo] = useState<"lettura" | "correzione" | "cancellazione">("lettura");
  const [testo, setTesto] = useState(voce.testo);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function esegui(lavoro: () => Promise<void>, ripiego: string): Promise<void> {
    setInCorso(true);
    setErrore(undefined);
    try {
      await lavoro();
      setModo("lettura");
    } catch (causa) {
      setErrore(inParole(causa, ripiego));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className="voce-memoria">
      {modo === "correzione" ? (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void esegui(() => correggiVoce(voce.id, testo), "Voce non corretta.");
          }}
        >
          <textarea
            aria-label="Testo della voce"
            rows={3}
            maxLength={VOCE_MEMORIA_MASSIMA}
            value={testo}
            autoFocus
            onChange={(evento) => setTesto(evento.target.value)}
          />
          <div className="pulsanti">
            <button type="submit" className="approva" disabled={inCorso || testo.trim() === ""}>
              Salva
            </button>
            <button type="button" className="discreto" disabled={inCorso} onClick={() => setModo("lettura")}>
              Annulla
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="testo-voce">{voce.testo}</p>
          <div className="piede-voce">
            <span className="tenue">{giornoInBreve(voce.annotataIl)}</span>
            {modo === "cancellazione" ? (
              <span className="pulsanti">
                <button
                  type="button"
                  disabled={inCorso}
                  onClick={() => void esegui(() => cancellaVoce(voce.id), "Voce non cancellata.")}
                >
                  Conferma la cancellazione
                </button>
                <button type="button" className="discreto" disabled={inCorso} onClick={() => setModo("lettura")}>
                  Annulla
                </button>
              </span>
            ) : (
              <span className="pulsanti">
                <button
                  type="button"
                  className="discreto piccolo"
                  onClick={() => {
                    setTesto(voce.testo);
                    setModo("correzione");
                  }}
                >
                  Correggi
                </button>
                <button type="button" className="discreto piccolo" onClick={() => setModo("cancellazione")}>
                  Cancella
                </button>
              </span>
            )}
          </div>
        </>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}
