/**
 * Nel pannello dell'anteprima: l'applicazione del progetto, con il pulsante per avviarla e
 * fermarla senza passare dalla chat. Come si avvia lo dice il progetto (lo imposta Claude) oppure
 * il proprietario, qui. Avviata da qui, l'anteprima si apre da sola; dopo un riavvio di Shinka
 * riparte se era accesa.
 */

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { CONDIZIONE_IN_PAROLE, type StatoApplicazione } from "../../src/protocollo/applicazioni.ts";
import { comandaApplicazione, impostaApplicazione, leggiApplicazione, type VistaApplicazione } from "./api.ts";

/** Ogni quanto si riguarda un'applicazione che sta partendo. */
const RIGUARDA_MS = 4000;

export function Applicazione({ idProgetto, nomeAmbiente }: { idProgetto: string; nomeAmbiente: string }): ReactNode {
  const [vista, setVista] = useState<VistaApplicazione>();
  const [inCorso, setInCorso] = useState<"avvio" | "arresto" | "salvataggio">();
  const [errore, setErrore] = useState<string>();
  const [modifica, setModifica] = useState(false);

  const rileggi = useCallback(async (): Promise<void> => {
    try {
      setVista(await leggiApplicazione(idProgetto));
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non so com'è l'applicazione.");
    }
  }, [idProgetto]);

  useEffect(() => {
    setVista(undefined);
    setModifica(false);
    setErrore(undefined);
    void rileggi();
    // Tornando sulla pagina si guarda di nuovo: intanto può essere cambiato tutto.
    const alRitorno = (): void => {
      if (document.visibilityState === "visible") void rileggi();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => document.removeEventListener("visibilitychange", alRitorno);
  }, [rileggi]);

  // Mentre parte, la si riguarda ogni tanto finché risponde.
  const condizione = vista?.stato?.condizione;
  useEffect(() => {
    if (condizione !== "in-avvio") return;
    const sveglia = setInterval(() => void rileggi(), RIGUARDA_MS);
    return () => clearInterval(sveglia);
  }, [condizione, rileggi]);

  async function comanda(azione: "avvia" | "ferma"): Promise<void> {
    setErrore(undefined);
    setInCorso(azione === "avvia" ? "avvio" : "arresto");
    try {
      const stato = await comandaApplicazione(idProgetto, azione);
      setVista((prima) => (prima === undefined ? prima : { ...prima, voluta: azione === "avvia", stato }));
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è stato possibile.");
      void rileggi();
    } finally {
      setInCorso(undefined);
    }
  }

  if (vista === undefined) {
    return <div className="applicazione">{errore === undefined ? <span className="tenue">Carico l'applicazione…</span> : <p className="errore">{errore}</p>}</div>;
  }

  if (vista.avvio === undefined || modifica) {
    return (
      <ImpostaAvvio
        iniziale={vista.avvio}
        nomeAmbiente={nomeAmbiente}
        allAnnulla={vista.avvio === undefined ? undefined : () => setModifica(false)}
        alSalva={async (avvio) => {
          setInCorso("salvataggio");
          try {
            await impostaApplicazione(idProgetto, avvio);
            setModifica(false);
            await rileggi();
          } finally {
            setInCorso(undefined);
          }
        }}
      />
    );
  }

  const stato = vista.stato;
  const accesa = stato?.condizione === "attiva" || stato?.condizione === "in-avvio";
  return (
    <div className="applicazione">
      <div className="applicazione-riga">
        <span className={`spia-applicazione ${stato?.condizione ?? "sconosciuta"}`}>
          {stato === undefined ? "non si sa" : CONDIZIONE_IN_PAROLE[stato.condizione]}
        </span>
        <code className="comando-applicazione" title={`${vista.avvio.comando} · porta ${vista.avvio.porta}`}>
          {vista.avvio.comando}
        </code>
        {accesa ? (
          <button type="button" className="mini" disabled={inCorso !== undefined} onClick={() => void comanda("ferma")}>
            {inCorso === "arresto" ? "Fermo…" : "Ferma"}
          </button>
        ) : (
          <button
            type="button"
            className="mini approva"
            disabled={inCorso !== undefined || stato?.condizione === "fuori-da-shinka"}
            onClick={() => void comanda("avvia")}
          >
            {inCorso === "avvio" ? "Avvio…" : stato?.condizione === "fallita" ? "Riprova" : "Avvia"}
          </button>
        )}
        <button type="button" className="mini discreto" disabled={inCorso !== undefined} onClick={() => setModifica(true)}>
          Modifica
        </button>
      </div>
      <Dettaglio stato={stato} motivo={vista.motivo} />
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Perché è com'è, e le ultime righe dell'uscita quando servono a capire. */
function Dettaglio({ stato, motivo }: { stato: StatoApplicazione | undefined; motivo: string | undefined }): ReactNode {
  const spiegazione = stato?.motivo ?? motivo;
  const conRighe = stato !== undefined && stato.righe.length > 0 && stato.condizione !== "attiva";
  if (spiegazione === undefined && !conRighe) return null;
  return (
    <div className="dettaglio-applicazione">
      {spiegazione !== undefined && <p className={stato?.condizione === "fallita" ? "errore" : "tenue"}>{spiegazione}</p>}
      {conRighe && <pre className="uscita-applicazione">{stato.righe.join("\n")}</pre>}
    </div>
  );
}

function ImpostaAvvio({
  iniziale,
  nomeAmbiente,
  alSalva,
  allAnnulla,
}: {
  iniziale: VistaApplicazione["avvio"];
  nomeAmbiente: string;
  alSalva: (avvio: { comando: string; porta: number; percorso?: string }) => Promise<void>;
  allAnnulla: (() => void) | undefined;
}): ReactNode {
  const idComando = useId();
  const idPorta = useId();
  const [comando, setComando] = useState(iniziale?.comando ?? "");
  const [porta, setPorta] = useState(iniziale === undefined ? "" : String(iniziale.porta));
  const [percorso, setPercorso] = useState(iniziale?.percorso ?? "/");
  const [errore, setErrore] = useState<string>();
  const [salva, setSalva] = useState(false);

  async function alInvio(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    const numero = Number(porta);
    if (comando.trim() === "" || !Number.isInteger(numero) || numero < 1 || numero > 65535) {
      setErrore("Servono il comando e la porta su cui l'applicazione risponde, per esempio 5173.");
      return;
    }
    setErrore(undefined);
    setSalva(true);
    try {
      await alSalva({ comando: comando.trim(), porta: numero, ...(percorso.trim() === "" ? {} : { percorso: percorso.trim() }) });
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non salvato.");
    } finally {
      setSalva(false);
    }
  }

  return (
    <form className="applicazione imposta-avvio" onSubmit={(evento) => void alInvio(evento)}>
      <div className="tenue">
        {iniziale === undefined
          ? `Come si avvia l'applicazione in «${nomeAmbiente}»: il comando, dalla cartella del progetto, e la porta su cui risponde. Puoi anche chiederlo a Claude.`
          : "Come si avvia l'applicazione."}
      </div>
      <label htmlFor={idComando}>Comando</label>
      <input
        id={idComando}
        type="text"
        spellCheck={false}
        autoComplete="off"
        maxLength={2000}
        placeholder="npm run dev -- --port 5173 --host 127.0.0.1"
        value={comando}
        onChange={(evento) => setComando(evento.target.value)}
      />
      <div className="campi-in-riga">
        <label htmlFor={idPorta}>Porta</label>
        <input
          id={idPorta}
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="5173"
          value={porta}
          onChange={(evento) => setPorta(evento.target.value.replace(/\D/g, ""))}
        />
        <input
          type="text"
          aria-label="Pagina iniziale"
          spellCheck={false}
          maxLength={2000}
          value={percorso}
          onChange={(evento) => setPercorso(evento.target.value)}
        />
      </div>
      <div className="tenue">Il comando resta in primo piano finché l'applicazione serve: Shinka la tiene accesa e la riavvia dopo un riavvio.</div>
      <div className="pulsanti">
        <button type="submit" className="mini approva" disabled={salva}>
          {salva ? "Salvo…" : "Salva"}
        </button>
        {allAnnulla !== undefined && (
          <button type="button" className="mini discreto" onClick={allAnnulla}>
            Annulla
          </button>
        )}
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </form>
  );
}
