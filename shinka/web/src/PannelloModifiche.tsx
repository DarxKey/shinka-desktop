/**
 * Il pannello Modifiche: i file cambiati mentre Claude lavorava, turno per turno, dal più recente:
 * quelli che ha cambiato con i suoi strumenti di modifica e quelli cambiati dai comandi che ha
 * eseguito. Di ogni file si vedono le differenze, e lo si può riportare a com'era prima del turno,
 * un file alla volta o tutto il turno. Non c'è nulla da accettare: ciò che non si riporta resta com'è.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { blocchi, confronta, type Blocco } from "../../src/protocollo/differenze.ts";
import type { DecisioneModifiche, FileDeiComandi, FileModificato, VersioniDiUnFile } from "../../src/protocollo/modifiche.ts";
import { annullaModifiche, leggiVersioniModificate } from "./api.ts";

export interface TurnoModificato {
  idTurno: string;
  file: FileModificato[];
  decisi: Readonly<Record<string, DecisioneModifiche>>;
  /** Quanti altri file sono cambiati nel turno senza che se ne tenga la versione di prima. */
  altri?: number;
}

/** Che cosa c'è e che cosa manca tra le modifiche, per ciò che la conversazione ha detto. */
function NotaSuiComandi({ fileDeiComandi }: { fileDeiComandi: FileDeiComandi | undefined }): ReactNode {
  if (fileDeiComandi?.guardati === false) {
    return (
      <p className="tenue nota-comandi" role="note">
        Qui i file cambiati dai comandi non si vedono: {fileDeiComandi.motivo}. Restano quelli che Claude cambia con i suoi strumenti di modifica.
      </p>
    );
  }
  return (
    <p className="tenue nota-comandi">
      Ci sono anche i file cambiati dai comandi che Claude esegue. Restano fuori quelli che il progetto fa ignorare a Git, quelli oltre 1 MB e quelli che non sono testo.
    </p>
  );
}

export function PannelloModifiche({
  idProgetto,
  turni,
  scelto,
  occupata,
  fileDeiComandi,
}: {
  idProgetto: string;
  /** Dal più vecchio al più recente, come nella conversazione. */
  turni: readonly TurnoModificato[];
  /** Il turno da aprire, se il proprietario è arrivato da una scheda della chat. */
  scelto?: string;
  occupata: boolean;
  /** Se entrano anche i file cambiati dai comandi: non si sa finché la conversazione non lo dice. */
  fileDeiComandi?: FileDeiComandi;
}): ReactNode {
  const dalPiuRecente = useMemo(() => [...turni].reverse(), [turni]);
  if (turni.length === 0) {
    return (
      <div className="pannello-modifiche vuoto">
        <p>Qui compaiono i file cambiati mentre Claude lavora, turno per turno, con le differenze: ognuno si può riportare a com'era.</p>
        <NotaSuiComandi fileDeiComandi={fileDeiComandi} />
      </div>
    );
  }
  return (
    <div className="pannello-modifiche">
      {fileDeiComandi?.guardati === false && <NotaSuiComandi fileDeiComandi={fileDeiComandi} />}
      {dalPiuRecente.map((turno, posizione) => (
        <Turno
          key={turno.idTurno}
          idProgetto={idProgetto}
          turno={turno}
          numero={turni.length - posizione}
          aperto={scelto === undefined ? posizione === 0 : scelto === turno.idTurno}
          occupata={occupata}
        />
      ))}
    </div>
  );
}

