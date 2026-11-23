import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState, type PointerEvent as PuntatoreReact, type ReactNode } from "react";
import type { ShellDisponibile, TerminaleAperto } from "../ponte/tipi.ts";
import {
  RIQUADRI_MASSIMI,
  SCHEDE_MASSIME,
  conDivisione,
  conNuovaScheda,
  conRiquadroAttivo,
  conSchedaInVista,
  daSalvare,
  daSalvata,
  progettoDi,
  senzaRiquadro,
  senzaScheda,
  type Disposizione,
  type Riquadro,
  type Verso,
} from "./disposizione.ts";
import { ponte } from "./ponte.ts";

const CHIAVE_PANNELLO = "shinka-desktop.terminali";
const CHIAVE_LUOGO = "shinka-desktop.terminali.";
const LARGHEZZA_MINIMA = 300;
/** Quanto resta almeno all'interfaccia di Shinka, accanto ai terminali. */
const RESTO_MINIMO = 420;

const TEMA = {
  background: "#151517",
  foreground: "#ecebe8",
  cursor: "#7ea2ff",
  cursorAccent: "#151517",
  selectionBackground: "#3a4a78",
};

interface Pannello {
  aperto: boolean;
  larghezza: number;
}

function leggiIlPannello(): Pannello {
  try {
    const letto = JSON.parse(window.localStorage.getItem(CHIAVE_PANNELLO) ?? "null") as Partial<Pannello> | null;
    return { aperto: letto?.aperto === true, larghezza: typeof letto?.larghezza === "number" ? letto.larghezza : 520 };
  } catch {
    return { aperto: false, larghezza: 520 };
  }
}

function salva(chiave: string, valore: string): void {
  try {
    window.localStorage.setItem(chiave, valore);
  } catch {
    // Senza spazio per ricordarla, la disposizione vale fino alla chiusura.
  }
}

function entro(larghezza: number): number {
  return Math.round(Math.max(LARGHEZZA_MINIMA, Math.min(larghezza, window.innerWidth - RESTO_MINIMO)));
}

function nomeDellaCartella(cartella: string): string {
  return cartella.split(/[\\/]/).filter((parte) => parte !== "").at(-1) ?? cartella;
}

/**
 * I terminali di questo PC (ADR 0005), a destra dell'interfaccia: ogni progetto ha i suoi, e
 * tutto il resto usa quelli della Home. Le shell restano accese passando da un luogo all'altro; la
 * disposizione di schede e riquadri si ritrova alla prossima apertura, con shell nuove.
 */
