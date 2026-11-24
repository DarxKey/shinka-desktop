import { useEffect, useState } from "react";
import { altraParola, CAMBIO_PAROLA_MS, silenzioInParole } from "./parole-buffe.ts";

/**
 * Il germoglio del logo di Shinka, che mentre Claude lavora oscilla dalla base e apre le foglie a
 * turno. Gli stessi tratti dell'icona, a facce, senza il fondo: la faccia in ombra è più tenue. Con
 * le animazioni ridotte resta fermo.
 */
function Germoglio() {
  return (
    <svg className="germoglio" viewBox="120 90 280 340" width="18" height="20" aria-hidden="true" focusable="false">
      <g className="pianta">
        <path d="M248 414 L242 338 L248 262" fill="none" stroke="currentColor" strokeWidth="34" strokeLinecap="square" />
        <g className="foglia piccola">
          <path d="M246 318 L190 312 L132 240 Z" fill="currentColor" />
          <path d="M246 318 L132 240 L200 246 Z" fill="currentColor" opacity="0.55" />
        </g>
        <g className="foglia grande">
          <path d="M232 270 L250 196 L302 138 L380 102 Z" fill="currentColor" />
          <path d="M232 270 L380 102 L366 176 L320 232 Z" fill="currentColor" opacity="0.55" />
        </g>
      </g>
    </svg>
  );
}

/**
 * La riga che dice che Claude sta lavorando: il germoglio di Shinka che si muove, e una parola
 * buffa che cambia ogni pochi secondi, con tre puntini che lampeggiano. Se Claude tace da un po' lo
 * dice; se aspetta una risposta del proprietario, al posto della parola buffa c'è quello, ben in vista.
 * Vive solo qui: nulla di ciò che scrive entra nella conversazione.
 */
export function Attesa({ aspettaTe = false, ultimaNovita }: { aspettaTe?: boolean; ultimaNovita?: () => number }) {
  const [parola, setParola] = useState(() => altraParola());

  useEffect(() => {
    const ritmo = setInterval(() => setParola((mostrata) => altraParola(mostrata)), CAMBIO_PAROLA_MS);
    return () => clearInterval(ritmo);
  }, []);

  if (aspettaTe) {
    return (
      <div className="riga attesa-risposta aspetta-te" role="status">
        <Germoglio />
        <span className="parola">Aspetta una tua risposta</span>
      </div>
    );
  }
  const silenzio = ultimaNovita === undefined ? undefined : silenzioInParole(Date.now() - ultimaNovita());
  // Chi ascolta la pagina sente una volta sola che Claude lavora, non una parola nuova ogni pochi secondi.
  return (
    <div className="riga attesa-risposta" role="status" aria-label="Claude sta lavorando">
      <Germoglio />
      <span className="parola" aria-hidden="true" key={parola}>
        {parola}
      </span>
      <span className="puntini" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      {silenzio !== undefined && <span className="silenzio">{silenzio}</span>}
    </div>
  );
}
