/**
 * La vista affiancata: sugli schermi larghi una seconda conversazione, la Home o un progetto,
 * accanto a quella che si sta guardando. La scelta resta nel browser.
 */

import type { ReactNode } from "react";
import type { VoceProgetto } from "../../src/protocollo/progetti.ts";

export type Affiancata = { tipo: "home" } | { tipo: "progetto"; id: string };

const CHIAVE = "shinka.affiancata";

export function leggiAffiancata(): Affiancata | undefined {
  try {
    const letta = JSON.parse(window.localStorage.getItem(CHIAVE) ?? "null") as unknown;
    if (typeof letta !== "object" || letta === null) return undefined;
    const { tipo, id } = letta as Record<string, unknown>;
    if (tipo === "home") return { tipo };
    return tipo === "progetto" && typeof id === "string" ? { tipo, id } : undefined;
  } catch {
    return undefined;
  }
}

export function scriviAffiancata(affiancata: Affiancata | undefined): void {
  try {
    if (affiancata === undefined) window.localStorage.removeItem(CHIAVE);
    else window.localStorage.setItem(CHIAVE, JSON.stringify(affiancata));
  } catch {
    // Senza memoria del browser la scelta vale finché la pagina resta aperta.
  }
}

/** Vero se la conversazione affiancata è quella che si sta già guardando. */
export function stessaConversazione(affiancata: Affiancata, vista: { tipo: string; id?: string }): boolean {
  return affiancata.tipo === "home" ? vista.tipo === "home" : vista.tipo === "progetto" && vista.id === affiancata.id;
}

/** Il menu nella testata per scegliere che cosa affiancare, o per smettere. Solo sugli schermi larghi. */
export function MenuAffianca({
  progetti,
  attuale,
  scelta,
  allaScelta,
}: {
  progetti: readonly VoceProgetto[];
  /** La conversazione che si sta guardando: non si affianca a sé stessa. */
  attuale: { tipo: string; id?: string };
  scelta: Affiancata | undefined;
  allaScelta: (affiancata: Affiancata | undefined) => void;
}): ReactNode {
  const scegli = (evento: { currentTarget: HTMLElement }, affiancata: Affiancata | undefined): void => {
    evento.currentTarget.closest("details")?.removeAttribute("open");
    allaScelta(affiancata);
  };
  const voci: { affiancata: Affiancata; nome: string }[] = [
    { affiancata: { tipo: "home" as const }, nome: "Home" },
    ...progetti.map((progetto) => ({ affiancata: { tipo: "progetto" as const, id: progetto.id }, nome: progetto.nome })),
  ].filter((voce) => !stessaConversazione(voce.affiancata, attuale));
  return (
    <details className="menu-affianca">
      <summary aria-label="Affianca un'altra conversazione" title="Affianca un'altra conversazione">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 3.5v13" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="voci-esporta">
        {voci.map((voce) => (
          <button
            key={voce.affiancata.tipo === "home" ? "home" : voce.affiancata.id}
            type="button"
            aria-pressed={scelta !== undefined && JSON.stringify(scelta) === JSON.stringify(voce.affiancata)}
            onClick={(evento) => scegli(evento, voce.affiancata)}
          >
            Affianca {voce.nome}
          </button>
        ))}
        {scelta !== undefined && (
          <button type="button" onClick={(evento) => scegli(evento, undefined)}>
            Una conversazione sola
          </button>
        )}
      </div>
    </details>
  );
}
