/**
 * Le estensioni dell'interfaccia nel browser (ADR 0054 e 0057): i temi aggiunti alla pagina, le
 * pagine nei loro posti (menu, pannello, barre, testata, intorno al campo di scrittura, pannello
 * flottante, pagine Ambiente e Sicurezza) e al posto delle parti che sostituiscono, i comandi della
 * palette con le loro scorciatoie, le etichette nella barra laterale, i pulsanti sopra il campo di
 * scrittura, e la scheda con cui la Home ne propone una.
 *
 * Ogni pagina sta nel suo riquadro, con un'origine sua e senza rete. Parla con l'interfaccia con il
 * ponte (`window.shinka`, che il centro mette in cima alla pagina): lo stato, i messaggi alle
 * conversazioni, e le API di Shinka, che l'interfaccia chiama con la sessione del proprietario solo
 * per le rotte che l'estensione ha dichiarato.
 */

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  apiConsentita,
  CAMPO_DEL_PONTE,
  conICampiNuovi,
  PARTI_IN_PAROLE,
  POSTI_IN_PAROLE,
  tastiCombaciano,
  type ComandoDiEstensione,
  type EstensioneInterfaccia,
  type Parte,
  type Posto,
  type QuiPerLaPagina,
  type StatoPerLaPagina,
} from "../../src/protocollo/interfaccia.ts";
import { BASE_HOME, baseDelProgetto, decidiInterfaccia, eDellaHome, indirizzoPaginaEstensione, inviaMessaggio } from "./api.ts";
import { useSolaLettura } from "./ContestoChat.ts";
import { useQuadroCorrente, type Quadro } from "./Quadro.tsx";
import type { Elemento } from "./stato.ts";
import { frammentoDi, vaiA } from "./vista.ts";

/** Con `?senza-estensioni` nell'indirizzo l'interfaccia si apre senza estensioni: se una la rompe, da qui la si spegne. */
export function senzaEstensioni(): boolean {
  return new URLSearchParams(window.location.search).has("senza-estensioni");
}

function accese(quadro: Quadro): EstensioneInterfaccia[] {
  return senzaEstensioni() ? [] : (quadro.interfaccia?.estensioni ?? []).filter((una) => una.accesa).map((una) => conICampiNuovi(una));
}

/** Il sito o Shinka Desktop, che mette il suo ponte nella pagina. */
export function clientDiQui(): "web" | "desktop" {
  return "shinkaDesktop" in window ? "desktop" : "web";
}

function temaDiQui(): "chiaro" | "scuro" {
  const scelto = document.documentElement.dataset.tema;
  if (scelto === "chiaro" || scelto === "scuro") return scelto;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches === true ? "scuro" : "chiaro";
}

// --- Dove si trova il proprietario

const ContestoQui = createContext<QuiPerLaPagina>({ tipo: "pagina" });
/** Dice alle estensioni dove si trova il proprietario: la Home, un progetto, un ambiente, un'altra pagina. */
export const FornitoreQui = ContestoQui.Provider;
export function useQui(): QuiPerLaPagina {
  return useContext(ContestoQui);
}

/** Una pagina di un'estensione accesa, con la sua estensione. */
export interface PaginaAccesa {
  estensione: EstensioneInterfaccia;
  pagina: { id: string; titolo: string };
}

const POSTI_SENZA_AMBITO: readonly Posto[] = ["menu", "ambiente", "sicurezza"];

/** Le pagine delle estensioni accese che stanno in un posto, qui: secondo l'ambito (Home, progetti) e il client. */
export function pagineNelPosto(quadro: Quadro, posto: Posto, qui: QuiPerLaPagina): PaginaAccesa[] {
  const client = clientDiQui();
  return accese(quadro).flatMap((estensione) =>
    estensione.pagine
      .filter((pagina) =>
        pagina.posti.some(
          (voce) =>
            voce.posto === posto &&
            (voce.client === "tutti" || voce.client === client) &&
            // L'ambito conta nei posti intorno a una conversazione; il menu e le pagine Ambiente e Sicurezza non ne hanno.
            (POSTI_SENZA_AMBITO.includes(posto) || voce.ambito === "ovunque" || (voce.ambito === "home" && qui.tipo === "home") || (voce.ambito === "progetti" && qui.tipo === "progetto")),
        ),
      )
      .map((pagina) => ({ estensione, pagina: { id: pagina.id, titolo: pagina.titolo } })),
  );
}

