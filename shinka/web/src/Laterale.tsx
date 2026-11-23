import { useEffect, useRef, useState, type ReactNode } from "react";
import type { VoceProgetto } from "../../src/protocollo/progetti.ts";
import { eliminaProgetto, fissaProgetto, rinominaProgetto } from "./api.ts";
import { leggiModoGruppi, raggruppaProgetti, scriviModoGruppi, type ModoGruppi } from "./barra.ts";
import { PulsanteAmbienti } from "./Ambienti.tsx";
import { MenuAspetto } from "./Aspetto.tsx";
import { condizioneInParole, filtraArgomenti, giornoInBreve, vaultInBreve } from "./descrivi.ts";
import type { Quadro } from "./Quadro.tsx";
import { frammentoDi, type Vista } from "./vista.ts";

export interface ProprietaLaterale {
  vista: Vista;
  quadro: Quadro;
  /** Quante skill sono nate o cambiate da quando il proprietario ha guardato la loro pagina. */
  skillNuove: number;
  /** Sugli schermi stretti la barra sta fuori dallo schermo finché non viene aperta. */
  aperta: boolean;
  /** Il proprietario ha scelto una voce: sugli schermi stretti la barra si richiude. */
  allaScelta: () => void;
  pannelloAmbientiAperto: boolean;
  alClicAmbienti: () => void;
  /** Apre la palette dei comandi. */
  alVaiA: () => void;
  allUscita: () => void;
}

/** Da quanti argomenti archiviati in su compare il campo per cercarli. */
const ARGOMENTI_PER_CERCARE = 6;

/**
 * La barra laterale: il campo per cercare, la Home con i suoi argomenti archiviati, poi i progetti
 * con il loro ambiente e la loro condizione, che hanno tutto lo spazio che resta. In fondo il
 * menu delle pagine (memoria, skill, vault, impostazioni…), che si apre con la sua icona.
 */
