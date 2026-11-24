/**
 * Le estensioni dell'interfaccia nel browser (ADR 0054): i temi aggiunti alla pagina, le pagine nel
 * loro riquadro con il ponte verso Shinka, i pulsanti sopra il campo di scrittura e la scheda con cui
 * la Home ne propone una.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CAMPO_DEL_PONTE, type EstensioneInterfaccia, type StatoPerLaPagina } from "../../src/protocollo/interfaccia.ts";
import { BASE_HOME, baseDelProgetto, decidiInterfaccia, eDellaHome, indirizzoPaginaEstensione, inviaMessaggio } from "./api.ts";
import { useSolaLettura } from "./ContestoChat.ts";
import { useQuadroCorrente, type Quadro } from "./Quadro.tsx";
import type { Elemento } from "./stato.ts";
import { frammentoDi } from "./vista.ts";

/** Con `?senza-estensioni` nell'indirizzo l'interfaccia si apre senza temi né pulsanti: se un tema la rompe, da qui lo si spegne. */
export function senzaEstensioni(): boolean {
  return new URLSearchParams(window.location.search).has("senza-estensioni");
}

function accese(quadro: Quadro): EstensioneInterfaccia[] {
  return senzaEstensioni() ? [] : (quadro.interfaccia?.estensioni ?? []).filter((una) => una.accesa);
}

/** I temi delle estensioni accese, aggiunti alla pagina dopo quello di Shinka. */
export function TemiDelleEstensioni({ quadro }: { quadro: Quadro }): ReactNode {
  return (
    <>
      {accese(quadro).map((una) =>
        una.tema === undefined ? null : (
          <style key={una.id} data-estensione={una.nome}>
            {una.tema}
          </style>
        ),
      )}
    </>
  );
}

/** Le pagine delle estensioni accese che vanno nel menu delle pagine, o nel pannello dei progetti. */
export function pagineDelleEstensioni(quadro: Quadro, dove: "menu" | "pannello"): { id: string; pagina: string; titolo: string }[] {
  return accese(quadro).flatMap((una) => una.pagine.filter((pagina) => pagina.dove === dove).map((pagina) => ({ id: una.id, pagina: pagina.id, titolo: pagina.titolo })));
}

/** Lo stato che una pagina riceve: niente credenziali, memoria o testo delle conversazioni. */
export function statoPerLaPagina(quadro: Quadro, qui: StatoPerLaPagina["qui"]): StatoPerLaPagina {
  const ambienti = quadro.ambienti?.ambienti ?? [];
  return {
    qui,
    home: { condizione: quadro.home?.complessiva ?? quadro.home?.condizione ?? "fermo" },
    progetti: (quadro.progetti?.progetti ?? []).map((progetto) => ({ id: progetto.id, nome: progetto.nome, ambiente: progetto.nomeAmbiente, condizione: progetto.condizione })),
    ambienti: ambienti.map((ambiente) => ({ id: ambiente.id, nome: ambiente.nome, attivo: ambiente.attivo, sistema: ambiente.sistema })),
  };
}

/** Quanto deve passare tra due messaggi mandati da una pagina. */
const PAUSA_TRA_I_MESSAGGI_MS = 2000;

/**
 * Una pagina nel suo riquadro: un'origine opaca, che parla con Shinka solo con `postMessage`. Chiede
 * lo stato e lo riceve di nuovo a ogni cambiamento; manda messaggi alla Home o a un progetto.
 */