function Turno({ idProgetto, turno, numero, aperto, occupata }: { idProgetto: string; turno: TurnoModificato; numero: number; aperto: boolean; occupata: boolean }): ReactNode {
  const [errore, setErrore] = useState<string>();
  const [lavoro, setLavoro] = useState(false);
  const [daConfermare, setDaConfermare] = useState<string[] | "tutti">();
  // Un file accettato con le versioni di prima vale come uno mai toccato: si può ancora riportare.
  const inSospeso = turno.file.filter((file) => turno.decisi[file.percorso] !== "annullate").map((file) => file.percorso);
  const aggiunte = turno.file.reduce((somma, file) => somma + file.aggiunte, 0);
  const tolte = turno.file.reduce((somma, file) => somma + file.tolte, 0);

  async function riporta(percorsi: string[]): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    setDaConfermare(undefined);
    try {
      const esito = await annullaModifiche(idProgetto, turno.idTurno, percorsi);
      if (esito.nonAnnullati.length > 0) {
        setErrore(`Non riportati: ${esito.nonAnnullati.map((voce) => `${voce.percorso} (${voce.motivo})`).join("; ")}.`);
      }
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è stato possibile.");
    } finally {
      setLavoro(false);
    }
  }

  const conferma = daConfermare === undefined ? undefined : daConfermare === "tutti" ? inSospeso : daConfermare;
  return (
    <details className="turno-modificato" open={aperto} id={`turno-${turno.idTurno}`}>
      <summary>
        <span className="nome-turno">Turno {numero}</span>
        <span className="tenue">
          {turno.file.length === 1 ? "1 file" : `${turno.file.length} file`} · <span className="aggiunte">+{aggiunte}</span> <span className="tolte">−{tolte}</span>
        </span>
        {inSospeso.length === 0 && turno.file.length > 0 && <span className="deciso">riportato com'era</span>}
      </summary>
      {inSospeso.length > 1 && conferma === undefined && (
        <div className="pulsanti">
          <button type="button" className="mini" disabled={lavoro || occupata} title={occupata ? "Aspetta che Claude finisca" : undefined} onClick={() => setDaConfermare("tutti")}>
            Riporta tutto com'era
          </button>
        </div>
      )}
      {conferma !== undefined && (
        <div className="conferma-annulla" role="alertdialog" aria-label="Riportare i file com'erano">
          <p>
            {conferma.length === 1 ? `${conferma[0]} torna` : `${conferma.length} file tornano`} com'erano prima di questo turno: ciò che il turno vi ha cambiato si
            perde, e Claude ne viene avvisato.
          </p>
          <div className="pulsanti">
            <button type="button" className="mini pericolo" disabled={lavoro} onClick={() => void riporta(conferma)}>
              Riporta com'era
            </button>
            <button type="button" className="mini discreto" onClick={() => setDaConfermare(undefined)}>
              No
            </button>
          </div>
        </div>
      )}
      <ul className="file-modificati">
        {turno.file.map((file) => (
          <FileDelTurno
            key={file.percorso}
            idProgetto={idProgetto}
            idTurno={turno.idTurno}
            file={file}
            deciso={turno.decisi[file.percorso]}
            bloccato={lavoro}
            occupata={occupata}
            alRiporta={() => setDaConfermare([file.percorso])}
          />
        ))}
      </ul>
      {turno.altri !== undefined && (
        <p className="tenue altri-file">
          {turno.altri === 1 ? "Un altro file è cambiato" : `Altri ${turno.altri} file sono cambiati`} in questo turno per un comando: erano troppi per tenerne la versione
          di prima, e da qui non si riportano.
        </p>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </details>
  );
}

function FileDelTurno({
  idProgetto,
  idTurno,
  file,
  deciso,
  bloccato,
  occupata,
  alRiporta,
}: {
  idProgetto: string;
  idTurno: string;
  file: FileModificato;
  deciso: DecisioneModifiche | undefined;
  bloccato: boolean;
  occupata: boolean;
  alRiporta: () => void;
}): ReactNode {
  const [aperto, setAperto] = useState(false);
  return (
    <li className={deciso === "annullate" ? "file-modificato annullate" : "file-modificato"}>
      <div className="riga-file">
        <button type="button" className="discreto nome-file" aria-expanded={aperto} onClick={() => setAperto((prima) => !prima)} title={file.percorso}>
          <span className="freccia" aria-hidden="true">
            {aperto ? "▾" : "▸"}
          </span>
          <code>{file.percorso}</code>
          {file.stato !== "cambiato" && <span className="etichetta-stato">{file.stato === "nuovo" ? "nuovo" : "tolto"}</span>}
          {file.daComando === true && (
            <span className="etichetta-stato da-comando" title="Non lo ha cambiato uno strumento di modifica di Claude: è cambiato mentre il turno era in corso, di solito per un comando">
              da un comando
            </span>
          )}
        </button>
        <span className="conteggio">
          <span className="aggiunte">+{file.aggiunte}</span> <span className="tolte">−{file.tolte}</span>
        </span>
      </div>
      {deciso === "annullate" ? (
        <p className="tenue esito-file">riportato com'era</p>
      ) : (
        <div className="pulsanti">
          <button type="button" className="mini" disabled={bloccato || occupata} title={occupata ? "Aspetta che Claude finisca" : undefined} onClick={alRiporta}>
            Riporta com'era
          </button>
        </div>
      )}
      {aperto && <Differenze idProgetto={idProgetto} idTurno={idTurno} percorso={file.percorso} />}
    </li>
  );
}

function Differenze({ idProgetto, idTurno, percorso }: { idProgetto: string; idTurno: string; percorso: string }): ReactNode {
  const [versioni, setVersioni] = useState<VersioniDiUnFile>();
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    let valido = true;
    leggiVersioniModificate(idProgetto, idTurno, percorso)
      .then((lette) => valido && setVersioni(lette))
      .catch((causa: unknown) => valido && setErrore(causa instanceof Error ? causa.message : "Le differenze non si leggono."));
    return () => {
      valido = false;
    };
  }, [idProgetto, idTurno, percorso]);
  const pezzi = useMemo<Blocco[]>(() => (versioni === undefined ? [] : blocchi(confronta(versioni.prima ?? "", versioni.dopo ?? ""))), [versioni]);
  if (errore !== undefined) return <p className="errore">{errore}</p>;
  if (versioni === undefined) return <p className="tenue">Leggo le differenze…</p>;
  if (pezzi.length === 0) return <p className="tenue">Nessuna differenza nel testo.</p>;
  return (
    <div className="differenze" role="table" aria-label={`Differenze di ${percorso}`}>
      {pezzi.map((pezzo, posizione) => (
        <div key={posizione} className="pezzo" role="rowgroup">
          {pezzo.righe.map((riga, indice) => (
            <div key={indice} className={`riga-diff ${riga.tipo}`} role="row">
              <span className="numero" aria-hidden="true">
                {riga.tipo === "aggiunta" ? "" : riga.prima}
              </span>
              <span className="numero" aria-hidden="true">
                {riga.tipo === "tolta" ? "" : riga.dopo}
              </span>
              <span className="segno" aria-hidden="true">
                {riga.tipo === "aggiunta" ? "+" : riga.tipo === "tolta" ? "−" : " "}
              </span>
              <code>{riga.testo === "" ? " " : riga.testo}</code>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
