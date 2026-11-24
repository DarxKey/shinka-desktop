/**
 * La scheda della sessione, dalla testata della chat: dove lavora la conversazione e con che cosa,
 * di che cosa è fatto il contesto, i limiti del piano, le attività (comandi in background e agenti,
 * con la loro uscita) e quanti file sono stati cambiati.
 */

import { progettoDellaConversazione } from "../../src/protocollo/incarichi.ts";
import { useQuadroCorrente } from "./Quadro.tsx";
import { frammentoDi } from "./vista.ts";
import { CartelleCollegate } from "./Collegate.tsx";
import { ChiImplementa } from "./ChiImplementa.tsx";
import { EstensioniDelProgetto } from "./EstensioniDelProgetto.tsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Attivita } from "../../src/protocollo/attivita.ts";
import type { UscitaAttivita } from "../../src/protocollo/eventi.ts";
import type { ImpostazioniConversazione, StatoConversazione } from "../../src/protocollo/impostazioni.ts";
import { cambiaImpostazioni, leggiUscitaAttivita } from "./api.ts";
import { NOMI_IMPEGNI, NOMI_PERMESSI } from "./Controlli.tsx";
import { inMigliaia, quandoRiparte } from "./descrivi.ts";

const STATI_IN_PAROLE: Record<Attivita["stato"], string> = { "in-corso": "in corso", finita: "finita", fallita: "fallita", fermata: "fermata" };

