import { useEffect, useState, type ReactNode } from "react";
import {
  contenutoInRighe,
  definizioneInChiaro,
  tipoInParole,
  type Estensione,
  type EstensioniDellAmbiente,
  type StatoEstensioni,
} from "../../src/protocollo/estensioni.ts";
import type { Ambiente, StatoAmbienti } from "../../src/protocollo/nodi.ts";
import { accendiEstensione, decidiEstensione, guardaEstensioniDellAmbiente, rimuoviEstensione } from "./api.ts";
import { useSolaLettura } from "./ContestoChat.ts";
import { momentoInBreve } from "./descrivi.ts";
import type { Elemento } from "./stato.ts";
import { frammentoDi } from "./vista.ts";

type Proposta = Extract<Elemento, { tipo: "estensione" }>;

function inParole(causa: unknown, ripiego: string): string {
  return causa instanceof Error ? causa.message : ripiego;
}

/** Come si chiama, nella scheda, ciò che la definizione dice. */
const CHE_COSA_E = {
  "mcp-locale": "Che cosa viene eseguito",
  "mcp-remoto": "A che cosa si collega",
  plugin: "Da dove viene",
} as const;

function quantiStrumenti(strumenti: readonly string[]): string {
  return strumenti.length === 1 ? "uno strumento" : `${strumenti.length} strumenti`;
}

/** La definizione per intero, com'è: nulla di abbreviato. */
function Definizione({ estensione }: { estensione: Pick<Estensione, "definizione"> }): ReactNode {
  return <pre className="definizione-estensione">{definizioneInChiaro(estensione.definizione).join("\n")}</pre>;
}

/**
 * La scheda con cui la Home propone un'estensione: che cosa è, da dove viene, che cosa viene
 * eseguito e in quale ambiente. Finché il proprietario non conferma non viene installato né avviato
 * nulla; confermata, l'ambiente la avvia una volta, e la accende solo se parte.
 */
