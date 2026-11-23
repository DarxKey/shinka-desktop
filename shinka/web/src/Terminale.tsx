import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DalBrowserAlTerminale, DalTerminaleAlBrowser } from "../../src/protocollo/terminale.ts";
import { indirizzoDelTerminale } from "./api.ts";
import { conCtrl } from "./descrivi.ts";

type Fase =
  | { fase: "collegamento" }
  | { fase: "aperto" }
  /** `riprova` è vero quando il terminale è ancora acceso nel suo ambiente e si è perso solo il collegamento. */
  | { fase: "chiuso"; motivo: string; riprova: boolean };

/** Il terminale è scuro in ogni tema: i colori dei programmi sono pensati per uno sfondo scuro. */
const TEMA = {
  background: "#151517",
  foreground: "#ecebe8",
  cursor: "#7ea2ff",
  cursorAccent: "#151517",
  selectionBackground: "#3a4a78",
};

/** I tasti che una tastiera da telefono non ha. */
const TASTI: { etichetta: string; nome: string; dati: string }[] = [
  { etichetta: "Esc", nome: "Esc", dati: "\x1b" },
  { etichetta: "Tab", nome: "Tab", dati: "\t" },
  { etichetta: "↑", nome: "Freccia su", dati: "\x1b[A" },
  { etichetta: "↓", nome: "Freccia giù", dati: "\x1b[B" },
  { etichetta: "←", nome: "Freccia a sinistra", dati: "\x1b[D" },
  { etichetta: "→", nome: "Freccia a destra", dati: "\x1b[C" },
  { etichetta: "^C", nome: "Interrompi il comando", dati: "\x03" },
];

/** Quante volte di seguito si riprova da soli a ricollegarsi. */
const TENTATIVI_DA_SOLI = 4;

/**
 * Il terminale del progetto: una shell nella sua cartella, nel suo ambiente. Resta accesa quando
 * questa pagina si chiude: riaprendola si ritrova ciò che è uscito nel frattempo.
 */
