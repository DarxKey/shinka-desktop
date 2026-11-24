import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { avviaAspetto } from "../../shinka/web/src/aspetto.ts";
import "../../shinka/web/src/stile.css";
import { AppDesktop } from "./AppDesktop.tsx";
import { AvvioDelLogo } from "./AvvioDelLogo.tsx";
import { ascoltaTastieraEMenu } from "./comandi.ts";
import "./desktop.css";
import { sostituisciLeSorgenti } from "./sorgente.ts";

// I flussi di eventi partono dalla cache dell'app: va deciso prima che una pagina ne apra uno.
sostituisciLeSorgenti();
// Il tema scelto dal proprietario vale prima del primo disegno.
avviaAspetto();
// I comandi dell'app: dalla tastiera e dal menu.
ascoltaTastieraEMenu();

// L'app si riapre dov'era: la posizione sta dopo il cancelletto, e a ogni cambio si ricorda.
const CHIAVE_POSIZIONE = "shinka-desktop.posizione";
try {
  const ultima = window.localStorage.getItem(CHIAVE_POSIZIONE);
  if (window.location.hash === "" && ultima !== null && ultima.startsWith("#/")) window.history.replaceState(null, "", ultima);
  window.addEventListener("hashchange", () => window.localStorage.setItem(CHIAVE_POSIZIONE, window.location.hash));
} catch {
  // Senza posto per ricordarla si riparte dalla Home.
}

const radice = document.getElementById("radice");
if (radice === null) throw new Error("Manca l'elemento radice della pagina.");

createRoot(radice).render(
  <StrictMode>
    <AppDesktop />
    <AvvioDelLogo />
  </StrictMode>,
);
