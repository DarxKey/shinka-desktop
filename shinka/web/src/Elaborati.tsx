import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { genereDi, modificabileAMano, type ElaboratoConsegnato } from "../../src/protocollo/elaborati.ts";
import { aggiornaElaborato, BASE_HOME, indirizzoElaborato, leggiConsegnati, salvaElaborato, type RiferimentoElaborato } from "./api.ts";
import { aggiungiCommento } from "./commenti.ts";
import { useApriElaborato } from "./ContestoChat.ts";
import { oraInBreve } from "./descrivi.ts";
import { chiaveElaborato, giornoDelGruppo, perGiorno } from "./elaborati-giorni.ts";
import { Formattato } from "./Elementi.tsx";
import { frammentoDi } from "./vista.ts";

/** Un testo più lungo di così si mostra solo in parte: il resto si scarica. */
const TESTO_MOSTRATO_MASSIMO = 200_000;

/** Il nome del file, senza le cartelle. */
function nomeDi(percorso: string): string {
  return percorso.split("/").pop() ?? percorso;
}

/** Ciò che il centro risponde quando un elaborato non si può leggere. */
async function problemaDi(risposta: Response): Promise<string> {
  const dati: unknown = await risposta.json().catch(() => undefined);
  return typeof dati === "object" && dati !== null && "errore" in dati && typeof dati.errore === "string"
    ? dati.errore
    : `Il centro ha risposto ${risposta.status}.`;
}

/**
 * Un elaborato com'è: un'immagine, un testo con la sua formattazione, una pagina in un riquadro
 * isolato. Il riquadro ha un'origine sua: la pagina non vede né la sessione né le API di Shinka.
 */
export function AnteprimaElaborato({
  riferimento,
  compatta = false,
  versione = 0,
}: {
  riferimento: RiferimentoElaborato;
  compatta?: boolean;
  /** Cambia quando il file è stato rifatto o riscritto: l'anteprima lo rilegge. */
  versione?: number;
}): ReactNode {
  const genere = genereDi(riferimento.percorso);
  const indirizzo = `${indirizzoElaborato(riferimento)}${versione === 0 ? "" : `&v=${versione}`}`;
  const [testo, setTesto] = useState<string>();
  const [problema, setProblema] = useState<string>();

  useEffect(() => {
    setTesto(undefined);
    setProblema(undefined);
    if (genere !== "markdown" && genere !== "testo") return;
    let valido = true;
    fetch(indirizzo, { credentials: "same-origin" })
      .then(async (risposta) => {
        if (!risposta.ok) throw new Error(await problemaDi(risposta));
        return risposta.text();
      })
      .then((letto) => valido && setTesto(letto))
      .catch((errore: unknown) => valido && setProblema(errore instanceof Error ? errore.message : String(errore)));
    return () => {
      valido = false;
    };
  }, [indirizzo, genere]);

  // Un'immagine o una pagina che non arrivano dicono perché solo a chi lo chiede di nuovo.
  const nonArrivata = useCallback(() => {
    fetch(indirizzo, { credentials: "same-origin" })
      .then(async (risposta) => setProblema(risposta.ok ? "Il file non si riesce a mostrare." : await problemaDi(risposta)))
      .catch(() => setProblema("Il centro non risponde."));
  }, [indirizzo]);

  const classe = compatta ? "anteprima-elaborato compatta" : "anteprima-elaborato";
  if (problema !== undefined) {
    return (
      <div className={`${classe} problema`} role="alert">
        {problema}
      </div>
    );
  }
  switch (genere) {
    case "immagine":
      return (
        <div className={classe}>
          <img src={indirizzo} alt={riferimento.titolo ?? nomeDi(riferimento.percorso)} onError={nonArrivata} />
        </div>
      );
    case "html":
      return (
        <div className={`${classe} pagina`}>
          <iframe
            src={indirizzo}
            title={riferimento.titolo ?? nomeDi(riferimento.percorso)}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
      );
    case "markdown":
    case "testo": {
      if (testo === undefined) return <div className={`${classe} attesa`}>Carico…</div>;
      const tagliato = testo.length > TESTO_MOSTRATO_MASSIMO;
      const mostrato = tagliato ? testo.slice(0, TESTO_MOSTRATO_MASSIMO) : testo;
      return (
        <div className={`${classe} ${genere}`}>
          {genere === "markdown" ? <Formattato testo={mostrato} /> : <pre>{mostrato}</pre>}
          {tagliato && <p className="nota">Il file continua: scaricalo per leggerlo tutto.</p>}
        </div>
      );
    }
    case "altro":
      return (
        <div className={`${classe} altro`}>
          Questo file non si può mostrare qui.{" "}
          <a href={indirizzoElaborato(riferimento, true)} download={nomeDi(riferimento.percorso)}>
            Scaricalo
          </a>
          .
        </div>
      );
  }
}

