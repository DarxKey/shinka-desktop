/**
 * Modificare un messaggio già mandato: il testo si riscrive sul posto e la conversazione riparte da
 * lì. Se da quel messaggio Claude ha cambiato dei file, una casella chiede se riportarli a com'erano,
 * con il loro elenco. "Rigenera", sotto l'ultima risposta, apre la stessa modifica sull'ultimo messaggio.
 * Nella Home il messaggio può anche partire in un argomento nuovo, che ha la storia fino a lì: quello
 * aperto resta com'è, archiviato.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import type { AnteprimaRiavvolgimento } from "../../src/protocollo/eventi.ts";
import { eDellaHome, leggiRiavvolgimento, mandaInUnRamo, modificaMessaggio } from "./api.ts";
import { useBaseDellaChat } from "./ContestoChat.ts";

/** Il nome di un file, con la cartella che lo precede se aiuta a riconoscerlo. */
function nomeBreve(percorso: string): string {
  const parti = percorso.split(/[\\/]/).filter((parte) => parte !== "");
  return parti.slice(-2).join("/");
}

export function ModificaMessaggio({
  idMessaggio,
  testoIniziale,
  allaChiusura,
}: {
  idMessaggio: string;
  testoIniziale: string;
  allaChiusura: () => void;
}): ReactNode {
  const base = useBaseDellaChat();
  const idCasella = useId();
  const [testo, setTesto] = useState(testoIniziale);
  const [anteprima, setAnteprima] = useState<AnteprimaRiavvolgimento>();
  const [file, setFile] = useState(false);
  const [invio, setInvio] = useState<"qui" | "ramo">();
  const nellaHome = eDellaHome(base);
  const [errore, setErrore] = useState<string>();

  useEffect(() => {
    let valida = true;
    leggiRiavvolgimento(base, idMessaggio)
      .then((letta) => valida && setAnteprima(letta))
      .catch((causa: unknown) => valida && setAnteprima({ motivo: causa instanceof Error ? causa.message : "Non so quali file sono cambiati." }));
    return () => {
      valida = false;
    };
  }, [base, idMessaggio]);

  async function invia(dove: "qui" | "ramo"): Promise<void> {
    if (testo.trim() === "") return;
    setInvio(dove);
    setErrore(undefined);
    try {
      if (dove === "ramo") await mandaInUnRamo(base, idMessaggio, testo);
      else await modificaMessaggio(base, idMessaggio, testo, file);
      allaChiusura();
    } catch (causa) {
      setInvio(undefined);
      setErrore(causa instanceof Error ? causa.message : "Il messaggio non è ripartito.");
    }
  }

  const cambiati = anteprima !== undefined && "file" in anteprima ? anteprima.file : [];
  return (
    <div className="modifica-messaggio">
      <textarea
        aria-label="Il messaggio, modificato"
        value={testo}
        autoFocus
        rows={Math.min(10, Math.max(2, testo.split("\n").length))}
        disabled={invio !== undefined}
        onChange={(evento) => setTesto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") allaChiusura();
        }}
      />
      {anteprima === undefined && <p className="tenue">Guardo quali file sono cambiati da qui…</p>}
      {anteprima !== undefined && "motivo" in anteprima && <p className="tenue">{anteprima.motivo}</p>}
      {cambiati.length > 0 && (
        <div className="file-da-riportare">
          <label htmlFor={idCasella} className="spunta">
            <input id={idCasella} type="checkbox" checked={file} disabled={invio !== undefined} onChange={(evento) => setFile(evento.target.checked)} />
            <span>
              Riporta anche i file a com'erano ({cambiati.length === 1 ? "uno è cambiato" : `${cambiati.length} sono cambiati`} da qui)
            </span>
          </label>
          <ul>
            {cambiati.slice(0, 12).map((percorso) => (
              <li key={percorso} title={percorso}>
                <code>{nomeBreve(percorso)}</code>
              </li>
            ))}
            {cambiati.length > 12 && <li className="tenue">e altri {cambiati.length - 12}</li>}
          </ul>
        </div>
      )}
      {anteprima !== undefined && "file" in anteprima && cambiati.length === 0 && (
        <p className="tenue">Da qui Claude non ha cambiato file: riparte solo la conversazione.</p>
      )}
      <div className="pulsanti">
        <button type="button" className="approva" disabled={invio !== undefined || testo.trim() === ""} onClick={() => void invia("qui")}>
          {invio === "qui" ? "Riparto…" : "Manda da qui"}
        </button>
        {nellaHome && (
          <button
            type="button"
            disabled={invio !== undefined || testo.trim() === ""}
            title="Un argomento nuovo con la storia fin qui; questo resta com'è, archiviato"
            onClick={() => void invia("ramo")}
          >
            {invio === "ramo" ? "Preparo l'argomento…" : "In un argomento nuovo"}
          </button>
        )}
        <button type="button" className="discreto" disabled={invio !== undefined} onClick={allaChiusura}>
          Annulla
        </button>
      </div>
      <p className="tenue">
        La conversazione riparte da questo messaggio: quello che viene dopo, Claude non lo ricorderà.
        {nellaHome && " In un argomento nuovo, invece, questo resta com'è e lo ritrovi tra gli archiviati."}
      </p>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
