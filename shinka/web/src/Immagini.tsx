import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Immagine } from "../../src/protocollo/allegati.ts";
import { indirizzoImmagine, indirizzoImmagineEsterna } from "./api.ts";
import { useBaseDellaChat } from "./ContestoChat.ts";

/** Le immagini di un messaggio o di un'azione, in piccolo: un tocco le apre a tutto schermo. */
export function Immagini({ immagini }: { immagini: Immagine[] | undefined }): ReactNode {
  const base = useBaseDellaChat();
  const [aperta, setAperta] = useState<string>();
  // Solo quelle che il centro ha in custodia hanno un indirizzo da cui caricarle.
  const indirizzi = (immagini ?? []).flatMap((immagine) =>
    immagine.id === undefined ? [] : [indirizzoImmagine(base, immagine.id)],
  );
  if (indirizzi.length === 0) return null;

  return (
    <>
      <div className="immagini">
        {indirizzi.map((indirizzo) => (
          <button
            key={indirizzo}
            type="button"
            className="miniatura"
            aria-label="Apri l'immagine"
            onClick={() => setAperta(indirizzo)}
          >
            <img src={indirizzo} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {aperta !== undefined && <Visore indirizzo={aperta} allaChiusura={() => setAperta(undefined)} />}
    </>
  );
}

/**
 * Un'immagine scritta nel testo di una risposta. Se il suo indirizzo è https la chiede al centro,
 * che la scarica dal sito (ADR 0043): il sito non vede né il browser né i cookie del proprietario.
 * Se non si carica non si vede, e il testo resta com'è. Un tocco la apre a tutto schermo.
 */
export function ImmagineNelTesto({ indirizzo, testo }: { indirizzo: string | undefined; testo: string }): ReactNode {
  const [rotta, setRotta] = useState(false);
  const [aperta, setAperta] = useState(false);
  if (indirizzo === undefined || !/^https:\/\//i.test(indirizzo)) {
    return <span className="immagine-omessa">[immagine: {testo || String(indirizzo ?? "")}]</span>;
  }
  if (rotta) return null;
  const dalCentro = indirizzoImmagineEsterna(indirizzo);
  return (
    <>
      <button
        type="button"
        className="immagine-nel-testo"
        aria-label={testo === "" ? "Apri l'immagine" : `Apri l'immagine: ${testo}`}
        onClick={(evento) => {
          // Dentro un collegamento, il tocco apre l'immagine e non il collegamento.
          evento.preventDefault();
          evento.stopPropagation();
          setAperta(true);
        }}
      >
        <img src={dalCentro} alt={testo} title={testo || undefined} loading="lazy" decoding="async" onError={() => setRotta(true)} />
      </button>
      {aperta && createPortal(<Visore indirizzo={dalCentro} allaChiusura={() => setAperta(false)} />, document.body)}
    </>
  );
}

function Visore({ indirizzo, allaChiusura }: { indirizzo: string; allaChiusura: () => void }): ReactNode {
  useEffect(() => {
    const alTasto = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") allaChiusura();
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, [allaChiusura]);

  return (
    <div className="visore" role="dialog" aria-label="Immagine" onClick={allaChiusura}>
      <img src={indirizzo} alt="" />
      <div className="comandi" onClick={(evento) => evento.stopPropagation()}>
        <a className="pulsante" href={indirizzo} target="_blank" rel="noopener noreferrer">
          Apri in un'altra scheda
        </a>
        <button type="button" onClick={allaChiusura}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