export function Laterale(proprieta: ProprietaLaterale): ReactNode {
  const { vista, quadro, aperta, allaScelta } = proprieta;
  const progetti = quadro.progetti?.progetti;
  const archiviati = quadro.argomenti?.archiviati ?? [];
  const [cercato, setCercato] = useState("");
  const [argomentiAperti, setArgomentiAperti] = useState(false);
  const trovati = filtraArgomenti(archiviati, cercato);
  // Chi sta rileggendo un argomento archiviato lo vede nell'elenco, anche se lo aveva richiuso.
  const elencoAperto = argomentiAperti || vista.tipo === "argomento";
  const condizioneHome = quadro.home?.condizione ?? "fermo";
  const [modo, setModo] = useState<ModoGruppi>(leggiModoGruppi);
  const gruppi = progetti === undefined ? [] : raggruppaProgetti(progetti, modo);

  return (
    <nav className={aperta ? "laterale aperta" : "laterale"} aria-label="Home e progetti">
      <div className="marchio">
        Shinka
        <button type="button" className="discreto mini vai-a" title="Vai a un progetto, un argomento o una pagina (Ctrl+K)" onClick={proprieta.alVaiA}>
          Vai a… <kbd>Ctrl K</kbd>
        </button>
      </div>

      <CampoCerca allaScelta={allaScelta} />

      <a
        className={`voce ${condizioneHome}${vista.tipo === "home" ? " attuale" : ""}`}
        href={frammentoDi({ tipo: "home" })}
        aria-current={vista.tipo === "home" ? "page" : undefined}
        onClick={allaScelta}
      >
        <span className="nome">Home</span>
        {/* Come per i progetti: si vede da qui se la Home lavora o se aspetta una risposta. */}
        {condizioneHome !== "fermo" && (
          <span className="dettaglio">
            <span className="condizione">{condizioneInParole(condizioneHome)}</span>
          </span>
        )}
      </a>

      {archiviati.length > 0 && (
        <details
          className="argomenti"
          open={elencoAperto}
          onToggle={(evento) => setArgomentiAperti(evento.currentTarget.open)}
        >
          <summary>Argomenti archiviati ({archiviati.length})</summary>
          {archiviati.length >= ARGOMENTI_PER_CERCARE && (
            <input
              type="search"
              aria-label="Cerca tra gli argomenti archiviati"
              placeholder="Cerca…"
              value={cercato}
              onChange={(evento) => setCercato(evento.target.value)}
            />
          )}
          <div className="elenco-argomenti">
            {trovati.length === 0 && <p className="tenue">Nessun argomento corrisponde.</p>}
            {trovati.map((argomento) => {
              const attuale = vista.tipo === "argomento" && vista.id === argomento.id;
              return (
                <a
                  key={argomento.id}
                  className={attuale ? "voce attuale" : "voce"}
                  href={frammentoDi({ tipo: "argomento", id: argomento.id })}
                  aria-current={attuale ? "page" : undefined}
                  title={argomento.riassunto === "" ? undefined : argomento.riassunto}
                  onClick={allaScelta}
                >
                  <span className="nome">{argomento.titolo}</span>
                  <span className="dettaglio">{giornoInBreve(argomento.archiviatoIl)}</span>
                </a>
              );
            })}
          </div>
        </details>
      )}

      <div className="testa-progetti">
        <h2>Progetti</h2>
        <a
          className={vista.tipo === "nuovo-progetto" ? "nuovo-progetto attuale" : "nuovo-progetto"}
          href={frammentoDi({ tipo: "nuovo-progetto" })}
          aria-label="Nuovo progetto"
          title="Nuovo progetto"
          onClick={allaScelta}
        >
          +
        </a>
        {(progetti?.length ?? 0) > 1 && (
          <select
            aria-label="Raggruppa i progetti"
            title="Raggruppa i progetti"
            value={modo}
            onChange={(evento) => {
              const scelto = evento.target.value as ModoGruppi;
              setModo(scelto);
              scriviModoGruppi(scelto);
            }}
          >
            <option value="nessuno">Tutti insieme</option>
            <option value="ambiente">Per ambiente</option>
            <option value="stato">Per stato</option>
          </select>
        )}
      </div>
      <div className="elenco-progetti">
        {progetti === undefined && <p className="tenue">Carico…</p>}
        {progetti?.length === 0 && (
          <p className="tenue">Ancora nessuno. Chiedi un lavoro lungo alla Home: ti proporrà un progetto. Oppure creane uno da te, con il «+» qui sopra.</p>
        )}
        {gruppi.map((gruppo, posizione) => (
          <div key={gruppo.titolo ?? posizione} className="gruppo-progetti" role="group" aria-label={gruppo.titolo ?? "Progetti"}>
            {gruppo.titolo !== undefined && <h3 className="titolo-gruppo">{gruppo.titolo}</h3>}
            {gruppo.progetti.map((progetto) => (
              <VoceProgettoLaterale
                key={progetto.id}
                progetto={progetto}
                attuale={vista.tipo === "progetto" && vista.id === progetto.id}
                allaScelta={allaScelta}
              />
            ))}
          </div>
        ))}
      </div>

      <MenuAspetto />
      <div className="piede">
        <PulsanteAmbienti
          stato={quadro.ambienti}
          aperto={proprieta.pannelloAmbientiAperto}
          alClic={proprieta.alClicAmbienti}
        />
        <div className="piede-destra">
          <MenuPagine vista={vista} quadro={quadro} skillNuove={proprieta.skillNuove} allaScelta={allaScelta} />
          <button type="button" className="discreto" onClick={proprieta.allUscita}>
            Esci
          </button>
        </div>
      </div>
    </nav>
  );
}

/** Il campo per cercare nelle conversazioni: con Invio apre la pagina Cerca con le parole scritte. */
function CampoCerca({ allaScelta }: { allaScelta: () => void }): ReactNode {
  const [parole, setParole] = useState("");
  return (
    <form
      className="cerca-laterale"
      role="search"
      onSubmit={(evento) => {
        evento.preventDefault();
        window.location.hash = frammentoDi({ tipo: "cerca", parole });
        setParole("");
        allaScelta();
      }}
    >
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M12.5 12.5l4.5 4.5" />
      </svg>
      <input
        type="search"
        enterKeyHint="search"
        aria-label="Cerca nelle conversazioni"
        placeholder="Cerca"
        value={parole}
        onChange={(evento) => setParole(evento.target.value)}
      />
    </form>
  );
}

