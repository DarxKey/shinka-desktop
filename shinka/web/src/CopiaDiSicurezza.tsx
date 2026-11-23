/**
 * La sezione «Copia di sicurezza» della pagina Impostazioni (ADR 0042): scaricare una copia dei
 * dati, cifrata con una password scelta al momento; caricarne una, aprirla con la sua password, e
 * poi portare qui memoria e skill oppure ripristinare tutto.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PASSWORD_DELLA_COPIA_MINIMA, type CopiaCaricata, type CopiaPronta, type EsitoTrasloco, type StatoCopie } from "../../src/protocollo/copia.ts";
import {
  apriCopiaCaricata,
  caricaCopia,
  eliminaDatiDiPrima,
  indirizzoDellaCopia,
  leggiCopie,
  preparaCopia,
  ripristinaDallaCopia,
  scartaCopiaCaricata,
  traslocaDallaCopia,
} from "./api.ts";
import { grandezzaInBreve, momentoInBreve, pesoInBreve } from "./descrivi.ts";
import { frammentoDi } from "./vista.ts";

function peso(byte: number): string {
  return byte < 100_000_000 ? pesoInBreve(byte) : grandezzaInBreve(byte);
}

const detto = (causa: unknown, altrimenti: string): string => (causa instanceof Error ? causa.message : altrimenti);

export function SezioneCopiaDiSicurezza(): ReactNode {
  const [stato, setStato] = useState<StatoCopie>();
  const [manca, setManca] = useState(false);
  useEffect(() => {
    leggiCopie()
      .then(setStato)
      .catch(() => setManca(true));
  }, []);
  if (manca) return null;
  return (
    <section aria-labelledby="titolo-copia" className="copia-di-sicurezza">
      <h2 id="titolo-copia">Copia di sicurezza</h2>
      <p className="tenue">
        Un solo file con i dati di Shinka: memoria, skill, conversazioni con le loro immagini, progetti, ambienti, lavori programmati e impostazioni. È cifrato con
        una password che scegli adesso: senza, non si apre, e Shinka non la conserva.
      </p>
      <p className="tenue">
        Non ci sono i file dei progetti, che restano nelle loro cartelle, e non c'è il vault: la sua copia si scarica dalla pagina{" "}
        <a href={frammentoDi({ tipo: "vault" })}>Vault</a>.
      </p>
      {stato?.ultimoRipristino !== undefined && <UltimoRipristino stato={stato} alCambio={setStato} />}
      <Scarica />
      {stato !== undefined && <Carica stato={stato} alCambio={setStato} />}
    </section>
  );
}

function UltimoRipristino({ stato, alCambio }: { stato: StatoCopie; alCambio: (stato: StatoCopie) => void }): ReactNode {
  const esito = stato.ultimoRipristino;
  const [daConfermare, setDaConfermare] = useState(false);
  const [errore, setErrore] = useState<string>();
  if (esito === undefined) return null;
  return (
    <div className={esito.riuscito ? "esito-ripristino" : "esito-ripristino fallito"} role="status">
      {esito.riuscito ? (
        <p>
          Il {momentoInBreve(esito.quando)} i dati sono stati ripristinati dalla copia del {momentoInBreve(esito.copia.quando)}.
        </p>
      ) : (
        <p>
          Il ripristino del {momentoInBreve(esito.quando)} non è riuscito, e i dati sono rimasti quelli di prima{esito.errore === undefined ? "." : `: ${esito.errore}.`}
        </p>
      )}
      {stato.datiDiPrima !== undefined && (
        <>
          <p className="tenue">
            I dati di prima del ripristino sono tenuti da parte sul server ({peso(stato.datiDiPrima.byte)}), nella cartella <code>copia-di-sicurezza</code> dei dati
            di Shinka: da lì si possono rimettere a mano. Quando sei sicuro che non servono, toglili.
          </p>
          {daConfermare ? (
            <div className="conferma-annulla" role="alertdialog" aria-label="Eliminare i dati di prima del ripristino">
              <p>I dati di prima del ripristino vengono cancellati: non si potrà più tornare a com'era.</p>
              <div className="pulsanti">
                <button
                  type="button"
                  className="mini pericolo"
                  onClick={() => {
                    setDaConfermare(false);
                    eliminaDatiDiPrima()
                      .then(alCambio)
                      .catch((causa: unknown) => setErrore(detto(causa, "Non è stato possibile.")));
                  }}
                >
                  Elimina
                </button>
                <button type="button" className="mini discreto" onClick={() => setDaConfermare(false)}>
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="pulsanti">
              <button type="button" className="mini" onClick={() => setDaConfermare(true)}>
                Elimina i dati di prima
              </button>
            </div>
          )}
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

function Scarica(): ReactNode {
  const [password, setPassword] = useState("");
  const [ripetuta, setRipetuta] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [pronta, setPronta] = useState<CopiaPronta>();
  const [errore, setErrore] = useState<string>();
  const corta = password !== "" && password.length < PASSWORD_DELLA_COPIA_MINIMA;
  const diverse = ripetuta !== "" && password !== ripetuta;

  async function prepara(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    setPronta(undefined);
    try {
      const copia = await preparaCopia(password);
      setPronta(copia);
      setPassword("");
      setRipetuta("");
      // Lo scaricamento parte da solo: è un file, e il browser lo salva senza tenerlo in memoria.
      const collegamento = document.createElement("a");
      collegamento.href = indirizzoDellaCopia(copia.id);
      collegamento.download = copia.nome;
      document.body.append(collegamento);
      collegamento.click();
      collegamento.remove();
    } catch (causa) {
      setErrore(detto(causa, "La copia non è stata preparata."));
    } finally {
      setLavoro(false);
    }
  }

  return (
    <>
      <h3>Scarica una copia</h3>
      <form
        className="modulo-impostazioni"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (corta || diverse || password === "" || ripetuta === "") return;
          void prepara();
        }}
      >
        <label>
          Password per questa copia
          <input type="password" autoComplete="new-password" value={password} onChange={(evento) => setPassword(evento.target.value)} required />
        </label>
        <label>
          Ripeti la password
          <input type="password" autoComplete="new-password" value={ripetuta} onChange={(evento) => setRipetuta(evento.target.value)} required />
        </label>
        {corta && <p className="tenue">Almeno {PASSWORD_DELLA_COPIA_MINIMA} caratteri.</p>}
        {diverse && <p className="tenue">Le due password non sono uguali.</p>}
        <div className="pulsanti">
          <button type="submit" disabled={lavoro || corta || diverse || password === "" || ripetuta === ""}>
            {lavoro ? "Preparo la copia…" : "Prepara e scarica"}
          </button>
        </div>
        {pronta !== undefined && (
          <p className="tenue" role="status">
            La copia è pronta ({peso(pronta.byte)}, {pronta.file} file) e lo scaricamento è partito. Se non parte,{" "}
            <a href={indirizzoDellaCopia(pronta.id)} download={pronta.nome}>
              scaricala da qui
            </a>
            : resta sul server per un'ora. Tieni da conto la password: senza, la copia non si apre.
            {pronta.saltati.length > 0 && ` Non sono entrati nella copia: ${pronta.saltati.join(", ")}.`}
          </p>
        )}
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
    </>
  );
}

function Carica({ stato, alCambio }: { stato: StatoCopie; alCambio: (stato: StatoCopie) => void }): ReactNode {
  const campo = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number>();
  const [errore, setErrore] = useState<string>();
  const caricata = stato.caricata;

  async function carica(file: File): Promise<void> {
    setErrore(undefined);
    setProgresso(0);
    try {
      alCambio({ ...stato, caricata: await caricaCopia(file, setProgresso) });
    } catch (causa) {
      setErrore(detto(causa, "La copia non è stata caricata."));
    } finally {
      setProgresso(undefined);
      if (campo.current !== null) campo.current.value = "";
    }
  }

  return (
    <>
      <h3>Carica una copia</h3>
      {caricata === undefined ? (
        <>
          <p className="tenue">
            Per ripristinare i dati, oppure per portare in questa installazione la memoria e le skill di un'altra. Caricarla non cambia ancora nulla.
          </p>
          <div className="pulsanti">
            <input
              ref={campo}
              type="file"
              hidden
              aria-label="Il file della copia di sicurezza"
              onChange={(evento) => {
                const file = evento.target.files?.[0];
                if (file !== undefined) void carica(file);
              }}
            />
            <button type="button" disabled={progresso !== undefined} onClick={() => campo.current?.click()}>
              {progresso === undefined ? "Scegli il file…" : `Carico… ${Math.round(progresso * 100)}%`}
            </button>
          </div>
        </>
      ) : (
        <Caricata copia={caricata} stato={stato} alCambio={alCambio} />
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </>
  );
}

function Caricata({ copia, stato, alCambio }: { copia: CopiaCaricata; stato: StatoCopie; alCambio: (stato: StatoCopie) => void }): ReactNode {
  const [password, setPassword] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  const contenuto = copia.contenuto;

  async function apri(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    try {
      alCambio({ ...stato, caricata: await apriCopiaCaricata(password) });
      setPassword("");
    } catch (causa) {
      setErrore(detto(causa, "La copia non si è aperta."));
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="copia-caricata">
      <p>
        Copia del <strong>{momentoInBreve(copia.quando)}</strong>, {peso(copia.byte)}.
      </p>
      {contenuto === undefined ? (
        <form
          className="modulo-impostazioni"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (password !== "") void apri();
          }}
        >
          <label>
            La password di questa copia
            <input type="password" autoComplete="off" value={password} onChange={(evento) => setPassword(evento.target.value)} required />
          </label>
          <div className="pulsanti">
            <button type="submit" disabled={lavoro || password === ""}>
              {lavoro ? "Apro…" : "Apri la copia"}
            </button>
            <Scarta alCambio={alCambio} alErrore={setErrore} />
          </div>
        </form>
      ) : (
        <>
          <ul className="contenuto-copia">
            <li>
              {contenuto.memoria.voci === 1 ? "1 voce di memoria" : `${contenuto.memoria.voci} voci di memoria`}, {contenuto.skill.length} skill
            </li>
            <li>
              {contenuto.progetti === 1 ? "1 progetto" : `${contenuto.progetti} progetti`},{" "}
              {contenuto.argomenti === 1 ? "1 argomento della Home" : `${contenuto.argomenti} argomenti della Home`}
            </li>
            <li>
              {contenuto.file} file, {peso(contenuto.byteAperti)} una volta aperta
            </li>
          </ul>
          {!contenuto.stessaVersione && <p className="tenue">Viene da un'altra versione di Shinka: se è più vecchia di questa, i dati si leggono lo stesso.</p>}
          <Trasloco copia={copia} stato={stato} alCambio={alCambio} />
          <Ripristino copia={copia} stato={stato} />
          <div className="pulsanti">
            <Scarta alCambio={alCambio} alErrore={setErrore} />
          </div>
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

function Scarta({ alCambio, alErrore }: { alCambio: (stato: StatoCopie) => void; alErrore: (errore: string) => void }): ReactNode {
  return (
    <button
      type="button"
      className="discreto"
      onClick={() => {
        scartaCopiaCaricata()
          .then(alCambio)
          .catch((causa: unknown) => alErrore(detto(causa, "Non è stato possibile.")));
      }}
    >
      Togli la copia caricata
    </button>
  );
}

function Trasloco({ copia, stato, alCambio }: { copia: CopiaCaricata; stato: StatoCopie; alCambio: (stato: StatoCopie) => void }): ReactNode {
  const contenuto = copia.contenuto;
  const [memoria, setMemoria] = useState(true);
  const [scelte, setScelte] = useState<ReadonlySet<string>>(() => new Set(contenuto?.skill.filter((skill) => skill.qui === undefined).map((skill) => skill.nome)));
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<EsitoTrasloco>();
  const [errore, setErrore] = useState<string>();
  if (contenuto === undefined) return null;
  const nulla = (!memoria || contenuto.memoria.nuove === 0) && scelte.size === 0;

  async function porta(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    setEsito(undefined);
    try {
      setEsito(await traslocaDallaCopia({ memoria, skill: [...scelte] }));
      alCambio(await leggiCopie());
    } catch (causa) {
      setErrore(detto(causa, "Non è stato portato nulla."));
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="trasloco">
      <h4>Porta qui memoria e skill</h4>
      <p className="tenue">Si aggiungono a quelle che ci sono già; conversazioni, progetti e il resto di questa installazione non si toccano.</p>
      <label className="scelta">
        <input type="checkbox" checked={memoria} disabled={contenuto.memoria.nuove === 0} onChange={(evento) => setMemoria(evento.target.checked)} />
        <span>
          La memoria:{" "}
          {contenuto.memoria.nuove === 0
            ? "le sue voci qui ci sono già tutte"
            : contenuto.memoria.nuove === 1
              ? "1 voce che qui non c'è"
              : `${contenuto.memoria.nuove} voci che qui non ci sono`}
        </span>
      </label>
      {contenuto.skill.map((skill) => (
        <label className="scelta" key={skill.nome}>
          <input
            type="checkbox"
            checked={scelte.has(skill.nome)}
            disabled={skill.qui === "uguale"}
            onChange={(evento) => {
              const nuove = new Set(scelte);
              if (evento.target.checked) nuove.add(skill.nome);
              else nuove.delete(skill.nome);
              setScelte(nuove);
            }}
          />
          <span>
            <code>{skill.nome}</code>
            {skill.qui === "uguale" && <span className="tenue"> · qui c'è già, uguale</span>}
            {skill.qui === "diversa" && <span className="tenue"> · qui c'è già, diversa: verrebbe sostituita, e la storia lo ricorda</span>}
            <span className="tenue descrizione-skill"> {skill.descrizione}</span>
          </span>
        </label>
      ))}
      <div className="pulsanti">
        <button type="button" disabled={lavoro || nulla} onClick={() => void porta()}>
          {lavoro ? "Porto…" : "Porta qui"}
        </button>
      </div>
      {esito !== undefined && (
        <p className="tenue" role="status">
          Portate {esito.memoria === 1 ? "1 voce di memoria" : `${esito.memoria} voci di memoria`} e{" "}
          {esito.skillCreate.length + esito.skillCambiate.length === 1 ? "1 skill" : `${esito.skillCreate.length + esito.skillCambiate.length} skill`}.
          {esito.rifiutati.length > 0 && ` Non accettati: ${esito.rifiutati.map((voce) => `${voce.che} (${voce.motivo})`).join("; ")}`}
        </p>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

function Ripristino({ copia, stato }: { copia: CopiaCaricata; stato: StatoCopie }): ReactNode {
  const contenuto = copia.contenuto;
  const [aperto, setAperto] = useState(false);
  const [password, setPassword] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [chiesto, setChiesto] = useState<{ riparte: boolean }>();
  const [errore, setErrore] = useState<string>();
  if (contenuto === undefined) return null;

  async function ripristina(): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    try {
      setChiesto(await ripristinaDallaCopia(password));
      setPassword("");
    } catch (causa) {
      setErrore(detto(causa, "Il ripristino non è partito."));
    } finally {
      setLavoro(false);
    }
  }

  if (chiesto !== undefined) {
    return (
      <div className="ripristino" role="status">
        <h4>Ripristino chiesto</h4>
        <p>
          {chiesto.riparte
            ? "Shinka si riavvia con i dati della copia: tra qualche secondo ricarica la pagina."
            : "Questa installazione non sa ripartire da sola: riavvia Shinka sul server, e ripartirà con i dati della copia."}{" "}
          Si entra con la password che Shinka aveva quando è stata fatta la copia.
        </p>
      </div>
    );
  }
  return (
    <div className="ripristino">
      <h4>Ripristina tutto</h4>
      <p className="tenue">
        Tutti i dati di questa installazione lasciano il posto a quelli della copia: conversazioni, progetti, memoria, skill, ambienti, impostazioni e password di
        Shinka. Quelli di adesso restano da parte sul server finché non li togli. Il vault e il collegamento con il gateway non cambiano.
      </p>
      {contenuto.progettiSenzaCartella.length > 0 && (
        <p className="avviso-copia">
          La cartella di {contenuto.progettiSenzaCartella.length === 1 ? "questo progetto" : "questi progetti"} qui non c'è, e i file dei progetti non stanno nella
          copia: {contenuto.progettiSenzaCartella.join(", ")}. Le conversazioni si rileggono, ma per lavorarci vanno riportati i file.
        </p>
      )}
      {!aperto ? (
        <div className="pulsanti">
          <button type="button" className="pericolo" onClick={() => setAperto(true)}>
            Ripristina tutto…
          </button>
        </div>
      ) : (
        <form
          className="modulo-impostazioni conferma-annulla"
          role="alertdialog"
          aria-label="Ripristinare tutti i dati dalla copia"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (password !== "") void ripristina();
          }}
        >
          <p>
            I dati di adesso vengono sostituiti da quelli della copia del {momentoInBreve(copia.quando)}
            {stato.riparte ? ", e Shinka si riavvia" : ""}. Conferma con la password di Shinka, quella di adesso.
          </p>
          <label>
            Password di Shinka
            <input type="password" autoComplete="current-password" value={password} onChange={(evento) => setPassword(evento.target.value)} required />
          </label>
          <div className="pulsanti">
            <button type="submit" className="pericolo" disabled={lavoro || password === ""}>
              {lavoro ? "Chiedo il ripristino…" : "Ripristina"}
            </button>
            <button type="button" className="discreto" onClick={() => setAperto(false)}>
              No
            </button>
          </div>
        </form>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
