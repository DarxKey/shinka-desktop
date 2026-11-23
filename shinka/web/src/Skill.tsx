import { useEffect, useState, type ReactNode } from "react";
import type {
  DettaglioSkill,
  ModificaSkill,
  StatoSkill,
  TipoModifica,
  VersioniSkill,
  VoceSkill,
} from "../../src/protocollo/skill.ts";
import { annullaModifica, ErroreCentro, leggiSkill, leggiVersioni } from "./api.ts";
import { momentoInBreve } from "./descrivi.ts";
import { Formattato } from "./Elementi.tsx";
import { frammentoDi } from "./vista.ts";

const TIPI: Record<TipoModifica, string> = {
  creata: "Creata",
  modificata: "Modificata",
  annullata: "Riportata a prima",
};

function inParole(causa: unknown, ripiego: string): string {
  return causa instanceof Error ? causa.message : ripiego;
}

function quante(modifiche: number): string {
  return modifiche === 1 ? "1 passaggio nella storia" : `${modifiche} passaggi nella storia`;
}

export interface ProprietaPaginaSkill {
  menu: ReactNode;
  stato: StatoSkill | undefined;
  /** La skill aperta; se manca si vede l'elenco. */
  nome: string | undefined;
  /** Le skill create o cambiate dall'ultima volta che il proprietario ha guardato questa pagina. */
  nuove: ReadonlySet<string>;
}

/**
 * La pagina delle skill: le procedure che Claude ha scritto e migliorato da solo.
 * Di ognuna il proprietario vede il testo e la storia, e può tornare a prima di una modifica.
 */
export function PaginaSkill({ menu, stato, nome, nuove }: ProprietaPaginaSkill): ReactNode {
  const voce = nome === undefined ? undefined : stato?.skill.find((skill) => skill.nome === nome);
  useEffect(() => {
    document.title = `${nome ?? "Skill"} · Shinka`;
  }, [nome]);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>{nome ?? "Skill"}</h1>
          <span className="sottotitolo">
            {nome === undefined ? "Le procedure che Claude ha imparato" : (voce?.descrizione ?? "Skill di Shinka")}
          </span>
        </div>
        {nome !== undefined && (
          <a className="pulsante" href={frammentoDi({ tipo: "skill" })}>
            Tutte le skill
          </a>
        )}
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina">
          {nome === undefined ? (
            <Elenco stato={stato} nuove={nuove} />
          ) : stato === undefined ? (
            <p className="tenue">Carico…</p>
          ) : voce === undefined ? (
            <p className="tenue vuota">Questa skill non c'è, o non c'è più.</p>
          ) : (
            // Quando la skill cambia, anche per mano di Claude, la pagina la rilegge.
            <Dettaglio key={`${voce.nome} ${voce.modificataIl} ${voce.modifiche}`} voce={voce} />
          )}
        </div>
      </div>
    </div>
  );
}

