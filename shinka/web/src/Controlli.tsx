import { useEffect, useState, type ReactNode } from "react";
import {
  IMPEGNI,
  MODI_PERMESSI,
  type FinestraDiUtilizzo,
  type Impegno,
  type ImpostazioniConversazione,
  type ModelloDisponibile,
  type ModoPermessi,
  type SceltaDelProprietario,
  type StatoConversazione,
} from "../../src/protocollo/impostazioni.ts";
import type { StileDiRisposta } from "../../src/protocollo/stili.ts";
import { cambiaImpostazioni, leggiStili } from "./api.ts";
import { GestioneStili } from "./Stili.tsx";
import { useBaseDellaChat } from "./ContestoChat.ts";
import { inMigliaia, quandoRiparte } from "./descrivi.ts";
import { gruppiDiModelli, nomeDelModello } from "./motori.ts";
import { MenuDelModello } from "./MenuDelModello.tsx";

/** I modelli da proporre finché l'harness non ha detto quali sono disponibili. */
export const MODELLI_NOTI: ModelloDisponibile[] = [
  { valore: "fable", nome: "Fable", descrizione: "" },
  { valore: "opus", nome: "Opus", descrizione: "" },
  { valore: "sonnet", nome: "Sonnet", descrizione: "" },
  { valore: "haiku", nome: "Haiku", descrizione: "" },
];

export const NOMI_IMPEGNI: Record<Impegno, string> = {
  low: "Basso",
  medium: "Medio",
  high: "Alto",
  xhigh: "Molto alto",
  max: "Massimo",
};

export const NOMI_PERMESSI: Record<ModoPermessi, string> = {
  chiedi: "Chiedi sempre",
  "modifiche-libere": "Modifiche libere",
  automatico: "Automatico",
  "senza-permessi": "Senza permessi",
};

/** I permessi in una parola, per il riassunto sul telefono. */
const PERMESSI_IN_BREVE: Record<ModoPermessi, string> = {
  chiedi: "Chiedi",
  "modifiche-libere": "Modifiche",
  automatico: "Automatico",
  "senza-permessi": "Senza permessi",
};

export const SPIEGAZIONI_PERMESSI: Record<ModoPermessi, string> = {
  chiedi: "Ogni azione che non sia di sola lettura chiede il tuo permesso.",
  "modifiche-libere": "Le modifiche ai file della cartella non chiedono; i comandi sì.",
  automatico: "Decide un classificatore di Claude Code, che chiede a te solo nel dubbio.",
  "senza-permessi": "Claude esegue qualunque azione senza chiedere nulla.",
};

export interface ProprietaControlli {
  impostazioni: ImpostazioniConversazione | undefined;
  stato: StatoConversazione | undefined;
}

/** Il valore della voce che apre la gestione degli stili, nel menu dello stile. */
const NUOVO_STILE = "--nuovo--";

