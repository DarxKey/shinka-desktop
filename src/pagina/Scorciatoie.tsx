import { useEffect, type ReactNode } from "react";
import { SCORCIATOIE, tastiInParole, type Gruppo } from "../ponte/scorciatoie.ts";

const GRUPPI: readonly Gruppo[] = ["Andare", "Terminali", "Finestra"];

/** Ciò che fa da sé il menu dell'app, e non passa dai comandi della pagina. */
const DEL_MENU: readonly { etichetta: string; tasti: string }[] = [
  { etichetta: "Ricarica la pagina", tasti: "F5" },
  { etichetta: "Schermo intero", tasti: "F11" },
  { etichetta: "Ingrandisci, rimpicciolisci, dimensione normale", tasti: "Ctrl+=  Ctrl+-  Ctrl+0" },
  { etichetta: "Esci da Shinka Desktop", tasti: "Ctrl+Q" },
];

/** L'elenco delle scorciatoie da tastiera, sopra la pagina. Si chiude con Esc o cliccando fuori. */
export function Scorciatoie({ allaChiusura }: { allaChiusura: () => void }): ReactNode {
  useEffect(() => {
    const alTasto = (evento: KeyboardEvent): void => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      evento.stopPropagation();
      allaChiusura();
    };
    window.addEventListener("keydown", alTasto, true);
    return () => window.removeEventListener("keydown", alTasto, true);
  }, [allaChiusura]);

  return (
    <div className="velo-palette" onMouseDown={allaChiusura}>
      <div className="palette scorciatoie" role="dialog" aria-label="Scorciatoie da tastiera" onMouseDown={(evento) => evento.stopPropagation()}>
        <h2>Scorciatoie da tastiera</h2>
        <div className="scorciatoie-elenco">
          {GRUPPI.map((gruppo) => (
            <section key={gruppo}>
              <h3>{gruppo}</h3>
              <dl>
                {SCORCIATOIE.filter((voce) => voce.gruppo === gruppo).map((voce) => (
                  <Riga key={voce.comando} etichetta={voce.etichetta} tasti={tastiInParole(voce.tasti)} />
                ))}
                {gruppo === "Finestra" && DEL_MENU.map((voce) => <Riga key={voce.etichetta} etichetta={voce.etichetta} tasti={voce.tasti} />)}
              </dl>
            </section>
          ))}
        </div>
        <p className="tenue piede-palette">Mentre scrivi in un terminale Ctrl+K, Ctrl+W, Ctrl+, e Alt+← Alt+→ restano della shell.</p>
      </div>
    </div>
  );
}

function Riga({ etichetta, tasti }: { etichetta: string; tasti: string }): ReactNode {
  return (
    <div className="scorciatoie-riga">
      <dt>{etichetta}</dt>
      <dd>
        <kbd>{tasti}</kbd>
      </dd>
    </div>
  );
}
