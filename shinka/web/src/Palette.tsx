/**
 * La palette dei comandi, con Ctrl+K (⌘K sul Mac): si scrive qualche lettera e si salta a un
 * progetto, a un argomento archiviato o a una pagina, o si fa un'azione come un argomento nuovo.
 * Frecce per scegliere, Invio per andare, Esc per chiudere.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { filtraPalette } from "./palette.ts";

export interface VocePalette {
  chiave: string;
  etichetta: string;
  /** Una parola sul genere: progetto, argomento, pagina, azione. */
  genere: string;
  dettaglio?: string;
  esegui(): void;
}

export function Palette({ voci, allaChiusura }: { voci: readonly VocePalette[]; allaChiusura: () => void }): ReactNode {
  const [scritto, setScritto] = useState("");
  const [scelta, setScelta] = useState(0);
  const elenco = useRef<HTMLUListElement>(null);
  const trovate = useMemo(() => filtraPalette(voci, scritto).slice(0, 50), [voci, scritto]);
  useEffect(() => setScelta(0), [scritto]);
  useEffect(() => {
    elenco.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [scelta]);
  const vai = (voce: VocePalette | undefined): void => {
    if (voce === undefined) return;
    allaChiusura();
    voce.esegui();
  };
  return (
    <div className="velo-palette" onMouseDown={allaChiusura}>
      <div className="palette" role="dialog" aria-label="Vai a" onMouseDown={(evento) => evento.stopPropagation()}>
        <input
          type="search"
          aria-label="Vai a un progetto, un argomento o una pagina"
          placeholder="Vai a un progetto, un argomento, una pagina…"
          autoFocus
          value={scritto}
          onChange={(evento) => setScritto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "ArrowDown") {
              evento.preventDefault();
              setScelta((prima) => Math.min(trovate.length - 1, prima + 1));
            } else if (evento.key === "ArrowUp") {
              evento.preventDefault();
              setScelta((prima) => Math.max(0, prima - 1));
            } else if (evento.key === "Enter") {
              evento.preventDefault();
              vai(trovate[scelta]);
            } else if (evento.key === "Escape") {
              evento.preventDefault();
              allaChiusura();
            }
          }}
        />
        <ul ref={elenco} role="listbox" aria-label="Risultati">
          {trovate.length === 0 && <li className="tenue">Niente con queste parole.</li>}
          {trovate.map((voce, posizione) => (
            <li
              key={voce.chiave}
              role="option"
              aria-selected={posizione === scelta}
              className={posizione === scelta ? "scelto" : undefined}
              onMouseEnter={() => setScelta(posizione)}
              onClick={() => vai(voce)}
            >
              <span className="genere-palette">{voce.genere}</span>
              <span className="etichetta-palette">{voce.etichetta}</span>
              {voce.dettaglio !== undefined && <span className="tenue dettaglio-palette">{voce.dettaglio}</span>}
            </li>
          ))}
        </ul>
        <p className="tenue piede-palette">
          ↑↓ per scegliere · Invio per andare · Esc per chiudere · Ctrl+K ovunque per riaprirla
        </p>
      </div>
    </div>
  );
}
