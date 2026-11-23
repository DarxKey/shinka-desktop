/** Il menu Esporta, nella testata della chat: la conversazione in Markdown, oppure stampata o salvata in PDF. */

import type { ReactNode } from "react";

export function MenuEsporta({ base }: { base: string }): ReactNode {
  return (
    <details className="menu-esporta">
      <summary aria-label="Esporta la conversazione" title="Esporta la conversazione">
        Esporta
      </summary>
      <div className="voci-esporta">
        <a href={`${base}/esporta`} download>
          Scarica in Markdown
        </a>
        <button
          type="button"
          onClick={(evento) => {
            evento.currentTarget.closest("details")?.removeAttribute("open");
            // Il browser stampa la conversazione intera; da lì si può anche salvare in PDF.
            setTimeout(() => window.print(), 50);
          }}
        >
          Stampa o salva in PDF
        </button>
      </div>
    </details>
  );
}