/** L'elaborato che la Home ha mostrato nella chat: il nome, l'ambiente e la sua anteprima. */
export function SchedaElaborato({ riferimento }: { riferimento: RiferimentoElaborato }): ReactNode {
  const apri = useApriElaborato();
  const [versione, setVersione] = useState(0);
  const nome = nomeDi(riferimento.percorso);
  return (
    <div className="riga scheda-elaborato">
      <header>
        <div className="titoli">
          <span className="nome">{riferimento.titolo ?? nome}</span>
          <span className="dove">
            {riferimento.titolo === undefined ? "" : `${nome} · `}
            {riferimento.nomeAmbiente}
          </span>
        </div>
        {apri !== undefined && (
          <button type="button" className="discreto" onClick={() => apri(riferimento)}>
            Apri
          </button>
        )}
        <a className="pulsante discreto" href={indirizzoElaborato(riferimento, true)} download={nome}>
          Scarica
        </a>
      </header>
      {riferimento.aggiorna !== undefined && <Aggiorna riferimento={riferimento} allAggiornamento={() => setVersione((prima) => prima + 1)} />}
      <AnteprimaElaborato riferimento={riferimento} compatta versione={versione} />
    </div>
  );
}

/**
 * Il pulsante di un elaborato vivo: rifà il file con il comando che la Home gli ha dato, che il
 * proprietario può leggere prima di premere.
 */
function Aggiorna({ riferimento, allAggiornamento }: { riferimento: RiferimentoElaborato; allAggiornamento: () => void }): ReactNode {
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<{ riuscita: boolean; uscita: string } | { problema: string }>();
  async function aggiorna(): Promise<void> {
    setLavoro(true);
    setEsito(undefined);
    try {
      const fatto = await aggiornaElaborato(riferimento);
      setEsito(fatto);
      if (fatto.riuscita) allAggiornamento();
    } catch (causa) {
      setEsito({ problema: causa instanceof Error ? causa.message : "Non si è aggiornato." });
    } finally {
      setLavoro(false);
    }
  }
  return (
    <div className="aggiorna-elaborato">
      <button type="button" className="mini" disabled={lavoro} onClick={() => void aggiorna()}>
        {lavoro ? "Aggiorno…" : "Aggiorna"}
      </button>
      <details>
        <summary className="tenue">Che cosa fa</summary>
        <p className="tenue">Esegue, nella cartella dell'argomento in «{riferimento.nomeAmbiente}»:</p>
        <pre>{riferimento.aggiorna}</pre>
      </details>
      {esito !== undefined && "problema" in esito && (
        <p className="errore" role="alert">
          {esito.problema}
        </p>
      )}
      {esito !== undefined && "riuscita" in esito && !esito.riuscita && (
        <div className="errore" role="alert">
          Il comando non è riuscito.
          {esito.uscita !== "" && <pre>{esito.uscita}</pre>}
        </div>
      )}
      {esito !== undefined && "riuscita" in esito && esito.riuscita && <span className="tenue">Aggiornato.</span>}
    </div>
  );
}

/** Dove sta un elaborato, per un commento o una modifica che arriva alla Home. */
function doveDi(riferimento: ElaboratoConsegnato): string {
  return `elaborato nell'ambiente ${riferimento.nomeAmbiente}, argomento ${riferimento.titoloArgomento === undefined ? "aperto" : `«${riferimento.titoloArgomento}»`} (${riferimento.idArgomento})`;
}