function Elenco({ stato, nuove }: { stato: StatoSkill | undefined; nuove: ReadonlySet<string> }): ReactNode {
  return (
    <>
      <p className="tenue">
        Dopo un lavoro riuscito che potrebbe ripetersi, Claude ne scrive la procedura; quando la usa e trova di
        meglio, la corregge. Le skill valgono nella Home, in ogni progetto e in ogni ambiente. Ogni modifica resta
        nella storia, e puoi tornare a prima.
      </p>
      {stato === undefined && <p className="tenue">Carico…</p>}
      {stato?.skill.length === 0 && (
        <p className="tenue vuota">Ancora nessuna. Nasceranno da sole, dai lavori che fai fare a Claude.</p>
      )}
      {stato !== undefined && stato.skill.length > 0 && (
        <ul className="elenco-skill">
          {stato.skill.map((skill) => (
            <li key={skill.nome}>
              <a className="scheda-skill" href={frammentoDi({ tipo: "skill", nome: skill.nome })}>
                <span className="riga-nome">
                  <span className="nome">{skill.nome}</span>
                  {nuove.has(skill.nome) && <span className="novita">novità</span>}
                </span>
                <span className="descrizione">{skill.descrizione}</span>
                <span className="tenue">
                  {momentoInBreve(skill.modificataIl)} · {quante(skill.modifiche)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Dettaglio({ voce }: { voce: VoceSkill }): ReactNode {
  const [dettaglio, setDettaglio] = useState<DettaglioSkill>();
  const [errore, setErrore] = useState<string>();

  useEffect(() => {
    let attuale = true;
    leggiSkill(voce.nome).then(
      (letto) => {
        if (attuale) setDettaglio(letto);
      },
      (causa: unknown) => {
        if (attuale) setErrore(inParole(causa, "Skill non letta."));
      },
    );
    return () => {
      attuale = false;
    };
  }, [voce.nome]);

  if (errore !== undefined) {
    return (
      <p className="errore" role="alert">
        {errore}
      </p>
    );
  }
  if (dettaglio === undefined) return <p className="tenue">Carico…</p>;
  return (
    <>
      <section className="testo-skill" aria-label="Testo della skill">
        <Formattato testo={dettaglio.contenuto} />
      </section>
      <h2 className="titolo-sezione">Storia</h2>
      <ol className="storia-skill">
        {dettaglio.storia.map((modifica) => (
          <VistaModifica key={modifica.id} nome={dettaglio.nome} modifica={modifica} />
        ))}
      </ol>
    </>
  );
}

function VistaModifica({ nome, modifica }: { nome: string; modifica: ModificaSkill }): ReactNode {
  const [versioni, setVersioni] = useState<VersioniSkill>();
  const [aperta, setAperta] = useState(false);
  const [daConfermare, setDaConfermare] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();
  const creazione = modifica.tipo === "creata";

  async function mostra(): Promise<void> {
    if (aperta) {
      setAperta(false);
      return;
    }
    setErrore(undefined);
    try {
      if (versioni === undefined) setVersioni(await leggiVersioni(nome, modifica.id));
      setAperta(true);
    } catch (causa) {
      setErrore(inParole(causa, "Modifica non letta."));
    }
  }

  async function annulla(): Promise<void> {
    setInCorso(true);
    setErrore(undefined);
    try {
      // La pagina si aggiorna da sé: la skill cambiata arriva dal centro.
      await annullaModifica(nome, modifica.id);
      setDaConfermare(false);
    } catch (causa) {
      setDaConfermare(false);
      setErrore(
        causa instanceof ErroreCentro && causa.stato === 404
          ? "Questa modifica non c'è più."
          : inParole(causa, "Modifica non annullata."),
      );
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className={`modifica ${modifica.tipo}`}>
      <div className="riga-modifica">
        <span className="tipo">{TIPI[modifica.tipo]}</span>
        <span className="tenue">
          {momentoInBreve(modifica.quando)} · {modifica.origine}
        </span>
      </div>
      <p className="motivo">{modifica.motivo}</p>
      {daConfermare ? (
        <div className="conferma">
          <p className="tenue">
            {creazione
              ? "La skill viene tolta, da ogni ambiente. Resta nella storia: non si perde nulla."
              : "La skill torna com'era prima di questo passaggio; anche ciò che è venuto dopo viene tolto. Resta tutto nella storia."}
          </p>
          <div className="pulsanti">
            <button type="button" disabled={inCorso} onClick={() => void annulla()}>
              {creazione ? "Conferma: togli la skill" : "Conferma: torna a prima"}
            </button>
            <button type="button" className="discreto" disabled={inCorso} onClick={() => setDaConfermare(false)}>
              Lascia com'è
            </button>
          </div>
        </div>
      ) : (
        <div className="pulsanti">
          <button type="button" className="discreto piccolo" aria-expanded={aperta} onClick={() => void mostra()}>
            {aperta ? "Nascondi" : "Vedi prima e dopo"}
          </button>
          <button type="button" className="discreto piccolo" onClick={() => setDaConfermare(true)}>
            {creazione ? "Togli la skill" : "Torna a prima"}
          </button>
        </div>
      )}
      {aperta && versioni !== undefined && (
        <div className="versioni">
          <Versione titolo="Prima" versione={versioni.prima} assente="Non esisteva." />
          <Versione titolo="Dopo" versione={versioni.dopo} assente="Tolta." />
        </div>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </li>
  );
}

function Versione({
  titolo,
  versione,
  assente,
}: {
  titolo: string;
  versione: VersioniSkill["prima"];
  assente: string;
}): ReactNode {
  return (
    <div className="versione">
      <h3>{titolo}</h3>
      {versione === undefined ? (
        <p className="tenue">{assente}</p>
      ) : (
        <>
          <p className="tenue">{versione.descrizione}</p>
          <pre>{versione.contenuto}</pre>
        </>
      )}
    </div>
  );
}
