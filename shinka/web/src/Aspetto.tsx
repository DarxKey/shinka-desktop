/** Il menu Aspetto, in fondo alla barra laterale: il tema e la vista della trascrizione. */

import type { ReactNode } from "react";
import { cambiaAspetto, NOMI_TEMI, NOMI_VISTE, TEMI, useAspetto, VISTE } from "./aspetto.ts";

export function MenuAspetto(): ReactNode {
  const { tema, vista } = useAspetto();
  return (
    <details className="aspetto">
      <summary>Aspetto</summary>
      <div className="pannello-aspetto">
        <fieldset>
          <legend>Tema</legend>
          <div className="segmenti">
            {TEMI.map((voce) => (
              <label key={voce} className={voce === tema ? "segmento scelto" : "segmento"}>
                <input type="radio" name="tema" value={voce} checked={voce === tema} onChange={() => cambiaAspetto({ tema: voce })} />
                {NOMI_TEMI[voce]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Trascrizione</legend>
          <div className="segmenti verticali">
            {VISTE.map((voce) => (
              <label key={voce} className={voce === vista ? "segmento scelto" : "segmento"}>
                <input type="radio" name="vista" value={voce} checked={voce === vista} onChange={() => cambiaAspetto({ vista: voce })} />
                {NOMI_VISTE[voce]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}