/** Modificare a mano un elaborato di testo, e commentarlo: le due cose arrivano alla Home con il prossimo messaggio. */
function LavoroSullElaborato({ elaborato, allaModifica, anteprima }: { elaborato: ElaboratoConsegnato; allaModifica: () => void; anteprima: ReactNode }): ReactNode {
  const [inModifica, setInModifica] = useState<string>();
  const [commento, setCommento] = useState<{ testo: string; pezzo: string }>();
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [fatto, setFatto] = useState<string>();
  const contenitore = useRef<HTMLDivElement>(null);
  const modificabile = modificabileAMano(elaborato.percorso);

  async function apriModifica(): Promise<void> {
    setErrore(undefined);
    setFatto(undefined);
    try {
      const risposta = await fetch(indirizzoElaborato(elaborato), { credentials: "same-origin", cache: "no-store" });
      if (!risposta.ok) throw new Error(await problemaDi(risposta));
      setInModifica(await risposta.text());
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non riesco a leggerlo.");
    }
  }

  async function salva(): Promise<void> {
    if (inModifica === undefined) return;
    setSalvo(true);
    setErrore(undefined);
    try {
      await salvaElaborato(elaborato, inModifica);
      // Claude deve saperlo, prima di rimetterci mano.
      aggiungiCommento(BASE_HOME, {
        percorso: elaborato.percorso,
        riga: 0,
        testoDellaRiga: "",
        commento: "L'ho modificato a mano: rileggilo prima di cambiarlo.",
        dove: doveDi(elaborato),
      });
      setInModifica(undefined);
      setFatto("Salvato. La Home lo saprà con il tuo prossimo messaggio.");
      allaModifica();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non si è salvato.");
    } finally {
      setSalvo(false);
    }
  }

  return (
    <>
      <div className="lavoro-elaborato">
        {modificabile && inModifica === undefined && (
          <button type="button" className="mini" onClick={() => void apriModifica()}>
            Modifica
          </button>
        )}
        {commento === undefined && (
          <button
            type="button"
            className="mini"
            // Il pezzo scelto si legge prima del clic: dopo, la scelta potrebbe non esserci più.
            onMouseDown={() => {
              const scelta = window.getSelection();
              const dentro = scelta !== null && contenitore.current !== null && scelta.anchorNode !== null && contenitore.current.contains(scelta.anchorNode);
              setCommento({ testo: "", pezzo: dentro ? scelta.toString().trim().slice(0, 500) : "" });
            }}
            onClick={() => setCommento((prima) => prima ?? { testo: "", pezzo: "" })}
          >
            Commenta
          </button>
        )}
      </div>
      {commento !== undefined && (
        <div className="commento-elaborato">
          {commento.pezzo !== "" && <blockquote>{commento.pezzo}</blockquote>}
          <textarea
            aria-label="Commento all'elaborato"
            autoFocus
            rows={3}
            placeholder={commento.pezzo === "" ? "Che cosa vuoi che la Home sappia di questo elaborato? Scegli un pezzo prima di premere «Commenta» per citarlo." : "Che cosa vuoi che la Home sappia di questo pezzo?"}
            value={commento.testo}
            onChange={(evento) => setCommento({ ...commento, testo: evento.target.value })}
          />
          <div className="pulsanti">
            <button
              type="button"
              className="mini approva"
              disabled={commento.testo.trim() === ""}
              onClick={() => {
                aggiungiCommento(BASE_HOME, { percorso: elaborato.percorso, riga: 0, testoDellaRiga: commento.pezzo, commento: commento.testo, dove: doveDi(elaborato) });
                setCommento(undefined);
                setFatto("Il commento parte con il tuo prossimo messaggio alla Home.");
              }}
            >
              Aggiungi il commento
            </button>
            <button type="button" className="mini discreto" onClick={() => setCommento(undefined)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {fatto !== undefined && (
        <p className="tenue fatto-elaborato">
          {fatto} <a href={frammentoDi({ tipo: "home" })}>Vai alla Home</a>
        </p>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
      {inModifica !== undefined ? (
        <div className="modifica-elaborato">
          <textarea aria-label="Il testo dell'elaborato" value={inModifica} disabled={salvo} onChange={(evento) => setInModifica(evento.target.value)} />
          <div className="pulsanti">
            <button type="button" className="mini approva" disabled={salvo} onClick={() => void salva()}>
              {salvo ? "Salvo…" : "Salva"}
            </button>
            <button type="button" className="mini discreto" disabled={salvo} onClick={() => setInModifica(undefined)}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div ref={contenitore}>{anteprima}</div>
      )}
    </>
  );
}

/**
 * La pagina degli elaborati: i file definitivi che la Home ha consegnato, quelli che ha mostrato,
 * per giorno. Scelto uno, la pagina lo mostra.
 */
export function PaginaElaborati({ menu, scelto }: { menu: ReactNode; scelto: string | undefined }): ReactNode {
  const [elaborati, setElaborati] = useState<ElaboratoConsegnato[]>();
  const [versione, setVersione] = useState(0);
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    document.title = "Elaborati · Shinka";
  }, []);
  useEffect(() => {
    let vivo = true;
    leggiConsegnati()
      .then((letti) => vivo && setElaborati(letti))
      .catch((causa: unknown) => vivo && setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere gli elaborati."));
    return () => {
      vivo = false;
    };
  }, []);

  const aperto = scelto === undefined ? undefined : elaborati?.find((voce) => chiaveElaborato(voce) === scelto);

  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>{aperto === undefined ? "Elaborati" : (aperto.titolo ?? nomeDi(aperto.percorso))}</h1>
          <span className="sottotitolo">
            {aperto === undefined ? "Ciò che la Home ti ha consegnato" : `${aperto.percorso} · ${aperto.nomeAmbiente}`}
          </span>
        </div>
        {aperto !== undefined && (
          <a className="pulsante discreto mini" href={indirizzoElaborato(aperto, true)} download={nomeDi(aperto.percorso)}>
            Scarica
          </a>
        )}
      </header>
      <div className="corpo-pagina">
        <div className={aperto === undefined ? "colonna-pagina" : "colonna-pagina elaborato-in-pagina"}>
          {scelto !== undefined && (
            <a className="indietro-elaborati" href={frammentoDi({ tipo: "elaborati" })}>
              ‹ Tutti gli elaborati
            </a>
          )}
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {elaborati === undefined && errore === undefined && <p className="tenue">Carico…</p>}
          {scelto !== undefined && elaborati !== undefined && aperto === undefined && (
            <p className="tenue">Questo elaborato non c'è più tra quelli consegnati.</p>
          )}
          {aperto !== undefined && (
            <>
              <p className="tenue dove-elaborato">
                {aperto.titoloArgomento === undefined ? "Argomento aperto nella Home" : `Argomento «${aperto.titoloArgomento}»`} ·{" "}
                {giornoDelGruppo(aperto.quando)}, {oraInBreve(aperto.quando)}
              </p>
              {aperto.aggiorna !== undefined && <Aggiorna riferimento={aperto} allAggiornamento={() => setVersione((prima) => prima + 1)} />}
              <LavoroSullElaborato
                key={chiaveElaborato(aperto)}
                elaborato={aperto}
                allaModifica={() => setVersione((prima) => prima + 1)}
                anteprima={<AnteprimaElaborato riferimento={aperto} versione={versione} />}
              />
            </>
          )}
          {scelto === undefined && elaborati !== undefined && (
            <>
              <p className="tenue">
                I file che la Home ti ha consegnato mostrandoteli: documenti, itinerari, immagini, mappe. I file di lavoro che
                non ti ha mostrato restano nelle cartelle degli argomenti.
              </p>
              {elaborati.length === 0 && <p className="tenue vuota">Ancora nessuno. Chiedi alla Home un documento o una mappa.</p>}
              {perGiorno(elaborati).map((gruppo) => (
                <section key={gruppo.giorno} className="giorno-elaborati">
                  <h2 className="titolo-sezione">{gruppo.giorno}</h2>
                  <ul className="elenco-consegnati">
                    {gruppo.elaborati.map((voce) => (
                      <li key={chiaveElaborato(voce)}>
                        <a className="voce-elaborato" href={frammentoDi({ tipo: "elaborati", scelto: chiaveElaborato(voce) })}>
                          <span className={`segno ${genereDi(voce.percorso)}`} aria-hidden="true" />
                          <span className="nome">{voce.titolo ?? nomeDi(voce.percorso)}</span>
                          <span className="dettaglio">
                            {[voce.titolo === undefined ? undefined : nomeDi(voce.percorso), voce.titoloArgomento, oraInBreve(voce.quando)]
                              .filter((parte) => parte !== undefined && parte !== "")
                              .join(" · ")}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