export function SchedaSessione({
  base,
  luogo,
  impostazioni,
  stato,
  attivita,
  fileCambiati,
  alPannello,
}: {
  base: string;
  /** Dove lavora la conversazione: ambiente e cartella. */
  luogo?: string;
  impostazioni: ImpostazioniConversazione | undefined;
  stato: StatoConversazione | undefined;
  attivita: readonly Attivita[];
  /** Quanti file ha cambiato il modello in questa conversazione; manca dove il pannello Modifiche non c'è. */
  fileCambiati?: number;
  alPannello?: () => void;
}): ReactNode {
  const inCorso = attivita.filter((voce) => voce.stato === "in-corso").length;
  // Un progetto può avere cartelle collegate in altri ambienti; la Home no.
  const codificato = /^\/api\/progetti\/([^/]+)$/.exec(base)?.[1];
  // In una chat parallela (ADR 0052) le scelte sono quelle del suo progetto.
  const idProgetto = codificato === undefined ? undefined : progettoDellaConversazione(decodeURIComponent(codificato));
  const contesto = stato?.contesto;
  const etichetta = inCorso > 0 ? `Sessione: ${inCorso === 1 ? "un'attività in corso" : `${inCorso} attività in corso`}` : "Sessione";
  return (
    <details className="menu-sessione">
      <summary aria-label={etichetta} title={etichetta}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 10V5.5M10 10l3.5 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {inCorso > 0 && <span className="pallino-conteggio">{inCorso}</span>}
      </summary>
      <div className="scheda-sessione" role="dialog" aria-label="La sessione">
        <section>
          <h3>Dove e con che cosa</h3>
          <dl>
            {luogo !== undefined && (
              <>
                <dt>Ambiente</dt>
                <dd>{luogo}</dd>
              </>
            )}
            <dt>Modello</dt>
            <dd>{stato?.modello ?? impostazioni?.modello ?? "predefinito"}</dd>
            {impostazioni !== undefined && (
              <>
                <dt>Effort</dt>
                <dd>{impostazioni.impegno === undefined ? "predefinito" : NOMI_IMPEGNI[impostazioni.impegno]}</dd>
                <dt>Permessi</dt>
                <dd>{NOMI_PERMESSI[impostazioni.permessi]}</dd>
                <dt>Stile</dt>
                <dd>{impostazioni.stile?.nome ?? "normale"}</dd>
              </>
            )}
          </dl>
          {idProgetto !== undefined && impostazioni !== undefined && <TuttoIlPc base={base} attivo={impostazioni.tuttoIlPc === true} />}
          {idProgetto !== undefined && <ChiImplementa idProgetto={idProgetto} modelli={stato?.modelli} />}
          {idProgetto !== undefined && <EstensioniDelProgetto idProgetto={idProgetto} />}
          {idProgetto !== undefined && <CartelleCollegate idProgetto={idProgetto} />}
          {idProgetto !== undefined && <CollegamentoAiProcessi idProgetto={idProgetto} />}
        </section>
        {contesto !== undefined && (
          <section>
            <h3>
              Contesto: {contesto.percento}% <span className="tenue">({inMigliaia(contesto.usati)} di {inMigliaia(contesto.massimo)} token)</span>
            </h3>
            {contesto.parti !== undefined && (
              <>
                <div className="barra-contesto" aria-hidden="true">
                  {contesto.parti.map((parte) => (
                    <span key={parte.nome} className={`parte ${parte.genere}`} style={{ flexGrow: parte.token }} title={`${parte.nome}: ${inMigliaia(parte.token)}`} />
                  ))}
                </div>
                <ul className="parti-contesto">
                  {contesto.parti.map((parte) => (
                    <li key={parte.nome}>
                      <span className={`pallino ${parte.genere}`} aria-hidden="true" />
                      <span>{parte.nome}</span>
                      <span className="tenue">{inMigliaia(parte.token)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {(stato?.limiti?.cinqueOre !== undefined || stato?.limiti?.setteGiorni !== undefined) && (
          <section>
            <h3>Limiti del piano</h3>
            <dl>
              {stato.limiti.cinqueOre !== undefined && (
                <>
                  <dt>5 ore</dt>
                  <dd>
                    {stato.limiti.cinqueOre.percento}% <span className="tenue">{quandoRiparte(stato.limiti.cinqueOre.azzeraIl)}</span>
                  </dd>
                </>
              )}
              {stato.limiti.setteGiorni !== undefined && (
                <>
                  <dt>7 giorni</dt>
                  <dd>
                    {stato.limiti.setteGiorni.percento}% <span className="tenue">{quandoRiparte(stato.limiti.setteGiorni.azzeraIl)}</span>
                  </dd>
                </>
              )}
            </dl>
          </section>
        )}
        {fileCambiati !== undefined && (
          <section>
            <h3>Modifiche</h3>
            <p className="riga-sessione">
              <span>{fileCambiati === 0 ? "Nessun file cambiato." : fileCambiati === 1 ? "Un file cambiato." : `${fileCambiati} file cambiati.`}</span>
              {alPannello !== undefined && fileCambiati > 0 && (
                <button
                  type="button"
                  className="mini"
                  onClick={(evento) => {
                    evento.currentTarget.closest("details")?.removeAttribute("open");
                    alPannello();
                  }}
                >
                  Apri il pannello
                </button>
              )}
            </p>
          </section>
        )}
        <section>
          <h3>Attività</h3>
          {attivita.length === 0 ? (
            <p className="tenue">Nessun comando in background e nessun agente, finora.</p>
          ) : (
            <ul className="elenco-attivita">
              {attivita.map((voce) => (
                <VoceAttivita key={voce.id} base={base} attivita={voce} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}

function VoceAttivita({ base, attivita }: { base: string; attivita: Attivita }): ReactNode {
  const [uscita, setUscita] = useState<UscitaAttivita | { motivo: string }>();
  const [aperta, setAperta] = useState(false);
  const inCorso = attivita.stato === "in-corso";
  // L'uscita aperta si rilegge mentre l'attività lavora, e una volta ancora quando finisce.
  useEffect(() => {
    if (!aperta || attivita.conUscita !== true) return;
    let valido = true;
    const leggi = (): void => {
      void leggiUscitaAttivita(base, attivita.id)
        .then((letta) => {
          if (valido) setUscita(letta);
        })
        .catch((causa: unknown) => {
          if (valido) setUscita({ motivo: causa instanceof Error ? causa.message : "L'uscita non si legge." });
        });
    };
    leggi();
    const ogni = inCorso ? window.setInterval(leggi, 2000) : undefined;
    return () => {
      valido = false;
      if (ogni !== undefined) window.clearInterval(ogni);
    };
  }, [aperta, inCorso, attivita.conUscita, attivita.id, base]);
  const genere = attivita.genere === "agente" ? `Agente${attivita.tipoAgente === undefined ? "" : ` ${attivita.tipoAgente}`}` : attivita.genere === "comando" ? "Comando" : "Attività";
  const dettagli = [
    attivita.inSfondo ? "in background" : undefined,
    attivita.strumentiUsati === undefined ? undefined : `${attivita.strumentiUsati} azioni`,
    attivita.durataMs === undefined ? undefined : `${Math.max(1, Math.round(attivita.durataMs / 1000))} s`,
    attivita.stato === "in-corso" && attivita.ultimoStrumento !== undefined ? `ora: ${attivita.ultimoStrumento}` : undefined,
  ].filter((parte) => parte !== undefined);
  return (
    <li className={`attivita ${attivita.stato}`}>
      <div className="testa-attivita">
        <span className="stato-attivita">{STATI_IN_PAROLE[attivita.stato]}</span>
        <span className="genere-attivita">{genere}</span>
        <span className="descrizione-attivita">{attivita.descrizione}</span>
      </div>
      {attivita.comando !== undefined && <pre className="comando-attivita">$ {attivita.comando}</pre>}
      {dettagli.length > 0 && <p className="tenue">{dettagli.join(" · ")}</p>}
      {attivita.riassunto !== undefined && <p className="riassunto-attivita">{attivita.riassunto}</p>}
      {attivita.conUscita === true && (
        <button type="button" className="mini discreto" onClick={() => setAperta((prima) => !prima)}>
          {aperta ? "Nascondi l'uscita" : inCorso ? "Segui l'uscita" : "Mostra l'uscita"}
        </button>
      )}
      {aperta && uscita !== undefined && "motivo" in uscita && <p className="errore">{uscita.motivo}</p>}
      {aperta && uscita !== undefined && "testo" in uscita && <UscitaInFondo uscita={uscita} inCorso={inCorso} />}
    </li>
  );
}

/** L'uscita di un'attività, che resta in fondo mentre cresce, se chi legge non è risalito. */
function UscitaInFondo({ uscita, inCorso }: { uscita: UscitaAttivita; inCorso: boolean }): ReactNode {
  const riquadro = useRef<HTMLPreElement>(null);
  const inFondo = useRef(true);
  useEffect(() => {
    const elemento = riquadro.current;
    if (elemento !== null && inFondo.current) elemento.scrollTop = elemento.scrollHeight;
  }, [uscita.testo]);
  return (
    <pre
      ref={riquadro}
      className="uscita-attivita"
      onScroll={(evento) => {
        const elemento = evento.currentTarget;
        inFondo.current = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 24;
      }}
    >
      {uscita.troncata ? "…\n" : ""}
      {uscita.testo === "" ? (inCorso ? "(ancora nessuna uscita)" : "(nessuna uscita)") : uscita.testo}
    </pre>
  );
}

/**
 * Tutto il computer come la cartella del progetto: leggere e modificare file ovunque segue il modo
 * dei permessi come dentro la cartella. I comandi chiedono come sempre.
 */
function TuttoIlPc({ base, attivo }: { base: string; attivo: boolean }): ReactNode {
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  return (
    <div className="tutto-il-pc">
      <label>
        <input
          type="checkbox"
          checked={attivo}
          disabled={lavoro}
          onChange={(evento) => {
            setLavoro(true);
            setErrore(undefined);
            void cambiaImpostazioni(base, { tuttoIlPc: evento.target.checked })
              .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è cambiato."))
              .finally(() => setLavoro(false));
          }}
        />
        Accesso a tutto il computer
      </label>
      <p className="tenue">
        {attivo
          ? "Legge e modifica file anche fuori dalla sua cartella, con le stesse regole dei permessi che valgono dentro."
          : "Fuori dalla sua cartella chiede il permesso per ogni file. «Approva sempre» lo salva per una regola sola."}
      </p>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Dalla scheda di un progetto ai processi che vi ha acceso Shinka, nella pagina del suo ambiente. */
function CollegamentoAiProcessi({ idProgetto }: { idProgetto: string }): ReactNode {
  const quadro = useQuadroCorrente();
  const idAmbiente = quadro.progetti?.progetti.find((progetto) => progetto.id === idProgetto)?.idAmbiente;
  if (idAmbiente === undefined) return null;
  return (
    <p className="processi-del-progetto">
      <a href={frammentoDi({ tipo: "ambiente", id: idAmbiente })}>Processi, risorse e termina…</a>
    </p>
  );
}