export function RiquadroEstensione({ id, pagina, titolo, qui }: { id: string; pagina: string; titolo: string; qui: StatoPerLaPagina["qui"] }): ReactNode {
  const quadro = useQuadroCorrente();
  const riquadro = useRef<HTMLIFrameElement>(null);
  const [iscritta, setIscritta] = useState(false);
  const ultimoInvio = useRef(0);
  const stato = useRef(statoPerLaPagina(quadro, qui));
  stato.current = statoPerLaPagina(quadro, qui);

  useEffect(() => {
    const rispondi = (dati: Record<string, unknown>): void => {
      riquadro.current?.contentWindow?.postMessage({ [CAMPO_DEL_PONTE]: dati.tipo, ...dati }, "*");
    };
    const alMessaggio = (evento: MessageEvent): void => {
      // Solo la pagina di questo riquadro, e solo con il campo del ponte.
      if (riquadro.current === null || evento.source !== riquadro.current.contentWindow) return;
      const dati = evento.data as Record<string, unknown> | null;
      if (typeof dati !== "object" || dati === null) return;
      const richiesta = dati[CAMPO_DEL_PONTE];
      if (richiesta === "stato") {
        setIscritta(true);
        rispondi({ tipo: "stato", stato: stato.current });
        return;
      }
      if (richiesta !== "manda") return;
      const testo = typeof dati.testo === "string" ? dati.testo.trim().slice(0, 20_000) : "";
      const dove = typeof dati.dove === "string" ? dati.dove : undefined;
      const progetto = dove === undefined || dove === "home" ? undefined : stato.current.progetti.find((uno) => uno.id === dove);
      const base =
        dove === "home" ? BASE_HOME : progetto !== undefined ? baseDelProgetto(progetto.id) : dove === undefined && qui.tipo === "progetto" ? baseDelProgetto(qui.id) : undefined;
      const adesso = Date.now();
      if (testo === "" || base === undefined) {
        rispondi({ tipo: "mandato", riuscito: false, motivo: testo === "" ? "Il messaggio è vuoto." : "Non so a quale conversazione mandarlo." });
        return;
      }
      if (adesso - ultimoInvio.current < PAUSA_TRA_I_MESSAGGI_MS) {
        rispondi({ tipo: "mandato", riuscito: false, motivo: "Troppo presto: un messaggio ogni due secondi." });
        return;
      }
      ultimoInvio.current = adesso;
      inviaMessaggio(base, `[Dalla pagina «${titolo}»] ${testo}`).then(
        () => rispondi({ tipo: "mandato", riuscito: true }),
        (causa: unknown) => rispondi({ tipo: "mandato", riuscito: false, motivo: causa instanceof Error ? causa.message : "Non è partito." }),
      );
    };
    window.addEventListener("message", alMessaggio);
    return () => window.removeEventListener("message", alMessaggio);
  }, [titolo, qui]);

  // A ogni cambiamento la pagina che ha chiesto lo stato lo riceve di nuovo.
  const statoInTesto = JSON.stringify(stato.current);
  useEffect(() => {
    if (!iscritta) return;
    riquadro.current?.contentWindow?.postMessage({ [CAMPO_DEL_PONTE]: "stato", stato: JSON.parse(statoInTesto) as unknown }, "*");
  }, [iscritta, statoInTesto]);

  return <iframe ref={riquadro} className="riquadro-estensione" title={titolo} sandbox="allow-scripts" src={indirizzoPaginaEstensione(id, pagina)} />;
}

