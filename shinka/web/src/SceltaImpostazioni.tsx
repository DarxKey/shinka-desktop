import type { ReactNode } from "react";
import { IMPEGNI, MODI_PERMESSI, type Impegno, type ModelloDisponibile, type ModoPermessi, type Motore } from "../../src/protocollo/impostazioni.ts";
import { MODELLI_NOTI, NOMI_IMPEGNI, NOMI_PERMESSI, SPIEGAZIONI_PERMESSI } from "./Controlli.tsx";
import { MenuDelModello } from "./MenuDelModello.tsx";
import { gruppiDiModelli } from "./motori.ts";

/** I tre selettori di una scheda: motore e modello, effort e permessi con cui un lavoro parte. */
export function SceltaImpostazioni({
  modelli,
  motore,
  modello,
  impegno,
  permessi,
  disattivo,
  alModello,
  allImpegno,
  aiPermessi,
}: {
  modelli: ModelloDisponibile[] | undefined;
  motore: Motore | undefined;
  modello: string;
  impegno: Impegno | "";
  permessi: ModoPermessi;
  disattivo: boolean;
  alModello: (scelta: { motore?: Motore; modello: string | null }) => void;
  allImpegno: (impegno: Impegno | "") => void;
  aiPermessi: (permessi: ModoPermessi) => void;
}): ReactNode {
  const gruppo = gruppiDiModelli(modelli ?? MODELLI_NOTI).find((voce) => voce.motore === undefined || voce.motore === motore);
  const scelto = gruppo?.modelli.find((voce) => voce.valore === modello);
  // L'effort che il modello scelto accetta; se non si sa, tutti.
  const impegni = scelto?.impegni ?? IMPEGNI;
  return (
    <div className="scelte scelte-lavoro">
      <MenuDelModello
        etichetta="Modello del lavoro"
        modelli={modelli ?? MODELLI_NOTI}
        motore={motore}
        modello={modello === "" ? undefined : modello}
        disattivo={disattivo}
        allaScelta={alModello}
      />
      <select
        aria-label="Effort del lavoro"
        value={impegno}
        disabled={disattivo}
        onChange={(evento) => allImpegno(evento.target.value === "" ? "" : (evento.target.value as Impegno))}
      >
        <option value="">Effort predefinito</option>
        {impegno !== "" && !impegni.includes(impegno) && <option value={impegno}>Effort: {NOMI_IMPEGNI[impegno]}</option>}
        {impegni.map((voce) => (
          <option key={voce} value={voce}>
            Effort: {NOMI_IMPEGNI[voce]}
          </option>
        ))}
      </select>
      <select
        aria-label="Permessi del lavoro"
        className={permessi === "senza-permessi" ? "pericolo" : undefined}
        title={SPIEGAZIONI_PERMESSI[permessi]}
        value={permessi}
        disabled={disattivo}
        onChange={(evento) => aiPermessi(evento.target.value as ModoPermessi)}
      >
        {MODI_PERMESSI.map((modo) => (
          <option key={modo} value={modo}>
            {NOMI_PERMESSI[modo]}
          </option>
        ))}
      </select>
    </div>
  );
}
