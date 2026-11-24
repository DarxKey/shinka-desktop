import { SezioneNotifiche } from "./Notifiche.tsx";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AccessiDiUnAmbiente, AccessoInCorso, EsitoAccessi, ImpostazioniViste } from "../../src/protocollo/accessi.ts";
import { MOTORI, NOMI_MOTORI, type Motore } from "../../src/protocollo/impostazioni.ts";
import { CHIAVE_BENVENUTO } from "./Accesso.tsx";
import {
  INDIRIZZO_PACCHETTO,
  cambiaAmbienteDelCentro,
  cambiaMotorePredefinito,
  cambiaPassword,
  chiediAccessi,
  leggiAccessi,
  leggiImpostazioniInstallazione,
} from "./api.ts";
import { SezioneHttps } from "./Https.tsx";
import { frammentoDi } from "./vista.ts";
import { SezioneCopiaDiSicurezza } from "./CopiaDiSicurezza.tsx";
import { SezioneDesktop } from "./Desktop.tsx";

/** Ogni quanto si guarda se un accesso a Codex si è concluso sul sito. */
const OGNI_MS = 3000;

/** Quanto deve essere lunga la password di Shinka, come vuole il centro. */
const PASSWORD_MINIMA = 10;

/**
 * La pagina Impostazioni: il motore delle conversazioni nuove, gli accessi dei motori in ogni
 * ambiente, l'ambiente del centro, la password di Shinka e il collegamento sicuro.
 */
