/**
 * Ciò che nelle risposte di Claude non è solo testo: i blocchi di codice, con il colore della
 * sintassi, il nome del linguaggio e il pulsante Copia, e i diagrammi Mermaid. Le librerie che
 * servono si caricano la prima volta che servono: aprire una chat senza codice non le scarica.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import { useAspetto } from "./aspetto.ts";
import { copia } from "./copia.ts";

/** L'icona del pulsante Copia: due fogli; dopo, un segno di spunta o una croce. */
function IconaCopia({ fatto }: { fatto: "copiato" | "non-riuscito" | undefined }): ReactNode {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {fatto === "copiato" ? (
        <path d="M4.5 10.5l3.5 3.5 7.5-8" />
      ) : fatto === "non-riuscito" ? (
        <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
      ) : (
        <>
          <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
          <path d="M13 4.5V4.25A1.75 1.75 0 0 0 11.25 2.5h-6.5A1.75 1.75 0 0 0 3 4.25v6.5c0 .97.78 1.75 1.75 1.75H5" />
        </>
      )}
    </svg>
  );
}

/** Il pulsante Copia, con l'icona: per un blocco di codice o per una risposta intera. */
export function PulsanteCopia({ testo, etichetta = "Copia" }: { testo: string; etichetta?: string }): ReactNode {
  const [fatto, setFatto] = useState<"copiato" | "non-riuscito">();
  useEffect(() => {
    if (fatto === undefined) return;
    const sveglia = setTimeout(() => setFatto(undefined), 1800);
    return () => clearTimeout(sveglia);
  }, [fatto]);
  return (
    <button
      type="button"
      className={fatto === undefined ? "copia" : `copia ${fatto}`}
      aria-label={fatto === "copiato" ? "Copiato" : fatto === "non-riuscito" ? "Non copiato" : etichetta}
      title={fatto === "copiato" ? "Copiato" : fatto === "non-riuscito" ? "Non copiato" : etichetta}
      onClick={() => void copia(testo).then((riuscito) => setFatto(riuscito ? "copiato" : "non-riuscito"))}
    >
      <IconaCopia fatto={fatto} />
    </button>
  );
}

/** Un blocco di codice: il linguaggio, il pulsante Copia, e il codice con i suoi colori quando sono pronti. */
export function BloccoCodice({ codice, linguaggio }: { codice: string; linguaggio: string }): ReactNode {
  const [html, setHtml] = useState<string>();
  useEffect(() => {
    let valido = true;
    setHtml(undefined);
    void import("./evidenzia.ts").then(({ evidenzia }) => {
      if (valido) setHtml(evidenzia(codice, linguaggio));
    });
    return () => {
      valido = false;
    };
  }, [codice, linguaggio]);
  if (linguaggio === "mermaid") return <Diagramma codice={codice} />;
  return (
    <div className="blocco-codice">
      <div className="testa-codice">
        <span className="linguaggio">{linguaggio === "" ? "codice" : linguaggio}</span>
        <PulsanteCopia testo={codice} etichetta="Copia il codice" />
      </div>
      <pre>
        {html === undefined ? <code>{codice}</code> : <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />}
      </pre>
    </div>
  );
}

/** Un diagramma Mermaid, disegnato dalla sua libreria; se non si disegna, resta il codice con il perché. */
function Diagramma({ codice }: { codice: string }): ReactNode {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { tema } = useAspetto();
  const [svg, setSvg] = useState<string>();
  const [errore, setErrore] = useState<string>();
  useEffect(() => {
    let valido = true;
    const scuro = tema === "scuro" || (tema === "automatico" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true);
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        // "strict": niente script né collegamenti attivi nel disegno.
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: scuro ? "dark" : "neutral", fontFamily: "inherit" });
        const { svg: disegnato } = await mermaid.render(id, codice);
        if (valido) setSvg(disegnato);
      })
      .catch((causa: unknown) => {
        if (valido) setErrore(causa instanceof Error ? causa.message : String(causa));
      });
    return () => {
      valido = false;
    };
  }, [codice, id, tema]);
  if (svg !== undefined) {
    return (
      <div className="blocco-codice diagramma">
        <div className="testa-codice">
          <span className="linguaggio">diagramma</span>
          <PulsanteCopia testo={codice} etichetta="Copia il codice del diagramma" />
        </div>
        <div className="disegno" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    );
  }
  return (
    <div className="blocco-codice">
      <div className="testa-codice">
        <span className="linguaggio">mermaid</span>
        <PulsanteCopia testo={codice} etichetta="Copia il codice" />
      </div>
      <pre>
        <code>{codice}</code>
      </pre>
      {errore !== undefined && <p className="tenue errore-diagramma">Il diagramma non si è potuto disegnare: {errore.split("\n")[0]}</p>}
    </div>
  );
}
