/**
 * Il pannello File: sfogliare e cercare i file del progetto, e guardarne uno in anteprima. Il
 * testo e il codice si leggono con il colore della sintassi e i numeri di riga, e ogni riga si può
 * commentare: i commenti partono con il prossimo messaggio. Immagini, PDF, video e audio si vedono
 * come nel browser; il Markdown impaginato, o nel suo sorgente. Ogni file si scarica così com'è, e
 * ogni cartella, anche il progetto intero, come ZIP (ADR 0048). Solo lettura.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { genereDelFile, linguaggioDi, type ElencoCartella, type FileTrovati } from "../../src/protocollo/file-progetto.ts";
import { baseDelProgetto, cercaFile, elencaFile, indirizzoDaScaricare, indirizzoDelFile, leggiTestoDelFile } from "./api.ts";
import { aggiungiCommento, useCommenti } from "./commenti.ts";
import { Formattato } from "./Elementi.tsx";

/** Quante righe di un file di testo si mostrano al massimo. */
const RIGHE_MOSTRATE = 4000;

function dimensioneInParole(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

/** Il pulsante per scaricare: un file così com'è, una cartella come ZIP. */
function Scarica({ idProgetto, percorso, cartella, nome }: { idProgetto: string; percorso: string; cartella: boolean; nome: string }): ReactNode {
  const titolo = cartella ? `Scarica ${nome} (ZIP)` : `Scarica ${nome}`;
  return (
    <a className="scarica-file" href={indirizzoDaScaricare(idProgetto, percorso)} download aria-label={titolo} title={titolo}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3v9.5M6 9l4 4 4-4M4 16.5h12" />
      </svg>
    </a>
  );
}

export function PannelloFile({ idProgetto }: { idProgetto: string }): ReactNode {
  const [cartella, setCartella] = useState("");
  const [elenco, setElenco] = useState<ElencoCartella>();
  const [cercato, setCercato] = useState("");
  const [trovati, setTrovati] = useState<FileTrovati>();
  const [scelto, setScelto] = useState<string>();
  const [errore, setErrore] = useState<string>();

  useEffect(() => {
    let valido = true;
    setErrore(undefined);
    elencaFile(idProgetto, cartella)
      .then((letto) => valido && setElenco(letto))
      .catch((causa: unknown) => valido && setErrore(causa instanceof Error ? causa.message : "La cartella non si legge."));
    return () => {
      valido = false;
    };
  }, [idProgetto, cartella]);

  useEffect(() => {
    if (cercato.trim().length < 2) {
      setTrovati(undefined);
      return;
    }
    let valido = true;
    const attesa = setTimeout(() => {
      cercaFile(idProgetto, cercato)
        .then((letti) => valido && setTrovati(letti))
        .catch((causa: unknown) => valido && setErrore(causa instanceof Error ? causa.message : "La ricerca non è riuscita."));
    }, 250);
    return () => {
      valido = false;
      clearTimeout(attesa);
    };
  }, [idProgetto, cercato]);

  const parti = cartella === "" ? [] : cartella.split("/");
  const apri = (percorso: string): void => {
    if (percorso.endsWith("/")) {
      setCartella(percorso.slice(0, -1));
      setCercato("");
      setScelto(undefined);
    } else setScelto(percorso);
  };

  if (scelto !== undefined) {
    return (
      <div className="pannello-file">
        <div className="barra-file">
          <button type="button" className="discreto mini" onClick={() => setScelto(undefined)}>
            ← {cartella === "" ? "Progetto" : (parti.at(-1) ?? "")}
          </button>
          <code className="percorso-file" title={scelto}>
            {scelto}
          </code>
          <Scarica idProgetto={idProgetto} percorso={scelto} cartella={false} nome={scelto.split("/").pop() ?? scelto} />
        </div>
        <Anteprima idProgetto={idProgetto} percorso={scelto} />
      </div>
    );
  }

  return (
    <div className="pannello-file">
      <div className="barra-file">
        <input type="search" aria-label="Cerca un file per nome" placeholder="Cerca un file…" value={cercato} onChange={(evento) => setCercato(evento.target.value)} />
      </div>
      {trovati !== undefined ? (
        <ul className="elenco-file" aria-label="File trovati">
          {trovati.percorsi.length === 0 && <li className="tenue">Nessun file con questo nome.</li>}
          {trovati.percorsi.map((percorso) => (
            <li key={percorso} className="riga-file">
              <button type="button" className="discreto voce-file" onClick={() => apri(percorso)}>
                <span aria-hidden="true">{percorso.endsWith("/") ? "📁" : "📄"}</span> <code>{percorso}</code>
              </button>
              <Scarica
                idProgetto={idProgetto}
                percorso={percorso.replace(/\/$/, "")}
                cartella={percorso.endsWith("/")}
                nome={percorso.replace(/\/$/, "").split("/").pop() ?? percorso}
              />
            </li>
          ))}
          {trovati.incompleta && <li className="tenue">Ce ne sono altri: scrivi un nome più preciso.</li>}
        </ul>
      ) : (
        <>
          <nav className="briciole" aria-label="Cartella">
            <button type="button" className="discreto mini" onClick={() => setCartella("")}>
              Progetto
            </button>
            {parti.map((parte, posizione) => (
              <span key={posizione}>
                {" / "}
                <button type="button" className="discreto mini" onClick={() => setCartella(parti.slice(0, posizione + 1).join("/"))}>
                  {parte}
                </button>
              </span>
            ))}
            <Scarica idProgetto={idProgetto} percorso={cartella} cartella nome={cartella === "" ? "il progetto intero" : `la cartella ${parti.at(-1) ?? ""}`} />
          </nav>
          <ul className="elenco-file" aria-label="File della cartella">
            {elenco?.voci.length === 0 && <li className="tenue">La cartella è vuota.</li>}
            {elenco?.voci.map((voce) => {
              const percorso = cartella === "" ? voce.nome : `${cartella}/${voce.nome}`;
              return (
                <li key={voce.nome} className="riga-file">
                  <button type="button" className="discreto voce-file" onClick={() => apri(voce.cartella ? `${percorso}/` : percorso)}>
                    <span aria-hidden="true">{voce.cartella ? "📁" : "📄"}</span> <span className="nome">{voce.nome}</span>
                    {voce.dimensione !== undefined && <span className="tenue dimensione">{dimensioneInParole(voce.dimensione)}</span>}
                  </button>
                  <Scarica idProgetto={idProgetto} percorso={percorso} cartella={voce.cartella} nome={voce.nome} />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

function Anteprima({ idProgetto, percorso }: { idProgetto: string; percorso: string }): ReactNode {
  const { genere } = genereDelFile(percorso);
  const indirizzo = indirizzoDelFile(idProgetto, percorso);
  switch (genere) {
    case "immagine":
      return (
        <div className="anteprima-file media">
          <img src={indirizzo} alt={percorso} />
        </div>
      );
    case "pdf":
      return (
        <div className="anteprima-file pdf">
          <iframe src={indirizzo} title={percorso} />
          <a href={indirizzo} target="_blank" rel="noreferrer">
            Apri il PDF in una scheda
          </a>
        </div>
      );
    case "video":
      return (
        <div className="anteprima-file media">
          <video src={indirizzo} controls playsInline preload="metadata" />
        </div>
      );
    case "audio":
      return (
        <div className="anteprima-file media">
          <audio src={indirizzo} controls preload="metadata" />
        </div>
      );
    case "altro":
      return (
        <div className="anteprima-file">
          <p className="tenue">Per questo tipo di file non c'è un'anteprima.</p>
          <a href={indirizzoDaScaricare(idProgetto, percorso)} download>
            Scarica il file
          </a>
        </div>
      );
    default:
      return <Testo idProgetto={idProgetto} percorso={percorso} markdown={genere === "markdown"} />;
  }
}

function Testo({ idProgetto, percorso, markdown }: { idProgetto: string; percorso: string; markdown: boolean }): ReactNode {
  const [testo, setTesto] = useState<string>();
  const [errore, setErrore] = useState<string>();
  const [sorgente, setSorgente] = useState(!markdown);
  const [colori, setColori] = useState<string[]>();
  const [inCommento, setInCommento] = useState<number>();
  const [commento, setCommento] = useState("");
  const base = baseDelProgetto(idProgetto);
  const commenti = useCommenti(base);
  const righe = useMemo(() => (testo === undefined ? [] : testo.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")), [testo]);
  const mostrate = righe.slice(0, RIGHE_MOSTRATE);
  const commentate = new Set(commenti.filter((voce) => voce.percorso === percorso).map((voce) => voce.riga));

  useEffect(() => {
    let valido = true;
    leggiTestoDelFile(idProgetto, percorso)
      .then((letto) => valido && setTesto(letto))
      .catch((causa: unknown) => valido && setErrore(causa instanceof Error ? causa.message : "Il file non si legge."));
    return () => {
      valido = false;
    };
  }, [idProgetto, percorso]);

  // Il colore della sintassi riga per riga: un commento su più righe resta senza colore, il resto sì.
  useEffect(() => {
    const linguaggio = linguaggioDi(percorso);
    if (testo === undefined || linguaggio === "") return;
    let valido = true;
    void import("./evidenzia.ts").then(({ evidenzia }) => {
      if (!valido) return;
      const colorate = righe.slice(0, RIGHE_MOSTRATE).map((riga) => evidenzia(riga, linguaggio) ?? "");
      setColori(colorate);
    });
    return () => {
      valido = false;
    };
  }, [testo, righe, percorso]);

  if (errore !== undefined) return <p className="errore">{errore}</p>;
  if (testo === undefined) return <p className="tenue">Leggo il file…</p>;
  if (testo.includes("\0")) return <p className="tenue">Questo file non è testo: non c'è un'anteprima.</p>;

  return (
    <div className="anteprima-file testo">
      {markdown && (
        <div className="pulsanti scelta-vista">
          <button type="button" className={sorgente ? "mini discreto" : "mini attiva"} aria-pressed={!sorgente} onClick={() => setSorgente(false)}>
            Impaginato
          </button>
          <button type="button" className={sorgente ? "mini attiva" : "mini discreto"} aria-pressed={sorgente} onClick={() => setSorgente(true)}>
            Sorgente
          </button>
        </div>
      )}
      {!sorgente ? (
        <div className="markdown-file">
          <Formattato testo={testo} />
        </div>
      ) : (
        <>
          <p className="tenue suggerimento">Tocca il numero di una riga per commentarla: il commento parte con il prossimo messaggio.</p>
          <div className="codice-file" role="list" aria-label={`Righe di ${percorso}`}>
            {mostrate.map((riga, posizione) => {
              const numero = posizione + 1;
              const colorata = colori?.[posizione];
              return (
                <div key={posizione} role="listitem">
                  <div className={commentate.has(numero) ? "riga-file-testo commentata" : "riga-file-testo"}>
                    <button
                      type="button"
                      className="numero-riga"
                      aria-label={`Commenta la riga ${numero}`}
                      onClick={() => {
                        setInCommento(inCommento === numero ? undefined : numero);
                        setCommento("");
                      }}
                    >
                      {numero}
                    </button>
                    {colorata === undefined || colorata === "" ? (
                      <code>{riga === "" ? " " : riga}</code>
                    ) : (
                      <code className="hljs" dangerouslySetInnerHTML={{ __html: colorata }} />
                    )}
                  </div>
                  {inCommento === numero && (
                    <div className="nuovo-commento">
                      <textarea
                        aria-label={`Commento alla riga ${numero}`}
                        autoFocus
                        rows={2}
                        value={commento}
                        placeholder="Che cosa vuoi che Claude sappia di questa riga?"
                        onChange={(evento) => setCommento(evento.target.value)}
                      />
                      <div className="pulsanti">
                        <button
                          type="button"
                          className="mini approva"
                          disabled={commento.trim() === ""}
                          onClick={() => {
                            aggiungiCommento(base, { percorso, riga: numero, testoDellaRiga: riga, commento });
                            setInCommento(undefined);
                          }}
                        >
                          Aggiungi il commento
                        </button>
                        <button type="button" className="mini discreto" onClick={() => setInCommento(undefined)}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {righe.length > RIGHE_MOSTRATE && <p className="tenue">Sono mostrate le prime {RIGHE_MOSTRATE} righe di {righe.length}.</p>}
        </>
      )}
    </div>
  );
}
