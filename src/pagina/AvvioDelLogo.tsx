/**
 * L'avvio di Shinka Desktop: il logo a tutto schermo, con i colori neon che scorrono lungo il
 * contorno del germoglio, poi una dissolvenza che lascia l'interfaccia, già pronta sotto. Un clic o
 * un tasto lo salta; con le animazioni ridotte il logo resta fermo e svanisce subito. Se l'app parte
 * nascosta, nell'area di notifica, l'animazione aspetta che la finestra si veda.
 */

import { useEffect, useState, type ReactNode } from "react";
import { tempiDellAvvio } from "./avvio-del-logo.ts";

/** Il germoglio del logo, a facce: lo stelo e le due foglie, ciascuna con la faccia in luce e quella in ombra. */
const STELO = "M248 414 L242 338 L248 262";
const FACCE_IN_LUCE = ["M246 318 L190 312 L132 240 Z", "M232 270 L250 196 L302 138 L380 102 Z"];
const FACCE_IN_OMBRA = ["M246 318 L132 240 L200 246 Z", "M232 270 L380 102 L366 176 L320 232 Z"];
/** Il contorno delle due foglie, su cui scorre la luce. */
const CONTORNI = ["M246 318 L190 312 L132 240 L200 246 Z", "M232 270 L250 196 L302 138 L380 102 L366 176 L320 232 Z"];

type Fase = "attesa" | "luce" | "dissolvenza" | "finito";

function animazioniRidotte(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AvvioDelLogo(): ReactNode {
  const [fase, setFase] = useState<Fase>(() => (document.visibilityState === "visible" ? "luce" : "attesa"));
  const tempi = tempiDellAvvio(animazioniRidotte());

  // Partita nascosta, l'animazione comincia quando la finestra si vede.
  useEffect(() => {
    if (fase !== "attesa") return;
    const alCambio = (): void => {
      if (document.visibilityState === "visible") setFase("luce");
    };
    document.addEventListener("visibilitychange", alCambio);
    return () => document.removeEventListener("visibilitychange", alCambio);
  }, [fase]);

  useEffect(() => {
    if (fase === "luce") {
      const passo = setTimeout(() => setFase("dissolvenza"), tempi.luceMs);
      return () => clearTimeout(passo);
    }
    if (fase === "dissolvenza") {
      const passo = setTimeout(() => setFase("finito"), tempi.dissolvenzaMs);
      return () => clearTimeout(passo);
    }
    return undefined;
  }, [fase, tempi.luceMs, tempi.dissolvenzaMs]);

  // Un clic o un tasto lo saltano.
  useEffect(() => {
    if (fase !== "luce") return;
    const salta = (): void => setFase("dissolvenza");
    window.addEventListener("keydown", salta, { once: true });
    return () => window.removeEventListener("keydown", salta);
  }, [fase]);

  if (fase === "finito") return null;
  return (
    <div
      className={`avvio-del-logo ${fase}`}
      style={{ ["--dissolvenza" as string]: `${tempi.dissolvenzaMs}ms`, ["--giro" as string]: `${tempi.giroMs}ms` }}
      aria-hidden="true"
      onPointerDown={() => fase === "luce" && setFase("dissolvenza")}
    >
      <svg className="logo-avvio" viewBox="112 80 296 360" role="presentation">
        <defs>
          <linearGradient id="avvio-scorre" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#00f0ff" />
            <stop offset="0.5" stopColor="#ff2bd6" />
            <stop offset="1" stopColor="#b026ff" />
            <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="2.4s" repeatCount="indefinite" />
          </linearGradient>
          <filter id="avvio-neon" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="largo" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="stretto" />
            <feMerge>
              <feMergeNode in="largo" />
              <feMergeNode in="stretto" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Le facce si accendono piano, sotto la luce che corre. */}
        <g className="facce">
          <path d={STELO} fill="none" stroke="#00f0ff" strokeWidth="22" strokeLinecap="square" />
          {FACCE_IN_LUCE.map((d) => (
            <path key={d} d={d} fill="#00f0ff" />
          ))}
          {FACCE_IN_OMBRA.map((d) => (
            <path key={d} d={d} fill="#ff2bd6" />
          ))}
        </g>
        {/* Il contorno: una traccia tenue, e sopra la luce che scorre, con l'alone. */}
        <g className="contorno" fill="none" strokeLinejoin="miter">
          {[STELO, ...CONTORNI].map((d) => (
            <path key={`base-${d}`} d={d} pathLength={100} stroke="#7a1fd6" strokeOpacity="0.45" strokeWidth="3" />
          ))}
          <g filter="url(#avvio-neon)">
            {/* Ogni tratto di luce ha un alone colorato e un'anima bianca: resta visibile anche sopra le facce accese. */}
            {[STELO, ...CONTORNI].flatMap((d, posto) => [
              <path key={`luce-${d}`} className="luce" d={d} pathLength={100} stroke="url(#avvio-scorre)" strokeWidth="9" strokeLinecap="round" style={{ animationDelay: `${posto * -0.35}s` }} />,
              <path key={`anima-${d}`} className="luce" d={d} pathLength={100} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: `${posto * -0.35}s` }} />,
            ])}
          </g>
        </g>
      </svg>
      <div className="nome-avvio">SHINKA</div>
    </div>
  );
}
