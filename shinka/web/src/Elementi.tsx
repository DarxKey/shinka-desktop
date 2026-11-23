import { Children, isValidElement, memo, useEffect, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import type { PluggableList } from "unified";
import { useAspetto } from "./aspetto.ts";
import { BloccoCodice, PulsanteCopia } from "./Codice.tsx";
import { SchedaCoseDaFare, TestoDelPiano } from "./Piano.tsx";
import { STRUMENTO_PIANO } from "./gruppi.ts";
import { haFormule } from "./formule.ts";
import remarkGfm from "remark-gfm";
import type { DecisionePermesso } from "../../src/protocollo/eventi.ts";
import { decidiApprovazione, decidiPermesso, inviaMessaggio, leggiAzione } from "./api.ts";
import { useApriAnteprima, useApriModifiche, useBaseDellaChat, useModifiche, useSolaLettura } from "./ContestoChat.ts";
import { ModificaMessaggio } from "./Modifica.tsx";
import { anteprimaProposta, comandoSuHost, dettaglioDi, etichettaDi, oraInBreve } from "./descrivi.ts";
import { SchedaDomande } from "./Domande.tsx";
import { SchedaElaborato } from "./Elaborati.tsx";
import { SchedaEstensione } from "./Estensioni.tsx";
import { esitoDi, riassuntoDi, type Azione, type Gruppo, type Voce } from "./gruppi.ts";
import { ImmagineNelTesto, Immagini } from "./Immagini.tsx";
import { disposizioneImmagini } from "./immagini-nel-testo.ts";
import { SchedaProposta } from "./Proposta.tsx";
import { InstallazioneConclusa, SchedaInstallazione, SchedaSviluppo } from "./Sviluppo.tsx";
import type { Elemento } from "./stato.ts";
import { conGliACapo } from "./scrittura.ts";
import { frammentoDi } from "./vista.ts";

/**
 * I collegamenti si aprono in un'altra scheda. Le immagini scritte nel testo con un indirizzo https
 * le passa il centro (ADR 0043); le altre non si caricano. Un paragrafo o una voce di elenco che
 * comincia con un'immagine diventa una scheda, con la foto a sinistra e il testo accanto; uno fatto
 * solo di immagini le mostra più grandi.
 */
const COMPONENTI_MARKDOWN: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ alt, src }) => <ImmagineNelTesto indirizzo={typeof src === "string" ? src : undefined} testo={alt ?? ""} />,
  p: ({ node, children }) => {
    const disposizione = disposizioneImmagini(node);
    return <p className={disposizione}>{disposizione === "con-immagine" ? inScheda(children) : children}</p>;
  },
  li: ({ node, children, className }) => {
    const disposizione = disposizioneImmagini(node);
    return (
      <li className={[className, disposizione].filter((classe) => classe !== undefined && classe !== "").join(" ") || undefined}>
        {disposizione === "con-immagine" ? inScheda(children) : children}
      </li>
    );
  },
  // Un blocco di codice ha la sua scheda: linguaggio, colori della sintassi, Copia; un diagramma si disegna.
  pre: ({ children }) => {
    const codice = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children.props : undefined;
    if (codice === undefined) return <pre>{children}</pre>;
    const linguaggio = /language-([\w+#.-]+)/.exec(codice.className ?? "")?.[1]?.toLowerCase() ?? "";
    return <BloccoCodice codice={String(codice.children ?? "").replace(/\n$/, "")} linguaggio={linguaggio} />;
  },
};

/**
 * Una scheda: l'immagine, poi il resto in una colonna sua, che resta accanto alla foto anche
 * quando il testo è più lungo. L'immagine è il primo figlio che non è uno spazio.
 */
function inScheda(children: ReactNode): ReactNode {
  const figli = Children.toArray(children);
  const posto = figli.findIndex((figlio) => !(typeof figlio === "string" && figlio.trim() === ""));
  if (posto < 0) return children;
  return (
    <>
      {figli[posto]}
      <span className="testo-della-scheda">{figli.slice(posto + 1)}</span>
    </>
  );
}

/** I plugin delle formule, una volta caricati: si caricano la prima volta che una risposta ne contiene. */
let pluginMatematica: { remark: PluggableList; rehype: PluggableList } | undefined;
let caricamentoMatematica: Promise<void> | undefined;

function useMatematica(serve: boolean): typeof pluginMatematica {
  const [, setPronti] = useState(pluginMatematica !== undefined);
  useEffect(() => {
    if (!serve || pluginMatematica !== undefined) return;
    caricamentoMatematica ??= import("./matematica.ts").then((modulo) => {
      pluginMatematica = { remark: [...modulo.pluginRemark] as PluggableList, rehype: [...modulo.pluginRehype] as PluggableList };
    });
    let valido = true;
    void caricamentoMatematica.then(() => valido && setPronti(true));
    return () => {
      valido = false;
    };
  }, [serve]);
  return serve ? pluginMatematica : undefined;
}

/** Un testo scritto da Claude, con la sua formattazione: codice, tabelle, formule e diagrammi. */
export function Formattato({ testo }: { testo: string }): ReactNode {
  const matematica = useMatematica(haFormule(testo));
  return (
    <Markdown
      remarkPlugins={[remarkGfm, ...(matematica?.remark ?? [])]}
      rehypePlugins={matematica?.rehype ?? []}
      components={COMPONENTI_MARKDOWN}
    >
      {testo}
    </Markdown>
  );
}

export const VistaVoce = memo(function VistaVoce({ voce }: { voce: Voce }): ReactNode {
  switch (voce.tipo) {
    case "proprietario":
      return <MessaggioDelProprietario voce={voce} />;
    case "testo":
      return <RispostaDiClaude voce={voce} />;
    default:
      return <AltraVoce voce={voce} />;
  }
});

/** Un messaggio del proprietario: con "Modifica", se la conversazione può ripartire da lì. */
function MessaggioDelProprietario({ voce }: { voce: Extract<Elemento, { tipo: "proprietario" }> }): ReactNode {
  const { occupata } = useModifiche();
  const solaLettura = useSolaLettura();
  const [inModifica, setInModifica] = useState(false);
  if (inModifica) {
    return (
      <div className="riga proprietario">
        <ModificaMessaggio idMessaggio={voce.chiave} testoIniziale={voce.testo} allaChiusura={() => setInModifica(false)} />
      </div>
    );
  }
  return (
        <div className="riga proprietario">
          <div className="fumetto">
            <Immagini immagini={voce.immagini} />
            {voce.file !== undefined && (
              <ul className="file-allegati">
                {voce.file.map((nome) => (
                  <li key={nome}>{nome}</li>
                ))}
              </ul>
            )}
            {/* Ciò che il proprietario scrive si mostra con i suoi a capo e i suoi elenchi. */}
            {voce.testo !== "" && <Formattato testo={conGliACapo(voce.testo)} />}
          </div>
          {voce.daTelegram === true && <span className="origine-messaggio">da Telegram</span>}
          {voce.programmato === true && <span className="origine-messaggio">lavoro programmato, partito da solo</span>}
          {voce.modificabile === true && !solaLettura && !occupata && (
            <div className="azioni-messaggio">
              <PulsanteCopia testo={voce.testo} etichetta="Copia il messaggio" />
              <button type="button" className="copia" onClick={() => setInModifica(true)}>
                Modifica
              </button>
            </div>
          )}
        </div>
  );
}

/** Una risposta di Claude: con Copia, e con Rigenera se è l'ultima e si può ripartire dal messaggio che la precede. */
function RispostaDiClaude({ voce }: { voce: Extract<Elemento, { tipo: "testo" }> }): ReactNode {
  const { occupata, ultimoModificabile, ultimaRisposta } = useModifiche();
  const solaLettura = useSolaLettura();
  const [rigenera, setRigenera] = useState(false);
  return (
        <div className={voce.concluso ? "riga claude" : "riga claude in-arrivo"}>
          <Formattato testo={voce.testo} />
          {voce.concluso && voce.testo.trim() !== "" && (
            <div className="azioni-risposta">
              <PulsanteCopia testo={voce.testo} etichetta="Copia la risposta" />
              {voce.chiave === ultimaRisposta && ultimoModificabile !== undefined && !occupata && !solaLettura && !rigenera && (
                <button type="button" className="copia" onClick={() => setRigenera(true)}>
                  Rigenera
                </button>
              )}
            </div>
          )}
          {rigenera && ultimoModificabile !== undefined && (
            <ModificaMessaggio idMessaggio={ultimoModificabile.id} testoIniziale={ultimoModificabile.testo} allaChiusura={() => setRigenera(false)} />
          )}
        </div>
  );
}

function AltraVoce({ voce }: { voce: Exclude<Voce, { tipo: "proprietario" | "testo" }> }): ReactNode {
  switch (voce.tipo) {
    case "azione":
      return <VistaAzione azione={voce} />;
    case "gruppo":
      return <VistaGruppo gruppo={voce} />;
    case "proposta":
      return <SchedaProposta proposta={voce} />;
    case "scelta":
      return <SchedaScelta scelta={voce} />;
    case "domande":
      return <SchedaDomande elemento={voce} />;
    case "ragionamento":
      return (
        <details className="riga ragionamento">
          <summary>Ragionamento</summary>
          <div className="testo-ragionamento">
            <Formattato testo={voce.testo} />
          </div>
        </details>
      );
    case "cose-da-fare":
      return <SchedaCoseDaFare scheda={voce} />;
    case "approvazione":
      return <SchedaApprovazione approvazione={voce} />;
    case "sviluppo":
      return <SchedaSviluppo sviluppo={voce} />;
    case "estensione":
      return <SchedaEstensione proposta={voce} />;
    case "installazione":
      return <SchedaInstallazione installazione={voce} />;
    case "installata":
      return <InstallazioneConclusa installata={voce} />;
    case "passaggio":
      return (
        <div className="riga passaggio">
          <span>
            {voce.ramo === true ? "Da qui un argomento nuovo, con la storia fin qui" : voce.riaperto ? "Argomento ripreso" : "Nuovo argomento"}
            {voce.archiviato !== undefined && (
              <>
                {voce.ramo === true ? " · com'era continuato è archiviato: " : " · il precedente è archiviato: "}
                <a href={frammentoDi({ tipo: "argomento", id: voce.archiviato.id })}>{voce.archiviato.titolo}</a>
              </>
            )}
          </span>
        </div>
      );
    case "archiviato":
      return (
        <div className="riga passaggio">
          <span>
            Argomento archiviato come «{voce.titolo}»
            {voce.proseguito && ": la richiesta che lo ha chiuso è passata all'argomento successivo"}
          </span>
        </div>
      );
    case "avviso":
      return (
        <div className="riga avviso" role="alert">
          {voce.testo}
        </div>
      );
    case "nota":
      return <div className="riga nota">{voce.testo}</div>;
    case "modifiche":
      return <SchedaModifiche voce={voce} />;
    case "elaborato":
      return <SchedaElaborato riferimento={voce} />;
  }
}

/** Le due risposte alla domanda su dove fare un lavoro: sono messaggi come quelli scritti a mano. */
const QUI = "Fallo qui nella Home.";
const IN_UN_PROGETTO = "Apri un progetto.";

/** La Home non sa se un lavoro merita un progetto, e lo chiede: due pulsanti, o una risposta scritta. */
function SchedaScelta({ scelta }: { scelta: Extract<Elemento, { tipo: "scelta" }> }): ReactNode {
  const base = useBaseDellaChat();
  const solaLettura = useSolaLettura();
  const [inviata, setInviata] = useState(false);
  const [errore, setErrore] = useState<string>();

  if (scelta.superata || solaLettura) {
    return <div className="riga nota">La Home ha chiesto dove fare questo lavoro: {scelta.lavoro}</div>;
  }

  async function rispondi(testo: string): Promise<void> {
    setInviata(true);
    setErrore(undefined);
    try {
      await inviaMessaggio(base, testo);
    } catch (causa) {
      setInviata(false);
      setErrore(causa instanceof Error ? causa.message : "Risposta non inviata.");
    }
  }

  return (
    <div className="riga proposta scelta">
      <div className="intestazione">Dove lo facciamo?</div>
      <div className="lavoro">{scelta.lavoro}</div>
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inviata} onClick={() => void rispondi(QUI)}>
          Qui nella Home
        </button>
        <button type="button" disabled={inviata} onClick={() => void rispondi(IN_UN_PROGETTO)}>
          In un progetto
        </button>
      </div>
      <div className="tenue">Nella Home il lavoro si chiude in questa seduta; un progetto ha una cartella e una conversazione sue.</div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

const APPROVAZIONE_DECISA = {
  approvata: "Comando approvato da te",
  negata: "Comando negato: non è stato eseguito",
  scaduta: "Approvazione scaduta: il comando non è stato eseguito",
} as const;

const PROGRAMMATO_DECISO = {
  approvata: "Lavoro programmato, con il tuo sì",
  negata: "Lavoro non programmato: l'hai annullato",
  scaduta: "Tempo scaduto: il lavoro non è stato programmato",
} as const;

const CREDENZIALE_DECISA = {
  approvata: "Credenziale in chiaro salvata nel vault, con il tuo sì",
  negata: "Credenziale non salvata: l'hai negata",
  scaduta: "Tempo scaduto: la credenziale non è stata salvata",
} as const;

/**
 * Claude chiede di eseguire un comando su un host del proprietario, fuori dagli stack di Shinka.
 * La scheda mostra il comando com'è scritto: è quello, e solo quello, che l'approvazione fa partire.
 */
function SchedaApprovazione({ approvazione }: { approvazione: Extract<Elemento, { tipo: "approvazione" }> }): ReactNode {
  const solaLettura = useSolaLettura();
  const [inviata, setInviata] = useState<"approvata" | "negata">();
  const [errore, setErrore] = useState<string>();
  const [fuoriTempo, setFuoriTempo] = useState(() => Date.parse(approvazione.scadeIl) <= Date.now());
  const inAttesa = approvazione.esito === undefined;

  // Allo scadere i pulsanti si spengono da soli, anche se il centro non lo ha ancora detto.
  useEffect(() => {
    if (!inAttesa) return;
    const mancano = Date.parse(approvazione.scadeIl) - Date.now();
    if (!(mancano > 0)) {
      setFuoriTempo(true);
      return;
    }
    const sveglia = setTimeout(() => setFuoriTempo(true), mancano);
    return () => clearTimeout(sveglia);
  }, [inAttesa, approvazione.scadeIl]);

  async function decidi(decisione: "approvata" | "negata"): Promise<void> {
    setInviata(decisione);
    setErrore(undefined);
    try {
      await decidiApprovazione(approvazione.chiave, decisione);
    } catch (causa) {
      setInviata(undefined);
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    }
  }

  const dove = (
    <div className="tenue dove">
      con <strong>{approvazione.credenziale}</strong> su <strong>{approvazione.host}</strong>
    </div>
  );

  if (approvazione.genere === "programmato") {
    const decisa = !inAttesa || solaLettura || fuoriTempo;
    return (
      <div
        className={decisa ? `riga proposta approvazione decisa ${approvazione.esito ?? "scaduta"}` : "riga proposta approvazione"}
        role="group"
        aria-label="Lavoro programmato da confermare"
      >
        <div className="intestazione">{decisa ? PROGRAMMATO_DECISO[approvazione.esito ?? "scaduta"] : "Programmare questo lavoro?"}</div>
        {!decisa && (
          <div>
            Partirà da solo, anche quando non ci sei, con i permessi che questa conversazione avrà in quel momento. Lo ritrovi, lo cambi e lo
            togli dalla pagina <a href={frammentoDi({ tipo: "programmati" })}>Programmati</a>.
          </div>
        )}
        <div className="tenue dove">
          <strong>{approvazione.credenziale}</strong> · {approvazione.host}
        </div>
        <pre className="comando">{approvazione.comando}</pre>
        {!decisa && (
          <>
            <div className="pulsanti">
              <button type="button" className="approva" disabled={inviata !== undefined} onClick={() => void decidi("approvata")}>
                {inviata === "approvata" ? "Programmo…" : "Programma"}
              </button>
              <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negata")}>
                Annulla
              </button>
            </div>
            <div className="tenue">Hai tempo fino alle {oraInBreve(approvazione.scadeIl)} per decidere.</div>
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

  if (approvazione.genere === "credenziale") {
    const decisa = !inAttesa || solaLettura || fuoriTempo;
    return (
      <div
        className={decisa ? `riga proposta approvazione decisa ${approvazione.esito ?? "scaduta"}` : "riga proposta approvazione"}
        role="group"
        aria-label="Credenziale in chiaro da salvare"
      >
        <div className="intestazione">{decisa ? CREDENZIALE_DECISA[approvazione.esito ?? "scaduta"] : "Salvare questa credenziale in chiaro?"}</div>
        {!decisa && (
          <div>
            Claude propone di salvarla nel vault come credenziale in chiaro: potrà rileggerne il valore, che resta nell'archivio di questa
            conversazione. Vale solo dove è scritto qui. Salvala solo se è di prova o a basso rischio.
          </div>
        )}
        <div className="tenue dove">
          <strong>{approvazione.credenziale}</strong> · vale per <strong>{approvazione.host}</strong>
        </div>
        <div>{approvazione.comando}</div>
        {!decisa && (
          <>
            <div className="pulsanti">
              <button type="button" className="approva" disabled={inviata !== undefined} onClick={() => void decidi("approvata")}>
                {inviata === "approvata" ? "Salvo…" : "Salva nel vault"}
              </button>
              <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negata")}>
                Non salvarla
              </button>
            </div>
            <div className="tenue">Hai tempo fino alle {oraInBreve(approvazione.scadeIl)}: dopo, non viene salvata.</div>
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

  if (!inAttesa || solaLettura || fuoriTempo) {
    const esito = approvazione.esito ?? "scaduta";
    return (
      <div className={`riga proposta approvazione decisa ${esito}`}>
        <div className="intestazione">{APPROVAZIONE_DECISA[esito]}</div>
        {dove}
        <pre className="comando">{approvazione.comando}</pre>
      </div>
    );
  }

  if (approvazione.alGateway === true) {
    return (
      <div className="riga proposta approvazione" role="group" aria-label="Sì da dare al gateway">
        <div className="intestazione">Serve il tuo sì, dato al gateway</div>
        <div>
          Questo comando è per il server su cui gira Shinka, dove chi comanda può tutto. Per questo il sì non si dà qui:
          lo chiede il gateway. Rispondi su Telegram al messaggio che ti ha mandato il gateway, oppure dalla pagina del
          vault, che apri dalla pagina <a href={frammentoDi({ tipo: "vault" })}>Vault</a>. Da qui puoi solo negarlo.
        </div>
        {dove}
        <pre className="comando">{approvazione.comando}</pre>
        <div className="pulsanti">
          <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negata")}>
            {inviata === "negata" ? "Negato…" : "Nega"}
          </button>
        </div>
        <div className="tenue">Hai tempo fino alle {oraInBreve(approvazione.scadeIl)}: dopo, il comando non parte.</div>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="riga proposta approvazione" role="group" aria-label="Approvazione richiesta">
      <div className="intestazione">Serve la tua approvazione</div>
      <div>Claude chiede di eseguire questo comando su un host che non gestisce da solo. Parte solo se lo approvi, così com'è scritto.</div>
      {dove}
      <pre className="comando">{approvazione.comando}</pre>
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inviata !== undefined} onClick={() => void decidi("approvata")}>
          {inviata === "approvata" ? "Approvato…" : "Approva"}
        </button>
        <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negata")}>
          Nega
        </button>
      </div>
      <div className="tenue">Hai tempo fino alle {oraInBreve(approvazione.scadeIl)}: dopo, il comando non parte.</div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

function statoDi(azione: Azione): { classe: string; testo: string } {
  if (azione.permesso?.stato === "in-attesa") return { classe: "attesa", testo: "aspetta te" };
  if (azione.permesso?.stato === "negato") return { classe: "negata", testo: "negata" };
  if (!azione.conclusa) return { classe: "in-corso", testo: "in corso" };
  if (azione.errore === true) return { classe: "fallita", testo: "non riuscita" };
  return { classe: "riuscita", testo: "fatta" };
}

/** Più azioni di seguito in una riga sola: aperta, mostra ciascuna con il suo dettaglio. */
function VistaGruppo({ gruppo }: { gruppo: Gruppo }): ReactNode {
  const esito = esitoDi(gruppo.azioni);
  const ultima = gruppo.azioni.at(-1);
  const immagini = gruppo.azioni.flatMap((azione) => azione.immagini ?? []);
  // Mentre lavora si vede che cosa sta facendo adesso; a lavoro finito, che cosa ha fatto in tutto.
  const inCorso = esito.classe === "in-corso" && ultima !== undefined;
  // Nella vista dettagliata tutte le azioni sono aperte.
  const dettagliata = useAspetto().vista === "dettagliata";
  const [aperto, setAperto] = useState(dettagliata);
  useEffect(() => setAperto(dettagliata), [dettagliata]);
  return (
    <div className={`riga gruppo ${esito.classe}`}>
      <details open={aperto} onToggle={(evento) => setAperto(evento.currentTarget.open)}>
        <summary>
          <span className="etichetta">{inCorso ? etichettaDi(ultima.strumento) : riassuntoDi(gruppo.azioni)}</span>
          {inCorso && <code className="dettaglio">{dettaglioDi(ultima.strumento, ultima.ingresso)}</code>}
          <span className="stato">{inCorso ? `${gruppo.azioni.length} azioni, in corso` : esito.testo}</span>
        </summary>
        {/* Le azioni del gruppo entrano nella pagina solo quando lo si apre: in una conversazione lunga sono migliaia. */}
        {aperto && (
          <div className="azioni-del-gruppo">
            {gruppo.azioni.map((azione) => (
              <VistaAzione key={azione.chiave} azione={azione} senzaImmagini />
            ))}
          </div>
        )}
      </details>
      <Immagini immagini={immagini} />
    </div>
  );
}

/** Richiesta ed esito di un'azione. Se la chat ne ha solo un riassunto, li chiede interi al centro. */
function DettaglioAzione({ azione }: { azione: Azione }): ReactNode {
  const base = useBaseDellaChat();
  const [intera, setIntera] = useState<{ ingresso: unknown; esito?: string }>();
  const [errore, setErrore] = useState<string>();
  const daChiedere = azione.accorciata === true;
  useEffect(() => {
    if (!daChiedere) return;
    let valida = true;
    leggiAzione(base, azione.chiave)
      .then((letta) => valida && setIntera(letta))
      .catch((causa: unknown) => valida && setErrore(causa instanceof Error ? causa.message : "Dettaglio non disponibile."));
    return () => {
      valida = false;
    };
  }, [base, azione.chiave, daChiedere]);
  const ingresso = intera?.ingresso ?? azione.ingresso;
  const esito = intera?.esito ?? azione.esito;
  return (
    <div className="corpo">
      {daChiedere && intera === undefined && (
        <p className="tenue">{errore === undefined ? "Carico il dettaglio intero…" : `Qui sotto solo un riassunto: ${errore}`}</p>
      )}
      <div className="titolino">Richiesta</div>
      <pre>{JSON.stringify(ingresso, null, 2)}</pre>
      {esito !== undefined && esito !== "" && (
        <>
          <div className="titolino">Esito</div>
          <pre>{esito}</pre>
        </>
      )}
    </div>
  );
}

function VistaAzione({ azione, senzaImmagini }: { azione: Azione; senzaImmagini?: boolean }): ReactNode {
  const stato = statoDi(azione);
  const dettaglio = dettaglioDi(azione.strumento, azione.ingresso);
  const inAttesa = azione.permesso?.stato === "in-attesa";
  const apriAnteprima = useApriAnteprima();
  const proposta = apriAnteprima === undefined ? undefined : anteprimaProposta(azione);
  const dettagliata = useAspetto().vista === "dettagliata";
  const [aperta, setAperta] = useState(dettagliata);
  useEffect(() => setAperta(dettagliata), [dettagliata]);
  // Il piano di Claude si legge come un documento, anche chiuso.
  const piano = azione.strumento === STRUMENTO_PIANO;

  return (
    <div className={`riga azione ${stato.classe}${piano ? " con-piano" : ""}`}>
      {piano && <TestoDelPiano ingresso={azione.ingresso} />}
      <details open={aperta} onToggle={(evento) => setAperta(evento.currentTarget.open)}>
        <summary>
          <span className="etichetta">{etichettaDi(azione.strumento)}</span>
          {dettaglio !== "" && <code className="dettaglio">{dettaglio}</code>}
          <span className="stato">{stato.testo}</span>
        </summary>
        {/* Il dettaglio entra nella pagina solo quando lo si apre. */}
        {aperta && <DettaglioAzione azione={azione} />}
      </details>
      {senzaImmagini !== true && <Immagini immagini={azione.immagini} />}
      {inAttesa && azione.permesso !== undefined && (
        <RichiestaPermesso
          idPermesso={azione.permesso.id}
          motivo={azione.permesso.motivo}
          comando={comandoSuHost(azione.strumento, azione.ingresso)}
        />
      )}
      {proposta !== undefined && apriAnteprima !== undefined && (
        <div className="permesso">
          <p>Claude propone di guardare l'applicazione del progetto: la vedi qui accanto, attraverso Shinka.</p>
          <div className="pulsanti">
            <button type="button" className="approva" onClick={() => apriAnteprima(proposta.porta, proposta.percorso)}>
              Apri l'anteprima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RichiestaPermesso({
  idPermesso,
  motivo,
  comando,
}: {
  idPermesso: string;
  motivo: string | undefined;
  /** Il comando per un host, per intero: il consenso vale per quello, e la riga in alto lo tronca. */
  comando: string | undefined;
}): ReactNode {
  const base = useBaseDellaChat();
  const [inviata, setInviata] = useState<DecisionePermesso>();
  const [errore, setErrore] = useState<string>();

  async function decidi(decisione: DecisionePermesso): Promise<void> {
    setInviata(decisione);
    setErrore(undefined);
    try {
      await decidiPermesso(base, idPermesso, decisione);
    } catch (causa) {
      setInviata(undefined);
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    }
  }

  return (
    <div className="permesso">
      <p>Claude chiede il tuo permesso per questa azione.{motivo !== undefined && ` ${motivo}`}</p>
      {comando !== undefined && <pre className="comando">{comando}</pre>}
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

/** A fine turno, i file che Claude ha cambiato: in breve, con il pulsante per guardarli nel pannello. */
function SchedaModifiche({ voce }: { voce: Extract<Voce, { tipo: "modifiche" }> }): ReactNode {
  const apriModifiche = useApriModifiche();
  const aggiunte = voce.file.reduce((somma, file) => somma + file.aggiunte, 0);
  const tolte = voce.file.reduce((somma, file) => somma + file.tolte, 0);
  const annullati = Object.values(voce.decisi).filter((esito) => esito === "annullate").length;
  const mostrati = voce.file.slice(0, 4);
  // Con quelli cambiati da un comando di cui non si tiene la versione: erano troppi.
  const quanti = voce.file.length + (voce.altri ?? 0);
  const daComandi = voce.file.filter((file) => file.daComando === true).length + (voce.altri ?? 0);
  return (
    <div className="riga scheda-modifiche">
      <div className="testa-modifiche">
        <span>
          {quanti === 1 ? "Claude ha cambiato un file" : `Claude ha cambiato ${quanti} file`}
          {voce.file.length > 0 && (
            <>
              {" "}
              · <span className="aggiunte">+{aggiunte}</span> <span className="tolte">−{tolte}</span>
            </>
          )}
        </span>
        {apriModifiche !== undefined && (
          <button type="button" className="mini" onClick={() => apriModifiche(voce.chiave)}>
            Guarda
          </button>
        )}
      </div>
      <ul>
        {mostrati.map((file) => (
          <li key={file.percorso}>
            <code>{file.percorso}</code>
            {voce.decisi[file.percorso] === "annullate" && <span className="tenue"> · riportato com'era</span>}
          </li>
        ))}
        {quanti > mostrati.length && <li className="tenue">e altri {quanti - mostrati.length}</li>}
      </ul>
      {daComandi > 0 && <p className="tenue">{daComandi === quanti ? (quanti === 1 ? "Con un comando" : "Tutti con dei comandi") : daComandi === 1 ? "Uno con un comando" : `${daComandi} con dei comandi`}.</p>}
      {annullati > mostrati.filter((file) => voce.decisi[file.percorso] === "annullate").length && (
        <p className="tenue">{annullati === 1 ? "Uno riportato com'era" : `${annullati} riportati com'erano`}.</p>
      )}
    </div>
  );
}