/** La riga sotto il campo di scrittura: modello, impegno, permessi, stile, contesto occupato e limiti del piano. */
export function Controlli({ impostazioni, stato }: ProprietaControlli): ReactNode {
  const base = useBaseDellaChat();
  const [errore, setErrore] = useState<string>();
  const [daConfermare, setDaConfermare] = useState(false);
  // Sul telefono le scelte stanno chiuse dietro un riassunto: si aprono quando servono.
  const [aperte, setAperte] = useState(false);
  const [stili, setStili] = useState<StileDiRisposta[]>();
  const [siCreano, setSiCreano] = useState(false);
  const [gestione, setGestione] = useState(false);
  useEffect(() => {
    let valida = true;
    leggiStili()
      .then((letti) => {
        if (!valida) return;
        setStili(letti.stili);
        setSiCreano(letti.siCreano);
      })
      .catch(() => {});
    return () => {
      valida = false;
    };
  }, []);
  if (impostazioni === undefined) return null;

  async function cambia(modifica: SceltaDelProprietario): Promise<void> {
    setErrore(undefined);
    try {
      await cambiaImpostazioni(base, modifica);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Impostazione non salvata.");
    }
  }

  const gruppi = gruppiDiModelli(stato?.modelli ?? MODELLI_NOTI);
  // Il motore della conversazione: quello scelto, o quello che sta lavorando.
  const motore = impostazioni.motore ?? stato?.motore;
  const gruppo = gruppi.find((voce) => voce.motore === undefined || voce.motore === motore);
  const scelto = gruppo?.modelli.find((modello) => modello.valore === impostazioni.modello);
  const impegni = scelto?.impegni ?? IMPEGNI;
  const conMotori = gruppi.length > 1;

  const nomeModello = nomeDelModello(gruppi, motore, impostazioni.modello);
  const riassunto = [
    nomeModello,
    impostazioni.impegno === undefined ? "Effort predefinito" : `Effort ${NOMI_IMPEGNI[impostazioni.impegno].toLowerCase()}`,
    NOMI_PERMESSI[impostazioni.permessi],
    ...(impostazioni.stile === undefined ? [] : [`Stile ${impostazioni.stile.nome.toLowerCase()}`]),
  ].join(" · ");
  // Accanto ai limiti c'è poco posto: l'effort compare solo se è stato scelto, i permessi in breve.
  const riassuntoBreve = [
    impostazioni.modello === undefined && scelto === undefined && !conMotori ? "Predefinito" : nomeModello,
    ...(impostazioni.impegno === undefined ? [] : [NOMI_IMPEGNI[impostazioni.impegno]]),
    PERMESSI_IN_BREVE[impostazioni.permessi],
    ...(impostazioni.stile === undefined ? [] : [impostazioni.stile.nome]),
  ].join(" · ");
  const sceltoStile = impostazioni.stile;
  const elencoStili = stili ?? [];

  return (
    <div className={aperte ? "controlli aperti" : "controlli"}>
      {/* Solo sul telefono: una riga con il riassunto delle scelte e i limiti in piccolo. */}
      <div className="riassunto-controlli">
        <button
          type="button"
          className={impostazioni.permessi === "senza-permessi" ? "discreto apri-scelte pericolo" : "discreto apri-scelte"}
          aria-expanded={aperte}
          aria-label={aperte ? "Chiudi le scelte di modello, effort, permessi e stile" : `Scelte: ${riassunto}. Tocca per cambiarle`}
          onClick={() => setAperte((prima) => !prima)}
        >
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M3 6h8M15 6h2M3 14h2M9 14h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="13" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="7" cy="14" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span className="testo-riassunto">{riassuntoBreve}</span>
          <span className="freccia" aria-hidden="true">
            {aperte ? "▴" : "▾"}
          </span>
        </button>
        <Misure stato={stato} compatte />
      </div>
      <div className="scelte">
        <MenuDelModello
          etichetta="Modello"
          titolo={stato?.modello === undefined ? "Modello" : `Modello in uso: ${stato.modello}`}
          modelli={stato?.modelli ?? MODELLI_NOTI}
          motore={motore}
          modello={impostazioni.modello}
          // Un modello dell'altro motore cambia anche il motore: lo dice una nota in chat.
          allaScelta={({ motore: nuovo, modello }) => void cambia(nuovo === undefined ? { modello } : { motore: nuovo, modello })}
        />

        <select
          aria-label="Effort"
          title="Effort: quanto Claude si impegna in ogni risposta"
          value={impostazioni.impegno ?? ""}
          onChange={(evento) =>
            void cambia({ impegno: evento.target.value === "" ? null : (evento.target.value as Impegno) })
          }
        >
          <option value="">Effort predefinito</option>
          {impostazioni.impegno !== undefined && !impegni.includes(impostazioni.impegno) && (
            <option value={impostazioni.impegno}>Effort: {NOMI_IMPEGNI[impostazioni.impegno]}</option>
          )}
          {impegni.map((impegno) => (
            <option key={impegno} value={impegno}>
              Effort: {NOMI_IMPEGNI[impegno]}
            </option>
          ))}
        </select>

        <select
          aria-label="Permessi"
          className={impostazioni.permessi === "senza-permessi" ? "pericolo" : undefined}
          title={SPIEGAZIONI_PERMESSI[impostazioni.permessi]}
          value={impostazioni.permessi}
          onChange={(evento) => {
            const modo = evento.target.value as ModoPermessi;
            // Togliere ogni controllo è una scelta da fare due volte.
            if (modo === "senza-permessi") setDaConfermare(true);
            else {
              setDaConfermare(false);
              void cambia({ permessi: modo });
            }
          }}
        >
          {MODI_PERMESSI.map((modo) => (
            <option key={modo} value={modo}>
              {NOMI_PERMESSI[modo]}
            </option>
          ))}
        </select>

        <select
          aria-label="Stile"
          title="Stile: come Claude scrive le risposte"
          value={sceltoStile?.id ?? ""}
          onChange={(evento) => {
            const valore = evento.target.value;
            if (valore === NUOVO_STILE) setGestione(true);
            else void cambia({ stile: valore === "" ? null : valore });
          }}
        >
          <option value="">Stile normale</option>
          {sceltoStile !== undefined && !elencoStili.some((stile) => stile.id === sceltoStile.id) && (
            <option value={sceltoStile.id}>Stile: {sceltoStile.nome}</option>
          )}
          {elencoStili.map((stile) => (
            <option key={stile.id} value={stile.id} title={stile.descrizione}>
              Stile: {stile.nome}
            </option>
          ))}
          {siCreano && <option value={NUOVO_STILE}>Nuovo stile…</option>}
        </select>

        <Misure stato={stato} />
      </div>

      {daConfermare && (
        <div className="conferma-permessi" role="alertdialog" aria-label="Lavorare senza permessi">
          <p>
            Senza permessi Claude esegue qualunque comando in questa conversazione senza chiedere, anche fuori
            dalla sua cartella. La scelta resta salvata finché non la cambi.
          </p>
          <div className="pulsanti">
            <button
              type="button"
              onClick={() => {
                setDaConfermare(false);
                void cambia({ permessi: "senza-permessi" });
              }}
            >
              Lavora senza permessi
            </button>
            <button type="button" className="discreto" onClick={() => setDaConfermare(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {gestione && (
        <GestioneStili
          stili={elencoStili}
          allaChiusura={() => setGestione(false)}
          alCambio={(nuovi, creato) => {
            setStili(nuovi);
            if (creato !== undefined) void cambia({ stile: creato.id });
          }}
        />
      )}
      {errore !== undefined && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/**
 * Contesto occupato e limiti del piano, ciascuno con la sua barra. Compatte, per il telefono: una
 * sigla, una barretta e la percentuale.
 */
function Misure({ stato, compatte = false }: { stato: StatoConversazione | undefined; compatte?: boolean }): ReactNode {
  const contesto = stato?.contesto;
  const limiti = stato?.limiti;
  if (contesto === undefined && limiti === undefined) return null;
  return (
    <div className={compatte ? "misure compatte" : "misure"}>
      {contesto !== undefined && (
        <Misura
          nome={compatte ? "Ctx" : "Contesto"}
          percento={contesto.percento}
          dettaglio={`Contesto: ${inMigliaia(contesto.usati)} di ${inMigliaia(contesto.massimo)} token occupati`}
        />
      )}
      {limiti?.cinqueOre !== undefined && (
        <MisuraLimite nome={compatte ? "5h" : "5 ore"} periodo="sulle ultime 5 ore" finestra={limiti.cinqueOre} />
      )}
      {limiti?.setteGiorni !== undefined && (
        <MisuraLimite nome={compatte ? "7g" : "7 giorni"} periodo="sugli ultimi 7 giorni" finestra={limiti.setteGiorni} />
      )}
    </div>
  );
}

function MisuraLimite({
  nome,
  periodo,
  finestra,
}: {
  nome: string;
  periodo: string;
  finestra: FinestraDiUtilizzo;
}): ReactNode {
  const riparte = quandoRiparte(finestra.azzeraIl);
  return (
    <Misura
      nome={nome}
      percento={finestra.percento}
      dettaglio={`Limite del piano ${periodo}: ${finestra.percento}% usato${riparte === "" ? "" : `, ${riparte}`}`}
    />
  );
}

function Misura({ nome, percento, dettaglio }: { nome: string; percento: number; dettaglio: string }): ReactNode {
  const pieno = Math.max(0, Math.min(100, percento));
  const tono = pieno >= 90 ? "alta" : pieno >= 70 ? "media" : "bassa";
  return (
    <span className={`misura ${tono}`} title={dettaglio} aria-label={dettaglio}>
      <span className="nome">{nome}</span>
      <span className="barra" aria-hidden="true">
        <span style={{ width: `${pieno}%` }} />
      </span>
      <span className="valore">{pieno}%</span>
    </span>
  );
}
