/**
 * La palette di Shinka con in più i comandi dell'app. Alla costruzione prende il posto di
 * `shinka/web/src/Palette.tsx` (vedi `electron.vite.config.ts`): la pagina di Shinka la apre come
 * la sua, con Ctrl+K o dalla barra laterale, e non sa di averne un'altra.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Palette as PaletteDiShinka, type VocePalette } from "../../shinka/web/src/Palette.tsx";
import { SCORCIATOIE, tastiInParole } from "../ponte/scorciatoie.ts";
import { esegui } from "./comandi.ts";
import { ponte } from "./ponte.ts";

export type { VocePalette };

const DEI_COMANDI: readonly VocePalette[] = SCORCIATOIE.filter((voce) => voce.comando !== "vai-a" && voce.comando !== "scheda-dopo" && voce.comando !== "scheda-prima").map((voce) => ({
  chiave: `comando-${voce.comando}`,
  etichetta: voce.etichetta,
  genere: "comando",
  dettaglio: tastiInParole(voce.tasti),
  esegui: () => esegui(voce.comando),
}));

export function Palette({ voci, allaChiusura }: { voci: readonly VocePalette[]; allaChiusura: () => void }): ReactNode {
  // Se l'app parte con Windows si sa solo chiedendolo; nell'app non installata non si può scegliere.
  const [conWindows, setConWindows] = useState<boolean>();
  useEffect(() => {
    let smontata = false;
    void ponte.stato().then((stato) => {
      if (!smontata) setConWindows(stato.avvioConWindows);
    });
    return () => {
      smontata = true;
    };
  }, []);

  const tutte = useMemo((): VocePalette[] => {
    const avvio: VocePalette[] =
      conWindows === undefined
        ? []
        : [
            {
              chiave: "comando-avvio-con-windows",
              etichetta: conWindows ? "Non avviare più con Windows" : "Avvia con Windows",
              genere: "comando",
              dettaglio: conWindows ? "adesso parte da sola" : "nell'area di notifica",
              esegui: () => void ponte.avviaConWindows(!conWindows),
            },
          ];
    return [...voci, ...DEI_COMANDI, ...avvio];
  }, [voci, conWindows]);

  return <PaletteDiShinka voci={tutte} allaChiusura={allaChiusura} />;
}
