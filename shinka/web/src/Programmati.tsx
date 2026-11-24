/**
 * La pagina Programmati: i lavori che il proprietario lascia a Shinka perché partano da soli, a un
 * orario o a intervalli, nella Home o in un progetto. Da qui li crea, li cambia, li mette in
 * pausa, li fa partire subito e li toglie. Gli orari sono quelli di questo browser. Un lavoro può
 * partire anche quando un altro sistema manda un evento al suo indirizzo, che si copia da qui.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  GIORNI,
  ISTRUZIONE_PROGRAMMATO_MASSIMA,
  MINUTI_MINIMI,
  pianificazioneInParole,
  TITOLO_PROGRAMMATO_MASSIMO,
  type Avviso,
  type DoveGira,
  type Giorno,
  type LavoroProgrammato,
  type NuovoProgrammato,
  type Pianificazione,
  type StatoProgrammati,
} from "../../src/protocollo/programmati.ts";
import { cambiaProgrammato, creaProgrammato, eseguiProgrammato, leggiProgrammati, togliProgrammato } from "./api.ts";
import { copia } from "./copia.ts";
import { momentoInBreve } from "./descrivi.ts";

const NOMI_GIORNI: Record<Giorno, string> = { lun: "Lun", mar: "Mar", mer: "Mer", gio: "Gio", ven: "Ven", sab: "Sab", dom: "Dom" };
const ESITI = { fatto: "fatto", "nulla-da-segnalare": "nulla da segnalare", errore: "si è fermato", saltato: "saltato" } as const;

interface ProgettoScelto {
  id: string;
  nome: string;
}

export function PaginaProgrammati({ menu, progetti }: { menu: ReactNode; progetti: readonly ProgettoScelto[] }): ReactNode {
  const [stato, setStato] = useState<StatoProgrammati>();
  const [errore, setErrore] = useState<string>();
  const [nuovo, setNuovo] = useState(false);
  const ricarica = useCallback(() => {
    leggiProgrammati()
      .then((letto) => {
        setStato(letto);
        setErrore(undefined);
      })
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere i lavori programmati."));
  }, []);
  useEffect(() => {
    document.title = "Programmati · Shinka";
    ricarica();
    // Mentre la pagina è aperta un lavoro può partire o finire: la si tiene fresca.
    const ogniTanto = setInterval(ricarica, 30_000);
    return () => clearInterval(ogniTanto);
  }, [ricarica]);

  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Programmati</h1>
          <span className="sottotitolo">Lavori che partono da soli: a un orario, a intervalli o con un evento</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-programmati">
          <p className="tenue">
            Un lavoro programmato è una richiesta che lasci a Shinka: quando tocca, arriva alla Home, in un argomento suo, oppure a un progetto, e la
            risposta finale ti arriva su Telegram. Lavora con i permessi che quella conversazione ha in quel momento: ciò che chiede il tuo consenso
            lo aspetta. Puoi anche chiederlo in chat («ogni mattina controlla…»): ti compare una scheda da confermare.
          </p>
          <p className="tenue">
            Un lavoro può partire anche quando un altro sistema gli manda un evento: il server, il firewall, un monitor dei servizi. Tu scrivi che
            cosa fare; l'evento arriva a Shinka come materiale da leggere, non come istruzioni.
          </p>
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {stato === undefined && errore === undefined && <p className="tenue">Carico…</p>}
          {stato !== undefined && (
            <>
              {stato.lavori.length === 0 && !nuovo && <p className="vuota tenue">Non c'è ancora nessun lavoro programmato.</p>}
              <ul className="elenco-programmati">
                {stato.lavori.map((lavoro) => (
                  <VistaProgrammato key={lavoro.id} lavoro={lavoro} progetti={progetti} alCambio={ricarica} />
                ))}
              </ul>
              {nuovo ? (
                <section className="scheda-programmato">
                  <h2 className="titolo-sezione">Nuovo lavoro programmato</h2>
                  <ModuloProgrammato
                    progetti={progetti}
                    etichetta="Programma"
                    allAnnulla={() => setNuovo(false)}
                    alSalva={async (lavoro) => {
                      await creaProgrammato(lavoro);
                      setNuovo(false);
                      ricarica();
                    }}
                  />
                </section>
              ) : (
                <button type="button" onClick={() => setNuovo(true)}>
                  Nuovo lavoro programmato
                </button>
              )}
              <p className="tenue fuso-programmati">Gli orari sono quelli di questo dispositivo ({stato.fuso}).</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function doveInParole(lavoro: LavoroProgrammato): string {
  return lavoro.dove.tipo === "home" ? "nella Home" : lavoro.nomeProgetto === undefined ? "in un progetto che non c'è più" : `nel progetto ${lavoro.nomeProgetto}`;
}

function VistaProgrammato({ lavoro, progetti, alCambio }: { lavoro: LavoroProgrammato; progetti: readonly ProgettoScelto[]; alCambio: () => void }): ReactNode {
  const [inModifica, setInModifica] = useState(false);
  const [daTogliere, setDaTogliere] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [copiato, setCopiato] = useState<boolean>();
  const [daCambiare, setDaCambiare] = useState(false);
  const conEvento = lavoro.quando.tipo === "evento";
  // L'indirizzo intero, com'è raggiungibile da dove il proprietario sta guardando la pagina.
  const indirizzo = lavoro.indirizzo === undefined ? undefined : `${window.location.origin}${lavoro.indirizzo}`;

  async function fai(azione: () => Promise<unknown>): Promise<void> {
    setOccupato(true);
    setErrore(undefined);
    try {
      await azione();
      alCambio();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è stato possibile.");
    } finally {
      setOccupato(false);
    }
  }

  if (inModifica) {
    return (
      <li className="scheda-programmato">
        <ModuloProgrammato
          progetti={progetti}
          iniziale={lavoro}
          etichetta="Salva"
          allAnnulla={() => setInModifica(false)}
          alSalva={async (cambiato) => {
            await cambiaProgrammato(lavoro.id, cambiato);
            setInModifica(false);
            alCambio();
          }}
        />
      </li>
    );
  }

  return (
    <li className={lavoro.attivo ? "scheda-programmato" : "scheda-programmato in-pausa"}>
      <div className="riga-programmato">
        <span className="nome">{lavoro.titolo}</span>
        {lavoro.inCorso === true ? (
          <span className="stato-programmato al-lavoro">al lavoro</span>
        ) : lavoro.riprendeIl !== undefined ? (
          <span className="stato-programmato aspetta-il-limite">aspetta il limite</span>
        ) : (
          !lavoro.attivo && <span className="stato-programmato">in pausa</span>
        )}
      </div>
      <div className="tenue">
        {pianificazioneInParole(lavoro.quando)} · {doveInParole(lavoro)} · {lavoro.avvisa === "sempre" ? "ti avvisa ogni volta" : "ti avvisa solo se serve"}
      </div>
      <p className="richiesta-programmato">{lavoro.istruzione}</p>
      {indirizzo !== undefined && (
        <div className="indirizzo-evento">
          <div className="tenue">Gli eventi si mandano a questo indirizzo, con POST: il contenuto è ciò che Shinka leggerà. Chi lo conosce può far partire questo lavoro: tienilo per te.</div>
          <pre className="comando-ambiente">
            <code>{indirizzo}</code>
          </pre>
          <div className="pulsanti">
            <button type="button" className="discreto" onClick={() => void copia(indirizzo).then(setCopiato)}>
              {copiato === true ? "Copiato" : copiato === false ? "Non copiato" : "Copia l'indirizzo"}
            </button>
            <button type="button" className="discreto" onClick={() => void copia(`curl -X POST --data 'Disco 3: errori SMART' '${indirizzo}'`).then(setCopiato)}>
              Copia un esempio con curl
            </button>
            {daCambiare ? (
              <>
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() =>
                    void fai(async () => {
                      await cambiaProgrammato(lavoro.id, { nuovoIndirizzo: true });
                      setDaCambiare(false);
                    })
                  }
                >
                  Conferma: quello di prima non varrà più
                </button>
                <button type="button" className="discreto" onClick={() => setDaCambiare(false)}>
                  Annulla
                </button>
              </>
            ) : (
              <button type="button" className="discreto" disabled={occupato} onClick={() => setDaCambiare(true)}>
                Cambia indirizzo
              </button>
            )}
          </div>
          <div className="tenue">
            Dalla rete di casa vale anche l'indirizzo interno di Shinka al posto del nome.
            {(lavoro.eventiInAttesa ?? 0) > 0 && ` ${lavoro.eventiInAttesa} ${lavoro.eventiInAttesa === 1 ? "evento aspetta" : "eventi aspettano"} che la conversazione sia libera.`}
          </div>
        </div>
      )}
      <div className="tenue">
        {lavoro.riprendeIl !== undefined && <>Il limite del piano è esaurito: riparte da solo {momentoInBreve(lavoro.riprendeIl)}, quando si azzera. </>}
        {lavoro.prossima !== undefined && lavoro.riprendeIl === undefined && <>Prossima volta: {momentoInBreve(lavoro.prossima)}. </>}
        {lavoro.ultima !== undefined && (
          <>
            L'ultima, {momentoInBreve(lavoro.ultima.quando)}: {ESITI[lavoro.ultima.esito]}
            {lavoro.ultima.dettaglio === undefined ? "." : ` (${lavoro.ultima.dettaglio})`}
          </>
        )}
      </div>
      <div className="pulsanti">
        {daTogliere ? (
          <>
            <button type="button" disabled={occupato} onClick={() => void fai(() => togliProgrammato(lavoro.id))}>
              Conferma la rimozione
            </button>
            <button type="button" className="discreto" onClick={() => setDaTogliere(false)}>
              Annulla
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={occupato || lavoro.inCorso === true} onClick={() => void fai(() => eseguiProgrammato(lavoro.id))}>
              {conEvento ? "Manda un evento di prova" : "Esegui adesso"}
            </button>
            <button type="button" className="discreto" disabled={occupato} onClick={() => void fai(() => cambiaProgrammato(lavoro.id, { attivo: !lavoro.attivo }))}>
              {lavoro.attivo ? "Metti in pausa" : "Riattiva"}
            </button>
            <button type="button" className="discreto" disabled={occupato} onClick={() => setInModifica(true)}>
              Modifica
            </button>
            <button type="button" className="discreto" disabled={occupato} onClick={() => setDaTogliere(true)}>
              Rimuovi
            </button>
          </>
        )}
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}

/** L'intervallo in minuti, nell'unità più grande che lo dice senza resto. */
function intervalloDi(minuti: number): { numero: number; unita: "minuti" | "ore" | "giorni" } {
  if (minuti % 1440 === 0) return { numero: minuti / 1440, unita: "giorni" };
  if (minuti % 60 === 0) return { numero: minuti / 60, unita: "ore" };
  return { numero: minuti, unita: "minuti" };
}