export function SchedaEstensione({ proposta }: { proposta: Proposta }): ReactNode {
  const solaLettura = useSolaLettura();
  const [inCorso, setInCorso] = useState<"confermata" | "annullata">();
  const [errore, setErrore] = useState<string>();

  if (proposta.esito === "annullata") {
    return <div className="riga nota">Proposta annullata: l'estensione «{proposta.nome}» non è stata installata.</div>;
  }
  if (proposta.esito === "non-partita") {
    return (
      <div className="riga avviso" role="alert">
        L'estensione «{proposta.nome}» non è partita nell'ambiente {proposta.nomeAmbiente}, e non è stata accesa
        {proposta.motivo === undefined ? "." : `: ${proposta.motivo}`}
      </div>
    );
  }
  if (proposta.esito === "accesa") {
    return (
      <div className="riga proposta decisa">
        <div className="testo">
          <div className="intestazione">Estensione accesa: {proposta.nome}</div>
          <div className="tenue">
            Nell'ambiente {proposta.nomeAmbiente}
            {proposta.strumenti !== undefined && proposta.strumenti.length > 0 && ` · ${quantiStrumenti(proposta.strumenti)}`}
          </div>
        </div>
        <a className="pulsante" href={frammentoDi({ tipo: "estensioni" })}>
          Estensioni
        </a>
      </div>
    );
  }
  if (solaLettura) {
    return <div className="riga nota">Proposta di un'estensione rimasta senza risposta: «{proposta.nome}».</div>;
  }

  async function decidi(esito: "confermata" | "annullata"): Promise<void> {
    setInCorso(esito);
    setErrore(undefined);
    try {
      await decidiEstensione(proposta.chiave, esito);
    } catch (causa) {
      // Se manca solo qualcosa che si può mettere a posto, la scheda resta e lo dice.
      setErrore(inParole(causa, "Decisione non registrata."));
    } finally {
      setInCorso(undefined);
    }
  }

  const { tipo } = proposta.definizione;
  return (
    <div className="riga proposta approvazione estensione" role="group" aria-label="Estensione da confermare">
      <div className="intestazione">
        {proposta.giaInElenco === true ? "Estensione da accendere in un altro ambiente" : "Estensione da installare"}
      </div>
      <div className="voce-scheda">
        <div className="titolino">Che cosa</div>
        <div className="titolo-sviluppo">
          {proposta.nome} <span className="tenue">· {tipoInParole(tipo)}</span>
        </div>
        <div>{proposta.descrizione}</div>
      </div>
      <div className="voce-scheda">
        <div className="titolino">Ambiente</div>
        <div>{proposta.nomeAmbiente}</div>
      </div>
      <div className="voce-scheda">
        <div className="titolino">{CHE_COSA_E[tipo]}</div>
        <Definizione estensione={proposta} />
      </div>
      {proposta.contenuto !== undefined && (
        <div className="voce-scheda">
          <div className="titolino">
            Che cosa contiene
            {proposta.contenuto.nome !== undefined &&
              ` · ${proposta.contenuto.nome}${proposta.contenuto.versione === undefined ? "" : ` ${proposta.contenuto.versione}`}`}
          </div>
          <ul className="contenuto-estensione">
            {contenutoInRighe(proposta.contenuto).map((riga) => (
              <li key={riga}>{riga}</li>
            ))}
          </ul>
        </div>
      )}
      {proposta.chiavi.length > 0 && (
        <div className="voce-scheda">
          <div className="titolino">Chiavi dal vault</div>
          <div>
            {proposta.chiavi.map((chiave) => (
              <code key={chiave}>{chiave}</code>
            ))}
          </div>
        </div>
      )}
      {proposta.avvisi.length > 0 && (
        <ul className="avvisi-installazione">
          {proposta.avvisi.map((avviso) => (
            <li key={avviso}>{avviso}</li>
          ))}
        </ul>
      )}
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inCorso !== undefined} onClick={() => void decidi("confermata")}>
          {inCorso === "confermata" ? "La provo…" : "Conferma"}
        </button>
        <button type="button" disabled={inCorso !== undefined} onClick={() => void decidi("annullata")}>
          Annulla
        </button>
      </div>
      <div className="tenue">
        Se confermi, l'ambiente la avvia una volta: viene accesa solo se parte. Finché non confermi non viene installato
        né avviato nulla.
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

export interface ProprietaPaginaEstensioni {
  menu: ReactNode;
  stato: StatoEstensioni | undefined;
  ambienti: StatoAmbienti | undefined;
}

/**
 * La pagina delle estensioni: quelle che Shinka ha nel suo elenco, con gli ambienti in cui sono
 * accese, e ciò che ogni ambiente aveva già per conto suo. Qui il proprietario le spegne, le
 * riaccende e le toglie; per aggiungerne una la chiede alla Home, che gli mostra la scheda.
 */
export function PaginaEstensioni({ menu, stato, ambienti }: ProprietaPaginaEstensioni): ReactNode {
  useEffect(() => {
    document.title = "Estensioni · Shinka";
  }, []);
  const elenco = ambienti?.ambienti ?? [];
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Estensioni</h1>
          <span className="sottotitolo">Strumenti di terzi accesi nei tuoi ambienti</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina">
          <p className="tenue">
            Un'estensione è codice di terzi che dà strumenti in più alle conversazioni: un server MCP, locale o remoto,
            oppure un plugin di Claude Code. La usano i progetti dell'ambiente in cui è accesa e, per l'ambiente del
            centro, la Home; ogni sua azione chiede il consenso come le altre. Per aggiungerne una chiedila alla Home:
            ti mostra una scheda, e nulla viene installato finché non la confermi.
          </p>
          {stato === undefined ? (
            <p className="tenue">Carico…</p>
          ) : (
            <>
              <h2 className="titolo-sezione">Nell'elenco di Shinka</h2>
              {stato.estensioni.length === 0 ? (
                <p className="tenue vuota">Ancora nessuna.</p>
              ) : (
                <ul className="credenziali-vault">
                  {stato.estensioni.map((estensione) => (
                    <VistaEstensione key={estensione.id} estensione={estensione} ambienti={elenco} />
                  ))}
                </ul>
              )}
              <h2 className="titolo-sezione">Già negli ambienti</h2>
              <p className="tenue">
                Ciò che hai installato per conto tuo in un ambiente, fuori da Shinka. I progetti di quell'ambiente lo usano
                già; Shinka lo mostra e basta: non lo copia, non lo spegne e non lo toglie.
              </p>
              <ul className="credenziali-vault">
                {elenco.map((ambiente) => (
                  <GiaNellAmbiente key={ambiente.id} ambiente={ambiente} viste={stato.dellAmbiente[ambiente.id]} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VistaEstensione({ estensione, ambienti }: { estensione: Estensione; ambienti: Ambiente[] }): ReactNode {
  const [daConfermare, setDaConfermare] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function rimuovi(): Promise<void> {
    setErrore(undefined);
    try {
      await rimuoviEstensione(estensione.id);
    } catch (causa) {
      setDaConfermare(false);
      setErrore(inParole(causa, "Estensione non rimossa."));
    }
  }

  // Gli ambienti che ci sono, e quelli in cui era stata accesa e che non ci sono più.
  const spariti = estensione.ambienti.filter((dove) => !ambienti.some((uno) => uno.id === dove.idAmbiente));
  return (
    <li className="credenziale-vault estensione">
      <div className="riga-credenziale">
        <span className="nome-credenziale">{estensione.nome}</span>
        <span className="tenue">{tipoInParole(estensione.definizione.tipo)}</span>
      </div>
      <p>{estensione.descrizione}</p>
      <Definizione estensione={estensione} />
      {estensione.contenuto !== undefined && (
        <details className="dettaglio-installazione">
          <summary>Che cosa contiene</summary>
          <ul>
            {contenutoInRighe(estensione.contenuto).map((riga) => (
              <li key={riga}>{riga}</li>
            ))}
          </ul>
        </details>
      )}
      {estensione.chiavi.length > 0 && (
        <p className="dove-vale">
          <span className="tenue">chiavi dal vault</span>{" "}
          {estensione.chiavi.map((chiave) => (
            <code key={chiave}>{chiave}</code>
          ))}
        </p>
      )}
      <ul className="ambienti-estensione">
        {ambienti.map((ambiente) => (
          <InAmbiente key={ambiente.id} estensione={estensione} ambiente={ambiente} />
        ))}
        {spariti.map((dove) => (
          <li key={dove.idAmbiente} className="tenue">
            Era accesa in un ambiente che non c'è più.
          </li>
        ))}
      </ul>
      {daConfermare ? (
        <div className="pulsanti">
          <button type="button" onClick={() => void rimuovi()}>
            Conferma: toglila dall'elenco
          </button>
          <button type="button" className="discreto" onClick={() => setDaConfermare(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <button type="button" className="discreto piccolo" onClick={() => setDaConfermare(true)}>
          Togli dall'elenco
        </button>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}

/** Un'estensione in un ambiente: accesa o spenta, con il pulsante per cambiarlo. Accenderla la prova di nuovo. */
function InAmbiente({ estensione, ambiente }: { estensione: Estensione; ambiente: Ambiente }): ReactNode {
  const [inCorso, setInCorso] = useState(false);
  const [nota, setNota] = useState<string>();
  const dove = estensione.ambienti.find((uno) => uno.idAmbiente === ambiente.id);
  const accesa = dove?.accesa === true;

  async function cambia(): Promise<void> {
    setInCorso(true);
    setNota(undefined);
    try {
      const esito = await accendiEstensione(estensione.id, ambiente.id, !accesa);
      if (esito.stato === "non-partita") setNota(`Non è partita, e resta spenta${esito.motivo === undefined ? "." : `: ${esito.motivo}`}`);
    } catch (causa) {
      setNota(inParole(causa, "Non è riuscito."));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className={accesa ? "ambiente-estensione accesa" : "ambiente-estensione"}>
      <div className="riga-ambiente">
        <span className="nome">{ambiente.nome}</span>
        <span className="stato">{accesa ? "accesa" : dove === undefined ? "mai accesa qui" : "spenta"}</span>
        <button type="button" className="discreto piccolo" disabled={inCorso || (!accesa && !ambiente.attivo)} onClick={() => void cambia()}>
          {inCorso ? (accesa ? "La spengo…" : "La provo…") : accesa ? "Spegni" : "Accendi"}
        </button>
      </div>
      {dove !== undefined && dove.strumenti.length > 0 && (
        <details className="strumenti-estensione">
          <summary>{quantiStrumenti(dove.strumenti)}</summary>
          <p>
            {dove.strumenti.map((strumento) => (
              <code key={strumento}>{strumento}</code>
            ))}
          </p>
        </details>
      )}
      {!accesa && !ambiente.attivo && <div className="tenue">L'ambiente è spento: si accende lì quando torna attivo.</div>}
      {nota !== undefined && (
        <p className="errore" role="alert">
          {nota}
        </p>
      )}
    </li>
  );
}

/** Ciò che un ambiente aveva già, l'ultima volta che Shinka ha guardato. */
function GiaNellAmbiente({ ambiente, viste }: { ambiente: Ambiente; viste: EstensioniDellAmbiente | undefined }): ReactNode {
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();

  async function guarda(): Promise<void> {
    setInCorso(true);
    setErrore(undefined);
    try {
      await guardaEstensioniDellAmbiente(ambiente.id);
    } catch (causa) {
      setErrore(inParole(causa, "Non sono riuscito a guardare."));
    } finally {
      setInCorso(false);
    }
  }

  const altre = viste === undefined ? 0 : viste.quanteSkill - viste.skill.length;
  return (
    <li className="credenziale-vault">
      <div className="riga-credenziale">
        <span className="nome-credenziale">{ambiente.nome}</span>
        <span className="tenue">{viste === undefined ? "mai guardato" : `visto il ${momentoInBreve(viste.quando)}`}</span>
      </div>
      {viste !== undefined && (
        <>
          <p className="dove-vale">
            <span className="tenue">server MCP</span>{" "}
            {viste.server.length === 0
              ? "nessuno"
              : viste.server.map((server) => (
                  <code key={server.nome} title={server.provenienza}>
                    {server.nome}
                  </code>
                ))}
          </p>
          <p className="dove-vale">
            <span className="tenue">plugin</span>{" "}
            {viste.plugin.length === 0
              ? "nessuno"
              : viste.plugin.map((plugin) => (
                  <code key={plugin.nome}>{plugin.versione === undefined ? plugin.nome : `${plugin.nome} ${plugin.versione}`}</code>
                ))}
          </p>
          {viste.quanteSkill > 0 && (
            <details className="strumenti-estensione">
              <summary>{viste.quanteSkill === 1 ? "Una skill o un comando" : `${viste.quanteSkill} tra skill e comandi`}</summary>
              <p>
                {viste.skill.map((skill) => (
                  <code key={skill}>{skill}</code>
                ))}
                {altre > 0 && <span className="tenue">… e altre {altre}</span>}
              </p>
            </details>
          )}
        </>
      )}
      <button type="button" className="discreto piccolo" disabled={inCorso || !ambiente.attivo} onClick={() => void guarda()}>
        {inCorso ? "Guardo…" : viste === undefined ? "Guarda adesso" : "Aggiorna"}
      </button>
      {!ambiente.attivo && <div className="tenue">L'ambiente è spento.</div>}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}
