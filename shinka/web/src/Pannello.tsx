import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { StatoAnteprima } from "../../src/protocollo/anteprima.ts";
import { Anteprima, type RichiestaAnteprima } from "./Anteprima.tsx";
import { PannelloFile } from "./PannelloFile.tsx";
import { PannelloModifiche, type TurnoModificato } from "./PannelloModifiche.tsx";
import type { FileDeiComandi } from "../../src/protocollo/modifiche.ts";

// Il terminale porta con sé una libreria pesante: si carica solo quando lo si apre.
const Terminale = lazy(() => import("./Terminale.tsx").then((modulo) => ({ default: modulo.Terminale })));

export type Scheda = "modifiche" | "file" | "terminale" | "anteprima";

const NOMI_SCHEDE: Record<Scheda, string> = { modifiche: "Modifiche", file: "File", terminale: "Terminale", anteprima: "Anteprima" };

/** I pulsanti in testata al progetto: aprono il pannello sulla scheda scelta, o lo chiudono. */
export function PulsantiPannello({
  scheda,
  alClic,
}: {
  scheda: Scheda | undefined;
  alClic: (scheda: Scheda) => void;
}): ReactNode {
  return (
    <div className="pulsanti-pannello">
      <button
        type="button"
        className={scheda === "modifiche" ? "discreto icona attiva" : "discreto icona"}
        aria-label="Modifiche ai file"
        title="Modifiche ai file"
        aria-pressed={scheda === "modifiche"}
        onClick={() => alClic("modifiche")}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <path d="M5 3.5h7l3 3v10H5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 8v5M7.5 10.5h5M7.5 15h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className={scheda === "file" ? "discreto icona attiva" : "discreto icona"}
        aria-label="File del progetto"
        title="File del progetto"
        aria-pressed={scheda === "file"}
        onClick={() => alClic("file")}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.5l1.5 2h7a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className={scheda === "terminale" ? "discreto icona attiva secondario" : "discreto icona secondario"}
        aria-label="Terminale del progetto"
        title="Terminale del progetto"
        aria-pressed={scheda === "terminale"}
        onClick={() => alClic("terminale")}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <rect x="2" y="3.5" width="16" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 8l3 2.5-3 2.5M10.5 13h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className={scheda === "anteprima" ? "discreto icona attiva secondario" : "discreto icona secondario"}
        aria-label="Anteprima dell'applicazione"
        title="Anteprima dell'applicazione"
        aria-pressed={scheda === "anteprima"}
        onClick={() => alClic("anteprima")}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <rect x="2" y="3.5" width="16" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 7.5h16" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4.75" cy="5.5" r="0.75" fill="currentColor" />
          <circle cx="7.25" cy="5.5" r="0.75" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Il pannello accanto alla chat di un progetto: il suo terminale e l'anteprima della sua
 * applicazione, tutti e due nell'ambiente del progetto. Sugli schermi stretti copre la chat.
 */
export function PannelloProgetto({
  idProgetto,
  nomeAmbiente,
  scheda,
  alCambio,
  allaChiusura,
  anteprima,
  richiesta,
  turni,
  turnoScelto,
  occupata,
  fileDeiComandi,
}: {
  idProgetto: string;
  nomeAmbiente: string;
  scheda: Scheda;
  alCambio: (scheda: Scheda) => void;
  allaChiusura: () => void;
  anteprima: StatoAnteprima | undefined;
  richiesta: RichiestaAnteprima | undefined;
  /** I turni in cui Claude ha cambiato dei file, per la scheda Modifiche. */
  turni: readonly TurnoModificato[];
  /** Il turno da aprire nella scheda Modifiche. */
  turnoScelto?: string;
  /** Vero mentre Claude lavora: allora i file non si riportano indietro. */
  occupata: boolean;
  /** Se tra le modifiche entrano i file cambiati dai comandi, quando la conversazione lo ha detto. */
  fileDeiComandi?: FileDeiComandi;
}): ReactNode {
  const pannello = useRef<HTMLElement>(null);
  // Una scheda nasce la prima volta che la si guarda, e poi resta: cambiare scheda non chiude il terminale.
  const [viste, setViste] = useState<ReadonlySet<Scheda>>(() => new Set([scheda]));
  useEffect(() => {
    setViste((prima) => (prima.has(scheda) ? prima : new Set([...prima, scheda])));
  }, [scheda]);

  // Sul telefono la tastiera copre la parte bassa dello schermo: il pannello occupa solo ciò che resta in vista.
  useEffect(() => {
    const vista = window.visualViewport;
    const elemento = pannello.current;
    if (vista === null || elemento === null) return;
    const aggiorna = (): void => {
      elemento.style.setProperty("--altezza-in-vista", `${Math.round(vista.height)}px`);
      elemento.style.setProperty("--scarto-in-vista", `${Math.round(vista.offsetTop)}px`);
    };
    aggiorna();
    vista.addEventListener("resize", aggiorna);
    vista.addEventListener("scroll", aggiorna);
    return () => {
      vista.removeEventListener("resize", aggiorna);
      vista.removeEventListener("scroll", aggiorna);
    };
  }, []);

  return (
    <aside className="affianco" ref={pannello} aria-label="Modifiche, file, terminale e anteprima del progetto">
      <header className="affianco-testata">
        <div className="schede" role="tablist">
          {(Object.keys(NOMI_SCHEDE) as Scheda[]).map((una) => (
            <button key={una} type="button" role="tab" aria-selected={scheda === una} className="scheda" onClick={() => alCambio(una)}>
              {NOMI_SCHEDE[una]}
            </button>
          ))}
        </div>
        <button type="button" className="discreto chiudi-affianco" aria-label="Chiudi il pannello e torna alla chat" onClick={allaChiusura}>
          ×
        </button>
      </header>
      <div className="affianco-corpo scorre" role="tabpanel" hidden={scheda !== "modifiche"}>
        {viste.has("modifiche") && (
          <PannelloModifiche
            idProgetto={idProgetto}
            turni={turni}
            {...(turnoScelto === undefined ? {} : { scelto: turnoScelto })}
            occupata={occupata}
            {...(fileDeiComandi === undefined ? {} : { fileDeiComandi })}
          />
        )}
      </div>
      <div className="affianco-corpo scorre" role="tabpanel" hidden={scheda !== "file"}>
        {viste.has("file") && <PannelloFile idProgetto={idProgetto} />}
      </div>
      <div className="affianco-corpo" role="tabpanel" hidden={scheda !== "terminale"}>
        {viste.has("terminale") && (
          <Suspense fallback={<div className="vuota-di-pannello">Apro il terminale…</div>}>
            <Terminale idProgetto={idProgetto} nomeAmbiente={nomeAmbiente} />
          </Suspense>
        )}
      </div>
      <div className="affianco-corpo" role="tabpanel" hidden={scheda !== "anteprima"}>
        {viste.has("anteprima") && (
          <Anteprima idProgetto={idProgetto} nomeAmbiente={nomeAmbiente} stato={anteprima} richiesta={richiesta} />
        )}
      </div>
    </aside>
  );
}
