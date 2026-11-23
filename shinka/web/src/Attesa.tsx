import { useEffect, useState } from "react";
import { altraParola, CAMBIO_PAROLA_MS, silenzioInParole } from "./parole-buffe.ts";

/**
 * Il germoglio del logo di Shinka, che mentre Claude lavora oscilla dalla base e apre le foglie a
 * turno. Gli stessi tratti dell'icona, senza il fondo; con le animazioni ridotte resta fermo.
 */
function Germoglio() {
  return (
    <svg className="germoglio" viewBox="131 90 300 340" width="18" height="20" aria-hidden="true" focusable="false">
      <g className="pianta">
        <path d="M256 412 C252 352 250 306 256 262" fill="none" stroke="currentColor" strokeWidth="34" strokeLinecap="round" />
        <path className="foglia piccola" d="M254 318 C204 322 160 296 148 240 C204 232 246 262 254 318 Z" fill="currentColor" />
        <path className="foglia grande" d="M241 270 C246 176 312 114 396 104 C402 198 336 264 241 270 Z" fill="currentColor" />
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