/** Le pagine delle estensioni accese che vanno nel menu delle pagine, o nel pannello dei progetti. */
export function pagineDelleEstensioni(quadro: Quadro, dove: "menu" | "pannello"): { id: string; pagina: string; titolo: string }[] {
  const qui: QuiPerLaPagina = dove === "pannello" ? { tipo: "progetto", id: "", nome: "" } : { tipo: "pagina" };
  return pagineNelPosto(quadro, dove, qui).map(({ estensione, pagina }) => ({ id: estensione.id, pagina: pagina.id, titolo: pagina.titolo }));
}

/** Lo stato che una pagina riceve: dove è aperta, progetti, ambienti e Home. Niente credenziali, memoria o testo delle conversazioni. */
export function statoPerLaPagina(quadro: Quadro, qui: QuiPerLaPagina, estensione?: EstensioneInterfaccia, posto?: StatoPerLaPagina["posto"]): StatoPerLaPagina {
  const ambienti = quadro.ambienti?.ambienti ?? [];
  const progetti = quadro.progetti?.progetti ?? [];
  const idArgomento = quadro.argomenti?.idAperto;
  let arricchito: QuiPerLaPagina = qui;
  if (qui.tipo === "progetto") {
    const progetto = progetti.find((uno) => uno.id === qui.id);
    if (progetto !== undefined) {
      arricchito = { tipo: "progetto", id: progetto.id, nome: progetto.nome, idAmbiente: progetto.idAmbiente, ambiente: progetto.nomeAmbiente, cartella: progetto.cartella, condizione: progetto.condizione };
    }
  }
  if (qui.tipo === "home" && idArgomento !== undefined) arricchito = { tipo: "home", idArgomento };
  return {
    qui: arricchito,
    ...(posto === undefined ? {} : { posto }),
    client: clientDiQui(),
    tema: temaDiQui(),
    estensione: { id: estensione?.id ?? "", nome: estensione?.nome ?? "", api: estensione?.api ?? [] },
    home: { condizione: quadro.home?.complessiva ?? quadro.home?.condizione ?? "fermo", ...(idArgomento === undefined ? {} : { idArgomento }) },
    progetti: progetti.map((progetto) => ({ id: progetto.id, nome: progetto.nome, ambiente: progetto.nomeAmbiente, idAmbiente: progetto.idAmbiente, condizione: progetto.condizione })),
    ambienti: ambienti.map((ambiente) => ({ id: ambiente.id, nome: ambiente.nome, attivo: ambiente.attivo, sistema: ambiente.sistema, delCentro: ambiente.delCentro })),
  };
}

// --- Le etichette che le pagine mettono accanto a progetti e argomenti

type Etichette = ReadonlyMap<string, ReadonlyMap<string, string>>;
let etichette: Etichette = new Map();
const ascoltatoriEtichette = new Set<() => void>();

function impostaEtichette(idEstensione: string, voci: unknown): void {
  if (typeof voci !== "object" || voci === null) return;
  const lette = new Map<string, string>();
  for (const [id, testo] of Object.entries(voci as Record<string, unknown>).slice(0, 300)) {
    if (typeof testo === "string" && testo.trim() !== "") lette.set(id, testo.trim().slice(0, 24));
  }
  const nuove = new Map(etichette);
  nuove.set(idEstensione, lette);
  etichette = nuove;
  for (const ascolta of ascoltatoriEtichette) ascolta();
}

/** Le etichette delle estensioni accese per un progetto o un argomento, una per estensione. */
export function useEtichette(id: string): { estensione: string; testo: string }[] {
  const tutte = useSyncExternalStore(
    (ascolta) => {
      ascoltatoriEtichette.add(ascolta);
      return () => ascoltatoriEtichette.delete(ascolta);
    },
    () => etichette,
  );
  const quadro = useQuadroCorrente();
  return accese(quadro).flatMap((estensione) => {
    const testo = tutte.get(estensione.id)?.get(id);
    return testo === undefined ? [] : [{ estensione: estensione.nome, testo }];
  });
}

// --- I segnali dei comandi alle pagine accese della loro estensione

const segnali = new EventTarget();

function daiSegnale(idEstensione: string, nome: string): void {
  segnali.dispatchEvent(new CustomEvent("segnale", { detail: { idEstensione, nome } }));
}

// --- Le API di Shinka per un'estensione

/** Quanti flussi può tenere aperti una pagina. */
const FLUSSI_MASSIMI = 8;
/** Quanto di una risposta arriva alla pagina. */
const RISPOSTA_MASSIMA = 4 * 1024 * 1024;

