import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Guscio } from "../../shinka/web/src/Guscio.tsx";
import { useFrammento, vaiA, vistaDa } from "../../shinka/web/src/vista.ts";
import type { AggiornamentoInVista, Situazione, StatoApp } from "../ponte/tipi.ts";
import { alComando } from "./comandi.ts";
import { luogoDi } from "./disposizione.ts";
import { ponte } from "./ponte.ts";
import { PrimoAccesso } from "./PrimoAccesso.tsx";
import { Scorciatoie } from "./Scorciatoie.tsx";
import { Terminali } from "./Terminali.tsx";

/** Da quante conversazioni mancanti in su si dice che la cache si sta riempiendo: sotto, è un attimo. */
const MANCANTI_DA_DIRE = 3;

/**
 * La radice della pagina: la schermata del primo accesso finché questo PC non è collegato a un
 * centro, poi l'interfaccia di Shinka com'è sul sito, con accanto i terminali di questo PC.
 */
export function AppDesktop(): ReactNode {
  const [stato, setStato] = useState<StatoApp>();

  useEffect(() => {
    let smontato = false;
    void ponte.stato().then((letto) => {
      if (!smontato) setStato(letto);
    });
    const smetti = ponte.alCambio(setStato);
    return () => {
      smontato = true;
      smetti();
    };
  }, []);

  // Chiudere la finestra vale anche prima dell'accesso.
  useEffect(
    () =>
      alComando((comando) => {
        if (comando === "chiudi-finestra") ponte.chiudiLaFinestra();
      }),
    [],
  );

  if (stato === undefined) return null;
  if (!stato.dentro) return <PrimoAccesso stato={stato} />;
  // Cambiando centro l'interfaccia riparte da capo.
  return <Dentro key={stato.centro} situazione={stato.situazione} aggiornamento={stato.aggiornamento} soloLettura={stato.soloLettura} />;
}

function avvisoDi(situazione: Situazione | undefined): string | undefined {
  if (situazione === undefined) return undefined;
  if (!situazione.collegato) return "Senza collegamento con il centro: puoi leggere ciò che è su questo PC.";
  if (situazione.mancano >= MANCANTI_DA_DIRE) return `Porto le conversazioni su questo PC: ne mancano ${situazione.mancano}.`;
  return undefined;
}

/**
 * L'avviso in cima, se ce n'è uno: un centro che questa versione non capisce più viene prima di
 * tutto, poi una versione nuova pronta da installare, poi il collegamento e la cache (ADR 0006).
 */
function avvisoInCima(situazione: Situazione | undefined, aggiornamento: AggiornamentoInVista | undefined, soloLettura: boolean, pronto: boolean): { testo: string; genere: string; aggiorna?: true } | undefined {
  if (soloLettura) {
    return aggiornamento?.fase === "pronta"
      ? { testo: `Il centro è stato aggiornato: riavvia l'app per passare alla ${aggiornamento.versione}. Fino ad allora puoi solo leggere.`, genere: "scollegato", aggiorna: true }
      : { testo: "Il centro è stato aggiornato e questa versione dell'app non lo capisce più: puoi solo leggere finché non si aggiorna.", genere: "scollegato" };
  }
  if (aggiornamento?.fase === "pronta") return { testo: `È pronta la versione ${aggiornamento.versione} di Shinka Desktop: si installa quando esci, oppure adesso.`, genere: "", aggiorna: true };
  const testo = pronto || situazione?.collegato === true ? avvisoDi(situazione) : undefined;
  return testo === undefined ? undefined : { testo, genere: situazione?.collegato === false ? "scollegato" : "" };
}

function Dentro({ situazione, aggiornamento, soloLettura }: { situazione: Situazione | undefined; aggiornamento: AggiornamentoInVista | undefined; soloLettura: boolean }): ReactNode {
  const frammento = useFrammento();
  const luogo = useMemo(() => luogoDi(vistaDa(frammento)), [frammento]);
  // Appena aperta l'app non si sa ancora se il centro risponde: l'avviso aspetta un momento.
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const sveglia = setTimeout(() => setPronto(true), 2500);
    return () => clearTimeout(sveglia);
  }, []);
  const avviso = avvisoInCima(situazione, aggiornamento, soloLettura, pronto);

  const [scorciatoie, setScorciatoie] = useState(false);
  useEffect(
    () =>
      alComando((comando) => {
        if (comando === "cerca") vaiA({ tipo: "cerca" });
        else if (comando === "home") vaiA({ tipo: "home" });
        else if (comando === "impostazioni") vaiA({ tipo: "impostazioni" });
        else if (comando === "indietro") window.history.back();
        else if (comando === "avanti") window.history.forward();
        else if (comando === "scorciatoie") setScorciatoie((prima) => !prima);
        // La palette è della pagina di Shinka, che la apre con questo tasto: glielo si fa sentire.
        else if (comando === "vai-a") window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
      }),
    [],
  );

  return (
    <div className={avviso === undefined ? "desktop" : "desktop con-avviso"}>
      {avviso !== undefined && (
        <p className={avviso.genere === "" ? "avviso-desktop" : `avviso-desktop ${avviso.genere}`} role="status">
          <span className="testo-avviso">{avviso.testo}</span>
          {avviso.aggiorna === true && (
            <button type="button" className="mini" onClick={() => ponte.riavviaPerAggiornare()}>
              Riavvia per aggiornare
            </button>
          )}
        </p>
      )}
      <div className="desktop-corpo">
        <div className="desktop-shinka">
          {/* Uscire dal centro lo fa l'app: toglie il dispositivo e torna al primo accesso da sé. */}
          <Guscio allUscita={() => {}} />
        </div>
        <Terminali luogo={luogo} />
      </div>
      {scorciatoie && <Scorciatoie allaChiusura={() => setScorciatoie(false)} />}
    </div>
  );
}
