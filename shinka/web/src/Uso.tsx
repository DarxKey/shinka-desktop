/**
 * Le pagine Uso e Archiviazione. Uso: i limiti del piano e i token degli ultimi giorni, per giorno
 * e per conversazione. Archiviazione: quanto occupano argomenti e progetti tra i dati di Shinka,
 * con la pulizia degli argomenti archiviati e dei progetti.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Archiviazione, SpazioDiUnaVoce, Uso } from "../../src/protocollo/uso.ts";
import { eliminaArgomento, eliminaProgetto, leggiArchiviazione, leggiUso } from "./api.ts";
import { inMigliaia, quandoRiparte } from "./descrivi.ts";
import { frammentoDi } from "./vista.ts";

function inGiornoBreve(giorno: string): string {
  const [anno, mese, numero] = giorno.split("-").map(Number);
  return new Date(anno ?? 2000, (mese ?? 1) - 1, numero ?? 1).toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
}

export function PaginaUso({ menu }: { menu: ReactNode }): ReactNode {
  const [uso, setUso] = useState<Uso>();
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    document.title = "Uso · Shinka";
    leggiUso()
      .then(setUso)
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere l'uso."));
  }, []);
  const massimo = Math.max(1, ...(uso?.giorni ?? []).map((giorno) => giorno.ingresso + giorno.uscita));
  const totale = (uso?.giorni ?? []).reduce((somma, giorno) => somma + giorno.ingresso + giorno.uscita, 0);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Uso</h1>
          <span className="sottotitolo">I limiti del piano e i token delle ultime due settimane</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-uso">
          {errore !== undefined && <p className="errore">{errore}</p>}
          {uso === undefined && errore === undefined && <p className="tenue">Carico…</p>}
          {uso !== undefined && (
            <>
              <section>
                <h2 className="titolo-sezione">Limiti del piano</h2>
                {uso.limiti === undefined ? (
                  <p className="tenue">Si sapranno dopo la prossima risposta della Home.</p>
                ) : (
                  <div className="limiti-uso">
                    {uso.limiti.cinqueOre !== undefined && <Limite nome="Ultime 5 ore" percento={uso.limiti.cinqueOre.percento} riparte={quandoRiparte(uso.limiti.cinqueOre.azzeraIl)} />}
                    {uso.limiti.setteGiorni !== undefined && <Limite nome="Ultimi 7 giorni" percento={uso.limiti.setteGiorni.percento} riparte={quandoRiparte(uso.limiti.setteGiorni.azzeraIl)} />}
                  </div>
                )}
              </section>
              <section>
                <h2 className="titolo-sezione">Token per giorno</h2>
                <p className="tenue">
                  {inMigliaia(totale)} token in due settimane, letti e scritti. Contano i turni da quando Shinka li registra (18 novembre 2026).
                </p>
                <div className="grafico-uso" role="table" aria-label="Token per giorno">
                  {uso.giorni.map((giorno) => {
                    const somma = giorno.ingresso + giorno.uscita;
                    return (
                      <div key={giorno.giorno} className="colonna-uso" role="row" title={`${inGiornoBreve(giorno.giorno)}: ${inMigliaia(giorno.ingresso)} letti, ${inMigliaia(giorno.uscita)} scritti, ${giorno.turni} turni`}>
                        <span className="barra-uso" style={{ height: `${Math.round((somma / massimo) * 100)}%` }} />
                        <span className="giorno-uso" role="cell">
                          {Number(giorno.giorno.slice(8))}
                        </span>
                        <span className="valore-uso" role="cell">
                          {somma === 0 ? "" : inMigliaia(somma)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section>
                <h2 className="titolo-sezione">Per conversazione</h2>
                {uso.conversazioni.length === 0 ? (
                  <p className="tenue">Nessun turno registrato nelle ultime due settimane.</p>
                ) : (
                  <table className="tabella-uso">
                    <thead>
                      <tr>
                        <th>Conversazione</th>
                        <th>Turni</th>
                        <th>Letti</th>
                        <th>Scritti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uso.conversazioni.map((voce) => (
                        <tr key={`${voce.genere}-${voce.id}`}>
                          <td>
                            <a href={frammentoDi(voce.genere === "progetto" ? { tipo: "progetto", id: voce.id } : { tipo: "argomento", id: voce.id })}>{voce.nome}</a>
                          </td>
                          <td>{voce.turni}</td>
                          <td>{inMigliaia(voce.ingresso)}</td>
                          <td>{inMigliaia(voce.uscita)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Limite({ nome, percento, riparte }: { nome: string; percento: number; riparte: string }): ReactNode {
  const pieno = Math.max(0, Math.min(100, percento));
  return (
    <div className="limite-uso">
      <div className="riga-limite">
        <span>{nome}</span>
        <strong>{pieno}%</strong>
      </div>
      <span className="barra-limite" aria-hidden="true">
        <span className={pieno >= 90 ? "alta" : pieno >= 70 ? "media" : "bassa"} style={{ width: `${pieno}%` }} />
      </span>
      {riparte !== "" && <span className="tenue">{riparte}</span>}
    </div>
  );
}

function inByte(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  if (byte < 1024 * 1024 * 1024) return `${(byte / 1024 / 1024).toFixed(1)} MB`;
  return `${(byte / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function PaginaArchiviazione({ menu }: { menu: ReactNode }): ReactNode {
  const [archiviazione, setArchiviazione] = useState<Archiviazione>();
  const [errore, setErrore] = useState<string>();
  const leggi = useCallback(() => {
    leggiArchiviazione()
      .then(setArchiviazione)
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere lo spazio."));
  }, []);
  useEffect(() => {
    document.title = "Archiviazione · Shinka";
    leggi();
  }, [leggi]);
  const totale = (archiviazione?.voci ?? []).reduce((somma, voce) => somma + voce.byteStoria + voce.byteFile, 0);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Archiviazione</h1>
          <span className="sottotitolo">Quanto occupano argomenti e progetti tra i dati di Shinka</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-archiviazione">
          {errore !== undefined && <p className="errore">{errore}</p>}
          {archiviazione === undefined && errore === undefined && <p className="tenue">Conto…</p>}
          {archiviazione !== undefined && (
            <>
              <p className="tenue">
                In tutto {inByte(totale)}{archiviazione.perDifetto ? " o poco più" : ""}. Per gli argomenti conta la storia e la cartella nell'ambiente del centro; per i
                progetti la storia e le immagini, non la cartella con il codice, che resta anche se elimini il progetto.
              </p>
              <ul className="elenco-spazio">
                {archiviazione.voci.map((voce) => (
                  <VoceSpazio key={`${voce.genere}-${voce.id}`} voce={voce} alCambio={leggi} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VoceSpazio({ voce, alCambio }: { voce: SpazioDiUnaVoce; alCambio: () => void }): ReactNode {
  const [conferma, setConferma] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  async function elimina(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    try {
      if (voce.genere === "argomento") await eliminaArgomento(voce.id);
      else await eliminaProgetto(voce.id);
      alCambio();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non si è eliminato.");
      setLavoro(false);
    }
  }
  return (
    <li className="voce-spazio">
      <div className="riga-spazio">
        <span className="genere-spazio">{voce.genere === "argomento" ? "Argomento" : "Progetto"}</span>
        <a className="nome-spazio" href={frammentoDi(voce.genere === "progetto" ? { tipo: "progetto", id: voce.id } : voce.eliminabile ? { tipo: "argomento", id: voce.id } : { tipo: "home" })}>
          {voce.nome}
        </a>
        <span className="byte-spazio">{inByte(voce.byteStoria + voce.byteFile)}</span>
      </div>
      <p className="tenue">
        storia {inByte(voce.byteStoria)} · {voce.genere === "argomento" ? "cartella" : "immagini"} {inByte(voce.byteFile)}
      </p>
      {voce.eliminabile && !conferma && (
        <button type="button" className="mini discreto" onClick={() => setConferma(true)}>
          Elimina…
        </button>
      )}
      {conferma && (
        <div className="conferma-annulla" role="alertdialog" aria-label={`Eliminare ${voce.nome}`}>
          <p>
            {voce.genere === "argomento"
              ? "L'argomento sparisce con la sua storia e la sua cartella nell'ambiente del centro. Le cartelle negli altri ambienti restano."
              : "Il progetto sparisce da Shinka con la sua conversazione. La cartella con i suoi file resta dov'è."}{" "}
            Non si torna indietro.
          </p>
          <div className="pulsanti">
            <button type="button" className="mini pericolo" disabled={lavoro} onClick={() => void elimina()}>
              Elimina
            </button>
            <button type="button" className="mini discreto" disabled={lavoro} onClick={() => setConferma(false)}>
              No
            </button>
          </div>
        </div>
      )}
      {errore !== undefined && <p className="errore">{errore}</p>}
    </li>
  );
}
