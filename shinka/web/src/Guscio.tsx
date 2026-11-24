import { ReteDiSicurezza } from "./ReteDiSicurezza.tsx";
import { PaginaEstensione, TemiDelleEstensioni } from "./Interfaccia.tsx";
import { PaginaImpostazioni } from "./Impostazioni.tsx";
import { PaginaCerca } from "./Cerca.tsx";
import { PaginaArchiviazione, PaginaUso } from "./Uso.tsx";
import { PaginaProgrammati } from "./Programmati.tsx";
import { PaginaSicurezza } from "./Sicurezza.tsx";
import { PaginaNuovoProgetto } from "./NuovoProgetto.tsx";
import { PaginaAmbiente } from "./Ambiente.tsx";
import { Palette, type VocePalette } from "./Palette.tsx";
import { leggiAffiancata, MenuAffianca, scriviAffiancata, stessaConversazione, type Affiancata } from "./Affianca.tsx";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { VoceProgetto } from "../../src/protocollo/progetti.ts";
import { PannelloAmbienti } from "./Ambienti.tsx";
import { BASE_HOME, baseDellArgomento, baseDellaChatDellaHome, baseDelProgetto, esci, nuovoArgomento, riapriArgomento } from "./api.ts";
import { leggiChatScelta, PulsanteNuovaChat, SchedeDelleChat, scriviChatScelta } from "./ChatParallele.tsx";
import { conversazioneDellaChat } from "../../src/protocollo/chat-parallele.ts";
import { Chat, type ComandoChat, type ProprietaChat } from "./Chat.tsx";
import { condizioneInParole, giornoInBreve, skillNonViste } from "./descrivi.ts";
import type { RichiestaAnteprima } from "./Anteprima.tsx";
import { Laterale } from "./Laterale.tsx";
import { PannelloProgetto, PulsantiPannello, type Scheda } from "./Pannello.tsx";
import type { TurnoModificato } from "./PannelloModifiche.tsx";
import type { FileDeiComandi } from "../../src/protocollo/modifiche.ts";
import { PaginaElaborati } from "./Elaborati.tsx";
import { chiaveElaborato } from "./elaborati-giorni.ts";
import type { RiferimentoElaborato } from "./api.ts";
import { PaginaMemoria } from "./Memoria.tsx";
import { PaginaEstensioni } from "./Estensioni.tsx";
import { PaginaSkill } from "./Skill.tsx";
import { PaginaVault } from "./Vault.tsx";
import { FornitoreQuadro, useQuadro } from "./Quadro.tsx";
import { frammentoDi, useFrammento, vaiA, vistaDa } from "./vista.ts";

const TONI: Record<VoceProgetto["condizione"], NonNullable<ProprietaChat["condizione"]>["tono"]> = {
  "al-lavoro": "bene",
  fermo: "bene",
  "aspetta-te": "attesa",
  "ambiente-spento": "spenta",
};

/** Il comando della testata di una chat della Home: archivia il suo argomento e ne comincia uno nuovo. */
function comandoNuovoArgomento(base: string): ComandoChat {
  return {
    etichetta: "Nuovo argomento",
    descrizione: "Archivia questo argomento e comincia da capo",
    esegui: () => nuovoArgomento(base),
  };
}

/** Dove questo browser ricorda fino a quando il proprietario ha visto le skill. */
const CHIAVE_SKILL_VISTE = "shinka.skill.viste";

function leggiSkillViste(): number {
  try {
    const letto = Number(window.localStorage.getItem(CHIAVE_SKILL_VISTE));
    return Number.isFinite(letto) ? letto : 0;
  } catch {
    return 0;
  }
}

