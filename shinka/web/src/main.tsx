import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { avviaAspetto } from "./aspetto.ts";
import { avviaNotifiche } from "./notifiche.ts";
import "./stile.css";

// Il tema scelto dal proprietario vale prima del primo disegno.
avviaAspetto();
// Le notifiche dell'app: il service worker, e ciò che succede toccandone una.
avviaNotifiche();

const radice = document.getElementById("radice");
if (radice === null) throw new Error("Manca l'elemento radice della pagina.");

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
