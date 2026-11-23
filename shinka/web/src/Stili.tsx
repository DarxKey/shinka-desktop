/**
 * Gli stili di risposta del proprietario: uno nuovo nasce da un nome e da una descrizione, e le
 * istruzioni le scrive Claude; quelli suoi si possono togliere. Gli stili di Shinka restano.
 */

import { useState, type ReactNode } from "react";
import { DESCRIZIONE_MASSIMA, NOME_MASSIMO, type StileDiRisposta } from "../../src/protocollo/stili.ts";
import { creaStile, rimuoviStile } from "./api.ts";

export function GestioneStili({
  stili,
  allaChiusura,
  alCambio,
}: {
  stili: StileDiRisposta[];
  allaChiusura: () => void;
  /** L'elenco nuovo; con `creato`, lo stile appena nato, da scegliere per questa conversazione. */
  alCambio: (stili: StileDiRisposta[], creato?: StileDiRisposta) => void;
}): ReactNode {
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string>();
  const propri = stili.filter((stile) => stile.diShinka !== true);

  async function crea(): Promise<void> {
    if (nome.trim() === "" || descrizione.trim() === "") return;
    setLavoro(true);
    setErrore(undefined);
    try {
      const creato = await creaStile(nome.trim(), descrizione.trim());
      alCambio([...stili, creato], creato);
      allaChiusura();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Lo stile non è nato.");
      setLavoro(false);
    }
  }

  async function togli(stile: StileDiRisposta): Promise<void> {
    setLavoro(true);
    setErrore(undefined);
    try {
      await rimuoviStile(stile.id);
      alCambio(stili.filter((voce) => voce.id !== stile.id));
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Lo stile non è stato tolto.");
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="gestione-stili" role="dialog" aria-label="Stili di risposta">
      <h3>Uno stile nuovo</h3>
      <p className="tenue">Descrivi come vuoi che Claude scriva: le istruzioni le scrive lui, e lo stile vale in ogni conversazione.</p>
      <input
        aria-label="Nome dello stile"
        placeholder="Nome, per esempio «Telegrafico»"
        maxLength={NOME_MASSIMO}
        value={nome}
        disabled={lavoro}
        onChange={(evento) => setNome(evento.target.value)}
      />
      <textarea
        aria-label="Descrizione dello stile"
        placeholder="Come deve scrivere: per esempio «frasi corte, niente elenchi, sempre un esempio pratico alla fine»"
        maxLength={DESCRIZIONE_MASSIMA}
        rows={3}
        value={descrizione}
        disabled={lavoro}
        onChange={(evento) => setDescrizione(evento.target.value)}
      />
      <div className="pulsanti">
        <button type="button" className="approva" disabled={lavoro || nome.trim() === "" || descrizione.trim() === ""} onClick={() => void crea()}>
          {lavoro ? "Claude lo scrive…" : "Crea e usa qui"}
        </button>
        <button type="button" className="discreto" disabled={lavoro} onClick={allaChiusura}>
          Chiudi
        </button>
      </div>
      {propri.length > 0 && (
        <>
          <h3>I tuoi stili</h3>
          <ul className="stili-propri">
            {propri.map((stile) => (
              <li key={stile.id}>
                <details>
                  <summary>
                    <strong>{stile.nome}</strong> <span className="tenue">{stile.descrizione}</span>
                  </summary>
                  <p className="istruzioni-stile">{stile.istruzioni}</p>
                </details>
                <button type="button" className="mini discreto" disabled={lavoro} aria-label={`Togli lo stile ${stile.nome}`} onClick={() => void togli(stile)}>
                  Togli
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