export function PaginaImpostazioni({ menu }: { menu: ReactNode }): ReactNode {
  const [viste, setViste] = useState<ImpostazioniViste>();
  const motore = viste?.motore;
  const [ambienti, setAmbienti] = useState<AccessiDiUnAmbiente[]>();
  const [errore, setErrore] = useState<string>();
  // Dopo il primo avvio la pagina dice che cosa resta da fare.
  const [benvenuto, setBenvenuto] = useState(() => sessionStorage.getItem(CHIAVE_BENVENUTO) === "1");
  const leggiTutti = useCallback(() => {
    setAmbienti(undefined);
    leggiAccessi()
      .then(setAmbienti)
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere gli accessi."));
  }, []);
  useEffect(() => {
    document.title = "Impostazioni · Shinka";
    leggiImpostazioniInstallazione()
      .then(setViste)
      .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere le impostazioni."));
    leggiTutti();
  }, [leggiTutti]);

  async function scegli(scelto: Motore): Promise<void> {
    setErrore(undefined);
    try {
      setViste(await cambiaMotorePredefinito(scelto));
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non si è salvato.");
    }
  }

  const effettivo = motore === undefined ? undefined : (motore.scelto ?? motore.variabile);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Impostazioni</h1>
          <span className="sottotitolo">Motori e accessi, ambiente del centro, notifiche, password, collegamento sicuro, copia di sicurezza, Shinka Desktop</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-impostazioni">
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {benvenuto && (
            <section className="benvenuto" aria-labelledby="titolo-benvenuto">
              <h2 id="titolo-benvenuto">Benvenuto in Shinka</h2>
              <ol>
                <li>Scegli il motore delle conversazioni nuove: Claude o Codex.</li>
                <li>Negli accessi entra con l'abbonamento del motore scelto, almeno nell'ambiente del centro.</li>
                <li>Dai un nome all'ambiente del centro.</li>
                <li>
                  Nella pagina <a href="#/vault">Vault</a> imposta il vault: scegli la frase che lo apre, e se vuoi collega Telegram.
                </li>
              </ol>
              {/* Finita la preparazione, la presentazione guidata dice che cosa sa fare e da dove si comincia. */}
              <a
                className="pulsante"
                href="#/presentazione"
                onClick={() => {
                  sessionStorage.removeItem(CHIAVE_BENVENUTO);
                  setBenvenuto(false);
                }}
              >
                Ho finito: com'è fatta Shinka
              </a>
            </section>
          )}
          <section aria-labelledby="titolo-motore">
            <h2 id="titolo-motore">Motore delle conversazioni nuove</h2>
            {motore !== undefined && (
              <>
                <div className="scelta-motore" role="radiogroup" aria-labelledby="titolo-motore">
                  {MOTORI.map((voce) => (
                    <label key={voce} className={effettivo === voce ? "scelto" : undefined}>
                      <input type="radio" name="motore" value={voce} checked={effettivo === voce} onChange={() => void scegli(voce)} />
                      {NOMI_MOTORI[voce]}
                    </label>
                  ))}
                </div>
                <p className="tenue">
                  Vale per gli argomenti e i progetti che cominciano da adesso: quelli già cominciati restano con il loro motore, e lo cambi dal menu del
                  modello sotto la chat.
                  {motore.scelto === undefined && ` Finché non ne scegli uno vale quello dell'installazione: ${NOMI_MOTORI[motore.variabile]}.`}
                </p>
              </>
            )}
          </section>
          <section aria-labelledby="titolo-accessi">
            <h2 id="titolo-accessi">Accessi</h2>
            <p className="tenue">
              Ogni ambiente usa il suo accesso a Claude e a Codex: con l'abbonamento, non a consumo. L'accesso si fa sul sito di Anthropic o di OpenAI; qui
              non passa nessuna password.
            </p>
            {ambienti === undefined && errore === undefined && <p className="tenue">Controllo gli accessi negli ambienti…</p>}
            {ambienti !== undefined && (
              <ul className="elenco-accessi">
                {ambienti.map((ambiente) => (
                  <AccessiAmbiente key={ambiente.id} ambiente={ambiente} />
                ))}
              </ul>
            )}
          </section>
          {viste !== undefined && <AmbienteDelCentro viste={viste} alCambio={setViste} />}
          <SezioneNotifiche />
          <CambioPassword />
          <SezioneHttps />
          <SezioneCopiaDiSicurezza />
          <SezioneDesktop />
          <section aria-labelledby="titolo-pacchetto">
            <h2 id="titolo-pacchetto">Un'altra installazione</h2>
            <p className="tenue">
              Per installare Shinka su un altro server con Docker, per esempio al lavoro: il pacchetto ha il codice di questa versione e i file per
              installarla, senza memoria, skill, conversazioni né vault. Dentro, LEGGIMI.md dice come si fa; per aggiornarla, scarichi un pacchetto nuovo.
            </p>
            <a className="pulsante" href={INDIRIZZO_PACCHETTO} download>
              Scarica il pacchetto
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

function AccessiAmbiente({ ambiente }: { ambiente: AccessiDiUnAmbiente }): ReactNode {
  const [esito, setEsito] = useState<EsitoAccessi | undefined>(ambiente.esito);
  const [lavoro, setLavoro] = useState(false);
  const chiedi = useCallback(
    async (richiesta: Parameters<typeof chiediAccessi>[1]): Promise<void> => {
      setLavoro(true);
      try {
        setEsito(await chiediAccessi(ambiente.id, richiesta));
      } catch (causa) {
        setEsito((prima) => ({ ...prima, motivo: causa instanceof Error ? causa.message : "Non è andata." }));
      } finally {
        setLavoro(false);
      }
    },
    [ambiente.id],
  );
  // Un accesso a Codex si conclude sul sito: qui si guarda ogni tanto se è fatto.
  const attendeCodex = esito?.inCorso?.some((voce) => voce.motore === "codex") === true;
  useEffect(() => {
    if (!attendeCodex) return;
    const timer = setInterval(() => {
      chiediAccessi(ambiente.id, { tipo: "stato" })
        .then(setEsito)
        .catch(() => {});
    }, OGNI_MS);
    return () => clearInterval(timer);
  }, [attendeCodex, ambiente.id]);

  return (
    <li className="voce-accessi">
      <div className="riga-spazio">
        <span className="nome-spazio">{ambiente.nome}</span>
        {ambiente.delCentro && <span className="genere-spazio">ambiente del centro</span>}
      </div>
      {!ambiente.attivo && <p className="tenue">Spento: gli accessi si vedono quando il suo nodo è collegato.</p>}
      {ambiente.attivo &&
        MOTORI.map((motore) => (
          <AccessoMotore
            key={motore}
            motore={motore}
            nomeAmbiente={ambiente.nome}
            esito={esito}
            lavoro={lavoro}
            chiedi={(richiesta) => void chiedi(richiesta)}
          />
        ))}
      {esito?.motivo !== undefined && (
        <p className="errore" role="alert">
          {esito.motivo}
        </p>
      )}
    </li>
  );
}

function AccessoMotore({
  motore,
  nomeAmbiente,
  esito,
  lavoro,
  chiedi,
}: {
  motore: Motore;
  nomeAmbiente: string;
  esito: EsitoAccessi | undefined;
  lavoro: boolean;
  chiedi: (richiesta: Parameters<typeof chiediAccessi>[1]) => void;
}): ReactNode {
  const [conferma, setConferma] = useState(false);
  const stato = esito?.accessi?.[motore];
  const inCorso = esito?.inCorso?.find((voce) => voce.motore === motore);
  return (
    <div className="accesso-motore">
      <div className="riga-accesso">
        <span className="nome-motore">{NOMI_MOTORI[motore]}</span>
        <span className={stato?.collegato === true ? "stato-accesso collegato" : "stato-accesso"}>
          {stato === undefined ? "Non si sa" : stato.collegato ? `Collegato · ${stato.descrizione}` : "Non collegato"}
        </span>
        {inCorso === undefined && stato !== undefined && !stato.collegato && (
          <button type="button" disabled={lavoro} onClick={() => chiedi({ tipo: "avvia", motore })}>
            Accedi
          </button>
        )}
        {inCorso === undefined && stato?.collegato === true && !conferma && (
          <button type="button" className="discreto" disabled={lavoro} onClick={() => setConferma(true)}>
            Esci
          </button>
        )}
      </div>
      {stato !== undefined && !stato.collegato && stato.motivo !== undefined && <p className="tenue">{stato.motivo}</p>}
      {conferma && (
        <div className="conferma-uscita" role="alertdialog" aria-label={`Uscire da ${NOMI_MOTORI[motore]}`}>
          <p>
            Senza accesso, le conversazioni di {nomeAmbiente} che usano {NOMI_MOTORI[motore]} si fermano finché non entri di nuovo.
          </p>
          <div className="pulsanti">
            <button
              type="button"
              onClick={() => {
                setConferma(false);
                chiedi({ tipo: "esci", motore });
              }}
            >
              Esci da {NOMI_MOTORI[motore]}
            </button>
            <button type="button" className="discreto" onClick={() => setConferma(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {inCorso !== undefined && <AccessoInCorsoVisto accesso={inCorso} lavoro={lavoro} chiedi={chiedi} />}
    </div>
  );
}

function AccessoInCorsoVisto({
  accesso,
  lavoro,
  chiedi,
}: {
  accesso: AccessoInCorso;
  lavoro: boolean;
  chiedi: (richiesta: Parameters<typeof chiediAccessi>[1]) => void;
}): ReactNode {
  const [codice, setCodice] = useState("");
  const sito = accesso.motore === "codex" ? "OpenAI" : "Anthropic";
  return (
    <div className="accesso-in-corso">
      {accesso.chiedeCodice ? (
        <ol>
          <li>
            <a href={accesso.indirizzo} target="_blank" rel="noopener noreferrer">
              Apri la pagina di {sito}
            </a>{" "}
            ed entra con il tuo account.
          </li>
          <li>Copia il codice che la pagina ti mostra alla fine e incollalo qui.</li>
        </ol>
      ) : (
        <ol>
          <li>
            <a href={accesso.indirizzo} target="_blank" rel="noopener noreferrer">
              Apri la pagina di {sito}
            </a>{" "}
            ed entra con il tuo account ChatGPT.
          </li>
          <li>
            Scrivi questo codice: <code className="codice-accesso">{accesso.codice}</code>
          </li>
          <li className="tenue">Shinka se ne accorge da sola: non serve tornare qui.</li>
        </ol>
      )}
      {accesso.chiedeCodice && (
        <form
          className="riga-codice"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (codice.trim() === "") return;
            chiedi({ tipo: "codice", motore: accesso.motore, codice: codice.trim() });
            setCodice("");
          }}
        >
          <input
            aria-label="Codice dato dal sito"
            value={codice}
            onChange={(evento) => setCodice(evento.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Incolla il codice"
          />
          <button type="submit" disabled={lavoro || codice.trim() === ""}>
            {lavoro ? "Controllo…" : "Conferma"}
          </button>
        </form>
      )}
      <button type="button" className="discreto" disabled={lavoro} onClick={() => chiedi({ tipo: "annulla", motore: accesso.motore })}>
        Annulla l'accesso
      </button>
    </div>
  );
}

function AmbienteDelCentro({ viste, alCambio }: { viste: ImpostazioniViste; alCambio: (viste: ImpostazioniViste) => void }): ReactNode {
  const { ambiente } = viste;
  const [nome, setNome] = useState(ambiente.nome);
  const [descrizione, setDescrizione] = useState(ambiente.descrizione);
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<{ errore?: string; fatto?: string }>({});
  const cambiato = nome.trim() !== ambiente.nome || descrizione.trim() !== ambiente.descrizione;

  async function salva(modifica: { nome: string | null; descrizione: string | null }, fatto: string): Promise<void> {
    setLavoro(true);
    setEsito({});
    try {
      const nuove = await cambiaAmbienteDelCentro(modifica);
      alCambio(nuove);
      setNome(nuove.ambiente.nome);
      setDescrizione(nuove.ambiente.descrizione);
      setEsito({ fatto });
    } catch (causa) {
      setEsito({ errore: causa instanceof Error ? causa.message : "Non si è salvato." });
    } finally {
      setLavoro(false);
    }
  }

  return (
    <section aria-labelledby="titolo-ambiente">
      <h2 id="titolo-ambiente">Ambiente del centro</h2>
      <p className="tenue">La macchina su cui gira Shinka: la Home e i progetti che ci nascono lavorano qui. Il nome lo vedi negli Ambienti e nelle schede dei progetti.</p>
      <form
        className="modulo-impostazioni"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (nome.trim() === "") return;
          void salva({ nome: nome.trim(), descrizione: descrizione.trim() === "" ? null : descrizione.trim() }, "Salvato.");
        }}
      >
        <label>
          Nome
          <input value={nome} maxLength={60} onChange={(evento) => setNome(evento.target.value)} required />
        </label>
        <label>
          Che cosa offre
          <input
            value={descrizione}
            maxLength={300}
            placeholder="Per esempio: Linux, Docker, i dischi di casa"
            onChange={(evento) => setDescrizione(evento.target.value)}
          />
        </label>
        <p className="tenue">
          {ambiente.sistema} · i progetti nascono in <code>{ambiente.radiceProgetti}</code>
        </p>
        <div className="pulsanti">
          <button type="submit" disabled={lavoro || !cambiato || nome.trim() === ""}>
            Salva
          </button>
          {(ambiente.nomeScelto || ambiente.descrizioneScelta) && (
            <button type="button" className="discreto" disabled={lavoro} onClick={() => void salva({ nome: null, descrizione: null }, "Tornati quelli di partenza.")}>
              Torna a quelli di partenza
            </button>
          )}
        </div>
        {esito.fatto !== undefined && <p className="tenue" role="status">{esito.fatto}</p>}
        {esito.errore !== undefined && (
          <p className="errore" role="alert">
            {esito.errore}
          </p>
        )}
      </form>
    </section>
  );
}

function CambioPassword(): ReactNode {
  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [ripetuta, setRipetuta] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<{ errore?: string; fatto?: boolean }>({});
  const diverse = ripetuta !== "" && nuova !== ripetuta;
  const corta = nuova !== "" && nuova.length < PASSWORD_MINIMA;

  async function cambia(): Promise<void> {
    setLavoro(true);
    setEsito({});
    try {
      await cambiaPassword(attuale, nuova);
      setAttuale("");
      setNuova("");
      setRipetuta("");
      setEsito({ fatto: true });
    } catch (causa) {
      setEsito({ errore: causa instanceof Error ? causa.message : "La password non è cambiata." });
    } finally {
      setLavoro(false);
    }
  }

  return (
    <section aria-labelledby="titolo-password">
      <h2 id="titolo-password">Password di Shinka</h2>
      <p className="tenue">
        Quella con cui entri in questa pagina, non la frase del vault. Cambiandola esci da tutti gli altri browser e telefoni; qui resti dentro.
        Chi è dentro adesso, e chi ha provato a entrare, lo dice la pagina <a href={frammentoDi({ tipo: "sicurezza" })}>Sicurezza</a>.
      </p>
      <form
        className="modulo-impostazioni"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (diverse || corta || attuale === "" || nuova === "") return;
          void cambia();
        }}
      >
        <label>
          Password attuale
          <input type="password" autoComplete="current-password" value={attuale} onChange={(evento) => setAttuale(evento.target.value)} required />
        </label>
        <label>
          Password nuova
          <input type="password" autoComplete="new-password" value={nuova} onChange={(evento) => setNuova(evento.target.value)} required />
        </label>
        <label>
          Ripeti la password nuova
          <input type="password" autoComplete="new-password" value={ripetuta} onChange={(evento) => setRipetuta(evento.target.value)} required />
        </label>
        {corta && <p className="tenue">Almeno {PASSWORD_MINIMA} caratteri.</p>}
        {diverse && <p className="tenue">Le due password nuove non sono uguali.</p>}
        <div className="pulsanti">
          <button type="submit" disabled={lavoro || diverse || corta || attuale === "" || nuova === "" || ripetuta === ""}>
            {lavoro ? "Cambio…" : "Cambia password"}
          </button>
        </div>
        {esito.fatto === true && (
          <p className="tenue" role="status">
            Password cambiata: gli altri browser e telefoni dovranno entrare con quella nuova.
          </p>
        )}
        {esito.errore !== undefined && (
          <p className="errore" role="alert">
            {esito.errore}
          </p>
        )}
      </form>
    </section>
  );
}
