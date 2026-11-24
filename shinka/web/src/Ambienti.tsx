import { useEffect, useState, type ReactNode } from "react";
import type { DecisionePermesso } from "../../src/protocollo/eventi.ts";
import type { Ambiente, RichiestaCollegamento, StatoAmbienti } from "../../src/protocollo/nodi.ts";
import { aggiornaAmbiente, decidiRichiesta, impostaAvvioConWindows, invitaAmbiente, rimuoviAmbiente, type InvitoAmbiente } from "./api.ts";
import { copia } from "./copia.ts";
import { frammentoDi } from "./vista.ts";
import { collegamentoAmbiente, sottotitoloAmbiente as sottotitolo, versioneAmbiente } from "./descrivi.ts";

export function PannelloAmbienti({
  stato,
  allaChiusura,
}: {
  stato: StatoAmbienti | undefined;
  allaChiusura: () => void;
}): ReactNode {
  useEffect(() => {
    const alTasto = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") allaChiusura();
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, [allaChiusura]);

  return (
    <section className="pannello" aria-label="Ambienti">
      <header>
        <h2>Ambienti</h2>
        <button type="button" className="discreto" onClick={allaChiusura}>
          Chiudi
        </button>
      </header>
      {stato === undefined ? (
        <p className="tenue">Carico…</p>
      ) : (
        <>
          {stato.richieste.length > 0 && (
            <>
              <h3>Richieste di collegamento</h3>
              {stato.richieste.map((richiesta) => (
                <VistaRichiesta key={richiesta.id} richiesta={richiesta} />
              ))}
            </>
          )}
          <ul className="elenco-ambienti">
            {stato.ambienti.map((ambiente) => (
              <VistaAmbiente key={ambiente.id} ambiente={ambiente} indirizzoNoto={indirizzoNoto(stato)} allaChiusura={allaChiusura} />
            ))}
          </ul>
          <AggiungiAmbiente indirizzoNoto={indirizzoNoto(stato)} />
        </>
      )}
    </section>
  );
}

function VistaRichiesta({ richiesta }: { richiesta: RichiestaCollegamento }): ReactNode {
  const [inviata, setInviata] = useState<DecisionePermesso>();
  const [errore, setErrore] = useState<string>();

  async function decidi(decisione: DecisionePermesso): Promise<void> {
    setInviata(decisione);
    setErrore(undefined);
    try {
      await decidiRichiesta(richiesta.id, decisione);
    } catch (causa) {
      setInviata(undefined);
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    }
  }

  return (
    <div className="richiesta">
      <div className="nome">{richiesta.nome}</div>
      <div className="tenue">{sottotitolo(richiesta.sistema, richiesta.descrizione)}</div>
      <p>
        Codice di verifica: <strong className="codice">{richiesta.codice}</strong>
        <br />
        Approva solo se è lo stesso codice che vedi sul nodo.
      </p>
      <div className="pulsanti">
        <button
          type="button"
          className="approva"
          disabled={inviata !== undefined}
          onClick={() => void decidi("approvato")}
        >
          Approva
        </button>
        <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negato")}>
          Nega
        </button>
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

function VistaAmbiente({ ambiente, indirizzoNoto, allaChiusura }: { ambiente: Ambiente; indirizzoNoto: string | undefined; allaChiusura: () => void }): ReactNode {
  const [daConfermare, setDaConfermare] = useState(false);
  const [reinstalla, setReinstalla] = useState(false);
  const [cambiaAvvio, setCambiaAvvio] = useState(false);
  const [daAggiornare, setDaAggiornare] = useState(false);
  const [errore, setErrore] = useState<string>();
  const versione = versioneAmbiente(ambiente);
  const collegamento = collegamentoAmbiente(ambiente);
  const { aggiornamento } = ambiente;
  const siPuoAggiornare = ambiente.attivo && ambiente.indietro === true && ambiente.siAggiorna === true && aggiornamento?.stato !== "in-corso";

  async function aggiorna(): Promise<void> {
    setErrore(undefined);
    setDaAggiornare(false);
    try {
      await aggiornaAmbiente(ambiente.id);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Aggiornamento non avviato.");
    }
  }

  async function avvioConWindows(attivo: boolean): Promise<void> {
    setErrore(undefined);
    setCambiaAvvio(true);
    try {
      await impostaAvvioConWindows(ambiente.id, attivo);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è cambiato.");
    } finally {
      setCambiaAvvio(false);
    }
  }

  async function rimuovi(): Promise<void> {
    setErrore(undefined);
    try {
      await rimuoviAmbiente(ambiente.id);
    } catch (causa) {
      setDaConfermare(false);
      setErrore(causa instanceof Error ? causa.message : "Ambiente non rimosso.");
    }
  }

  return (
    <li className={ambiente.attivo ? "ambiente attivo" : "ambiente"}>
      <div className="riga-ambiente">
        <span className="nome">{ambiente.nome}</span>
        <span className="stato">{ambiente.attivo ? "attivo" : "spento"}</span>
      </div>
      <div className="tenue">
        {sottotitolo(ambiente.sistema, ambiente.descrizione)}
        {ambiente.delCentro && " · qui gira il centro"}
      </div>
      {versione !== undefined && <div className="tenue">{versione}</div>}
      {collegamento !== undefined && <div className={collegamento.inChiaro ? "collegamento-ambiente in-chiaro" : "tenue collegamento-ambiente"}>{collegamento.testo}</div>}
      {ambiente.attivo && (
        <a className="dettagli-ambiente" href={frammentoDi({ tipo: "ambiente", id: ambiente.id })} onClick={allaChiusura}>
          Risorse, processi e container
        </a>
      )}
      {aggiornamento?.stato === "in-corso" && (
        <p className="tenue" role="status">
          Sta passando alla versione {aggiornamento.versione}: prepara la versione nuova e riparte. Può volerci qualche minuto.
        </p>
      )}
      {aggiornamento?.stato === "non-riuscito" && (
        <p className="errore" role="alert">
          L'aggiornamento alla versione {aggiornamento.versione} non è riuscito. {aggiornamento.motivo}
        </p>
      )}
      {ambiente.attivo && ambiente.avvioConWindows !== undefined && (
        <label className="avvio-con-windows">
          <input type="checkbox" checked={ambiente.avvioConWindows} disabled={cambiaAvvio} onChange={(evento) => void avvioConWindows(evento.target.checked)} />
          Avvia con Windows
          <span className="tenue"> · il nodo e la sua icona partono a ogni accesso</span>
        </label>
      )}
      {ambiente.attivo && ambiente.avvioConWindows === undefined && eWindows(ambiente.sistema) && (
        <p className="tenue">Per scegliere da qui se parte con Windows, reinstalla il nodo con il comando di una riga.</p>
      )}
      {ambiente.attivo && ambiente.indietro === true && ambiente.siAggiorna !== true && (
        <p className="tenue">Questo nodo non si aggiorna da qui: va aggiornato su quella macchina.</p>
      )}
      {siPuoAggiornare &&
        (daAggiornare ? (
          <>
            <p>Il nodo riparte con la versione del centro: le conversazioni e i terminali aperti in questo ambiente si chiudono.</p>
            <div className="pulsanti">
              <button type="button" className="approva" onClick={() => void aggiorna()}>
                Conferma l'aggiornamento
              </button>
              <button type="button" className="discreto" onClick={() => setDaAggiornare(false)}>
                Annulla
              </button>
            </div>
          </>
        ) : (
          <div className="pulsanti">
            <button type="button" onClick={() => setDaAggiornare(true)}>
              Aggiorna
            </button>
          </div>
        ))}
      {!ambiente.delCentro &&
        (reinstalla ? (
          <AggiungiAmbiente
            reinstalla={{
              sistema: eWindows(ambiente.sistema) ? "windows" : "linux",
              nome: ambiente.nome,
              descrizione: ambiente.descrizione,
              centro: ambiente.indirizzoDelCentro ?? indirizzoNoto ?? indirizzoProposto(window.location),
            }}
            allaChiusura={() => setReinstalla(false)}
          />
        ) : (
          <div className="pulsanti">
            <button type="button" className="discreto piccolo" onClick={() => setReinstalla(true)}>
              Reinstalla
            </button>
          </div>
        ))}
      {!ambiente.delCentro &&
        (daConfermare ? (
          <div className="pulsanti">
            <button type="button" onClick={() => void rimuovi()}>
              Conferma la rimozione
            </button>
            <button type="button" className="discreto" onClick={() => setDaConfermare(false)}>
              Annulla
            </button>
          </div>
        ) : (
          <button type="button" className="discreto piccolo" onClick={() => setDaConfermare(true)}>
            Rimuovi
          </button>
        ))}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}

/**
 * L'indirizzo del centro che una macchina della rete userà, proposto da quello della pagina: in
 * HTTP, perché i nodi si collegano così anche quando l'interfaccia è in HTTPS sulla stessa porta.
 */
export function indirizzoProposto(posizione: { hostname: string; port: string; protocol: string }): string {
  const porta = posizione.port !== "" ? posizione.port : posizione.protocol === "https:" ? "443" : "80";
  return `http://${posizione.hostname}:${porta}`;
}

/** Vero se il sistema di un ambiente è Windows. */
function eWindows(sistema: string): boolean {
  return /windows/i.test(sistema);
}

/**
 * L'indirizzo del centro che i nodi usano davvero, come l'hanno detto: dietro un proxy (per esempio
 * aprendo Shinka da un nome pubblico in HTTPS) quello della pagina non va bene per i nodi.
 */
export function indirizzoNoto(stato: StatoAmbienti): string | undefined {
  return stato.ambienti.find((ambiente) => ambiente.attivo && ambiente.indirizzoDelCentro !== undefined)?.indirizzoDelCentro ??
    stato.ambienti.find((ambiente) => ambiente.indirizzoDelCentro !== undefined)?.indirizzoDelCentro;
}

/** Ciò che serve per reinstallare un nodo con gli stessi dati di prima. */
interface DatiDelNodo {
  sistema: "linux" | "windows";
  nome: string;
  descrizione: string;
  centro: string;
}

/**
 * Un ambiente nuovo: il proprietario sceglie sistema e nome, e incolla su quella macchina il comando
 * che riceve. Con `reinstalla` i campi sono già quelli del nodo, che si ritrova con la sua identità.
 */
function AggiungiAmbiente({ indirizzoNoto: noto, reinstalla, allaChiusura }: { indirizzoNoto?: string | undefined; reinstalla?: DatiDelNodo; allaChiusura?: () => void }): ReactNode {
  const [aperto, setApertoQui] = useState(reinstalla !== undefined);
  const setAperto = (si: boolean): void => {
    setApertoQui(si);
    if (!si) allaChiusura?.();
  };
  const [sistema, setSistema] = useState<"linux" | "windows">(reinstalla?.sistema ?? "linux");
  const [nome, setNome] = useState(reinstalla?.nome ?? "");
  const [descrizione, setDescrizione] = useState(reinstalla?.descrizione ?? "");
  const [centro, setCentro] = useState(() => reinstalla?.centro ?? noto ?? indirizzoProposto(window.location));
  const [invito, setInvito] = useState<InvitoAmbiente>();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [copiato, setCopiato] = useState<boolean>();

  async function prepara(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    setCopiato(undefined);
    try {
      setInvito(
        await invitaAmbiente({ sistema, centro: centro.trim(), nome: nome.trim(), ...(descrizione.trim() === "" ? {} : { descrizione: descrizione.trim() }) }),
      );
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Comando non preparato.");
    } finally {
      setLavoro(false);
    }
  }

  if (!aperto) {
    return (
      <div className="aggiungi-ambiente">
        <button type="button" onClick={() => setAperto(true)}>
          Aggiungi un ambiente
        </button>
      </div>
    );
  }

  if (invito !== undefined) {
    const scade = new Date(invito.scade).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    return (
      <div className="aggiungi-ambiente">
        <h3>{reinstalla === undefined ? "Aggiungi un ambiente" : `Reinstalla «${reinstalla.nome}»`}</h3>
        <p>
          {invito.sistema === "linux"
            ? "Su quella macchina apri un terminale, con l'utente che farà lavorare i progetti (non root), e incolla:"
            : "Su quella macchina apri PowerShell, senza diritti di amministratore, e incolla:"}
        </p>
        <pre className="comando-ambiente">
          <code>{invito.comando}</code>
        </pre>
        <div className="pulsanti">
          <button type="button" onClick={() => void copia(invito.comando).then(setCopiato)}>
            {copiato === true ? "Copiato" : copiato === false ? "Non copiato" : "Copia il comando"}
          </button>
          <button
            type="button"
            className="discreto"
            onClick={() => {
              setInvito(undefined);
              setAperto(false);
            }}
          >
            Fatto
          </button>
        </div>
        <p className="tenue">
          Vale fino alle {scade}. Scarica da Shinka il nodo e il suo guardiano, installa ciò che serve e lo fa ripartire
          {invito.sistema === "linux" ? " all'accensione" : " a ogni accesso a Windows"}. Serve Node.js 22.18 o più recente
          {invito.sistema === "linux" ? ", con gli strumenti per compilare (build-essential e python3)." : ": se manca, lo script prova a installarlo con winget."}
        </p>
        <p className="tenue">
          Poi qui compare la richiesta di collegamento: approvala solo se il codice è quello che il comando ha scritto. Gli accessi di
          Claude o Codex per quell'ambiente si fanno dalla pagina Impostazioni.
        </p>
      </div>
    );
  }

  return (
    <div className="aggiungi-ambiente">
      <h3>{reinstalla === undefined ? "Aggiungi un ambiente" : `Reinstalla «${reinstalla.nome}»`}</h3>
      {reinstalla !== undefined && (
        <p className="tenue">
          Il comando rimette a posto il nodo, la sua icona e il suo avvio, e tiene la sua identità e le sue scelte: l'ambiente resta questo, con i suoi progetti.
        </p>
      )}
      <form
        className="modulo-impostazioni"
        onSubmit={(evento) => {
          evento.preventDefault();
          void prepara();
        }}
      >
        <div className="scelta-sistema" role="radiogroup" aria-label="Sistema">
          {(["linux", "windows"] as const).map((voce) => (
            <label key={voce} className={sistema === voce ? "scelto" : undefined}>
              <input type="radio" name="sistema" checked={sistema === voce} onChange={() => setSistema(voce)} />
              {voce === "linux" ? "Linux" : "Windows"}
            </label>
          ))}
        </div>
        <label>
          Nome
          <input value={nome} maxLength={60} placeholder="Per esempio: Server del lavoro" onChange={(evento) => setNome(evento.target.value)} required />
        </label>
        <label>
          Che cosa offre
          <input value={descrizione} maxLength={300} placeholder="Per esempio: Docker, Python" onChange={(evento) => setDescrizione(evento.target.value)} />
        </label>
        <label>
          Indirizzo di Shinka visto da quella macchina
          <input value={centro} maxLength={300} onChange={(evento) => setCentro(evento.target.value)} required />
        </label>
        <div className="pulsanti">
          <button type="submit" disabled={lavoro || nome.trim() === "" || centro.trim() === ""}>
            Prepara il comando
          </button>
          <button type="button" className="discreto" onClick={() => setAperto(false)}>
            Annulla
          </button>
        </div>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
    </div>
  );
}