export function Terminale({ idProgetto, nomeAmbiente }: { idProgetto: string; nomeAmbiente: string }): ReactNode {
  const schermo = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>({ fase: "collegamento" });
  /** Ogni cambio riapre il collegamento da capo. */
  const [giro, setGiro] = useState(0);
  const tentativi = useRef(0);
  const [ctrl, setCtrl] = useState(false);
  const ctrlAttivo = useRef(false);
  const [daSpegnere, setDaSpegnere] = useState(false);
  const scrivi = useRef<(dati: string) => void>(() => {});
  const spegni = useRef<() => void>(() => {});
  const metti = useRef<() => void>(() => {});

  useEffect(() => {
    ctrlAttivo.current = ctrl;
  }, [ctrl]);

  useEffect(() => {
    const contenitore = schermo.current;
    if (contenitore === null) return;
    setFase({ fase: "collegamento" });
    const terminale = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: TEMA,
    });
    const adatta = new FitAddon();
    terminale.loadAddon(adatta);
    terminale.open(contenitore);

    const socket = new WebSocket(indirizzoDelTerminale(idProgetto));
    let aperto = false;
    let dettoChiuso = false;
    let smontato = false;
    let ripresa: ReturnType<typeof setTimeout> | undefined;
    const manda = (messaggio: DalBrowserAlTerminale): void => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(messaggio));
    };

    let misure = "";
    const misura = (): void => {
      // Nascosto dietro l'altra scheda non ha misure: si adatta quando torna in vista.
      if (contenitore.clientWidth === 0 || contenitore.clientHeight === 0) return;
      try {
        adatta.fit();
      } catch {
        return;
      }
      const nuove = `${terminale.cols}x${terminale.rows}`;
      if (!aperto || nuove === misure) return;
      misure = nuove;
      manda({ tipo: "misura", colonne: terminale.cols, righe: terminale.rows });
    };

    socket.onopen = () => {
      misura();
      manda({ tipo: "apri", colonne: terminale.cols, righe: terminale.rows });
    };
    socket.onmessage = (evento: MessageEvent<string>) => {
      const messaggio = JSON.parse(evento.data) as DalTerminaleAlBrowser;
      switch (messaggio.tipo) {
        case "aperto":
          aperto = true;
          misure = `${terminale.cols}x${terminale.rows}`;
          tentativi.current = 0;
          terminale.reset();
          terminale.write(messaggio.finora);
          setFase({ fase: "aperto" });
          return;
        case "uscita":
          terminale.write(messaggio.dati);
          return;
        case "chiuso":
          aperto = false;
          dettoChiuso = true;
          setFase({ fase: "chiuso", motivo: messaggio.motivo, riprova: false });
          return;
      }
    };
    socket.onclose = () => {
      if (smontato || dettoChiuso) return;
      aperto = false;
      // Il telefono che si blocca o la rete che cade chiudono il collegamento, non il terminale.
      const daSolo = tentativi.current < TENTATIVI_DA_SOLI;
      setFase({ fase: "chiuso", motivo: "Collegamento con Shinka interrotto.", riprova: daSolo });
      if (daSolo) {
        tentativi.current += 1;
        ripresa = setTimeout(() => setGiro((n) => n + 1), 1500 * tentativi.current);
      }
    };

    const battuto = terminale.onData((dati) => {
      if (ctrlAttivo.current) {
        setCtrl(false);
        manda({ tipo: "scrivi", dati: conCtrl(dati) });
        return;
      }
      manda({ tipo: "scrivi", dati });
    });
    scrivi.current = (dati) => manda({ tipo: "scrivi", dati });
    spegni.current = () => manda({ tipo: "chiudi" });
    metti.current = () => terminale.focus();

    const osservatore = new ResizeObserver(() => misura());
    osservatore.observe(contenitore);

    return () => {
      smontato = true;
      clearTimeout(ripresa);
      osservatore.disconnect();
      battuto.dispose();
      socket.close();
      terminale.dispose();
      scrivi.current = () => {};
      spegni.current = () => {};
      metti.current = () => {};
    };
  }, [idProgetto, giro]);

  // La conferma di spegnimento si ritira da sola.
  useEffect(() => {
    if (!daSpegnere) return;
    const scadenza = setTimeout(() => setDaSpegnere(false), 4000);
    return () => clearTimeout(scadenza);
  }, [daSpegnere]);

  function riapri(): void {
    tentativi.current = 0;
    setGiro((n) => n + 1);
  }

  return (
    <div className="terminale">
      <div className="terminale-barra">
        <span className="tenue">
          {fase.fase === "aperto"
            ? `Shell in ${nomeAmbiente}, nella cartella del progetto`
            : fase.fase === "collegamento"
              ? "Apro il terminale…"
              : fase.riprova
                ? `${fase.motivo} Riprovo…`
                : fase.motivo}
        </span>
        {fase.fase === "chiuso" && (
          <button type="button" className="mini" onClick={riapri}>
            Riapri
          </button>
        )}
        {fase.fase === "aperto" && (
          <button
            type="button"
            className={daSpegnere ? "mini pericolo" : "mini discreto"}
            title="Spegne la shell e ciò che vi sta girando"
            onClick={() => {
              if (!daSpegnere) {
                setDaSpegnere(true);
                return;
              }
              setDaSpegnere(false);
              spegni.current();
            }}
          >
            {daSpegnere ? "Sì, spegni" : "Spegni"}
          </button>
        )}
      </div>
      <div className="terminale-schermo" ref={schermo} />
      <div className="tasti" role="toolbar" aria-label="Tasti che la tastiera del telefono non ha">
        {TASTI.slice(0, 2).map((tasto) => (
          <Tasto key={tasto.nome} {...tasto} premi={() => scrivi.current(tasto.dati)} torna={() => metti.current()} />
        ))}
        <button
          type="button"
          className={ctrl ? "tasto attivo" : "tasto"}
          aria-pressed={ctrl}
          title="Ctrl insieme al prossimo tasto"
          onPointerDown={(evento) => evento.preventDefault()}
          onClick={() => {
            setCtrl((attivo) => !attivo);
            metti.current();
          }}
        >
          Ctrl
        </button>
        {TASTI.slice(2).map((tasto) => (
          <Tasto key={tasto.nome} {...tasto} premi={() => scrivi.current(tasto.dati)} torna={() => metti.current()} />
        ))}
      </div>
    </div>
  );
}

function Tasto({
  etichetta,
  nome,
  premi,
  torna,
}: {
  etichetta: string;
  nome: string;
  premi: () => void;
  torna: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      className="tasto"
      aria-label={nome}
      // Il tasto non porta via il cursore dal terminale: la tastiera del telefono resta aperta.
      onPointerDown={(evento) => evento.preventDefault()}
      onClick={() => {
        premi();
        torna();
      }}
    >
      {etichetta}
    </button>
  );
}
