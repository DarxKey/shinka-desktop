import { useEffect, useState, type ReactNode } from "react";
import type { TelegramDalCentro } from "../../src/protocollo/telegram.ts";
import type { CredenzialeInVista, DettaglioVault, VaultInBreve, VoceRegistro } from "../../src/protocollo/vault.ts";
import { leggiVault } from "./api.ts";
import { momentoInBreve } from "./descrivi.ts";

/** Ogni quanto la pagina rilegge il vault, per mostrare gli usi appena fatti. */
const RILETTURA_MS = 10_000;

/** Quante righe del registro si vedono prima di chiedere le altre. */
const RIGHE_REGISTRO = 30;

/**
 * La pagina del vault: quali credenziali ci sono, su quali host e in quali siti valgono, e che cosa ne è stato fatto.
 * Qui non si inserisce e non si sblocca nulla: frase e valori si scrivono solo nella pagina del
 * gateway, che si apre a parte, così non passano dal centro dove girano le conversazioni.
 */
export function PaginaVault({ menu, breve }: { menu: ReactNode; breve: VaultInBreve | undefined }): ReactNode {
  const [dettaglio, setDettaglio] = useState<DettaglioVault>();
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    document.title = "Vault · Shinka";
  }, []);
  // Si rilegge all'ingresso, quando il centro segnala un cambiamento e poi a intervalli.
  const segnale = breve === undefined ? "" : `${breve.gateway}/${breve.condizione ?? ""}/${breve.quante}`;
  useEffect(() => {
    let vivo = true;
    const leggi = (): void => {
      leggiVault()
        .then((letto) => {
          if (!vivo) return;
          setDettaglio(letto);
          setErrore(undefined);
        })
        .catch((causa: unknown) => {
          if (vivo) setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere il vault.");
        });
    };
    leggi();
    const intervallo = setInterval(() => {
      if (document.visibilityState === "visible") leggi();
    }, RILETTURA_MS);
    return () => {
      vivo = false;
      clearInterval(intervallo);
    };
  }, [segnale]);

  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Vault</h1>
          <span className="sottotitolo">Le credenziali che Claude usa senza vederle</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina">
          <p className="tenue">
            Chiavi e password dei tuoi host e dei siti in cui entri stanno nel gateway, cifrate con la tua frase. Claude
            le usa per nome e solo sugli host e nei siti per cui le hai inserite: il valore non entra mai in una
            conversazione, nel suo archivio o nel registro. Fa eccezione la chiave di un'estensione, che scrivi tu
            come tale: viene consegnata al programma di quell'estensione quando parte, negli ambienti che indichi, e una
            conversazione di quell'ambiente potrebbe leggerla. Fanno eccezione anche le credenziali che segni «in chiaro», di
            prova o a basso rischio: Claude ne legge il valore, che resta nella conversazione; ne può anche proporre di
            nuove, che entrano nel vault solo se le approvi dalla scheda nella chat. Su un host che dichiari per gli stack di prova Claude
            gestisce da solo i container creati da Shinka; ogni altro comando lì aspetta la tua approvazione, nella chat.
            Sul server su cui gira Shinka, se ne inserisci la credenziale, ogni comando aspetta invece un sì che dai al
            gateway: su Telegram, o nella sua pagina.
          </p>
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {dettaglio === undefined && errore === undefined && <p className="tenue">Carico…</p>}
          {dettaglio !== undefined && (
            <>
              <StatoDelVault dettaglio={dettaglio} />
              {dettaglio.condizione === "aperto" && <Credenziali credenziali={dettaglio.credenziali} />}
              {dettaglio.gateway === "attivo" && dettaglio.telegram !== undefined && (
                <StatoDiTelegram telegram={dettaglio.telegram} pagina={dettaglio.pagina} />
              )}
              {dettaglio.gateway === "attivo" && <RegistroDegliUsi voci={dettaglio.registro} />}
              {dettaglio.gateway === "attivo" && <VersioneDelGateway dettaglio={dettaglio} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function inParole(dettaglio: DettaglioVault): { classe: string; titolo: string; testo: string; pulsante?: string } {
  if (dettaglio.gateway === "non-configurato") {
    return {
      classe: "spento",
      titolo: "Gateway non configurato",
      testo: "In questa installazione di Shinka il gateway non c'è: Claude non ha credenziali da usare.",
    };
  }
  if (dettaglio.gateway === "irraggiungibile") {
    return {
      classe: "male",
      titolo: "Il gateway non risponde",
      testo: "Finché non torna, Claude non può usare alcuna credenziale. Controlla che il suo container sia acceso.",
      pulsante: "Prova ad aprire la pagina del vault",
    };
  }
  if (dettaglio.condizione === "da-impostare") {
    return {
      classe: "attesa",
      titolo: "Vault da impostare",
      testo: "Scegli la frase di sblocco e inserisci le prime credenziali. La frase la sai solo tu: non è scritta da nessuna parte.",
      pulsante: "Imposta il vault",
    };
  }
  if (dettaglio.condizione === "chiuso") {
    return {
      classe: "attesa",
      titolo: "Vault chiuso",
      testo: "Il vault si chiude a ogni riavvio del gateway e quando lo chiudi tu. Finché non scrivi la tua frase, Claude non può usare alcuna credenziale né il browser del gateway.",
      pulsante: "Sblocca il vault",
    };
  }
  return {
    classe: "bene",
    titolo: "Vault aperto",
    testo: "Claude può usare le credenziali qui sotto, per nome. Per inserirne, sostituirne o rimuoverne una, o per chiudere il vault, apri la sua pagina.",
    pulsante: "Gestisci le credenziali",
  };
}

function StatoDelVault({ dettaglio }: { dettaglio: DettaglioVault }): ReactNode {
  const { classe, titolo, testo, pulsante } = inParole(dettaglio);
  return (
    <section className={`stato-vault ${classe}`} aria-label="Stato del vault">
      <h2>{titolo}</h2>
      <p>{testo}</p>
      {pulsante !== undefined && dettaglio.pagina !== undefined && (
        <>
          <a className="pulsante" href={dettaglio.pagina} target="_blank" rel="noreferrer">
            {pulsante}
          </a>
          <p className="tenue">
            Si apre in un'altra scheda, all'indirizzo del gateway: lì ti viene chiesta la frase.
          </p>
        </>
      )}
    </section>
  );
}

/** Il bot Telegram in parole: sta nel gateway, accanto al vault, e si imposta dalla stessa pagina. */
export function telegramInParole(telegram: TelegramDalCentro): { classe: string; titolo: string; testo: string; pulsante?: string } {
  const bot = "bot" in telegram && telegram.bot !== undefined ? `@${telegram.bot}` : "il bot";
  switch (telegram.condizione) {
    case "attivo":
      return {
        classe: "bene",
        titolo: "Telegram attivo",
        testo: `Scrivendo a ${bot} parli con la Home, e lì ricevi gli avvisi dei progetti e le richieste da approvare, con un pulsante. Ascolta solo te: chiunque altro viene ignorato.`,
        pulsante: "Gestisci il bot",
      };
    case "da-abbinare":
      return {
        classe: "attesa",
        titolo: "Telegram: bot da abbinare",
        testo: `Il token di ${bot} c'è, ma il bot non sa ancora chi sei: finché non lo abbini a te non ascolta nessuno.`,
        pulsante: "Abbina il bot",
      };
    case "errore":
      return {
        classe: "male",
        titolo: "Telegram ha un problema",
        testo: telegram.problema ?? "Il bot non riesce a parlare con Telegram.",
        pulsante: "Apri la pagina del vault",
      };
    case "da-configurare":
      return {
        classe: "spento",
        titolo: "Telegram non configurato",
        testo: "Con un bot Telegram scrivi alla Home dal telefono e ricevi lì avvisi e richieste di approvazione. Il token del bot si scrive nella pagina del vault, e resta nel gateway.",
        pulsante: "Configura Telegram",
      };
    default:
      return {
        classe: "spento",
        titolo: "Telegram non disponibile",
        testo: "Il gateway non ha saputo dire in che stato è il bot: può essere una versione che non lo conosce ancora.",
      };
  }
}

function StatoDiTelegram({ telegram, pagina }: { telegram: TelegramDalCentro; pagina: string | undefined }): ReactNode {
  const { classe, titolo, testo, pulsante } = telegramInParole(telegram);
  return (
    <>
      <h2 className="titolo-sezione">Telegram</h2>
      <section className={`stato-vault di-telegram ${classe}`} aria-label="Stato di Telegram">
        <h2>{titolo}</h2>
        <p>{testo}</p>
        {pulsante !== undefined && pagina !== undefined && (
          <a className="pulsante" href={pagina} target="_blank" rel="noreferrer">
            {pulsante}
          </a>
        )}
      </section>
    </>
  );
}

/** Da quale versione gira il gateway, e a che punto è l'ultima che il centro gli ha proposto. */
function VersioneDelGateway({ dettaglio }: { dettaglio: DettaglioVault }): ReactNode {
  const ultima = dettaglio.aggiornamento;
  const breve = (versione: string): string => versione.slice(0, 8);
  return (
    <p className="tenue">
      {dettaglio.versione === undefined ? "Il gateway non dice da quale versione gira" : `Gateway alla versione ${breve(dettaglio.versione)}`}
      {dettaglio.siAggiorna === true
        ? ": cambia versione da dentro Shinka, ma solo con un sì che dai al gateway stesso."
        : ": una versione nuova la può mettere solo chi lavora da fuori."}
      {ultima?.stato === "in-attesa" && ` Aspetta il tuo sì per la versione ${breve(ultima.versione)}: su Telegram, o nella sua pagina.`}
      {ultima?.stato === "in-corso" && ` Sta installando la versione ${breve(ultima.versione)}.`}
      {ultima?.stato === "negato" && ` Hai detto di no alla versione ${breve(ultima.versione)}.`}
      {ultima?.stato === "scaduto" && ` La richiesta per la versione ${breve(ultima.versione)} è scaduta senza risposta.`}
      {ultima?.stato === "non-riuscito" && ` La versione ${breve(ultima.versione)} non è entrata in funzione: ${ultima.motivo}`}
    </p>
  );
}

function Credenziali({ credenziali }: { credenziali: CredenzialeInVista[] }): ReactNode {
  return (
    <>
      <h2 className="titolo-sezione">Credenziali</h2>
      {credenziali.length === 0 ? (
        <p className="tenue vuota">Ancora nessuna. Inseriscile dalla pagina del vault.</p>
      ) : (
        <ul className="credenziali-vault">
          {credenziali.map((credenziale) => (
            <li key={credenziale.nome} className="credenziale-vault">
              <div className="riga-credenziale">
                <span className="nome-credenziale">{credenziale.nome}</span>
                <span className="tenue">
                  {credenziale.tipo === "chiave"
                    ? "chiave SSH"
                    : credenziale.tipo === "sito"
                      ? "accesso a un sito"
                      : credenziale.tipo === "estensione"
                        ? "chiave di un'estensione"
                        : "password"}
                </span>
              </div>
              <p className="dove-vale">
                {credenziale.tipo === "estensione" ? (
                  <>
                    <span className="tenue">chiave</span> {credenziale.utente} <span className="tenue">dell'estensione</span>{" "}
                    {credenziale.estensione} <span className="tenue">negli ambienti</span>{" "}
                  </>
                ) : (
                  <>
                    <span className="tenue">utente</span> {credenziale.utente}{" "}
                    <span className="tenue">{credenziale.tipo === "sito" ? "in" : "su"}</span>{" "}
                  </>
                )}
                {credenziale.host.map((host) => (
                  <code key={host}>{host}</code>
                ))}
              </p>
              {credenziale.stack !== undefined && (
                <p className="stack-vault">
                  Host per gli stack di prova <span className="tenue">· porte</span> {credenziale.stack.porte.da}–
                  {credenziale.stack.porte.a} <span className="tenue">· volumi in</span> <code>{credenziale.stack.radice}</code>
                </p>
              )}
              {credenziale.server === true && (
                <p className="stack-vault">
                  Server di Shinka <span className="tenue">· ogni comando aspetta il tuo sì, dato al gateway</span>
                </p>
              )}
              {credenziale.inChiaro === true && (
                <p className="stack-vault in-chiaro">
                  In chiaro <span className="tenue">· Claude ne può leggere il valore</span>
                </p>
              )}
              <p className="tenue">
                {credenziale.usataIl === undefined
                  ? "Mai usata"
                  : `Usata l'ultima volta il ${momentoInBreve(credenziale.usataIl)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const ESITI: Record<VoceRegistro["esito"], string> = {
  eseguito: "eseguito",
  rifiutato: "rifiutato",
  fallito: "non riuscito",
};

function RegistroDegliUsi({ voci }: { voci: VoceRegistro[] }): ReactNode {
  const [tutte, setTutte] = useState(false);
  const mostrate = tutte ? voci : voci.slice(0, RIGHE_REGISTRO);
  return (
    <>
      <h2 className="titolo-sezione">Registro degli usi</h2>
      {voci.length === 0 ? (
        <p className="tenue vuota">Nessuna credenziale è stata ancora usata.</p>
      ) : (
        <ul className="registro-vault">
          {mostrate.map((voce, indice) => {
            // Un'operazione su uno stack non ha un codice di uscita: riuscita o no, lo dice l'esito.
            const finitoMale =
              voce.esito === "eseguito" && voce.nelBrowser !== true && voce.codice !== undefined && voce.codice !== 0;
            return (
              <li key={`${voce.quando}-${indice}`} className={`uso ${voce.esito}`}>
                <div className="riga-uso">
                  <span className="esito">
                    {ESITI[voce.esito]}
                    {finitoMale && ` (codice ${voce.codice ?? "sconosciuto"})`}
                  </span>
                  <span className="tenue">{momentoInBreve(voce.quando)}</span>
                </div>
                <p className="chi-uso">
                  {voce.conversazione}{" "}
                  {voce.credenziale !== "" && (
                    <>
                      <span className="tenue">con</span> {voce.credenziale}{" "}
                    </>
                  )}
                  <span className="tenue">{voce.nelBrowser === true ? "nel sito" : "su"}</span> {voce.host}
                </p>
                <pre className="comando-uso">{voce.comando}</pre>
                {voce.motivo !== undefined && <p className="tenue">{voce.motivo}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {!tutte && voci.length > RIGHE_REGISTRO && (
        <button type="button" className="discreto" onClick={() => setTutte(true)}>
          Mostra tutte le {voci.length} righe
        </button>
      )}
    </>
  );
}
