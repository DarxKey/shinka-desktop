/**
 * La scheda delle domande di Claude: per ciascuna le risposte che propone, da toccare, e "Altro"
 * per scriverne una propria. Le risposte partono tutte insieme; si possono anche saltare, oppure
 * dare scrivendo un messaggio, che vale come risposta.
 */

import { useState, type ReactNode } from "react";
import type { EsitoDomande } from "../../src/protocollo/eventi.ts";
import { rispondiDomande } from "./api.ts";
import { useBaseDellaChat, useSolaLettura } from "./ContestoChat.ts";
import { risposteComplete, SCELTA_VUOTA, scegli, scegliAltro, type SceltaDiDomanda } from "./domande-scheda.ts";
import type { Elemento } from "./stato.ts";

type ElementoDomande = Extract<Elemento, { tipo: "domande" }>;

const CHIUSE: Record<Exclude<EsitoDomande, "risposte">, string> = {
  "in-chat": "Hai risposto con un messaggio.",
  saltate: "Hai saltato le domande: Claude va avanti con scelte sue.",
  annullate: "Le domande non aspettano più: il turno si è chiuso prima della risposta.",
};

export function SchedaDomande({ elemento }: { elemento: ElementoDomande }): ReactNode {
  const solaLettura = useSolaLettura();
  if (elemento.esito !== undefined) return <DomandeChiuse elemento={elemento} />;
  if (solaLettura) {
    return <div className="riga nota">Claude ha posto {elemento.domande.length === 1 ? "una domanda" : `${elemento.domande.length} domande`}, che aspettano una risposta.</div>;
  }
  return <DomandeAperte elemento={elemento} />;
}

function DomandeChiuse({ elemento }: { elemento: ElementoDomande }): ReactNode {
  const { esito, risposte } = elemento;
  return (
    <div className="riga proposta domande chiuse">
      <dl>
        {elemento.domande.map((voce, indice) => (
          <div key={indice} className="domanda-chiusa">
            <dt>{voce.domanda}</dt>
            {esito === "risposte" && <dd>{risposte?.[indice] ?? ""}</dd>}
          </div>
        ))}
      </dl>
      {esito !== "risposte" && esito !== undefined && <div className="tenue">{CHIUSE[esito]}</div>}
    </div>
  );
}

function DomandeAperte({ elemento }: { elemento: ElementoDomande }): ReactNode {
  const base = useBaseDellaChat();
  const { domande } = elemento;
  const [scelte, setScelte] = useState<SceltaDiDomanda[]>(() => domande.map(() => SCELTA_VUOTA));
  const [inviata, setInviata] = useState(false);
  const [errore, setErrore] = useState<string>();
  const risposte = risposteComplete(domande, scelte);

  const cambia = (indice: number, come: (scelta: SceltaDiDomanda) => SceltaDiDomanda): void =>
    setScelte((prima) => prima.map((scelta, quale) => (quale === indice ? come(scelta) : scelta)));

  async function manda(risposta: Parameters<typeof rispondiDomande>[2]): Promise<void> {
    setInviata(true);
    setErrore(undefined);
    try {
      await rispondiDomande(base, elemento.chiave, risposta);
    } catch (causa) {
      setInviata(false);
      setErrore(causa instanceof Error ? causa.message : "Risposte non inviate.");
    }
  }

  return (
    <form
      className="riga proposta domande"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (risposte !== undefined) void manda({ tipo: "risposte", risposte });
      }}
    >
      <div className="intestazione">{domande.length === 1 ? "Una domanda prima di procedere" : "Alcune domande prima di procedere"}</div>
      {domande.map((voce, indice) => {
        const scelta = scelte[indice] ?? SCELTA_VUOTA;
        const nome = `${elemento.chiave}-${indice}`;
        const tipo = voce.piuScelte ? "checkbox" : "radio";
        return (
          <fieldset key={indice} className="domanda" disabled={inviata}>
            <legend>
              {voce.intestazione !== "" && <span className="etichetta-domanda">{voce.intestazione}</span>}
              <span className="testo-domanda">
                {voce.domanda}
                {voce.piuScelte && <span className="tenue"> · anche più di una</span>}
              </span>
            </legend>
            {voce.opzioni.map((opzione) => (
              <label key={opzione.etichetta} className={scelta.scelte.includes(opzione.etichetta) ? "opzione scelta-presa" : "opzione"}>
                <input
                  type={tipo}
                  name={nome}
                  checked={scelta.scelte.includes(opzione.etichetta)}
                  onChange={() => cambia(indice, (prima) => scegli(voce, prima, opzione.etichetta))}
                />
                <span>
                  <span className="etichetta-opzione">{opzione.etichetta}</span>
                  {opzione.descrizione !== undefined && <span className="descrizione-opzione">{opzione.descrizione}</span>}
                </span>
              </label>
            ))}
            <label className={scelta.altro ? "opzione scelta-presa" : "opzione"}>
              <input type={tipo} name={nome} checked={scelta.altro} onChange={() => cambia(indice, (prima) => scegliAltro(voce, prima))} />
              <span className="etichetta-opzione">Altro</span>
            </label>
            {scelta.altro && (
              <input
                className="testo-altro"
                type="text"
                aria-label={`La tua risposta: ${voce.domanda}`}
                placeholder="Scrivi la tua risposta"
                maxLength={4000}
                autoFocus
                value={scelta.testoAltro}
                onChange={(evento) => {
                  const testo = evento.target.value;
                  cambia(indice, (prima) => ({ ...prima, testoAltro: testo }));
                }}
              />
            )}
          </fieldset>
        );
      })}
      <div className="pulsanti">
        <button type="submit" className="approva" disabled={inviata || risposte === undefined}>
          Rispondi
        </button>
        <button type="button" className="discreto" disabled={inviata} onClick={() => void manda({ tipo: "saltate" })}>
          Salta
        </button>
      </div>
      <div className="tenue">Puoi anche rispondere scrivendo un messaggio: vale come risposta a tutte.</div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </form>
  );
}