/** Le pagine che non sono conversazioni, in un menu che si apre dall'icona in fondo alla barra. */
function MenuPagine({ vista, quadro, skillNuove, allaScelta }: { vista: Vista; quadro: Quadro; skillNuove: number; allaScelta: () => void }): ReactNode {
  const menu = useRef<HTMLDetailsElement>(null);
  const [aperto, setAperto] = useState(false);
  // Si richiude con un tocco fuori o con Esc, come gli altri menu.
  useEffect(() => {
    if (!aperto) return;
    const chiudi = (): void => menu.current?.removeAttribute("open");
    const fuori = (evento: PointerEvent): void => {
      if (!menu.current?.contains(evento.target as Node)) chiudi();
    };
    const tasto = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") chiudi();
    };
    document.addEventListener("pointerdown", fuori);
    document.addEventListener("keydown", tasto);
    return () => {
      document.removeEventListener("pointerdown", fuori);
      document.removeEventListener("keydown", tasto);
    };
  }, [aperto]);

  const voci = quadro.memoria?.voci.length;
  const skill = quadro.skill?.skill.length;
  const estensioni = quadro.estensioni?.estensioni.length;
  const vault = vaultInBreve(quadro.vault);
  const pagine: { vista: Vista; nome: string; accanto?: ReactNode }[] = [
    { vista: { tipo: "programmati" }, nome: "Programmati" },
    { vista: { tipo: "uso" }, nome: "Uso" },
    { vista: { tipo: "archiviazione" }, nome: "Archiviazione" },
    { vista: { tipo: "elaborati" }, nome: "Elaborati" },
    { vista: { tipo: "memoria" }, nome: "Memoria", accanto: voci !== undefined && <span className="quanti">{voci}</span> },
    {
      vista: { tipo: "skill" },
      nome: "Skill",
      accanto:
        skillNuove > 0 ? (
          <span className="novita" aria-label={`${skillNuove} nuove o cambiate`}>
            {skillNuove === 1 ? "1 novità" : `${skillNuove} novità`}
          </span>
        ) : (
          skill !== undefined && <span className="quanti">{skill}</span>
        ),
    },
    { vista: { tipo: "estensioni" }, nome: "Estensioni", accanto: estensioni !== undefined && <span className="quanti">{estensioni}</span> },
    { vista: { tipo: "vault" }, nome: "Vault", accanto: vault !== undefined && <span className="quanti">{vault}</span> },
    { vista: { tipo: "impostazioni" }, nome: "Impostazioni" },
  ];
  const suUnaPagina = pagine.some((pagina) => pagina.vista.tipo === vista.tipo);

  return (
    <details ref={menu} className="menu-pagine" onToggle={(evento) => setAperto(evento.currentTarget.open)}>
      <summary
        className={suUnaPagina ? "attuale" : undefined}
        aria-label={skillNuove > 0 ? "Pagine: ci sono skill nuove" : "Pagine"}
        title="Programmati, uso, memoria, skill, vault, impostazioni…"
      >
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="5.5" height="5.5" rx="1.4" />
          <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.4" />
          <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.4" />
          <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.4" />
        </svg>
        {skillNuove > 0 && <span className="pallino" aria-hidden="true" />}
      </summary>
      <div className="voci-pagine">
        {pagine.map((pagina) => {
          const attuale = pagina.vista.tipo === vista.tipo;
          return (
            <a
              key={pagina.vista.tipo}
              className={attuale ? "voce attuale" : "voce"}
              href={frammentoDi(pagina.vista)}
              aria-current={attuale ? "page" : undefined}
              onClick={() => {
                menu.current?.removeAttribute("open");
                allaScelta();
              }}
            >
              <span className="nome">{pagina.nome}</span>
              {pagina.accanto}
            </a>
          );
        })}
      </div>
    </details>
  );
}