/** Un percorso delle API di questa interfaccia, o nulla se porta altrove. */
function percorsoDelleApi(scritto: unknown): string | undefined {
  if (typeof scritto !== "string") return undefined;
  try {
    const indirizzo = new URL(scritto, window.location.href);
    if (indirizzo.protocol !== window.location.protocol || indirizzo.host !== window.location.host || !indirizzo.pathname.startsWith("/api/")) return undefined;
    return `${indirizzo.pathname}${indirizzo.search}`;
  } catch {
    return undefined;
  }
}

/** Le intestazioni con cui l'interfaccia chiama per un'estensione: il centro la annota nel registro con il suo nome. */
function intestazioniPer(estensione: EstensioneInterfaccia, conCorpo: boolean): Record<string, string> {
  return { "X-Shinka-Estensione": encodeURIComponent(estensione.nome), ...(conCorpo ? { "Content-Type": "application/json" } : {}) };
}

/** Chiama le API per un'estensione: solo le rotte che ha dichiarato. */
export async function chiamaPerLEstensione(
  estensione: EstensioneInterfaccia,
  metodoScritto: unknown,
  percorsoScritto: unknown,
  corpo: unknown,
): Promise<{ ok: boolean; stato: number; dati?: unknown; errore?: string }> {
  const metodo = typeof metodoScritto === "string" ? metodoScritto.toUpperCase() : "";
  const percorso = percorsoDelleApi(percorsoScritto);
  if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(metodo)) return { ok: false, stato: 400, errore: "Il metodo è GET, POST, PUT, PATCH o DELETE." };
  if (percorso === undefined) return { ok: false, stato: 400, errore: "Il percorso è quello di un'API di Shinka, come /api/ambienti." };
  if (!apiConsentita(estensione.api, metodo, percorso)) {
    return { ok: false, stato: 403, errore: `L'estensione «${estensione.nome}» non ha dichiarato ${metodo} ${percorso.split("?")[0]}, oppure è una rotta che alle estensioni resta chiusa.` };
  }
  try {
    const conCorpo = corpo !== undefined && metodo !== "GET";
    const risposta = await fetch(percorso, {
      method: metodo,
      credentials: "same-origin",
      headers: intestazioniPer(estensione, conCorpo),
      ...(conCorpo ? { body: JSON.stringify(corpo) } : {}),
    });
    const testo = (await risposta.text()).slice(0, RISPOSTA_MASSIMA);
    let dati: unknown = testo;
    if ((risposta.headers.get("content-type") ?? "").includes("json")) {
      try {
        dati = JSON.parse(testo) as unknown;
      } catch {
        dati = testo;
      }
    }
    const errore = !risposta.ok && typeof dati === "object" && dati !== null && typeof (dati as { errore?: unknown }).errore === "string" ? (dati as { errore: string }).errore : undefined;
    return { ok: risposta.ok, stato: risposta.status, dati, ...(errore === undefined ? {} : { errore }) };
  } catch (causa) {
    return { ok: false, stato: 0, errore: causa instanceof Error ? causa.message : "La richiesta non è partita." };
  }
}

/** Segue un flusso di eventi delle API per un'estensione, finché il segnale non lo chiude. */
async function seguiPerLEstensione(
  estensione: EstensioneInterfaccia,
  percorso: string,
  nomi: readonly string[],
  fai: (nome: string, dati: unknown) => void,
  segnale: AbortSignal,
): Promise<string | undefined> {
  const risposta = await fetch(percorso, { credentials: "same-origin", headers: { ...intestazioniPer(estensione, false), Accept: "text/event-stream" }, signal: segnale });
  if (!risposta.ok || risposta.body === null) return `Shinka ha risposto ${risposta.status}.`;
  const lettore = risposta.body.getReader();
  const decodifica = new TextDecoder();
  let resto = "";
  let nome = "";
  let righe: string[] = [];
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) return undefined;
    const pezzi = (resto + decodifica.decode(value, { stream: true })).split(/\r\n|\n|\r/);
    resto = pezzi.pop() ?? "";
    for (const riga of pezzi) {
      if (riga === "") {
        const evento = nome === "" ? "message" : nome;
        if (righe.length > 0 && nomi.includes(evento)) {
          const testo = righe.join("\n");
          let dati: unknown = testo;
          try {
            dati = JSON.parse(testo) as unknown;
          } catch {
            dati = testo;
          }
          fai(evento, dati);
        }
        nome = "";
        righe = [];
      } else if (riga.startsWith("event:")) nome = riga.slice(6).trim();
      else if (riga.startsWith("data:")) righe.push(riga.slice(5).replace(/^ /, ""));
    }
  }
}