export function Terminali({ luogo }: { luogo: string }): ReactNode {
  const [pannello, setPannello] = useState(leggiIlPannello);
  const [luoghi, setLuoghi] = useState<Record<string, Disposizione>>({});
  const [shell, setShell] = useState<ShellDisponibile[]>([]);
  const [aperti, setAperti] = useState<Record<string, TerminaleAperto>>({});
  const [menuDelleShell, setMenuDelleShell] = useState(false);
  const [trascina, setTrascina] = useState(false);
  const luogoAdesso = useRef(luogo);
  luogoAdesso.current = luogo;
  const apertoAdesso = useRef(pannello.aperto);
  apertoAdesso.current = pannello.aperto;

  const disposizione = luoghi[luogo];

  useEffect(() => {
    void ponte.terminali.shell().then(setShell);
  }, []);

  useEffect(() => {
    salva(CHIAVE_PANNELLO, JSON.stringify(pannello));
  }, [pannello]);

  // Un luogo visto per la prima volta con i terminali aperti ritrova la sua disposizione.
  useEffect(() => {
    if (!pannello.aperto) return;
    setLuoghi((prima) => (prima[luogo] === undefined ? { ...prima, [luogo]: daSalvata(window.localStorage.getItem(CHIAVE_LUOGO + luogo)) } : prima));
  }, [luogo, pannello.aperto]);

  useEffect(() => {
    for (const [nome, voce] of Object.entries(luoghi)) salva(CHIAVE_LUOGO + nome, daSalvare(voce));
  }, [luoghi]);

  const cambia = useCallback((dove: string, come: (disposizione: Disposizione) => Disposizione) => {
    setLuoghi((prima) => {
      const adesso = prima[dove] ?? daSalvata(window.localStorage.getItem(CHIAVE_LUOGO + dove));
      const dopo = come(adesso);
      return dopo === prima[dove] ? prima : { ...prima, [dove]: dopo };
    });
  }, []);

  const mostra = useCallback(
    (aperto: boolean) => {
      setPannello((prima) => ({ ...prima, aperto }));
      // Aprire i terminali dove non ce n'è nessuno ne apre uno.
      if (aperto) cambia(luogoAdesso.current, (adesso) => (adesso.schede.length === 0 ? conNuovaScheda(adesso) : adesso));
    },
    [cambia],
  );

  const nuovaScheda = useCallback(
    (quale?: string) => {
      setMenuDelleShell(false);
      setPannello((prima) => ({ ...prima, aperto: true }));
      cambia(luogoAdesso.current, (adesso) => conNuovaScheda(adesso, quale));
    },
    [cambia],
  );

  useEffect(
    () =>
      ponte.terminali.alComando((comando) => {
        if (comando === "nuovo") nuovaScheda();
        else mostra(!apertoAdesso.current);
      }),
    [mostra, nuovaScheda],
  );

  // La finestra che si restringe non lascia i terminali più larghi di lei.
  useEffect(() => {
    const stringi = (): void => setPannello((prima) => (entro(prima.larghezza) === prima.larghezza ? prima : { ...prima, larghezza: entro(prima.larghezza) }));
    window.addEventListener("resize", stringi);
    stringi();
    return () => window.removeEventListener("resize", stringi);
  }, []);

  function allarga(evento: PuntatoreReact<HTMLDivElement>): void {
    if (evento.buttons !== 1) return;
    setPannello((prima) => ({ ...prima, larghezza: entro(window.innerWidth - evento.clientX - 40) }));
  }

  const dividi = (verso: Verso): void => cambia(luogo, (adesso) => conDivisione(adesso, verso));
  const scheda = disposizione?.schede.find((voce) => voce.id === disposizione.attiva);
  const pieno = scheda !== undefined && scheda.riquadri.length >= RIQUADRI_MASSIMI;
  const idProgetto = progettoDi(luogo);

  return (
    <>
      <aside className={trascina ? "terminali si-trascina" : "terminali"} hidden={!pannello.aperto} style={{ width: pannello.larghezza }} aria-label="Terminali di questo PC">
        <div
          className="terminali-maniglia"
          role="separator"
          aria-orientation="vertical"
          aria-label="Larghezza dei terminali"
          onPointerDown={(evento) => {
            evento.currentTarget.setPointerCapture(evento.pointerId);
            setTrascina(true);
          }}
          onPointerMove={allarga}
          onPointerUp={() => setTrascina(false)}
          onPointerCancel={() => setTrascina(false)}
        />
        <header className="terminali-testata">
          <div className="terminali-schede" role="tablist">
            {(disposizione?.schede ?? []).map((voce) => {
              const aperto = aperti[voce.attivo];
              const inVista = voce.id === disposizione?.attiva;
              return (
                <div key={voce.id} className={inVista ? "terminali-linguetta in-vista" : "terminali-linguetta"}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inVista}
                    title={aperto?.cartella}
                    onClick={() => cambia(luogo, (adesso) => conSchedaInVista(adesso, voce.id))}
                  >
                    <span className="terminali-shell">{aperto?.shell.nome ?? "Terminale"}</span>
                    {aperto !== undefined && <span className="terminali-dove">{aperto.delProgetto ? nomeDellaCartella(aperto.cartella) : "questo PC"}</span>}
                    {voce.riquadri.length > 1 && <span className="terminali-quanti">{voce.riquadri.length}</span>}
                  </button>
                  <button type="button" className="terminali-chiudi" aria-label="Chiudi la scheda" title="Chiudi la scheda" onClick={() => cambia(luogo, (adesso) => senzaScheda(adesso, voce.id))}>
                    <Croce />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="terminali-comandi">
            <button type="button" aria-label="Nuovo terminale" title="Nuovo terminale (Ctrl+Maiusc+T)" disabled={(disposizione?.schede.length ?? 0) >= SCHEDE_MASSIME} onClick={() => nuovaScheda()}>
              <Piu />
            </button>
            {shell.length > 1 && (
              <button type="button" aria-label="Scegli la shell" title="Scegli la shell" aria-expanded={menuDelleShell} onClick={() => setMenuDelleShell((prima) => !prima)}>
                <Freccia />
              </button>
            )}
            <button type="button" aria-label="Dividi a destra" title="Dividi a destra" disabled={scheda === undefined || pieno} onClick={() => dividi("affiancati")}>
              <DividiADestra />
            </button>
            <button type="button" aria-label="Dividi sotto" title="Dividi sotto" disabled={scheda === undefined || pieno} onClick={() => dividi("impilati")}>
              <DividiSotto />
            </button>
            <button type="button" aria-label="Nascondi i terminali" title="Nascondi i terminali (Ctrl+J)" onClick={() => mostra(false)}>
              <Croce />
            </button>
          </div>
          {menuDelleShell && (
            <ul className="terminali-menu" role="menu">
              {shell.map((voce) => (
                <li key={voce.id} role="none">
                  <button type="button" role="menuitem" onClick={() => nuovaScheda(voce.id)}>
                    {voce.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </header>
        <div className="terminali-corpo">
          {Object.entries(luoghi).flatMap(([nome, voce]) =>
            voce.schede.map((una) => {
              const inVista = nome === luogo && una.id === voce.attiva;
              return (
                <div key={una.id} className={`terminali-scheda ${una.verso}${inVista ? " in-vista" : ""}`} role="tabpanel" aria-hidden={!inVista}>
                  {una.riquadri.map((riquadro) => (
                    <RiquadroTerminale
                      key={riquadro.id}
                      riquadro={riquadro}
                      idProgetto={progettoDi(nome)}
                      conFuoco={inVista && pannello.aperto && una.attivo === riquadro.id}
                      segnato={inVista && una.riquadri.length > 1 && una.attivo === riquadro.id}
                      alFuoco={() => cambia(nome, (adesso) => conRiquadroAttivo(adesso, riquadro.id))}
                      alAperto={(aperto) => setAperti((prima) => ({ ...prima, [riquadro.id]: aperto }))}
                      allaFine={() => {
                        cambia(nome, (adesso) => senzaRiquadro(adesso, riquadro.id));
                        setAperti((prima) => {
                          const { [riquadro.id]: _tolto, ...resto } = prima;
                          return resto;
                        });
                      }}
                    />
                  ))}
                </div>
              );
            }),
          )}
          {(disposizione?.schede.length ?? 0) === 0 && (
            <div className="terminali-vuoti">
              <p>{idProgetto === undefined ? "Qui non c'è nessun terminale aperto." : "Questo progetto non ha terminali aperti."}</p>
              <button type="button" onClick={() => nuovaScheda()}>
                Nuovo terminale
              </button>
            </div>
          )}
        </div>
      </aside>
      <nav className="binario" aria-label="Strumenti di questo PC">
        <button
          type="button"
          className={pannello.aperto ? "acceso" : undefined}
          aria-pressed={pannello.aperto}
          aria-label="Terminali di questo PC"
          title="Terminali di questo PC (Ctrl+J)"
          onClick={() => mostra(!pannello.aperto)}
        >
          <IconaTerminale />
        </button>
      </nav>
    </>
  );
}

function RiquadroTerminale(proprieta: {
  riquadro: Riquadro;
  idProgetto: string | undefined;
  /** Vero se è il riquadro in cui si scrive, nella scheda in vista. */
  conFuoco: boolean;
  /** Vero se va distinto dagli altri riquadri della scheda. */
  segnato: boolean;
  alFuoco: () => void;
  alAperto: (aperto: TerminaleAperto) => void;
  allaFine: () => void;
}): ReactNode {
  const schermo = useRef<HTMLDivElement>(null);
  const terminale = useRef<Terminal>(undefined);
  // Le funzioni di chi lo usa cambiano a ogni disegno; la shell si apre una volta sola.
  const ultime = useRef(proprieta);
  ultime.current = proprieta;

  useEffect(() => {
    const contenitore = schermo.current;
    if (contenitore === null) return;
    const { riquadro, idProgetto } = ultime.current;
    const nuovo = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, ui-monospace, monospace',
      fontSize: 13,
      scrollback: 10_000,
      theme: TEMA,
    });
    terminale.current = nuovo;
    const adatta = new FitAddon();
    nuovo.loadAddon(adatta);
    nuovo.open(contenitore);
    try {
      adatta.fit();
    } catch {
      // Senza misure parte con quelle predefinite, e si adatta appena le ha.
    }

    const nato = Date.now();
    let finito = false;
    let smontato = false;
    const { id, aperto } = ponte.terminali.apri(
      { ...(riquadro.shell === undefined ? {} : { shell: riquadro.shell }), ...(idProgetto === undefined ? {} : { idProgetto }), colonne: nuovo.cols, righe: nuovo.rows },
      (dati) => nuovo.write(dati),
      (codice) => {
        finito = true;
        if (smontato) return;
        // Una shell che muore appena nata lascia scritto perché: il riquadro si chiude al primo tasto.
        if (codice !== 0 && Date.now() - nato < 3000) nuovo.write(`\r\n\x1b[2m[la shell si è chiusa con il codice ${codice}: premi un tasto per chiudere]\x1b[0m`);
        else ultime.current.allaFine();
      },
    );
    aperto.then(
      (dettagli) => {
        if (!smontato) ultime.current.alAperto(dettagli);
      },
      () => {
        finito = true;
        nuovo.write("\x1b[2m[non sono riuscito ad aprire una shell: premi un tasto per chiudere]\x1b[0m");
      },
    );

    nuovo.onData((dati) => {
      if (finito) ultime.current.allaFine();
      else ponte.terminali.scrivi(id, dati);
    });
    // Ctrl+C copia se c'è una selezione, altrimenti interrompe; Ctrl+V incolla una volta sola.
    nuovo.attachCustomKeyEventHandler((tasto) => {
      if (tasto.type !== "keydown" || !tasto.ctrlKey || tasto.altKey) return true;
      const lettera = tasto.key.toLowerCase();
      if (lettera === "c" && (tasto.shiftKey || nuovo.hasSelection())) {
        void navigator.clipboard.writeText(nuovo.getSelection()).catch(() => {});
        nuovo.clearSelection();
        tasto.preventDefault();
        return false;
      }
      if (lettera === "v") return false;
      return true;
    });
    const fuoco = (): void => ultime.current.alFuoco();
    nuovo.textarea?.addEventListener("focus", fuoco);

    let misure = `${nuovo.cols}x${nuovo.rows}`;
    const osserva = new ResizeObserver(() => {
      // Nascosto non ha misure: si adatta quando torna in vista.
      if (contenitore.clientWidth === 0 || contenitore.clientHeight === 0) return;
      try {
        adatta.fit();
      } catch {
        return;
      }
      const nuove = `${nuovo.cols}x${nuovo.rows}`;
      if (nuove === misure) return;
      misure = nuove;
      if (!finito) ponte.terminali.misura(id, nuovo.cols, nuovo.rows);
    });
    osserva.observe(contenitore);

    return () => {
      smontato = true;
      osserva.disconnect();
      nuovo.textarea?.removeEventListener("focus", fuoco);
      if (!finito) ponte.terminali.chiudi(id);
      nuovo.dispose();
      terminale.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (proprieta.conFuoco) terminale.current?.focus();
  }, [proprieta.conFuoco]);

  return (
    <div className={proprieta.segnato ? "terminali-riquadro segnato" : "terminali-riquadro"}>
      <div className="terminali-schermo" ref={schermo} />
    </div>
  );
}

function Icona({ children }: { children: ReactNode }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconaTerminale(): ReactNode {
  return (
    <Icona>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M4.5 6l2.2 2-2.2 2M8.5 10.5h3" />
    </Icona>
  );
}

function Croce(): ReactNode {
  return (
    <Icona>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icona>
  );
}

function Piu(): ReactNode {
  return (
    <Icona>
      <path d="M8 3v10M3 8h10" />
    </Icona>
  );
}

function Freccia(): ReactNode {
  return (
    <Icona>
      <path d="M4 6.5l4 4 4-4" />
    </Icona>
  );
}

function DividiADestra(): ReactNode {
  return (
    <Icona>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M8 2.5v11" />
    </Icona>
  );
}

function DividiSotto(): ReactNode {
  return (
    <Icona>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M1.5 8h13" />
    </Icona>
  );
}
