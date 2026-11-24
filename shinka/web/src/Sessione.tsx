/**
 * La scheda della sessione, dalla testata della chat: dove lavora la conversazione e con che cosa,
 * di che cosa è fatto il contesto, i limiti del piano, le attività (comandi in background e agenti,
 * con la loro uscita) e quanti file sono stati cambiati.
 */

import { CartelleCollegate } from "./Collegate.tsx";
import { ChiImplementa } from "./ChiImplementa.tsx";
import { useState, type ReactNode } from "react";
import type { Attivita } from "../../src/protocollo/attivita.ts";
import type { UscitaAttivita } from "../../src/protocollo/eventi.ts";
import type { ImpostazioniConversazione, StatoConversazione } from "../../src/protocollo/impostazioni.ts";
import { leggiUscitaAttivita } from "./api.ts";
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
  const idProgetto = codificato === undefined ? undefined : decodeURIComponent(codificato);
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
          {idProgetto !== undefined && <ChiImplementa idProgetto={idProgetto} modelli={stato?.modelli} />}
          {idProgetto !== undefined && <CartelleCollegate idProgetto={idProgetto} />}
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
      {dettagli.length > 0 && <p className="tenue">{dettagli.join(" · ")}</p>}
      {attivita.riassunto !== undefined && <p className="riassunto-attivita">{attivita.riassunto}</p>}
      {attivita.conUscita === true && uscita === undefined && (
        <button
          type="button"
          className="mini discreto"
          onClick={() =>
            void leggiUscitaAttivita(base, attivita.id)
              .then(setUscita)
              .catch((causa: unknown) => setUscita({ motivo: causa instanceof Error ? causa.message : "L'uscita non si legge." }))
          }
        >
          Mostra l'uscita
        </button>
      )}
      {uscita !== undefined && "motivo" in uscita && <p className="errore">{uscita.motivo}</p>}
      {uscita !== undefined && "testo" in uscita && (
        <pre className="uscita-attivita">
          {uscita.troncata ? "…\n" : ""}
          {uscita.testo === "" ? "(nessuna uscita)" : uscita.testo}
        </pre>
      )}
    </li>
  );
}
