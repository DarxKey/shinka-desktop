/**
 * La pagina Sicurezza (ADR 0039): le sessioni aperte del proprietario, da chiudere una per una o
 * tutte insieme, i dispositivi con un gettone loro, come Shinka Desktop (ADR 0047), e il registro
 * delle richieste al centro: chi è entrato, da dove, e chi ha provato senza riuscirci. In mezzo, il collegamento dei nodi con il centro (ADR 0040): quali sono cifrati,
 * e la scelta di accettare solo quelli.
 */

import { PostoEstensioni } from "./Interfaccia.tsx";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  accessoInParole,
  DA_GUARDARE,
  settimanaInBreve,
  type DispositivoInVista,
  type SessioneInVista,
  type StatoSicurezza,
  type VoceAccesso,
} from "../../src/protocollo/sicurezza.ts";
import type { Ambiente } from "../../src/protocollo/nodi.ts";
import { accettaSoloNodiCifrati, chiudiLeAltreSessioni, chiudiSessione, leggiSicurezza, togliDispositivo } from "./api.ts";
import { momentoInBreve, oraInBreve } from "./descrivi.ts";

export function PaginaSicurezza({ menu, ambienti }: { menu: ReactNode; ambienti: readonly Ambiente[] }): ReactNode {
  const [stato, setStato] = useState<StatoSicurezza>();
  const [soloDaGuardare, setSoloDaGuardare] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [lavoro, setLavoro] = useState(false);

  const carica = useCallback(async (solo: boolean) => {
    try {
      setStato(await leggiSicurezza(solo));
      setErrore(undefined);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non riesco a leggere il registro.");
    }
  }, []);
  useEffect(() => {
    document.title = "Sicurezza · Shinka";
  }, []);
  useEffect(() => {
    void carica(soloDaGuardare);
  }, [carica, soloDaGuardare]);

  async function fai(azione: () => Promise<unknown>): Promise<void> {
    setLavoro(true);
    try {
      await azione();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è riuscito.");
    } finally {
      setLavoro(false);
      await carica(soloDaGuardare);
    }
  }

  const settimana = settimanaInBreve(stato?.voci ?? []);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Sicurezza</h1>
          <span className="sottotitolo">Chi è dentro Shinka, e chi ha bussato</span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-sicurezza">
          <PostoEstensioni posto="sicurezza" qui={{ tipo: "sicurezza" }} />
          {errore !== undefined && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          {stato === undefined && errore === undefined && <p className="tenue">Carico…</p>}
          {stato !== undefined && (
            <>
              <section aria-labelledby="titolo-sessioni">
                <h2 className="titolo-sezione" id="titolo-sessioni">
                  Sessioni aperte
                </h2>
                <p className="tenue">
                  I browser e i telefoni che sono dentro Shinka con la tua password. Chiuderne una fa uscire quel dispositivo: per rientrare serve la
                  password.
                </p>
                <ul className="elenco-sessioni">
                  {stato.sessioni.map((sessione) => (
                    <Sessione
                      key={sessione.id}
                      sessione={sessione}
                      questa={sessione.id === stato.questa}
                      lavoro={lavoro}
                      allaChiusura={() => void fai(() => chiudiSessione(sessione.id))}
                    />
                  ))}
                </ul>
                {stato.sessioni.length > 1 && (
                  <div className="pulsanti">
                    <button type="button" className="discreto" disabled={lavoro} onClick={() => void fai(chiudiLeAltreSessioni)}>
                      Chiudi tutte le altre
                    </button>
                  </div>
                )}
              </section>

              {(stato.dispositivi?.length ?? 0) > 0 && (
                <section aria-labelledby="titolo-dispositivi">
                  <h2 className="titolo-sezione" id="titolo-dispositivi">
                    Dispositivi
                  </h2>
                  <p className="tenue">
                    Le app, come Shinka Desktop, che sono entrate una volta con la tua password e da lì usano un gettone loro. Un gettone vale finché
                    viene usato e decade dopo novanta giorni fermo; cambiare la password li toglie tutti. Toglierne uno lo fa uscire subito.
                  </p>
                  <ul className="elenco-sessioni">
                    {(stato.dispositivi ?? []).map((dispositivo) => (
                      <Dispositivo
                        key={dispositivo.id}
                        dispositivo={dispositivo}
                        questo={dispositivo.id === stato.questoDispositivo}
                        lavoro={lavoro}
                        allaRimozione={() => void fai(() => togliDispositivo(dispositivo.id))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {stato.nodi !== undefined && (
                <CollegamentoDeiNodi
                  nodi={stato.nodi}
                  ambienti={ambienti.filter((ambiente) => !ambiente.delCentro)}
                  lavoro={lavoro}
                  allaScelta={(soloCifrati) => void fai(() => accettaSoloNodiCifrati(soloCifrati))}
                />
              )}

              <section aria-labelledby="titolo-registro">
                <h2 className="titolo-sezione" id="titolo-registro">
                  Registro delle richieste
                </h2>
                <p className="tenue">
                  Chi è entrato, da dove, e ciò che è arrivato a Shinka senza riuscire: una password sbagliata, una richiesta senza essere entrati, una
                  pagina che non c'è. Delle richieste si tiene l'indirizzo e il percorso, mai il contenuto.
                </p>
                {!soloDaGuardare && (
                  <p className="settimana-sicurezza">
                    Negli ultimi sette giorni: <strong>{settimana.entrate}</strong> {settimana.entrate === 1 ? "entrata" : "entrate"},{" "}
                    <strong className={settimana.falliti > 0 ? "da-guardare" : undefined}>{settimana.falliti}</strong>{" "}
                    {settimana.falliti === 1 ? "tentativo non riuscito" : "tentativi non riusciti"}.
                  </p>
                )}
                <div className="filtri-sicurezza">
                  <label>
                    <input type="checkbox" checked={soloDaGuardare} onChange={(evento) => setSoloDaGuardare(evento.target.checked)} /> Solo ciò che merita
                    uno sguardo
                  </label>
                  <button type="button" className="discreto piccolo" disabled={lavoro} onClick={() => void carica(soloDaGuardare)}>
                    Aggiorna
                  </button>
                </div>
                {stato.voci.length === 0 ? (
                  <p className="tenue">{soloDaGuardare ? "Nulla da guardare." : "Il registro è ancora vuoto."}</p>
                ) : (
                  <ul className="registro-richieste">
                    {stato.voci.map((voce, indice) => (
                      <Voce key={`${voce.quando}-${voce.tipo}-${indice}`} voce={voce} />
                    ))}
                  </ul>
                )}
                <p className="tenue nota-sicurezza">
                  «Per conto di» è l'indirizzo che il proxy davanti a Shinka dichiara per chi arriva da fuori: vale quanto il proxy. Se da fuori vedi
                  sempre e solo l'indirizzo del firewall, è il firewall che non lo passa.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** L'impronta a gruppi di quattro, per confrontarla a occhio con quella scritta su un nodo. */
function improntaLeggibile(impronta: string): string {
  return (impronta.match(/.{1,4}/g) ?? []).join(" ");
}

function CollegamentoDeiNodi({
  nodi,
  ambienti,
  lavoro,
  allaScelta,
}: {
  nodi: NonNullable<StatoSicurezza["nodi"]>;
  ambienti: readonly Ambiente[];
  lavoro: boolean;
  allaScelta: (soloCifrati: boolean) => void;
}): ReactNode {
  const [daConfermare, setDaConfermare] = useState(false);
  const inChiaro = ambienti.filter((ambiente) => ambiente.attivo && ambiente.cifrato === false);
  return (
    <section aria-labelledby="titolo-nodi">
      <h2 className="titolo-sezione" id="titolo-nodi">
        Collegamento dei nodi
      </h2>
      <p className="tenue">
        Ciò che il centro e i nodi degli altri ambienti si dicono viaggia cifrato: ogni nodo riconosce il centro dal suo certificato e non parla con
        nessun altro. Un nodo di una versione di prima si collega ancora in chiaro, finché non si aggiorna.
      </p>
      {ambienti.length === 0 ? (
        <p className="tenue">Non ci sono altri ambienti oltre a quello del centro.</p>
      ) : (
        <ul className="elenco-nodi-sicurezza">
          {ambienti.map((ambiente) => (
            <li key={ambiente.id}>
              <span className="nome">{ambiente.nome}</span>
              {!ambiente.attivo ? (
                <span className="tenue">spento</span>
              ) : ambiente.cifrato === false ? (
                <span className="da-guardare">in chiaro</span>
              ) : (
                <span className="cifrato">cifrato</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="scelta-sicurezza">
        <input
          type="checkbox"
          checked={nodi.soloCifrati}
          disabled={lavoro}
          onChange={(evento) => {
            // Con un nodo collegato in chiaro la scelta lo lascia fuori: prima si chiede.
            if (evento.target.checked && inChiaro.length > 0) setDaConfermare(true);
            else allaScelta(evento.target.checked);
          }}
        />{" "}
        Accetta solo i nodi con il collegamento cifrato
      </label>
      {daConfermare && (
        <div className="conferma-sicurezza" role="alertdialog" aria-label="Accettare solo i collegamenti cifrati">
          <p>
            {inChiaro.length === 1 ? `«${inChiaro[0]?.nome}» è collegato` : `${inChiaro.map((ambiente) => `«${ambiente.nome}»`).join(", ")} sono collegati`} in
            chiaro: con questa scelta resta fuori finché non passa al collegamento cifrato. Se è a una versione di prima, aggiornalo adesso dalla
            pagina Ambienti: da fuori il centro non lo potrà più aggiornare.
          </p>
          <div className="pulsanti">
            <button
              type="button"
              className="mini pericolo"
              disabled={lavoro}
              onClick={() => {
                setDaConfermare(false);
                allaScelta(true);
              }}
            >
              Accetta solo i cifrati
            </button>
            <button type="button" className="mini discreto" onClick={() => setDaConfermare(false)}>
              No
            </button>
          </div>
        </div>
      )}
      <p className="tenue nota-sicurezza">
        {nodi.soloCifrati
          ? "Un nodo che prova a collegarsi in chiaro non viene ascoltato, e compare nel registro qui sotto."
          : "Accendila quando tutti i nodi sono cifrati: da lì un collegamento in chiaro non viene più ascoltato."}
        {nodi.impronta !== undefined && (
          <>
            {" "}
            Impronta del certificato dei nodi: <span className="indirizzo">{improntaLeggibile(nodi.impronta)}</span>
          </>
        )}
      </p>
    </section>
  );
}

function Sessione({ sessione, questa, lavoro, allaChiusura }: { sessione: SessioneInVista; questa: boolean; lavoro: boolean; allaChiusura: () => void }): ReactNode {
  const altrove = sessione.vistaDa !== undefined && sessione.vistaDa !== sessione.da;
  return (
    <li className={questa ? "sessione questa" : "sessione"}>
      <div className="riga-sessione">
        <span className="nome">{sessione.programma ?? "Un browser"}</span>
        {questa && <span className="marca-sessione">questa</span>}
        {!questa && (
          <button type="button" className="discreto piccolo" disabled={lavoro} onClick={allaChiusura}>
            Chiudi
          </button>
        )}
      </div>
      <span className="tenue">
        {sessione.apertaIl === undefined ? "Aperta prima che Shinka lo annotasse" : `Aperta ${momentoInBreve(sessione.apertaIl)}`}
        {sessione.da !== undefined && <> da <span className="indirizzo">{sessione.da}</span></>}
      </span>
      {sessione.vistaIl !== undefined && (
        <span className="tenue">
          Usata l'ultima volta {momentoInBreve(sessione.vistaIl)}
          {altrove && <> da <span className="indirizzo">{sessione.vistaDa}</span></>}
        </span>
      )}
    </li>
  );
}

const NOMI_DEI_GENERI: Record<DispositivoInVista["genere"], string> = { desktop: "App per il computer" };

function Dispositivo({
  dispositivo,
  questo,
  lavoro,
  allaRimozione,
}: {
  dispositivo: DispositivoInVista;
  questo: boolean;
  lavoro: boolean;
  allaRimozione: () => void;
}): ReactNode {
  const [daConfermare, setDaConfermare] = useState(false);
  const altrove = dispositivo.vistoDa !== undefined && dispositivo.vistoDa !== dispositivo.da;
  return (
    <li className={questo ? "sessione questa" : "sessione"}>
      <div className="riga-sessione">
        <span className="nome">{dispositivo.nome}</span>
        {questo && <span className="marca-sessione">questo</span>}
        {!daConfermare ? (
          <button type="button" className="discreto piccolo" disabled={lavoro} onClick={() => setDaConfermare(true)}>
            Togli
          </button>
        ) : (
          <span className="pulsanti">
            <button type="button" className="piccolo pericolo" disabled={lavoro} onClick={allaRimozione}>
              Togli davvero
            </button>
            <button type="button" className="discreto piccolo" disabled={lavoro} onClick={() => setDaConfermare(false)}>
              No
            </button>
          </span>
        )}
      </div>
      <span className="tenue">
        {NOMI_DEI_GENERI[dispositivo.genere] ?? dispositivo.genere}
        {dispositivo.programma !== undefined && <> · {dispositivo.programma}</>}
      </span>
      <span className="tenue">
        Aggiunto {momentoInBreve(dispositivo.aggiuntoIl)}
        {dispositivo.da !== undefined && <> da <span className="indirizzo">{dispositivo.da}</span></>}
      </span>
      {dispositivo.vistoIl !== undefined && (
        <span className="tenue">
          Usato l'ultima volta {momentoInBreve(dispositivo.vistoIl)}
          {altrove && <> da <span className="indirizzo">{dispositivo.vistoDa}</span></>}
        </span>
      )}
    </li>
  );
}

function Voce({ voce }: { voce: VoceAccesso }): ReactNode {
  const daGuardare = DA_GUARDARE.includes(voce.tipo);
  // Di una cosa ripetuta si dice fino a quando, se non è finita nello stesso minuto.
  const fino = voce.finoA === undefined || oraInBreve(voce.finoA) === oraInBreve(voce.quando) ? "" : `–${oraInBreve(voce.finoA)}`;
  const quando = `${momentoInBreve(voce.quando)}${fino}`;
  return (
    <li className={daGuardare ? "voce-registro da-guardare" : "voce-registro"}>
      <div className="riga-registro">
        <span className="cosa">
          {accessoInParole(voce.tipo)}
          {voce.volte !== undefined && voce.volte > 1 && <span className="volte"> × {voce.volte}</span>}
        </span>
        <span className="quando tenue">{quando}</span>
      </div>
      <span className="tenue">
        <span className="indirizzo">{voce.da}</span>
        {voce.programma !== undefined && <> · {voce.programma}</>}
      </span>
      {(voce.percorso !== undefined || voce.dettaglio !== undefined) && (
        <span className="tenue">
          {voce.percorso !== undefined && <span className="indirizzo">{voce.percorso}</span>}
          {voce.percorso !== undefined && voce.dettaglio !== undefined && " · "}
          {voce.dettaglio}
        </span>
      )}
    </li>
  );
}