/** Una pagina di un'estensione aperta dal menu delle pagine. */
export function PaginaEstensione({ menu, id, pagina }: { menu: ReactNode; id: string; pagina: string }): ReactNode {
  const quadro = useQuadroCorrente();
  const estensione = quadro.interfaccia?.estensioni.find((una) => una.id === id);
  const trovata = estensione?.accesa === true && !senzaEstensioni() ? estensione.pagine.find((una) => una.id === pagina) : undefined;
  const qui = useRef<StatoPerLaPagina["qui"]>({ tipo: "pagina" }).current;
  return (
    <div className="app pagina-estensione">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>{trovata?.titolo ?? "Pagina"}</h1>
          {estensione !== undefined && <span className="sottotitolo">Estensione dell'interfaccia «{estensione.nome}»</span>}
        </div>
      </header>
      {trovata === undefined ? (
        <div className="avviso-interno">
          <p>{quadro.interfaccia === undefined ? "Carico…" : "Questa pagina non c'è, o la sua estensione è spenta."}</p>
          <a className="pulsante" href={frammentoDi({ tipo: "estensioni" })}>
            Estensioni
          </a>
        </div>
      ) : (
        <RiquadroEstensione key={`${id}/${pagina}`} id={id} pagina={pagina} titolo={trovata.titolo} qui={qui} />
      )}
    </div>
  );
}

/** I pulsanti delle estensioni sopra il campo di scrittura: un tocco manda il loro testo alla conversazione. */
export function PulsantiDelleEstensioni({ base, occupata }: { base: string; occupata: boolean }): ReactNode {
  const quadro = useQuadroCorrente();
  const [inCorso, setInCorso] = useState<string>();
  const [errore, setErrore] = useState<string>();
  const nellaHome = eDellaHome(base);
  const pulsanti = accese(quadro).flatMap((una) =>
    una.pulsanti.filter((pulsante) => pulsante.dove === "ovunque" || (pulsante.dove === "home") === nellaHome).map((pulsante, posto) => ({ ...pulsante, chiave: `${una.id}-${posto}` })),
  );
  if (pulsanti.length === 0) return null;
  return (
    <div className="pulsanti-estensioni" aria-label="Pulsanti delle estensioni">
      {pulsanti.map((pulsante) => (
        <button
          key={pulsante.chiave}
          type="button"
          className="mini"
          title={pulsante.testo}
          disabled={occupata || inCorso !== undefined}
          onClick={() => {
            setInCorso(pulsante.chiave);
            setErrore(undefined);
            inviaMessaggio(base, pulsante.testo)
              .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è partito."))
              .finally(() => setInCorso(undefined));
          }}
        >
          {pulsante.etichetta}
        </button>
      ))}
      {errore !== undefined && (
        <span className="errore" role="alert">
          {errore}
        </span>
      )}
    </div>
  );
}

type Proposta = Extract<Elemento, { tipo: "interfaccia" }>;

/** La scheda con cui la Home propone un'estensione dell'interfaccia: che cosa aggiunge, con le pagine da guardare in anteprima. */
export function SchedaInterfaccia({ proposta }: { proposta: Proposta }): ReactNode {
  const solaLettura = useSolaLettura();
  const [inCorso, setInCorso] = useState<"confermata" | "annullata">();
  const [errore, setErrore] = useState<string>();

  if (proposta.esito === "annullata") return <div className="riga nota">Proposta annullata: l'estensione dell'interfaccia «{proposta.nome}» non è entrata.</div>;
  if (proposta.esito === "confermata") {
    return (
      <div className="riga proposta decisa">
        <div className="testo">
          <div className="intestazione">Estensione dell'interfaccia accesa: {proposta.nome}</div>
        </div>
        <a className="pulsante" href={frammentoDi({ tipo: "estensioni" })}>
          Estensioni
        </a>
      </div>
    );
  }
  if (solaLettura) return <div className="riga nota">Proposta di un'estensione dell'interfaccia rimasta senza risposta: «{proposta.nome}».</div>;

  async function decidi(esito: "confermata" | "annullata"): Promise<void> {
    setInCorso(esito);
    setErrore(undefined);
    try {
      await decidiInterfaccia(proposta.chiave, esito);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    } finally {
      setInCorso(undefined);
    }
  }

  return (
    <div className="riga proposta approvazione estensione" role="group" aria-label="Estensione dell'interfaccia da confermare">
      <div className="intestazione">{proposta.sostituisce === true ? "Estensione dell'interfaccia da sostituire" : "Estensione dell'interfaccia da aggiungere"}</div>
      <div className="voce-scheda">
        <div className="titolino">Che cosa</div>
        <div className="titolo-sviluppo">{proposta.nome}</div>
        <div>{proposta.descrizione}</div>
      </div>
      {proposta.righeTema !== undefined && (
        <div className="voce-scheda">
          <div className="titolino">Tema</div>
          <div>Un foglio di stile di {proposta.righeTema === 1 ? "una riga" : `${proposta.righeTema} righe`}, che si aggiunge a quello di Shinka.</div>
        </div>
      )}
      {proposta.pagine.length > 0 && (
        <div className="voce-scheda">
          <div className="titolino">Pagine</div>
          <ul className="contenuto-estensione">
            {proposta.pagine.map((pagina) => (
              <li key={pagina.id}>
                {pagina.titolo} <span className="tenue">· {pagina.dove === "menu" ? "nel menu delle pagine" : "nel pannello dei progetti"}</span>{" "}
                <a href={indirizzoPaginaEstensione(proposta.chiave, pagina.id, true)} target="_blank" rel="noreferrer">
                  Anteprima
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposta.pulsanti.length > 0 && (
        <div className="voce-scheda">
          <div className="titolino">Pulsanti</div>
          <ul className="contenuto-estensione">
            {proposta.pulsanti.map((pulsante) => (
              <li key={pulsante.etichetta}>
                <strong>{pulsante.etichetta}</strong>{" "}
                <span className="tenue">({pulsante.dove === "ovunque" ? "nella Home e nei progetti" : pulsante.dove === "home" ? "nella Home" : "nei progetti"}) manda:</span> {pulsante.testo}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inCorso !== undefined} onClick={() => void decidi("confermata")}>
          Conferma
        </button>
        <button type="button" disabled={inCorso !== undefined} onClick={() => void decidi("annullata")}>
          Annulla
        </button>
      </div>
      <div className="tenue">
        Le pagine girano chiuse in un riquadro: leggono lo stato di Shinka e possono mandare messaggi alle conversazioni, non altro. Se un tema rompe l'interfaccia,
        aprila con «?senza-estensioni» nell'indirizzo e spegnilo dalla pagina Estensioni.
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
