import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { PERCORSO_CERTIFICATO, type StatoHttps } from "../../src/protocollo/https.ts";
import { leggiHttps, scegliHttps } from "./api.ts";

/**
 * L'HTTPS di Shinka, nella pagina Impostazioni: se è acceso, da quali indirizzi si apre, quando scade il
 * certificato e la sua impronta; e la scelta per accenderlo, che vale dal prossimo avvio.
 */
export function SezioneHttps(): ReactNode {
  const [stato, setStato] = useState<StatoHttps>();
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const [riparte, setRiparte] = useState(false);
  const [attivo, setAttivo] = useState(false);
  const [nomi, setNomi] = useState("");
  const [reindirizza, setReindirizza] = useState(false);
  const idNomi = useId();

  useEffect(() => {
    let vivo = true;
    leggiHttps()
      .then((letto) => {
        if (!vivo) return;
        setStato(letto);
        setAttivo(letto.scelta.attivo);
        setNomi(letto.scelta.nomi.join(", "));
        setReindirizza(letto.scelta.reindirizza);
      })
      .catch((causa: unknown) => vivo && setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere l'HTTPS."));
    return () => {
      vivo = false;
    };
  }, []);

  async function salva(evento: FormEvent, riparti: boolean): Promise<void> {
    evento.preventDefault();
    setInCorso(true);
    setErrore(undefined);
    try {
      const elenco = nomi
        .split(/[,\s]+/)
        .map((nome) => nome.trim())
        .filter((nome) => nome !== "");
      const risposta = await scegliHttps({ attivo, nomi: elenco, reindirizza, riparti });
      setStato(risposta);
      if (risposta.riparte) setRiparte(true);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "La scelta non è stata salvata.");
    } finally {
      setInCorso(false);
    }
  }

  if (stato === undefined) {
    return errore === undefined ? null : <p className="tenue">{errore}</p>;
  }
  const cambiata =
    attivo !== stato.scelta.attivo || reindirizza !== stato.scelta.reindirizza || nomi.split(/[,\s]+/).filter(Boolean).join(",") !== stato.scelta.nomi.join(",");
  const daRipartire = stato.inFunzione !== stato.scelta.attivo;

  return (
    <section className="sezione-https">
      <h2 className="titolo-sezione">Collegamento sicuro (HTTPS)</h2>
      {stato.inFunzione ? (
        <>
          <p>
            Shinka parla HTTPS sulla stessa porta di sempre: apri{" "}
            {stato.indirizzi.map((indirizzo, i) => (
              <span key={indirizzo}>
                {i > 0 && " o "}
                <a href={indirizzo}>{indirizzo}</a>
              </span>
            ))}
            . Nodi, gateway e guardiano continuano a collegarsi in HTTP.
          </p>
          {stato.server !== undefined && (
            <dl className="dati-certificato">
              <dt>Certificato del server</dt>
              <dd>
                {stato.proprio ? "Tuo" : "Firmato dalla CA di Shinka"}, vale per {stato.nomi.join(", ")} e scade il {stato.server.scadeIl.slice(0, 10)}.
              </dd>
              {stato.ca !== undefined && (
                <>
                  <dt>Impronta della CA di Shinka</dt>
                  <dd>
                    <code>{stato.ca.impronta}</code>
                  </dd>
                </>
              )}
            </dl>
          )}
          {stato.ca !== undefined && (
            <p>
              Perché iPhone e PC si fidino di Shinka, installa una volta la sua CA:{" "}
              <a href={PERCORSO_CERTIFICATO} target="_blank" rel="noopener">
                istruzioni e certificato
              </a>
              .
            </p>
          )}
          {stato.avvisi.map((avviso) => (
            <p key={avviso} className="avvertenza">
              {avviso}
            </p>
          ))}
        </>
      ) : (
        <p className="tenue">
          Shinka parla solo HTTP. Con l'HTTPS il browser può dare la posizione e Shinka funziona meglio come app sull'iPhone; la stessa porta continua a parlare HTTP per nodi, gateway e guardiano.
        </p>
      )}
      {stato.problema !== undefined && (
        <p className="errore" role="alert">
          L'HTTPS è scelto ma non è partito: {stato.problema}
        </p>
      )}

      <form className="scelta-https" onSubmit={(evento) => void salva(evento, false)}>
        {stato.decisoDaVariabile ? (
          <p className="tenue">L'accensione la decide la variabile SHINKA_HTTPS del container: da qui cambi solo nomi e reindirizzamento.</p>
        ) : (
          <label className="spunta">
            <input type="checkbox" checked={attivo} disabled={inCorso} onChange={(evento) => setAttivo(evento.target.checked)} />
            <span>Accendi l'HTTPS</span>
          </label>
        )}
        <div className="voce-scheda">
          <label htmlFor={idNomi}>Indirizzi da cui apri Shinka</label>
          <input
            id={idNomi}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="per esempio 192.168.1.20"
            value={nomi}
            disabled={inCorso}
            onChange={(evento) => setNomi(evento.target.value)}
          />
          <div className="tenue">
            L'indirizzo del server che scrivi nel browser, non quello del telefono; più d'uno separati da virgole. Non 0.0.0.0: nessun browser apre
            quell'indirizzo. Il nome della macchina c'è già.
          </div>
        </div>
        <label className="spunta">
          <input type="checkbox" checked={reindirizza} disabled={inCorso} onChange={(evento) => setReindirizza(evento.target.checked)} />
          <span>Chi apre l'interfaccia in HTTP va all'HTTPS</span>
        </label>
        <div className="pulsanti">
          {stato.ripartenza ? (
            <button type="button" className="approva" disabled={inCorso || (!cambiata && !daRipartire)} onClick={(evento) => void salva(evento, true)}>
              {inCorso ? "Salvo…" : "Salva e riavvia Shinka"}
            </button>
          ) : (
            <button type="submit" disabled={inCorso || !cambiata}>
              {inCorso ? "Salvo…" : "Salva"}
            </button>
          )}
        </div>
        {riparte ? (
          <p className="avvertenza">Shinka sta ripartendo: tra qualche secondo ricarica la pagina{attivo ? ", anche dall'indirizzo https" : ""}.</p>
        ) : (
          <p className="tenue">
            {stato.ripartenza
              ? "La scelta vale quando Shinka riparte: le conversazioni in corso si fermano un momento e riprendono."
              : "La scelta vale dal prossimo avvio di Shinka."}
          </p>
        )}
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
    </section>
  );
}