/** L'interfaccia dopo l'accesso: la barra laterale e, accanto, la Home o il progetto scelto. */
export function Guscio({ allUscita }: { allUscita: () => void }): ReactNode {
  const quadro = useQuadro();
  const frammento = useFrammento();
  const vista = useMemo(() => vistaDa(frammento), [frammento]);
  const [lateraleAperta, setLateraleAperta] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);
  const richieste = quadro.ambienti?.richieste.length ?? 0;

  // Un nodo che chiede di collegarsi aspetta il proprietario: il pannello si apre da solo.
  useEffect(() => {
    if (richieste > 0) setPannelloAperto(true);
  }, [richieste]);

  // Cambiata la vista, sugli schermi stretti la barra laterale si toglie di mezzo.
  useEffect(() => {
    setLateraleAperta(false);
  }, [frammento]);

  const apriProgetto = useCallback((id: string) => vaiA({ tipo: "progetto", id }), []);

  // La chat scelta nella Home e in ciascun progetto, tra la principale e le chat parallele (ADR 0052).
  const [chatScelte, setChatScelte] = useState<Record<string, number>>({});
  const chatScelta = useCallback(
    (idProgetto: string | undefined, aperte: readonly { numero: number }[]): number => {
      const scelta = chatScelte[idProgetto ?? ""] ?? leggiChatScelta(idProgetto);
      // Una chat che non è (più) aperta lascia il posto alla principale.
      return scelta === 1 || aperte.some((chat) => chat.numero === scelta) ? scelta : 1;
    },
    [chatScelte],
  );
  const scegliChat = useCallback((idProgetto: string | undefined, numero: number) => {
    setChatScelte((prima) => ({ ...prima, [idProgetto ?? ""]: numero }));
    scriviChatScelta(idProgetto, numero);
  }, []);

  // Il pannello accanto alla chat di un progetto, con terminale e anteprima: vale per il progetto
  // in cui è stato aperto, e passando a un altro si chiude.
  const [affianco, setAffianco] = useState<{ idProgetto: string; scheda: Scheda; turno?: string }>();
  // La conversazione affiancata, sugli schermi larghi: la scelta resta nel browser.
  const [affiancata, setAffiancataQui] = useState<Affiancata | undefined>(leggiAffiancata);
  const setAffiancata = useCallback((scelta: Affiancata | undefined) => {
    setAffiancataQui(scelta);
    scriviAffiancata(scelta);
  }, []);
  // I turni in cui Claude ha cambiato dei file, come li ha visti la chat del progetto aperto.
  const [modifiche, setModifiche] = useState<{ idProgetto: string; turni: TurnoModificato[]; occupata: boolean; fileDeiComandi?: FileDeiComandi }>();
  const alleModifiche = useCallback(
    (idProgetto: string, turni: TurnoModificato[], occupata: boolean, fileDeiComandi: FileDeiComandi | undefined) =>
      setModifiche({ idProgetto, turni, occupata, ...(fileDeiComandi === undefined ? {} : { fileDeiComandi }) }),
    [],
  );
  const [richiestaAnteprima, setRichiestaAnteprima] = useState<RichiestaAnteprima & { idProgetto: string }>();
  // Un elaborato mostrato nella chat si apre nella sua pagina.
  const apriElaborato = useCallback((riferimento: RiferimentoElaborato) => vaiA({ tipo: "elaborati", scelto: chiaveElaborato(riferimento) }), []);
  const numeroRichiesta = useRef(0);

  // Le skill create o cambiate da quando il proprietario ha guardato la loro pagina: sono da segnalare.
  const [skillViste, setSkillViste] = useState(leggiSkillViste);
  const skillNuove = useMemo(
    () => new Set(skillNonViste(quadro.skill?.skill ?? [], skillViste).map((voce) => voce.nome)),
    [quadro.skill, skillViste],
  );
  // Ciò che era nuovo quando è entrato nella pagina resta segnato finché non ne esce.
  const [nuoveAllIngresso, setNuoveAllIngresso] = useState<ReadonlySet<string>>(new Set());
  const nellaPaginaSkill = vista.tipo === "skill";
  useEffect(() => {
    if (!nellaPaginaSkill) {
      setNuoveAllIngresso((prima) => (prima.size === 0 ? prima : new Set()));
      return;
    }
    if (skillNuove.size === 0) return;
    setNuoveAllIngresso((prima) => new Set([...prima, ...skillNuove]));
    const ultima = Math.max(...(quadro.skill?.skill ?? []).map((voce) => Date.parse(voce.modificataIl) || 0));
    setSkillViste(ultima);
    try {
      window.localStorage.setItem(CHIAVE_SKILL_VISTE, String(ultima));
    } catch {
      // Senza memoria del browser le skill restano segnalate fino alla prossima visita: non è grave.
    }
  }, [nellaPaginaSkill, skillNuove, quadro.skill]);

  // Un argomento ripreso torna a essere la Home: chi lo stava rileggendo viene portato lì.
  const idArgomentoAperto = quadro.argomenti?.idAperto;
  useEffect(() => {
    if (vista.tipo === "argomento" && vista.id === idArgomentoAperto) vaiA({ tipo: "home" });
  }, [vista, idArgomentoAperto]);
  const chiudiPannello = useCallback(() => setPannelloAperto(false), []);

  // La palette dei comandi (Ctrl+K o ⌘K) e Esc, che chiude ciò che è aperto sopra la pagina.
  const [paletteAperta, setPaletteAperta] = useState(false);
  useEffect(() => {
    const alTasto = (evento: KeyboardEvent): void => {
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setPaletteAperta((prima) => !prima);
        return;
      }
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      // Prima i menu aperti nelle testate, poi il pannello del progetto, poi la barra laterale.
      const menuAperti = [...document.querySelectorAll<HTMLDetailsElement>(".testata details[open], .laterale details.menu-progetto[open]")];
      if (menuAperti.length > 0) {
        for (const menu of menuAperti) menu.open = false;
        return;
      }
      const dentroUnCampo = evento.target instanceof HTMLElement && evento.target.closest("textarea, input, select") !== null;
      if (dentroUnCampo) return;
      setAffianco(undefined);
      setLateraleAperta(false);
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, []);
  const vociPalette = useMemo((): VocePalette[] => {
    const pagina = (etichetta: string, destinazione: Parameters<typeof frammentoDi>[0]): VocePalette => ({
      chiave: `pagina-${etichetta}`,
      etichetta,
      genere: "pagina",
      esegui: () => vaiA(destinazione),
    });
    return [
      pagina("Home", { tipo: "home" }),
      {
        chiave: "azione-nuovo-argomento",
        etichetta: "Nuovo argomento",
        genere: "azione",
        dettaglio: "archivia l'argomento aperto della Home",
        esegui: () => {
          vaiA({ tipo: "home" });
          void nuovoArgomento().catch(() => {});
        },
      },
      ...(quadro.progetti?.progetti ?? []).map((progetto) => ({
        chiave: `progetto-${progetto.id}`,
        etichetta: progetto.nome,
        genere: "progetto",
        dettaglio: progetto.nomeAmbiente,
        esegui: () => vaiA({ tipo: "progetto", id: progetto.id }),
      })),
      pagina("Cerca nelle conversazioni", { tipo: "cerca" }),
      pagina("Elaborati", { tipo: "elaborati" }),
      pagina("Nuovo progetto", { tipo: "nuovo-progetto" }),
      pagina("Programmati", { tipo: "programmati" }),
      pagina("Uso", { tipo: "uso" }),
      pagina("Archiviazione", { tipo: "archiviazione" }),
      pagina("Sicurezza", { tipo: "sicurezza" }),
      pagina("Memoria", { tipo: "memoria" }),
      pagina("Skill", { tipo: "skill" }),
      pagina("Estensioni", { tipo: "estensioni" }),
      pagina("Vault", { tipo: "vault" }),
      pagina("Impostazioni", { tipo: "impostazioni" }),
      ...(quadro.argomenti?.archiviati ?? []).map((argomento) => ({
        chiave: `argomento-${argomento.id}`,
        etichetta: argomento.titolo,
        genere: "argomento",
        dettaglio: giornoInBreve(argomento.archiviatoIl),
        esegui: () => vaiA({ tipo: "argomento", id: argomento.id }),
      })),
    ];
  }, [quadro.progetti, quadro.argomenti]);

  async function esciDaShinka(): Promise<void> {
    await esci().catch(() => {});
    allUscita();
  }

  // Ciò che aspetta il proprietario altrove: progetti fermi su una sua risposta e nodi da accogliere.
  const altrove =
    (quadro.progetti?.progetti ?? []).filter(
      (p) => p.condizione === "aspetta-te" && !(vista.tipo === "progetto" && vista.id === p.id),
    ).length + richieste;

  const menu = (
    <button
      type="button"
      className="discreto pulsante-menu"
      aria-label={altrove > 0 ? `Progetti: ${altrove} aspettano te` : "Progetti"}
      aria-expanded={lateraleAperta}
      onClick={() => setLateraleAperta(true)}
    >
      <span className="righe" aria-hidden="true" />
      {altrove > 0 && <span className="segnale">{altrove}</span>}
      {altrove === 0 && skillNuove.size > 0 && <span className="puntino" aria-label="Skill nuove o cambiate" />}
    </button>
  );

  const menuAffianca =
    vista.tipo === "home" || vista.tipo === "progetto" ? (
      <MenuAffianca progetti={quadro.progetti?.progetti ?? []} attuale={vista} scelta={affiancata} allaScelta={setAffiancata} />
    ) : undefined;

  let contenuto: ReactNode;
  if (vista.tipo === "memoria") {
    contenuto = <PaginaMemoria menu={menu} stato={quadro.memoria} />;
  } else if (vista.tipo === "skill") {
    contenuto = <PaginaSkill menu={menu} stato={quadro.skill} nome={vista.nome} nuove={nuoveAllIngresso} />;
  } else if (vista.tipo === "vault") {
    contenuto = <PaginaVault menu={menu} breve={quadro.vault} />;
  } else if (vista.tipo === "estensioni") {
    contenuto = <PaginaEstensioni menu={menu} stato={quadro.estensioni} ambienti={quadro.ambienti} />;
  } else if (vista.tipo === "elaborati") {
    contenuto = <PaginaElaborati menu={menu} scelto={vista.scelto} />;
  } else if (vista.tipo === "cerca") {
    contenuto = <PaginaCerca key={vista.parole ?? ""} menu={menu} parole={vista.parole} />;
  } else if (vista.tipo === "ambiente") {
    contenuto = <PaginaAmbiente menu={menu} ambiente={quadro.ambienti?.ambienti.find((uno) => uno.id === vista.id)} caricato={quadro.ambienti !== undefined} />;
  } else if (vista.tipo === "nuovo-progetto") {
    contenuto = <PaginaNuovoProgetto menu={menu} />;
  } else if (vista.tipo === "programmati") {
    contenuto = <PaginaProgrammati menu={menu} progetti={quadro.progetti?.progetti ?? []} />;
  } else if (vista.tipo === "uso") {
    contenuto = <PaginaUso menu={menu} />;
  } else if (vista.tipo === "archiviazione") {
    contenuto = <PaginaArchiviazione menu={menu} />;
  } else if (vista.tipo === "sicurezza") {
    contenuto = <PaginaSicurezza menu={menu} ambienti={quadro.ambienti?.ambienti ?? []} />;
  } else if (vista.tipo === "impostazioni") {
    contenuto = <PaginaImpostazioni menu={menu} />;
  } else if (vista.tipo === "interfaccia") {
    contenuto = <PaginaEstensione menu={menu} id={vista.id} pagina={vista.pagina} />;
  } else if (vista.tipo === "home") {
    const chatHome = quadro.home?.chat ?? [];
    const numero = chatScelta(undefined, chatHome);
    const base = baseDellaChatDellaHome(numero);
    contenuto = (
      <Chat
          key={base}
          base={base}
          titolo="Home"
          {...(numero === 1 ? {} : { sottotitolo: `Chat ${numero}` })}
          segnaposto="Scrivi alla Home…"
          seVuota={
            numero === 1
              ? "Scrivi alla Home: risponde, cerca e fa da sé i lavori che si chiudono in una seduta, in qualunque ambiente acceso. Per quelli lunghi ti propone un progetto."
              : "Una chat parallela della Home: un argomento nuovo, che lavora anche mentre la principale lavora. Chiudendola, il suo argomento va tra gli archiviati."
          }
          comando={comandoNuovoArgomento(base)}
          menu={menu}
          schede={<SchedeDelleChat aperte={chatHome} scelta={numero} allaScelta={(scelta) => scegliChat(undefined, scelta)} />}
          strumenti={
            <>
              <PulsanteNuovaChat aperte={chatHome} allApertura={(scelta) => scegliChat(undefined, scelta)} />
              {menuAffianca}
            </>
          }
          conPosizione
          alApriElaborato={apriElaborato}
          alApriProgetto={apriProgetto}
          allUscita={allUscita}
        />
    );
  } else if (vista.tipo === "argomento") {
    const argomento = quadro.argomenti?.archiviati.find((a) => a.id === vista.id);
    if (quadro.argomenti === undefined || vista.id === idArgomentoAperto) {
      contenuto = <Avviso menu={menu} titolo="Argomento" testo="Carico…" />;
    } else if (argomento === undefined) {
      contenuto = (
        <Avviso menu={menu} titolo="Argomento non trovato" testo="Questo argomento non esiste, o non esiste più.">
          <a className="pulsante" href={frammentoDi({ tipo: "home" })}>
            Torna alla Home
          </a>
        </Avviso>
      );
    } else {
      contenuto = (
        <Chat
          key={argomento.id}
          base={baseDellArgomento(argomento.id)}
          titolo={argomento.titolo}
          sottotitolo={`Argomento della Home · archiviato il ${giornoInBreve(argomento.archiviatoIl)}`}
          condizione={{ parola: "archiviato", tono: "spenta" }}
          segnaposto="Argomento archiviato"
          seVuota="Questo argomento è vuoto."
          bloccata="Questo argomento è archiviato: puoi rileggerlo. Riprendendolo torna nella Home, e quello aperto ora viene archiviato al suo posto."
          solaLettura
          comando={{
            etichetta: "Riprendi",
            descrizione: "Riprendi questo argomento nella Home",
            inBasso: "Riprendi questo argomento",
            // Il passaggio avviene nella Home, appena Claude ha intitolato l'argomento che si chiude.
            esegui: () => riapriArgomento(argomento.id).then(() => vaiA({ tipo: "home" })),
          }}
          menu={menu}
          alApriElaborato={apriElaborato}
          allUscita={allUscita}
        />
      );
    }
  } else {
    const progetto = quadro.progetti?.progetti.find((p) => p.id === vista.id);
    if (quadro.progetti === undefined) {
      contenuto = <Avviso menu={menu} titolo="Progetto" testo="Carico…" />;
    } else if (progetto === undefined) {
      contenuto = (
        <Avviso menu={menu} titolo="Progetto non trovato" testo="Questo progetto non esiste, o non esiste più.">
          <a className="pulsante" href={frammentoDi({ tipo: "home" })}>
            Torna alla Home
          </a>
        </Avviso>
      );
    } else {
      const spento = progetto.condizione === "ambiente-spento";
      const scheda = affianco?.idProgetto === progetto.id ? affianco.scheda : undefined;
      const diQuesto = modifiche?.idProgetto === progetto.id ? modifiche : undefined;
      const chiudiAffianco = (): void => {
        setAffianco(undefined);
        setRichiestaAnteprima(undefined);
      };
      const chatAperte = progetto.chat ?? [];
      const numero = chatScelta(progetto.id, chatAperte);
      const idConversazione = conversazioneDellaChat(progetto.id, numero);
      // Con le chat parallele la condizione del progetto è di tutte: ciascuna chat mostra la sua.
      const condizioneChat = numero === 1 ? (chatAperte.length === 0 || spento ? progetto.condizione : undefined) : chatAperte.find((chat) => chat.numero === numero)?.condizione;
      // Il pannello Modifiche segue la conversazione principale.
      const principale = numero === 1;
      contenuto = (
        <div className={scheda === undefined ? "affiancati" : "affiancati aperto"}>
        <Chat
          key={idConversazione}
          base={baseDelProgetto(idConversazione)}
          titolo={progetto.nome}
          sottotitolo={`${progetto.nomeAmbiente} · ${progetto.cartella}${numero === 1 ? "" : ` · chat ${numero}`}`}
          {...(condizioneChat === undefined ? {} : { condizione: { parola: condizioneInParole(condizioneChat), tono: TONI[condizioneChat] } })}
          schede={<SchedeDelleChat idProgetto={progetto.id} aperte={chatAperte} scelta={numero} allaScelta={(scelta) => scegliChat(progetto.id, scelta)} />}
          segnaposto={`Scrivi a ${progetto.nome}…`}
          seVuota="Questa conversazione è ancora vuota."
          {...(spento
            ? {
                bloccata: `L'ambiente «${progetto.nomeAmbiente}» è spento: puoi rileggere la conversazione, ma per lavorarci va riacceso.`,
              }
            : {})}
          menu={menu}
          strumenti={
            <>
              {!spento && <PulsanteNuovaChat idProgetto={progetto.id} aperte={chatAperte} allApertura={(scelta) => scegliChat(progetto.id, scelta)} />}
              {menuAffianca}
              <PulsantiPannello
                scheda={scheda}
                alClic={(scelta) => (scelta === scheda ? chiudiAffianco() : setAffianco({ idProgetto: progetto.id, scheda: scelta }))}
              />
            </>
          }
          alApriAnteprima={(porta, percorso) => {
            numeroRichiesta.current += 1;
            setAffianco({ idProgetto: progetto.id, scheda: "anteprima" });
            setRichiestaAnteprima({ idProgetto: progetto.id, porta, percorso, n: numeroRichiesta.current });
          }}
          {...(principale
            ? {
                alApriModifiche: (idTurno: string) => setAffianco({ idProgetto: progetto.id, scheda: "modifiche", turno: idTurno }),
                alleModifiche: (turni: TurnoModificato[], occupata: boolean, fileDeiComandi: FileDeiComandi | undefined) =>
                  alleModifiche(progetto.id, turni, occupata, fileDeiComandi),
              }
            : {})}
          allUscita={allUscita}
        />
        {scheda !== undefined && (
          <PannelloProgetto
            key={progetto.id}
            idProgetto={progetto.id}
            nomeAmbiente={progetto.nomeAmbiente}
            scheda={scheda}
            alCambio={(scelta) => setAffianco({ idProgetto: progetto.id, scheda: scelta })}
            allaChiusura={chiudiAffianco}
            anteprima={quadro.anteprima}
            richiesta={richiestaAnteprima?.idProgetto === progetto.id ? richiestaAnteprima : undefined}
            turni={diQuesto?.turni ?? []}
            {...(affianco?.turno === undefined ? {} : { turnoScelto: affianco.turno })}
            occupata={diQuesto?.occupata ?? false}
            {...(diQuesto?.fileDeiComandi === undefined ? {} : { fileDeiComandi: diQuesto.fileDeiComandi })}
          />
        )}
        </div>
      );
    }
  }

  // La seconda conversazione, accanto: solo per la Home e i progetti, e non mentre il pannello del progetto è aperto.
  const pannelloQui = vista.tipo === "progetto" && affianco?.idProgetto === vista.id;
  let seconda: ReactNode;
  if (affiancata !== undefined && (vista.tipo === "home" || vista.tipo === "progetto") && !stessaConversazione(affiancata, vista) && !pannelloQui) {
    const chiudi = (
      <button type="button" className="discreto icona" aria-label="Chiudi la conversazione affiancata" title="Chiudi la conversazione affiancata" onClick={() => setAffiancata(undefined)}>
        ×
      </button>
    );
    if (affiancata.tipo === "home") {
      seconda = (
        <Chat
          key={`affiancata-${BASE_HOME}`}
          base={BASE_HOME}
          titolo="Home"
          segnaposto="Scrivi alla Home…"
          seVuota="La Home è ancora vuota."
          menu={null}
          strumenti={chiudi}
          alApriElaborato={apriElaborato}
          alApriProgetto={apriProgetto}
          allUscita={allUscita}
        />
      );
    } else {
      const altro = quadro.progetti?.progetti.find((p) => p.id === affiancata.id);
      if (altro !== undefined) {
        seconda = (
          <Chat
            key={`affiancata-${altro.id}`}
            base={baseDelProgetto(altro.id)}
            titolo={altro.nome}
            sottotitolo={`${altro.nomeAmbiente} · ${altro.cartella}`}
            condizione={{ parola: condizioneInParole(altro.condizione), tono: TONI[altro.condizione] }}
            segnaposto={`Scrivi a ${altro.nome}…`}
            seVuota="Questa conversazione è ancora vuota."
            {...(altro.condizione === "ambiente-spento" ? { bloccata: `L'ambiente «${altro.nomeAmbiente}» è spento.` } : {})}
            menu={null}
            strumenti={chiudi}
            allUscita={allUscita}
          />
        );
      }
    }
  }
  if (seconda !== undefined) {
    contenuto = (
      <div className="due-chat">
        {contenuto}
        <div className="chat-affiancata">{seconda}</div>
      </div>
    );
  }

  return (
    <FornitoreQuadro value={quadro}>
      <TemiDelleEstensioni quadro={quadro} />
      <div className="guscio">
        <Laterale
          vista={vista}
          quadro={quadro}
          skillNuove={skillNuove.size}
          aperta={lateraleAperta}
          allaScelta={() => setLateraleAperta(false)}
          pannelloAmbientiAperto={pannelloAperto}
          alVaiA={() => {
            setLateraleAperta(false);
            setPaletteAperta(true);
          }}
          alClicAmbienti={() => {
            setLateraleAperta(false);
            setPannelloAperto((aperto) => !aperto);
          }}
          allUscita={() => void esciDaShinka()}
        />
        {lateraleAperta && <div className="velo" onClick={() => setLateraleAperta(false)} />}
        <main className="principale">
          {paletteAperta && <Palette voci={vociPalette} allaChiusura={() => setPaletteAperta(false)} />}
          {/* Una pagina che si rompe non porta via tutto: cambiando pagina si riprova. */}
          <ReteDiSicurezza key={frammento}>{contenuto}</ReteDiSicurezza>
          {pannelloAperto && <PannelloAmbienti stato={quadro.ambienti} allaChiusura={chiudiPannello} />}
        </main>
      </div>
    </FornitoreQuadro>
  );
}

/** Ciò che si vede al posto di una conversazione quando non c'è nulla da mostrare. */
function Avviso({
  menu,
  titolo,
  testo,
  children,
}: {
  menu: ReactNode;
  titolo: string;
  testo: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="app">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>{titolo}</h1>
        </div>
      </header>
      <div className="avviso-interno">
        <p>{testo}</p>
        {children}
      </div>
    </div>
  );
}