/** Quanto deve passare tra due messaggi mandati da una pagina. */
const PAUSA_TRA_I_MESSAGGI_MS = 2000;

/**
 * Una pagina nel suo riquadro: un'origine sua, senza rete, che parla con Shinka con il ponte. Riceve
 * lo stato e lo riceve di nuovo a ogni cambiamento; manda messaggi alla Home o a un progetto; chiama
 * le API che la sua estensione ha dichiarato; segue i loro flussi; chiede l'altezza che le serve.
 */
export function RiquadroEstensione({
  id,
  pagina,
  titolo,
  qui,
  posto,
  altezzaIniziale,
  proposta = false,
}: {
  id: string;
  pagina: string;
  titolo: string;
  qui: QuiPerLaPagina;
  posto?: StatoPerLaPagina["posto"];
  /** Nei posti stretti: l'altezza di partenza, che la pagina cambia con `shinka.altezza`. */
  altezzaIniziale?: number;
  /** L'anteprima di una pagina proposta: lo stato sì, le API no. */
  proposta?: boolean;
}): ReactNode {
  const quadro = useQuadroCorrente();
  const estensione = (quadro.interfaccia?.estensioni ?? []).find((una) => una.id === id);
  const riquadro = useRef<HTMLIFrameElement>(null);
  const [iscritta, setIscritta] = useState(false);
  const [altezza, setAltezza] = useState(altezzaIniziale);
  const ultimoInvio = useRef(0);
  const conNuovi = estensione === undefined ? undefined : conICampiNuovi(estensione);
  const stato = useRef(statoPerLaPagina(quadro, qui, conNuovi, posto));
  stato.current = statoPerLaPagina(quadro, qui, conNuovi, posto);
  const estensioneAttuale = useRef(conNuovi);
  estensioneAttuale.current = conNuovi;

  useEffect(() => {
    const flussi = new Map<string, AbortController>();
    const rispondi = (dati: Record<string, unknown>): void => {
      riquadro.current?.contentWindow?.postMessage({ [CAMPO_DEL_PONTE]: dati.tipo, ...dati }, "*");
    };
    const alMessaggio = (evento: MessageEvent): void => {
      // Solo la pagina di questo riquadro, e solo con il campo del ponte: nessun'altra finestra, nemmeno l'anteprima di un progetto.
      if (riquadro.current === null || evento.source !== riquadro.current.contentWindow) return;
      const dati = evento.data as Record<string, unknown> | null;
      if (typeof dati !== "object" || dati === null) return;
      const richiesta = dati[CAMPO_DEL_PONTE];
      const idRichiesta = typeof dati.id === "string" ? dati.id.slice(0, 40) : undefined;
      const conId = idRichiesta === undefined ? {} : { id: idRichiesta };
      const estensioneOra = estensioneAttuale.current;
      if (richiesta === "stato") {
        setIscritta(true);
        rispondi({ tipo: "stato", stato: stato.current });
        return;
      }
      if (richiesta === "altezza") {
        const px = typeof dati.px === "number" && Number.isFinite(dati.px) ? Math.round(dati.px) : undefined;
        if (px !== undefined && altezzaIniziale !== undefined) setAltezza(Math.min(Math.max(px, 20), 600));
        return;
      }
      if (richiesta === "etichette") {
        if (!proposta && estensioneOra !== undefined) impostaEtichette(estensioneOra.id, dati.etichette);
        return;
      }
      if (richiesta === "api") {
        if (proposta || estensioneOra === undefined) {
          rispondi({ tipo: "risposta", ...conId, ok: false, stato: 403, errore: "Nell'anteprima di una proposta le API non si usano." });
          return;
        }
        void chiamaPerLEstensione(estensioneOra, dati.metodo, dati.percorso, dati.corpo).then((esito) => rispondi({ tipo: "risposta", ...conId, ...esito }));
        return;
      }
      if (richiesta === "segui") {
        const percorso = percorsoDelleApi(dati.percorso);
        const nomi = Array.isArray(dati.nomi) ? dati.nomi.filter((nome): nome is string => typeof nome === "string").slice(0, 30) : ["message"];
        const chiudi = (motivo: string): void => rispondi({ tipo: "evento", ...conId, nome: "chiuso", dati: { motivo } });
        if (idRichiesta === undefined || proposta || estensioneOra === undefined || percorso === undefined) return chiudi("Il flusso non si può aprire da qui.");
        if (!apiConsentita(estensioneOra.api, "GET", percorso)) return chiudi(`L'estensione non ha dichiarato GET ${percorso.split("?")[0]}.`);
        if (flussi.size >= FLUSSI_MASSIMI) return chiudi(`Al massimo ${FLUSSI_MASSIMI} flussi per pagina.`);
        const controllo = new AbortController();
        flussi.set(idRichiesta, controllo);
        seguiPerLEstensione(estensioneOra, percorso, nomi, (nome, contenuto) => rispondi({ tipo: "evento", id: idRichiesta, nome, dati: contenuto }), controllo.signal)
          .then((motivo) => chiudi(motivo ?? "Il flusso si è chiuso."))
          .catch((causa: unknown) => {
            if (!controllo.signal.aborted) chiudi(causa instanceof Error ? causa.message : "Il flusso è caduto.");
          })
          .finally(() => flussi.delete(idRichiesta));
        return;
      }
      if (richiesta === "smetti") {
        if (idRichiesta !== undefined) flussi.get(idRichiesta)?.abort();
        return;
      }
      if (richiesta !== "manda") return;
      const testo = typeof dati.testo === "string" ? dati.testo.trim().slice(0, 20_000) : "";
      const dove = typeof dati.dove === "string" ? dati.dove : undefined;
      const progetto = dove === undefined || dove === "home" ? undefined : stato.current.progetti.find((uno) => uno.id === dove);
      const base =
        dove === "home" ? BASE_HOME : progetto !== undefined ? baseDelProgetto(progetto.id) : dove === undefined && qui.tipo === "progetto" ? baseDelProgetto(qui.id) : dove === undefined && qui.tipo === "home" ? BASE_HOME : undefined;
      const adesso = Date.now();
      if (testo === "" || base === undefined) {
        rispondi({ tipo: "mandato", ...conId, riuscito: false, motivo: testo === "" ? "Il messaggio è vuoto." : "Non so a quale conversazione mandarlo." });
        return;
      }
      if (adesso - ultimoInvio.current < PAUSA_TRA_I_MESSAGGI_MS) {
        rispondi({ tipo: "mandato", ...conId, riuscito: false, motivo: "Troppo presto: un messaggio ogni due secondi." });
        return;
      }
      ultimoInvio.current = adesso;
      inviaMessaggio(base, `[Dalla pagina «${titolo}»] ${testo}`).then(
        () => rispondi({ tipo: "mandato", ...conId, riuscito: true }),
        (causa: unknown) => rispondi({ tipo: "mandato", ...conId, riuscito: false, motivo: causa instanceof Error ? causa.message : "Non è partito." }),
      );
    };
    // I comandi dell'estensione che danno un segnale arrivano alle sue pagine accese.
    const alSegnale = (evento: Event): void => {
      const { idEstensione, nome } = (evento as CustomEvent<{ idEstensione: string; nome: string }>).detail;
      if (idEstensione === id) rispondi({ tipo: "segnale", nome });
    };
    window.addEventListener("message", alMessaggio);
    segnali.addEventListener("segnale", alSegnale);
    return () => {
      window.removeEventListener("message", alMessaggio);
      segnali.removeEventListener("segnale", alSegnale);
      for (const controllo of flussi.values()) controllo.abort();
    };
  }, [id, titolo, qui, proposta, altezzaIniziale]);

  // A ogni cambiamento la pagina che ha chiesto lo stato lo riceve di nuovo.
  const statoInTesto = JSON.stringify(stato.current);
  useEffect(() => {
    if (!iscritta) return;
    riquadro.current?.contentWindow?.postMessage({ [CAMPO_DEL_PONTE]: "stato", stato: JSON.parse(statoInTesto) as unknown }, "*");
  }, [iscritta, statoInTesto]);

  return (
    <iframe
      ref={riquadro}
      className="riquadro-estensione"
      title={titolo}
      sandbox="allow-scripts"
      src={indirizzoPaginaEstensione(id, pagina, proposta)}
      {...(altezza === undefined ? {} : { style: { height: `${altezza}px` } })}
    />
  );
}