/** Un progetto nella barra: il collegamento, e il menu per fissarlo, rinominarlo o eliminarlo. */
function VoceProgettoLaterale({ progetto, attuale, allaScelta }: { progetto: VoceProgetto; attuale: boolean; allaScelta: () => void }): ReactNode {
  const [inRinomina, setInRinomina] = useState<string>();
  const [elimina, setElimina] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [lavoro, setLavoro] = useState(false);
  const chiudiMenu = (evento: { currentTarget: HTMLElement }): void => evento.currentTarget.closest("details")?.removeAttribute("open");
  const fai = async (azione: () => Promise<void>): Promise<boolean> => {
    setLavoro(true);
    setErrore(undefined);
    try {
      await azione();
      return true;
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è riuscito.");
      return false;
    } finally {
      setLavoro(false);
    }
  };
  return (
    <div className="riga-progetto">
      {inRinomina === undefined ? (
        <a
          className={`voce ${progetto.condizione}${attuale ? " attuale" : ""}`}
          href={frammentoDi({ tipo: "progetto", id: progetto.id })}
          aria-current={attuale ? "page" : undefined}
          onClick={allaScelta}
        >
          <span className="nome">
            {progetto.nome}
            {progetto.diShinka === true && <span className="etichetta-shinka">questa Shinka</span>}
          </span>
          <span className="dettaglio">
            <span className="ambiente">{progetto.nomeAmbiente}</span>
            <span className="condizione">{condizioneInParole(progetto.condizione)}</span>
          </span>
        </a>
      ) : (
        <form
          className="rinomina-progetto"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (inRinomina.trim() === "") return;
            void fai(() => rinominaProgetto(progetto.id, inRinomina)).then((riuscito) => riuscito && setInRinomina(undefined));
          }}
        >
          <input
            aria-label={`Nuovo nome di ${progetto.nome}`}
            value={inRinomina}
            maxLength={60}
            autoFocus
            disabled={lavoro}
            onChange={(evento) => setInRinomina(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") setInRinomina(undefined);
            }}
          />
          <button type="submit" className="mini approva" disabled={lavoro || inRinomina.trim() === ""}>
            Salva
          </button>
        </form>
      )}
      {inRinomina === undefined && (
        <details className="menu-progetto">
          <summary aria-label={`Altro su ${progetto.nome}`} title="Fissa, rinomina, elimina">
            ⋯
          </summary>
          <div className="voci-esporta">
            <button
              type="button"
              onClick={(evento) => {
                chiudiMenu(evento);
                void fai(() => fissaProgetto(progetto.id, progetto.fissato !== true));
              }}
            >
              {progetto.fissato === true ? "Togli dalla cima" : "Fissa in cima"}
            </button>
            <button
              type="button"
              onClick={(evento) => {
                chiudiMenu(evento);
                setInRinomina(progetto.nome);
              }}
            >
              Rinomina
            </button>
            {progetto.diShinka !== true && (
              <button
                type="button"
                className="pericolo"
                onClick={(evento) => {
                  chiudiMenu(evento);
                  setElimina(true);
                }}
              >
                Elimina…
              </button>
            )}
          </div>
        </details>
      )}
      {elimina && (
        <div className="conferma-annulla" role="alertdialog" aria-label={`Eliminare ${progetto.nome}`}>
          <p>
            «{progetto.nome}» sparisce da Shinka con la sua conversazione. La cartella con i suoi file resta in {progetto.nomeAmbiente}. Non si torna indietro.
          </p>
          <div className="pulsanti">
            <button
              type="button"
              className="mini pericolo"
              disabled={lavoro}
              onClick={() =>
                void fai(() => eliminaProgetto(progetto.id)).then((riuscito) => {
                  if (!riuscito) return;
                  setElimina(false);
                  if (attuale) window.location.hash = frammentoDi({ tipo: "home" });
                })
              }
            >
              Elimina
            </button>
            <button type="button" className="mini discreto" disabled={lavoro} onClick={() => setElimina(false)}>
              No
            </button>
          </div>
        </div>
      )}
      {errore !== undefined && <p className="errore">{errore}</p>}
    </div>
  );
}
