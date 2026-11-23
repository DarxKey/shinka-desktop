import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { StatoAnteprima } from "../../src/protocollo/anteprima.ts";
import { apriAnteprima, chiudiAnteprima } from "./api.ts";
import { Applicazione } from "./Applicazione.tsx";
import { indirizzoAnteprima } from "./descrivi.ts";

/** Una richiesta di aprire l'anteprima arrivata da fuori: il pulsante di una proposta di Claude. */
export interface RichiestaAnteprima {
  porta: number;
  percorso: string;
  /** Cambia a ogni richiesta, anche se porta e percorso sono gli stessi. */
  n: number;
}

function chiaveDellaPorta(idProgetto: string): string {
  return `shinka.anteprima.porta.${idProgetto}`;
}

function portaRicordata(idProgetto: string): string {
  try {
    return window.localStorage.getItem(chiaveDellaPorta(idProgetto)) ?? "";
  } catch {
    return "";
  }
}

/**
 * L'anteprima dell'applicazione web del progetto: gira nell'ambiente del progetto, e qui la si
 * vede attraverso Shinka, in un riquadro servito da una porta a parte.
 */
export function Anteprima({
  idProgetto,
  nomeAmbiente,
  stato,
  richiesta,
}: {
  idProgetto: string;
  nomeAmbiente: string;
  stato: StatoAnteprima | undefined;
  richiesta: RichiestaAnteprima | undefined;
}): ReactNode {
  const [porta, setPorta] = useState(() => portaRicordata(idProgetto));
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();
  /** Cambiando, il riquadro ricarica la pagina. */
  const [ricarica, setRicarica] = useState(0);
  const eseguita = useRef(0);

  const aperta = stato?.aperta?.idProgetto === idProgetto ? stato.aperta : undefined;
  const diUnAltro = stato?.aperta !== undefined && aperta === undefined;
  // Aperta dal pulsante dell'applicazione, o ritrovata dopo un riavvio: il campo dice su quale porta.
  const portaAperta = aperta?.porta;
  useEffect(() => {
    if (portaAperta !== undefined) setPorta(String(portaAperta));
  }, [portaAperta]);

  async function apri(numero: number, percorso: string): Promise<void> {
    setErrore(undefined);
    setInCorso(true);
    try {
      await apriAnteprima(idProgetto, numero, percorso);
      setPorta(String(numero));
      setRicarica((n) => n + 1);
      try {
        window.localStorage.setItem(chiaveDellaPorta(idProgetto), String(numero));
      } catch {
        // Senza memoria del browser la porta va riscritta la prossima volta: non è grave.
      }
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "L'anteprima non si è aperta.");
    } finally {
      setInCorso(false);
    }
  }

  // Il proprietario ha premuto il pulsante di una proposta di Claude.
  useEffect(() => {
    if (richiesta === undefined || richiesta.n === eseguita.current) return;
    eseguita.current = richiesta.n;
    void apri(richiesta.porta, richiesta.percorso);
    // Dipende solo dalla richiesta: `apri` cambia a ogni disegno ma fa sempre la stessa cosa.
  }, [richiesta]);

  function alInvio(evento: FormEvent): void {
    evento.preventDefault();
    const numero = Number(porta.trim());
    if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
      setErrore("La porta è un numero tra 1 e 65535: quella su cui l'applicazione ascolta, per esempio 5173.");
      return;
    }
    void apri(numero, "/");
  }

  async function chiudi(): Promise<void> {
    setErrore(undefined);
    try {
      await chiudiAnteprima(idProgetto);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "L'anteprima non si è chiusa.");
    }
  }

  if (stato === undefined) return <div className="anteprima vuota-di-pannello">Carico…</div>;
  if (stato.porta === null) {
    return (
      <div className="anteprima vuota-di-pannello">
        <p>In questa installazione di Shinka l'anteprima non è accesa.</p>
      </div>
    );
  }
  const indirizzo = aperta === undefined ? undefined : indirizzoAnteprima(window.location, stato.porta, aperta.percorso);

  return (
    <div className="anteprima">
      <Applicazione idProgetto={idProgetto} nomeAmbiente={nomeAmbiente} />
      <form className="anteprima-barra" onSubmit={alInvio}>
        <label>
          <span className="tenue">localhost:</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Porta dell'applicazione in ${nomeAmbiente}`}
            placeholder="porta"
            maxLength={5}
            value={porta}
            onChange={(evento) => setPorta(evento.target.value.replace(/\D/g, ""))}
          />
        </label>
        <button type="submit" className={aperta === undefined ? "mini approva" : "mini"} disabled={inCorso || porta === ""}>
          {inCorso ? "Apro…" : "Apri"}
        </button>
        {aperta !== undefined && indirizzo !== undefined && (
          <>
            <button type="button" className="mini" title="Ricarica la pagina" onClick={() => setRicarica((n) => n + 1)}>
              Ricarica
            </button>
            <a className="pulsante mini" href={indirizzo} target="_blank" rel="noopener noreferrer" title="Apri in un'altra scheda">
              Scheda
            </a>
            <button type="button" className="mini discreto" onClick={() => void chiudi()}>
              Chiudi
            </button>
          </>
        )}
      </form>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
      {indirizzo !== undefined && aperta !== undefined ? (
        <iframe
          key={`${aperta.porta}${aperta.percorso}#${ricarica}`}
          className="anteprima-riquadro"
          title={`Anteprima dell'applicazione sulla porta ${aperta.porta}`}
          src={indirizzo}
          // L'applicazione fa ciò che vuole dentro il riquadro, ma non porta altrove la pagina di Shinka.
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-downloads"
        />
      ) : (
        <div className="vuota-di-pannello">
          <p>
            Qui vedi l'applicazione web del progetto mentre gira in «{nomeAmbiente}». Avviala con il pulsante qui sopra; se
            l'hai avviata in un altro modo, scrivi la porta su cui ascolta e premi Apri.
          </p>
          {diUnAltro && <p className="tenue">Adesso è aperta l'anteprima di un altro progetto: aprendo questa prende il suo posto.</p>}
        </div>
      )}
    </div>
  );
}