// --- I posti

/** Quanto è alta di partenza una pagina nei posti stretti. */
const ALTEZZE: Partial<Record<Posto, number>> = { testata: 36, "barra-di-stato": 28, "sopra-scrittura": 40, "sotto-scrittura": 32, "barra-sinistra": 160, ambiente: 220, sicurezza: 220 };

/** Le pagine di un posto stretto, una sotto l'altra: testata, barra di stato, intorno al campo di scrittura, sezioni. */
export function PostoEstensioni({ posto, qui: quiDato }: { posto: Posto; qui?: QuiPerLaPagina }): ReactNode {
  const quadro = useQuadroCorrente();
  const quiDalContesto = useQui();
  const qui = quiDato ?? quiDalContesto;
  const pagine = pagineNelPosto(quadro, posto, qui);
  if (pagine.length === 0) return null;
  return (
    <div className={`posto-estensioni posto-${posto}`} data-posto={posto} aria-label={`Estensioni: ${POSTI_IN_PAROLE[posto]}`}>
      {pagine.map(({ estensione, pagina }) => (
        <RiquadroEstensione
          key={`${estensione.id}/${pagina.id}`}
          id={estensione.id}
          pagina={pagina.id}
          titolo={pagina.titolo}
          qui={qui}
          posto={posto}
          {...(ALTEZZE[posto] === undefined ? {} : { altezzaIniziale: ALTEZZE[posto] })}
        />
      ))}
    </div>
  );
}