const IN_MINUTI = { minuti: 1, ore: 60, giorni: 1440 } as const;

function ModuloProgrammato({
  progetti,
  iniziale,
  etichetta,
  alSalva,
  allAnnulla,
}: {
  progetti: readonly ProgettoScelto[];
  iniziale?: LavoroProgrammato;
  etichetta: string;
  alSalva: (lavoro: NuovoProgrammato) => Promise<void>;
  allAnnulla: () => void;
}): ReactNode {
  const prima = iniziale?.quando;
  const [titolo, setTitolo] = useState(iniziale?.titolo ?? "");
  const [istruzione, setIstruzione] = useState(iniziale?.istruzione ?? "");
  const [tipo, setTipo] = useState<Pianificazione["tipo"]>(prima?.tipo ?? "giorni");
  const [ora, setOra] = useState(prima !== undefined && (prima.tipo === "giorni" || prima.tipo === "una-volta") ? prima.ora : "07:30");
  const [giorni, setGiorni] = useState<Giorno[]>(prima?.tipo === "giorni" ? prima.giorni : []);
  const intervallo = intervalloDi(prima?.tipo === "ogni" ? prima.minuti : 60);
  const [numero, setNumero] = useState(String(intervallo.numero));
  const [unita, setUnita] = useState(intervallo.unita);
  const [data, setData] = useState(prima?.tipo === "una-volta" ? prima.data : "");
  const [dove, setDove] = useState(iniziale === undefined || iniziale.dove.tipo === "home" ? "home" : iniziale.dove.id);
  const [avvisa, setAvvisa] = useState<Avviso>(iniziale?.avvisa ?? "sempre");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function salva(): Promise<void> {
    const quando: Pianificazione =
      tipo === "giorni"
        ? { tipo, ora, giorni }
        : tipo === "ogni"
          ? { tipo, minuti: Math.round(Number(numero) * IN_MINUTI[unita]) }
          : tipo === "evento"
            ? { tipo }
            : { tipo, data, ora };
    const doveGira: DoveGira = dove === "home" ? { tipo: "home" } : { tipo: "progetto", id: dove };
    setLavoro(true);
    setErrore(undefined);
    try {
      await alSalva({ titolo: titolo.trim(), istruzione: istruzione.trim(), quando, dove: doveGira, avvisa });
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non salvato.");
      setLavoro(false);
    }
  }

  return (
    <form
      className="modulo-impostazioni modulo-programmato"
      onSubmit={(evento) => {
        evento.preventDefault();
        void salva();
      }}
    >
      <label>
        Titolo
        <input value={titolo} maxLength={TITOLO_PROGRAMMATO_MASSIMO} placeholder="Per esempio: Backup del NAS" onChange={(evento) => setTitolo(evento.target.value)} required />
      </label>
      <label>
        Che cosa va fatto ogni volta
        <textarea
          value={istruzione}
          rows={4}
          maxLength={ISTRUZIONE_PROGRAMMATO_MASSIMA}
          placeholder="Per esempio: controlla che il backup di stanotte del NAS sia riuscito, e dimmi quanto spazio resta."
          onChange={(evento) => setIstruzione(evento.target.value)}
          required
        />
      </label>
      <div className="scelta-sistema" role="radiogroup" aria-label="Quando parte">
        {(
          [
            ["giorni", "A un'ora"],
            ["ogni", "A intervalli"],
            ["una-volta", "Una volta sola"],
            ["evento", "Quando arriva un evento"],
          ] as const
        ).map(([voce, nome]) => (
          <label key={voce}>
            <input type="radio" name="quando" checked={tipo === voce} onChange={() => setTipo(voce)} />
            {nome}
          </label>
        ))}
      </div>
      {tipo === "evento" ? (
        <p className="tenue">
          Salvato il lavoro, qui compare il suo indirizzo: lo dai al sistema che manda gli avvisi. A ogni evento Shinka fa ciò che scrivi qui sopra;
          se ne arrivano più d'uno mentre lavora, li riceve insieme.
        </p>
      ) : tipo === "ogni" ? (
        <div className="riga-intervallo">
          <label>
            Ogni
            <input type="number" min={1} value={numero} onChange={(evento) => setNumero(evento.target.value)} required />
          </label>
          <label>
            <select aria-label="Unità" value={unita} onChange={(evento) => setUnita(evento.target.value as typeof unita)}>
              <option value="minuti">minuti</option>
              <option value="ore">ore</option>
              <option value="giorni">giorni</option>
            </select>
          </label>
          <span className="tenue">Almeno {MINUTI_MINIMI} minuti.</span>
        </div>
      ) : (
        <>
          <div className="riga-intervallo">
            {tipo === "una-volta" && (
              <label>
                Giorno
                <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} required />
              </label>
            )}
            <label>
              Ora
              <input type="time" value={ora} onChange={(evento) => setOra(evento.target.value)} required />
            </label>
          </div>
          {tipo === "giorni" && (
            <fieldset className="giorni-programmato">
              <legend>In quali giorni (nessuno scelto: tutti)</legend>
              {GIORNI.map((giorno) => (
                <label key={giorno}>
                  <input
                    type="checkbox"
                    checked={giorni.includes(giorno)}
                    onChange={(evento) => setGiorni(evento.target.checked ? [...giorni, giorno] : giorni.filter((uno) => uno !== giorno))}
                  />
                  {NOMI_GIORNI[giorno]}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
      <label>
        Dove lavora
        <select value={dove} onChange={(evento) => setDove(evento.target.value)}>
          <option value="home">Nella Home, in un argomento suo</option>
          {progetti.map((progetto) => (
            <option key={progetto.id} value={progetto.id}>
              Nel progetto {progetto.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="scelta-sistema" role="radiogroup" aria-label="Quando ti avvisa">
        <label>
          <input type="radio" name="avvisa" checked={avvisa === "sempre"} onChange={() => setAvvisa("sempre")} />
          Ti avvisa ogni volta
        </label>
        <label>
          <input type="radio" name="avvisa" checked={avvisa === "se-serve"} onChange={() => setAvvisa("se-serve")} />
          Solo se c'è qualcosa da segnalare
        </label>
      </div>
      <div className="pulsanti">
        <button type="submit" disabled={lavoro || titolo.trim() === "" || istruzione.trim() === ""}>
          {etichetta}
        </button>
        <button type="button" className="discreto" onClick={allAnnulla}>
          Annulla
        </button>
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </form>
  );
}
