import { useEffect, useState, type ReactNode } from "react";
import type { Impegno, ImpostazioniConversazione, ModificaImpostazioni, ModoPermessi, Motore } from "../../src/protocollo/impostazioni.ts";
import { decidiInstallazione, decidiSviluppo } from "./api.ts";
import { NOMI_IMPEGNI, NOMI_PERMESSI } from "./Controlli.tsx";
import { SceltaImpostazioni } from "./SceltaImpostazioni.tsx";
import { useSolaLettura } from "./ContestoChat.ts";
import { interfacciaDaRicaricare } from "./interfaccia-nuova.ts";
import type { Elemento } from "./stato.ts";
import { frammentoDi, vaiA } from "./vista.ts";

type Sviluppo = Extract<Elemento, { tipo: "sviluppo" }>;
type Installazione = Extract<Elemento, { tipo: "installazione" }>;

/**
 * La scheda con cui la Home propone di sviluppare un pezzo nuovo di Shinka: che cosa e perché.
 * Non parte nulla finché il proprietario non conferma; confermata, la richiesta passa al progetto Shinka.
 */
export function SchedaSviluppo({ sviluppo }: { sviluppo: Sviluppo }): ReactNode {
  const solaLettura = useSolaLettura();
  const [inCorso, setInCorso] = useState<"confermata" | "annullata">();
  const [errore, setErrore] = useState<string>();
  // Si parte dalle impostazioni di sempre del progetto Shinka: cambiarle qui vale solo per questo lavoro.
  const predefinite: ImpostazioniConversazione = sviluppo.impostazioni ?? { permessi: "chiedi" };
  const [motore, setMotore] = useState<Motore | undefined>(predefinite.motore);
  const [modello, setModello] = useState(predefinite.modello ?? "");
  const [impegno, setImpegno] = useState<Impegno | "">(predefinite.impegno ?? "");
  const [permessi, setPermessi] = useState<ModoPermessi>(predefinite.permessi);

  if (sviluppo.esito === "annullata") {
    return <div className="riga nota">Proposta annullata: «{sviluppo.titolo}» non è stato sviluppato.</div>;
  }
  if (sviluppo.esito === "confermata") {
    return (
      <div className="riga proposta decisa">
        <div className="testo">
          <div className="intestazione">Sviluppo di Shinka avviato: {sviluppo.titolo}</div>
          <div className="tenue">
            Il lavoro prosegue nel progetto Shinka
            {sviluppo.usate === undefined ? "" : `, con ${impostazioniInBreve(sviluppo.usate)}`}
            {sviluppo.soloPerQuestoLavoro === true ? ": solo per questo lavoro, poi tornano quelle di sempre." : "."}
          </div>
        </div>
        {sviluppo.idProgetto !== undefined && (
          <a className="pulsante" href={frammentoDi({ tipo: "progetto", id: sviluppo.idProgetto })}>
            Apri
          </a>
        )}
      </div>
    );
  }
  if (solaLettura) {
    return <div className="riga nota">Proposta di sviluppo rimasta senza risposta: «{sviluppo.titolo}».</div>;
  }

  async function decidi(esito: "confermata" | "annullata"): Promise<void> {
    setInCorso(esito);
    setErrore(undefined);
    try {
      // Si manda solo ciò che è cambiato: il resto resta com'è.
      const scelta: ModificaImpostazioni = {
        ...(motore !== predefinite.motore ? { motore: motore ?? null } : {}),
        ...(modello !== (predefinite.modello ?? "") ? { modello: modello === "" ? null : modello } : {}),
        ...(impegno !== (predefinite.impegno ?? "") ? { impegno: impegno === "" ? null : impegno } : {}),
        ...(permessi !== predefinite.permessi ? { permessi } : {}),
      };
      const idProgetto = await decidiSviluppo(sviluppo.chiave, esito, scelta);
      // Il lavoro comincia nel progetto Shinka: l'interfaccia si sposta lì.
      if (idProgetto !== undefined) vaiA({ tipo: "progetto", id: idProgetto });
    } catch (causa) {
      setInCorso(undefined);
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    }
  }

  return (
    <div className="riga proposta sviluppo" role="group" aria-label="Proposta di sviluppo di Shinka">
      <div className="intestazione">Sviluppo di Shinka</div>
      <div className="voce-scheda">
        <div className="titolino">Che cosa</div>
        <div className="titolo-sviluppo">{sviluppo.titolo}</div>
      </div>
      <div className="voce-scheda">
        <div className="titolino">Richiesta per il progetto Shinka</div>
        <div className="brief">{sviluppo.richiesta}</div>
      </div>
      <div className="tenue">
        Se confermi, il progetto Shinka ci lavora sul codice di Shinka. Nulla entra in funzione senza una tua seconda
        approvazione, dopo le prove.
      </div>
      {sviluppo.impostazioni !== undefined && (
        <div className="voce-scheda">
          <div className="titolino">Con quali impostazioni lavora</div>
          <SceltaImpostazioni
            modelli={sviluppo.modelli}
            motore={motore}
            modello={modello}
            impegno={impegno}
            permessi={permessi}
            disattivo={inCorso !== undefined}
            alModello={(scelta) => {
              if (scelta.motore !== undefined) setMotore(scelta.motore);
              setModello(scelta.modello ?? "");
            }}
            allImpegno={setImpegno}
            aiPermessi={setPermessi}
          />
          <div className="tenue">
            {motore === predefinite.motore && modello === (predefinite.modello ?? "") && impegno === (predefinite.impegno ?? "") && permessi === predefinite.permessi
              ? "Sono quelle di sempre del progetto Shinka."
              : "Valgono solo per questo lavoro: poi il progetto Shinka torna a quelle di sempre."}
          </div>
          {permessi === "senza-permessi" && predefinite.permessi !== "senza-permessi" && (
            <div className="avvertenza">
              Senza permessi il progetto Shinka esegue qualunque comando senza chiederti nulla, anche fuori dalla sua cartella, per tutto questo lavoro.
            </div>
          )}
        </div>
      )}
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inCorso !== undefined} onClick={() => void decidi("confermata")}>
          {inCorso === "confermata" ? "Avvio…" : "Conferma"}
        </button>
        <button type="button" disabled={inCorso !== undefined} onClick={() => void decidi("annullata")}>
          Annulla
        </button>
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Modello, effort e permessi in poche parole. */
function impostazioniInBreve(impostazioni: ImpostazioniConversazione): string {
  const modello = impostazioni.modello === undefined ? "il modello predefinito" : impostazioni.modello.charAt(0).toUpperCase() + impostazioni.modello.slice(1);
  const impegno = impostazioni.impegno === undefined ? "effort predefinito" : `effort ${NOMI_IMPEGNI[impostazioni.impegno].toLowerCase()}`;
  return `${modello}, ${impegno}, permessi «${NOMI_PERMESSI[impostazioni.permessi].toLowerCase()}»`;
}

const INSTALLAZIONE_DECISA = {
  approvata: "Installazione approvata da te: Shinka si riavvia con la versione nuova",
  negata: "Installazione negata: la versione non è stata installata",
  scaduta: "Non più in attesa: la versione non è stata installata",
} as const;

/**
 * Una versione di Shinka ha passato le prove e aspetta il proprietario. La scheda dice che cosa
 * cambia: il riassunto di chi l'ha scritta, i commit, i file. Con l'approvazione Shinka si riavvia.
 */
export function SchedaInstallazione({ installazione }: { installazione: Installazione }): ReactNode {
  const solaLettura = useSolaLettura();
  const [inviata, setInviata] = useState<"approvata" | "negata">();
  const [errore, setErrore] = useState<string>();
  // Una richiesta aspetta finché il proprietario non decide: smette solo se ne arriva una più recente o se Shinka riparte.
  const inAttesa = installazione.esito === undefined;

  async function decidi(decisione: "approvata" | "negata"): Promise<void> {
    setInviata(decisione);
    setErrore(undefined);
    try {
      await decidiInstallazione(installazione.chiave, decisione);
    } catch (causa) {
      setInviata(undefined);
      setErrore(causa instanceof Error ? causa.message : "Decisione non registrata.");
    }
  }

  if (!inAttesa || solaLettura) {
    const esito = installazione.esito ?? "scaduta";
    return (
      <div className={`riga proposta approvazione decisa ${esito}`}>
        <div className="intestazione">{INSTALLAZIONE_DECISA[esito]}</div>
        <div className="tenue">
          Versione <code>{installazione.versione}</code> · {installazione.riassunto}
        </div>
      </div>
    );
  }

  const altri = installazione.quantiFile - installazione.file.length;
  return (
    <div className="riga proposta approvazione installazione" role="group" aria-label="Installazione da approvare">
      <div className="intestazione">Versione di Shinka pronta da installare</div>
      <div>
        Le prove sono passate sulla versione <code>{installazione.versione}</code>. Entra in funzione solo se la approvi.
      </div>
      <div className="voce-scheda">
        <div className="titolino">Che cosa cambia</div>
        <div className="brief">{installazione.riassunto}</div>
      </div>
      {installazione.avvisi.length > 0 && (
        <ul className="avvisi-installazione">
          {installazione.avvisi.map((avviso) => (
            <li key={avviso}>{avviso}</li>
          ))}
        </ul>
      )}
      <details className="dettaglio-installazione">
        <summary>
          {installazione.modifiche.length === 1 ? "Una modifica registrata" : `${installazione.modifiche.length} modifiche registrate`},{" "}
          {installazione.quantiFile === 1 ? "un file" : `${installazione.quantiFile} file`}
        </summary>
        <ul>
          {installazione.modifiche.map((modifica, indice) => (
            <li key={`${indice}-${modifica}`}>{modifica}</li>
          ))}
        </ul>
        <ul className="elenco-file">
          {installazione.file.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
          {altri > 0 && <li className="tenue">… e altri {altri}</li>}
        </ul>
      </details>
      <div className="pulsanti">
        <button type="button" className="approva" disabled={inviata !== undefined} onClick={() => void decidi("approvata")}>
          {inviata === "approvata" ? "Si riavvia…" : "Installa"}
        </button>
        <button type="button" disabled={inviata !== undefined} onClick={() => void decidi("negata")}>
          Nega
        </button>
      </div>
      <div className="tenue">
        Con l'installazione Shinka si riavvia, e per qualche momento non risponde. Se la versione nuova non parte, torna da
        sola quella di prima. La richiesta aspetta finché non decidi; una più recente prende il suo posto.
      </div>
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Com'è finita un'installazione, detto dal centro quando è ripartito. */
export function InstallazioneConclusa({ installata }: { installata: Extract<Elemento, { tipo: "installata" }> }): ReactNode {
  const [daRicaricare, setDaRicaricare] = useState(false);
  const riuscita = installata.riuscita;

  // La pagina aperta prima dell'installazione usa ancora l'interfaccia di prima: lo si dice, se è cambiata.
  useEffect(() => {
    if (!riuscita) return;
    let vivo = true;
    void interfacciaDaRicaricare().then((cambiata) => {
      if (vivo) setDaRicaricare(cambiata);
    });
    return () => {
      vivo = false;
    };
  }, [riuscita]);

  if (riuscita) {
    return (
      <div className="riga nota installata">
        <span>
          Shinka è ripartita con la versione <code>{installata.versione}</code>.
          {daRicaricare && " Questa pagina usa ancora l'interfaccia di prima."}
        </span>
        {daRicaricare && (
          <button type="button" onClick={() => location.reload()}>
            Ricarica
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="riga avviso" role="alert">
      La versione {installata.versione} non è partita{installata.motivo === undefined ? "" : ` (${installata.motivo})`}: Shinka è
      tornata da sola a quella di prima.
    </div>
  );
}