/** Una scelta che il browser ricorda: barre aperte o chiuse. */
function useRicordato(chiave: string, iniziale: boolean): [boolean, (valore: boolean) => void] {
  const [valore, setValore] = useState(() => {
    try {
      const scritto = window.localStorage.getItem(chiave);
      return scritto === null ? iniziale : scritto === "1";
    } catch {
      return iniziale;
    }
  });
  return [
    valore,
    (nuovo) => {
      setValore(nuovo);
      try {
        window.localStorage.setItem(chiave, nuovo ? "1" : "0");
      } catch {
        // Senza memoria del browser la scelta vale fino alla prossima apertura.
      }
    },
  ];
}

/** La barra a destra: le sue pagine una sotto l'altra, richiudibile, e la scelta resta. Chiusa, le pagine si fermano. */
export function BarraDestra(): ReactNode {
  const quadro = useQuadroCorrente();
  const qui = useQui();
  const pagine = pagineNelPosto(quadro, "barra-destra", qui);
  const strettoAllInizio = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 900px)").matches;
  const [aperta, setAperta] = useRicordato("shinka-barra-destra-aperta", !strettoAllInizio);
  if (pagine.length === 0) return null;
  return (
    <aside className={aperta ? "barra-destra aperta" : "barra-destra"} data-parte="barra-destra" aria-label="Barra delle estensioni">
      <button
        type="button"
        className="discreto mini apri-barra-destra"
        aria-expanded={aperta}
        aria-label={aperta ? "Chiudi la barra delle estensioni" : "Apri la barra delle estensioni"}
        title={aperta ? "Chiudi la barra" : "Apri la barra"}
        onClick={() => setAperta(!aperta)}
      >
        {aperta ? "›" : "‹"}
      </button>
      {aperta && (
        <div className="barra-destra-pagine">
          {pagine.map(({ estensione, pagina }) => (
            <section key={`${estensione.id}/${pagina.id}`} className="barra-destra-pagina">
              <div className="titolino">{pagina.titolo}</div>
              <RiquadroEstensione id={estensione.id} pagina={pagina.id} titolo={pagina.titolo} qui={qui} posto="barra-destra" />
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

/** In fondo alla barra laterale: le pagine del posto, in una sezione che si richiude. */
export function BarraSinistra(): ReactNode {
  const quadro = useQuadroCorrente();
  const qui = useQui();
  const pagine = pagineNelPosto(quadro, "barra-sinistra", qui);
  const [aperta, setAperta] = useRicordato("shinka-barra-sinistra-aperta", true);
  if (pagine.length === 0) return null;
  return (
    <details className="barra-sinistra" data-parte="barra-sinistra" open={aperta} onToggle={(evento) => setAperta(evento.currentTarget.open)}>
      <summary>Estensioni</summary>
      {aperta && <PostoEstensioni posto="barra-sinistra" qui={qui} />}
    </details>
  );
}

/** Il pannello flottante: un pulsante in basso a destra lo apre, con le sue pagine in schede. */
export function Flottante(): ReactNode {
  const quadro = useQuadroCorrente();
  const qui = useQui();
  const pagine = pagineNelPosto(quadro, "flottante", qui);
  const [aperto, setAperto] = useState(false);
  const [scelta, setScelta] = useState(0);
  if (pagine.length === 0) return null;
  const attuale = pagine[Math.min(scelta, pagine.length - 1)];
  return (
    <div className="flottante" data-parte="flottante">
      {aperto && attuale !== undefined && (
        <section className="flottante-pannello" aria-label="Pannello delle estensioni">
          <header className="flottante-testata">
            {pagine.map(({ pagina, estensione }, posto) => (
              <button key={`${estensione.id}/${pagina.id}`} type="button" className={posto === scelta ? "scheda attiva" : "scheda"} onClick={() => setScelta(posto)}>
                {pagina.titolo}
              </button>
            ))}
            <span className="spazio" />
            <button type="button" className="discreto mini" aria-label="Chiudi il pannello" onClick={() => setAperto(false)}>
              ×
            </button>
          </header>
          <RiquadroEstensione key={`${attuale.estensione.id}/${attuale.pagina.id}`} id={attuale.estensione.id} pagina={attuale.pagina.id} titolo={attuale.pagina.titolo} qui={qui} posto="flottante" />
        </section>
      )}
      <button type="button" className="apri-flottante" aria-expanded={aperto} aria-label="Pannello delle estensioni" title="Pannello delle estensioni" onClick={() => setAperto(!aperto)}>
        ✦
      </button>
    </div>
  );
}

// --- Le parti nascoste o sostituite

/** Come un'estensione accesa ha cambiato una parte: nascosta, o sostituita da una sua pagina. */
export function parteCambiata(quadro: Quadro, parte: Parte): { nascosta: true } | { pagina: PaginaAccesa } | undefined {
  for (const estensione of accese(quadro)) {
    const cambio = estensione.parti.find((una) => una.parte === parte);
    if (cambio === undefined) continue;
    const pagina = cambio.pagina === undefined ? undefined : estensione.pagine.find((una) => una.id === cambio.pagina);
    return pagina === undefined ? { nascosta: true } : { pagina: { estensione, pagina: { id: pagina.id, titolo: pagina.titolo } } };
  }
  return undefined;
}

/**
 * Una parte dell'interfaccia che un'estensione può nascondere o sostituire: com'è, se nessuna la
 * cambia. Con `data-parte` anche i temi la trovano.
 */
export function Parte({ nome, qui: quiDato, children }: { nome: Parte; qui?: QuiPerLaPagina; children: ReactNode }): ReactNode {
  const quadro = useQuadroCorrente();
  const quiDalContesto = useQui();
  const cambio = parteCambiata(quadro, nome);
  if (cambio === undefined) return children;
  if ("nascosta" in cambio) return null;
  return (
    <div className={`parte-sostituita parte-${nome}`} data-parte={nome}>
      <RiquadroEstensione id={cambio.pagina.estensione.id} pagina={cambio.pagina.pagina.id} titolo={cambio.pagina.pagina.titolo} qui={quiDato ?? quiDalContesto} posto="parte" />
    </div>
  );
}

// --- I comandi

/** I comandi delle estensioni accese, con la loro estensione. */
export function comandiDelleEstensioni(quadro: Quadro): { estensione: EstensioneInterfaccia; comando: ComandoDiEstensione }[] {
  return accese(quadro).flatMap((estensione) => estensione.comandi.map((comando) => ({ estensione, comando })));
}

/** Esegue un comando: apre una pagina, manda un testo alla conversazione aperta, o dà un segnale alle pagine dell'estensione. */
export function eseguiComando(estensione: EstensioneInterfaccia, comando: ComandoDiEstensione, qui: QuiPerLaPagina): void {
  const azione = comando.azione;
  if (azione.tipo === "pagina") vaiA({ tipo: "interfaccia", id: estensione.id, pagina: azione.pagina });
  else if (azione.tipo === "segnale") daiSegnale(estensione.id, azione.nome);
  else {
    const base = qui.tipo === "progetto" ? baseDelProgetto(qui.id) : BASE_HOME;
    void inviaMessaggio(base, azione.testo).catch(() => {});
  }
}

/** Le scorciatoie dei comandi delle estensioni accese. */
export function useScorciatoieEstensioni(quadro: Quadro, qui: QuiPerLaPagina): void {
  const comandi = comandiDelleEstensioni(quadro).filter(({ comando }) => comando.tasti !== undefined);
  const attuali = useRef({ comandi, qui });
  attuali.current = { comandi, qui };
  useEffect(() => {
    const alTasto = (evento: KeyboardEvent): void => {
      const trovato = attuali.current.comandi.find(({ comando }) => comando.tasti !== undefined && tastiCombaciano(comando.tasti, evento));
      if (trovato === undefined) return;
      evento.preventDefault();
      eseguiComando(trovato.estensione, trovato.comando, attuali.current.qui);
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, []);
}

// --- Temi, pagine del menu, pulsanti

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

/** Una pagina di un'estensione aperta dal menu delle pagine, o da un comando. */
export function PaginaEstensione({ menu, id, pagina }: { menu: ReactNode; id: string; pagina: string }): ReactNode {
  const quadro = useQuadroCorrente();
  const estensione = quadro.interfaccia?.estensioni.find((una) => una.id === id);
  const trovata = estensione?.accesa === true && !senzaEstensioni() ? estensione.pagine.find((una) => una.id === pagina) : undefined;
  const qui = useRef<QuiPerLaPagina>({ tipo: "pagina" }).current;
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
        <RiquadroEstensione key={`${id}/${pagina}`} id={id} pagina={pagina} titolo={trovata.titolo} qui={qui} posto="menu" />
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
  if (pulsanti.length === 0 || parteCambiata(quadro, "pulsanti-estensioni") !== undefined) return null;
  return (
    <div className="pulsanti-estensioni" data-parte="pulsanti-estensioni" aria-label="Pulsanti delle estensioni">
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

// --- La scheda

type Proposta = Extract<Elemento, { tipo: "interfaccia" }>;

function postiInParole(posti: { posto: Posto; ambito: string; client: string }[]): string {
  return posti
    .map((voce) => {
      const dove = POSTI_IN_PAROLE[voce.posto];
      const ambito = voce.ambito === "home" ? " (solo nella Home)" : voce.ambito === "progetti" ? " (solo nei progetti)" : "";
      const client = voce.client === "web" ? " (solo nel sito)" : voce.client === "desktop" ? " (solo in Shinka Desktop)" : "";
      return `${dove}${ambito}${client}`;
    })
    .join("; ");
}

/** La scheda con cui la Home propone un'estensione dell'interfaccia: che cosa aggiunge e dove, quali API usa, con le pagine da guardare in anteprima. */
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

  const tutteLeApi = proposta.api.some((voce) => voce.toLowerCase() === "tutte");
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
                {pagina.titolo} <span className="tenue">· {pagina.posti.length === 0 ? "solo da un comando o al posto di una parte" : postiInParole(pagina.posti)}</span>{" "}
                <a href={indirizzoPaginaEstensione(proposta.chiave, pagina.id, true)} target="_blank" rel="noreferrer">
                  Anteprima
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="voce-scheda api-estensione">
        <div className="titolino">API di Shinka</div>
        {proposta.api.length === 0 ? (
          <div>Nessuna: le pagine leggono lo stato e mandano messaggi, non altro.</div>
        ) : (
          <>
            <div>
              {tutteLeApi
                ? "Tutte: le pagine possono fare con le API ciò che fai tu dall'interfaccia, con la tua sessione."
                : "Le pagine chiamano queste API con la tua sessione, e nessun'altra:"}
            </div>
            {!tutteLeApi && (
              <ul className="contenuto-estensione">
                {proposta.api.map((voce) => (
                  <li key={voce}>
                    <code>{voce}</code>
                  </li>
                ))}
              </ul>
            )}
            <div className="tenue">
              Restano chiuse comunque l'accesso a Shinka (password, sessioni, dispositivi, copie dei dati) e le decisioni che spettano a te: permessi, approvazioni, proposte, installazioni.
              Ogni richiesta entra nel registro della pagina Sicurezza con il nome dell'estensione.
            </div>
          </>
        )}
      </div>
      {proposta.comandi.length > 0 && (
        <div className="voce-scheda">
          <div className="titolino">Comandi</div>
          <ul className="contenuto-estensione">
            {proposta.comandi.map((comando) => (
              <li key={comando.etichetta}>
                <strong>{comando.etichetta}</strong>
                {comando.tasti === undefined ? "" : ` (${comando.tasti})`}{" "}
                <span className="tenue">
                  ·{" "}
                  {comando.azione.tipo === "pagina"
                    ? `apre la pagina «${proposta.pagine.find((pagina) => comando.azione.tipo === "pagina" && pagina.id === comando.azione.pagina)?.titolo ?? comando.azione.pagina}»`
                    : comando.azione.tipo === "messaggio"
                      ? `manda: ${comando.azione.testo}`
                      : "dà un segnale alle sue pagine"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposta.parti.length > 0 && (
        <div className="voce-scheda">
          <div className="titolino">Parti dell'interfaccia</div>
          <ul className="contenuto-estensione">
            {proposta.parti.map((parte) => (
              <li key={parte.parte}>
                {parte.pagina === undefined ? "Nasconde" : "Sostituisce"} {PARTI_IN_PAROLE[parte.parte]}
                {parte.pagina === undefined ? "" : ` con la pagina «${proposta.pagine.find((pagina) => pagina.id === parte.pagina)?.titolo ?? parte.pagina}»`}
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
        Le pagine girano in un riquadro senza rete. Se un'estensione rompe l'interfaccia, aprila con «?senza-estensioni» nell'indirizzo e spegnila dalla pagina Estensioni.
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
