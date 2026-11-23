import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { FINE_STORIA, type EventoArchiviato, type EventoConversazione } from "../../src/protocollo/eventi.ts";
import { difettoDegliAllegati, preparaAllegati } from "./allegati.ts";
import { chiediAParte, interrompi, inviaMessaggio, inviaPosizione, leggiStato, type RiferimentoElaborato } from "./api.ts";
import { RiquadroAParte, type DomandaAParte } from "./AParte.tsx";
import { SchedaSessione } from "./Sessione.tsx";

/** Da quanto contesto occupato compare l'avviso, e poi di nuovo ogni dieci punti. */
const SOGLIA_AVVISO_CONTESTO = 75;
import { conICommenti, svuotaCommenti, togliCommento, useCommenti } from "./commenti.ts";
import type { TurnoModificato } from "./PannelloModifiche.tsx";
import type { FileDeiComandi } from "../../src/protocollo/modifiche.ts";
import { chiediPosizione } from "./posizione.ts";
import { modoDelPulsante, PulsanteDiInvio } from "./PulsanteDiInvio.tsx";
import { Attesa } from "./Attesa.tsx";
import { FornitoreChat } from "./ContestoChat.ts";
import { Controlli } from "./Controlli.tsx";
import { Formattato, VistaVoce } from "./Elementi.tsx";
import { raggruppa } from "./gruppi.ts";
import { aCapo } from "./scrittura.ts";
import { leggiBozza, leggiInCoda, quandoRiparte, scriviBozza, scriviInCoda, type MessaggioInCoda } from "./bozze.ts";
import { COMANDO_A_PARTE, comandiPer, domandaAParte, testoDelComando } from "./comandi.ts";
import { NOMI_MOTORI, type ComandoDisponibile } from "../../src/protocollo/impostazioni.ts";
import { alLavoro, applica, aspettaIlProprietario, statoIniziale, type StatoChat } from "./stato.ts";
import { useAspetto } from "./aspetto.ts";
import { MenuEsporta } from "./Esporta.tsx";

type Mossa = { tipo: "storia"; eventi: EventoConversazione[] } | { tipo: "evento"; evento: EventoConversazione };

function riduci(stato: StatoChat, mossa: Mossa): StatoChat {
  return mossa.tipo === "storia" ? mossa.eventi.reduce(applica, statoIniziale) : applica(stato, mossa.evento);
}

/** Entro questa distanza dal fondo la conversazione segue da sola i messaggi nuovi. */
const SOGLIA_FONDO_PX = 120;

/**
 * Quante voci si disegnano aprendo una conversazione, e quante se ne aggiungono a ogni "Mostra i
 * precedenti": una conversazione lunga, disegnata tutta, faceva aspettare a ogni cambio di scheda.
 */
export const PASSO_VOCI = 60;

/** Vero su un telefono o un tablet: lì Invio va a capo, e si manda con il pulsante. */
function sulTelefono(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

export interface ProprietaChat {
  /** Indirizzo di base della conversazione: quella della Home o quella di un progetto. */
  base: string;
  titolo: string;
  sottotitolo?: string;
  /** Come sta la conversazione secondo il centro; se manca lo si ricava da ciò che accade qui. */
  condizione?: { parola: string; tono: "bene" | "attesa" | "spenta" };
  /** Testo del campo di scrittura quando è vuoto. */
  segnaposto: string;
  /** Che cosa dire quando la conversazione non contiene ancora nulla. */
  seVuota: string;
  /** Se presente non si può scrivere, e questo dice perché. */
  bloccata?: string;
  /** Vero se la conversazione si può solo rileggere: niente scelte da fare né impostazioni da cambiare. */
  solaLettura?: boolean;
  /** Ciò che si può fare della conversazione intera, per esempio cominciare un argomento nuovo. */
  comando?: ComandoChat;
  /** Il pulsante che apre l'elenco dei progetti sugli schermi stretti. */
  menu: ReactNode;
  /** Altri pulsanti in testata: in un progetto, quelli del terminale e dell'anteprima. */
  strumenti?: ReactNode;
  /** Il proprietario apre l'anteprima che Claude ha proposto. */
  alApriAnteprima?: (porta: number, percorso: string) => void;
  /** Vero se accanto al campo c'è il pulsante per mandare la posizione: nella Home. */
  conPosizione?: boolean;
  /** Il proprietario apre nel pannello un elaborato che la Home ha mostrato. */
  alApriElaborato?: (riferimento: RiferimentoElaborato) => void;
  /** Il proprietario apre il pannello Modifiche su un turno. */
  alApriModifiche?: (idTurno: string) => void;
  /** Riceve i turni in cui Claude ha cambiato dei file, a ogni cambiamento, e se Claude sta lavorando. */
  alleModifiche?: (turni: TurnoModificato[], occupata: boolean, fileDeiComandi: FileDeiComandi | undefined) => void;
  /** La conversazione chiede di spostarsi su un progetto. */
  alApriProgetto?: (idProgetto: string) => void;
  /** La sessione del proprietario non vale più. */
  allUscita: () => void;
}

/** Un pulsante in testata. Mentre Claude lavora non si può usare. */
export interface ComandoChat {
  etichetta: string;
  /** Che cosa fa, per chi ci passa sopra con il puntatore. */
  descrizione: string;
  esegui(): Promise<void>;
  /**
   * Se presente, il comando compare anche in basso, grande, accanto alla frase che dice perché non
   * si scrive: è ciò che si fa di questa conversazione, come riprendere un argomento archiviato.
   */
  inBasso?: string;
}

/** Una conversazione con Claude: la storia, ciò che arriva in tempo reale e il campo per scrivere. */
export function Chat(proprieta: ProprietaChat): ReactNode {
  const { base, titolo, sottotitolo, condizione, segnaposto, seVuota, bloccata, menu, comando } = proprieta;
  const solaLettura = proprieta.solaLettura === true;
  const alApriAnteprima = useRef(proprieta.alApriAnteprima);
  const apriAnteprima = useCallback((porta: number, percorso: string) => alApriAnteprima.current?.(porta, percorso), []);
  const conAnteprima = proprieta.alApriAnteprima !== undefined && !solaLettura;
  const alApriElaborato = useRef(proprieta.alApriElaborato);
  const apriElaborato = useCallback((riferimento: RiferimentoElaborato) => alApriElaborato.current?.(riferimento), []);
  // Un elaborato si riapre anche da un argomento archiviato: guardarlo non cambia nulla.
  const conElaborati = proprieta.alApriElaborato !== undefined;
  const alApriModifiche = useRef(proprieta.alApriModifiche);
  const apriModifiche = useCallback((idTurno: string) => alApriModifiche.current?.(idTurno), []);
  const conModifiche = proprieta.alApriModifiche !== undefined;
  const [stato, muovi] = useReducer(riduci, statoIniziale);
  const occupataOra = alLavoro(stato);
  // Rigenera riparte dall'ultimo messaggio del proprietario, se è uno di quelli che si possono riprendere.
  const ultimoModificabile = useMemo(() => {
    const ultimo = stato.elementi.findLast((elemento) => elemento.tipo === "proprietario");
    return ultimo?.tipo === "proprietario" && ultimo.modificabile === true ? { id: ultimo.chiave, testo: ultimo.testo } : undefined;
  }, [stato.elementi]);
  const ultimaRisposta = useMemo(() => stato.elementi.findLast((elemento) => elemento.tipo === "testo")?.chiave, [stato.elementi]);
  const contesto = useMemo(
    () => ({
      base,
      solaLettura,
      occupata: occupataOra,
      ...(ultimoModificabile === undefined ? {} : { ultimoModificabile }),
      ...(ultimaRisposta === undefined ? {} : { ultimaRisposta }),
      ...(conAnteprima ? { apriAnteprima } : {}),
      ...(conElaborati ? { apriElaborato } : {}),
      ...(conModifiche ? { apriModifiche } : {}),
    }),
    [base, solaLettura, occupataOra, ultimoModificabile, ultimaRisposta, conAnteprima, apriAnteprima, conElaborati, apriElaborato, conModifiche, apriModifiche],
  );
  // I turni in cui Claude ha cambiato dei file: il pannello Modifiche li mostra accanto alla chat.
  const turniModificati = useMemo(
    () =>
      stato.elementi.flatMap((elemento) =>
        elemento.tipo === "modifiche"
          ? [{ idTurno: elemento.chiave, file: elemento.file, decisi: elemento.decisi, ...(elemento.altri === undefined ? {} : { altri: elemento.altri }) }]
          : [],
      ),
    [stato.elementi],
  );
  const alleModifiche = useRef(proprieta.alleModifiche);
  // Se nel pannello entrano anche i file cambiati dai comandi: lo dice la conversazione, quando lo sa.
  const fileDeiComandi = stato.stato?.fileDeiComandi;
  useEffect(() => {
    alleModifiche.current?.(turniModificati, occupataOra, fileDeiComandi);
  }, [turniModificati, occupataOra, fileDeiComandi]);
  // I file cambiati che sono ancora come li ha lasciati il modello: quelli riportati com'erano non contano.
  const fileCambiati = new Set(turniModificati.flatMap((turno) => turno.file.filter((file) => turno.decisi[file.percorso] !== "annullate").map((file) => file.percorso))).size;
  // Al 75% del contesto un avviso: si può compattare adesso, prima che lo faccia l'harness da solo.
  const percentoContesto = stato.stato?.contesto?.percento ?? 0;
  const nomeMotore = NOMI_MOTORI[stato.stato?.motore ?? "claude"];
  const [avvisoChiusoA, setAvvisoChiusoA] = useState<number>();
  const conAvvisoContesto = !solaLettura && percentoContesto >= SOGLIA_AVVISO_CONTESTO && (avvisoChiusoA === undefined || percentoContesto >= avvisoChiusoA + 10);
  // I commenti sulle righe dei file aspettano qui e partono con il prossimo messaggio.
  const commenti = useCommenti(base);
  const [comandoInCorso, setComandoInCorso] = useState(false);
  const [collegata, setCollegata] = useState(false);
  // La bozza resta nel browser: dopo un ricaricamento è ancora lì.
  const [bozza, setBozza] = useState(() => leggiBozza(proprieta.base));
  const [inCoda, setInCoda] = useState<MessaggioInCoda | undefined>(() => leggiInCoda(proprieta.base));
  /** I file scelti e non ancora inviati. */
  const [scelti, setScelti] = useState<File[]>([]);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();
  const campoFile = useRef<HTMLInputElement>(null);
  const { vista } = useAspetto();
  // Il ragionamento si vede solo nelle viste che lo chiedono: altrimenti non spezza nemmeno i gruppi di azioni.
  const voci = useMemo(
    () => raggruppa(vista === "normale" ? stato.elementi.filter((elemento) => elemento.tipo !== "ragionamento") : stato.elementi),
    [stato.elementi, vista],
  );
  const aspettaTe = useMemo(() => aspettaIlProprietario(stato.elementi), [stato.elementi]);
  /** Quando è arrivato l'ultimo segno di vita della conversazione: l'attesa dice se Claude tace da un po'. */
  const ultimaNovita = useRef(Date.now());
  /** Falso quando il proprietario è salito a leggere: compare il pulsante per tornare all'ultimo messaggio. */
  const [inFondo, setInFondo] = useState(true);
  // Il menu "/": i comandi che l'harness conosce, filtrati da ciò che è scritto. Esc lo chiude per quel testo.
  const [comandoScelto, setComandoScelto] = useState(0);
  const [menuChiuso, setMenuChiuso] = useState<string>();
  const [mostrate, setMostrate] = useState(PASSO_VOCI);
  const visibili = voci.length > mostrate ? voci.slice(-mostrate) : voci;
  const nascoste = voci.length - visibili.length;
  /** Distanza dal fondo da mantenere quando si aggiungono in cima le voci precedenti. */
  const ancoraggio = useRef<number | undefined>(undefined);
  const campoTesto = useRef<HTMLTextAreaElement>(null);
  /** Dove rimettere il cursore dopo un a capo fatto da qui. */
  const cursoreDaMettere = useRef<number | undefined>(undefined);
  const lista = useRef<HTMLDivElement>(null);
  const segueIlFondo = useRef(true);
  const occupata = alLavoro(stato);
  const comandiProposti = useMemo(
    () => (menuChiuso === bozza ? [] : comandiPer(bozza, [...(solaLettura ? [] : [COMANDO_A_PARTE]), ...(stato.stato?.comandi ?? [])])),
    [bozza, menuChiuso, stato.stato?.comandi, solaLettura],
  );
  /** L'ultima domanda a parte, con la sua risposta quando arriva. */
  const [aParte, setAParte] = useState<DomandaAParte>();
  const domandeAParte = useRef(0);

  // Il flusso si riapre solo quando cambia la conversazione, non a ogni nuovo disegno di chi ci usa.
  const alApriProgetto = useRef(proprieta.alApriProgetto);
  const allUscita = useRef(proprieta.allUscita);
  useEffect(() => {
    alApriProgetto.current = proprieta.alApriProgetto;
    allUscita.current = proprieta.allUscita;
    alApriAnteprima.current = proprieta.alApriAnteprima;
    alApriElaborato.current = proprieta.alApriElaborato;
    alApriModifiche.current = proprieta.alApriModifiche;
    alleModifiche.current = proprieta.alleModifiche;
  });

  useEffect(() => {
    // Una conversazione appena aperta si guarda dal fondo.
    segueIlFondo.current = true;
    const sorgente = new EventSource(`${base}/eventi`);
    // A ogni collegamento il centro rimanda tutta la storia, evento per evento, e la chiude con
    // FINE_STORIA. Si tiene da parte e si mostra tutta insieme: disegnata un evento alla volta, su
    // una rete lenta la chat scorreva tutta davanti al proprietario a ogni cambio di scheda.
    let storia: EventoConversazione[] | undefined;
    sorgente.onopen = () => {
      storia = [];
    };
    sorgente.onmessage = (messaggio: MessageEvent<string>) => {
      const { evento } = JSON.parse(messaggio.data) as EventoArchiviato;
      ultimaNovita.current = Date.now();
      if (evento.tipo === "apri-progetto") {
        alApriProgetto.current?.(evento.idProgetto);
        return;
      }
      if (storia !== undefined) storia.push(evento);
      else muovi({ tipo: "evento", evento });
    };
    // Per stampare o salvare in PDF si mostra tutta la conversazione, non solo le ultime voci.
    const perStampare = (): void => flushSync(() => setMostrate(Number.MAX_SAFE_INTEGER));
    window.addEventListener("beforeprint", perStampare);
    sorgente.addEventListener(FINE_STORIA, () => {
      // Una storia nuova si guarda dal fondo, con le sole voci più recenti.
      setMostrate(PASSO_VOCI);
      muovi({ tipo: "storia", eventi: storia ?? [] });
      storia = undefined;
      setCollegata(true);
    });
    // La Home è passata a un altro argomento: subito dopo arriva la storia di quello nuovo.
    sorgente.addEventListener("azzera", () => {
      storia = [];
      segueIlFondo.current = true;
    });
    sorgente.onerror = () => {
      setCollegata(false);
      // Se la sessione è scaduta si torna alla pagina di accesso; altrimenti il browser riprova da solo.
      leggiStato()
        .then((accesso) => {
          if (!accesso.autenticato) allUscita.current();
        })
        .catch(() => {});
    };
    return () => {
      sorgente.close();
      window.removeEventListener("beforeprint", perStampare);
    };
  }, [base]);

  useEffect(() => {
    document.title = `${titolo} · Shinka`;
  }, [titolo]);

  useEffect(() => scriviBozza(base, bozza), [base, bozza]);

  // Il messaggio in coda parte da solo quando il limite si azzera, se la pagina è aperta; altrimenti alla prossima apertura.
  useEffect(() => {
    if (inCoda === undefined || !collegata) return;
    const manca = Math.max(0, Date.parse(inCoda.partiAlle) - Date.now()) + 5_000;
    const sveglia = setTimeout(() => {
      inviaMessaggio(base, inCoda.testo, [])
        .then(() => {
          scriviInCoda(base, undefined);
          setInCoda(undefined);
        })
        .catch((causa: unknown) => setErrore(causa instanceof Error ? `Il messaggio in coda non è partito: ${causa.message}` : "Il messaggio in coda non è partito."));
    }, Math.min(manca, 2_000_000_000));
    return () => clearTimeout(sveglia);
  }, [base, inCoda, collegata]);

  useLayoutEffect(() => {
    const contenitore = lista.current;
    if (contenitore !== null && segueIlFondo.current) contenitore.scrollTop = contenitore.scrollHeight;
  }, [stato.elementi]);

  // Aggiunte in cima le voci precedenti, la conversazione resta dov'era.
  useLayoutEffect(() => {
    const contenitore = lista.current;
    if (contenitore === null || ancoraggio.current === undefined) return;
    contenitore.scrollTop = contenitore.scrollHeight - ancoraggio.current;
    ancoraggio.current = undefined;
  }, [mostrate]);

  function mostraPrecedenti(): void {
    const contenitore = lista.current;
    if (contenitore !== null) ancoraggio.current = contenitore.scrollHeight - contenitore.scrollTop;
    setMostrate((prima) => prima + PASSO_VOCI);
  }

  // Il campo cresce con il testo, fino a un terzo dello schermo; dopo un a capo fatto da qui il cursore torna al suo posto.
  useLayoutEffect(() => {
    const campo = campoTesto.current;
    if (campo === null) return;
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight + 2}px`;
    if (cursoreDaMettere.current !== undefined) {
      campo.setSelectionRange(cursoreDaMettere.current, cursoreDaMettere.current);
      cursoreDaMettere.current = undefined;
    }
  }, [bozza]);

  function alloScorrimento(): void {
    const contenitore = lista.current;
    if (contenitore === null) return;
    const distanza = contenitore.scrollHeight - contenitore.scrollTop - contenitore.clientHeight;
    segueIlFondo.current = distanza < SOGLIA_FONDO_PX;
    setInFondo(distanza < SOGLIA_FONDO_PX);
  }

  /** Torna all'ultimo messaggio; se qualcosa aspetta il proprietario, va lì. */
  function vaiInFondo(): void {
    const contenitore = lista.current;
    if (contenitore === null) return;
    segueIlFondo.current = true;
    setInFondo(true);
    contenitore.scrollTo({ top: contenitore.scrollHeight, behavior: "smooth" });
  }

  function aggiungiFile(nuovi: File[]): void {
    if (nuovi.length === 0) return;
    setErrore(undefined);
    setScelti((prima) => [...prima, ...nuovi]);
  }

  /** Vero mentre il proprietario trascina dei file sopra la chat: compare dove lasciarli. */
  const [trascina, setTrascina] = useState(false);
  /** Gli ingressi e le uscite del trascinamento si contano: i figli ne mandano di loro. */
  const sopra = useRef(0);
  const siAllega = bloccata === undefined && !solaLettura;
  const conFile = (evento: DragEvent<HTMLDivElement>): boolean => [...evento.dataTransfer.types].includes("Files");
  const trascinamento = {
    onDragEnter: (evento: DragEvent<HTMLDivElement>) => {
      if (!siAllega || !conFile(evento)) return;
      evento.preventDefault();
      sopra.current += 1;
      setTrascina(true);
    },
    onDragOver: (evento: DragEvent<HTMLDivElement>) => {
      if (!siAllega || !conFile(evento)) return;
      evento.preventDefault();
      evento.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (evento: DragEvent<HTMLDivElement>) => {
      if (!siAllega || !conFile(evento)) return;
      sopra.current = Math.max(0, sopra.current - 1);
      if (sopra.current === 0) setTrascina(false);
    },
    onDrop: (evento: DragEvent<HTMLDivElement>) => {
      if (!siAllega || !conFile(evento)) return;
      evento.preventDefault();
      sopra.current = 0;
      setTrascina(false);
      aggiungiFile([...evento.dataTransfer.files]);
      campoTesto.current?.focus();
    },
  };

  /** Un'immagine copiata, per esempio uno screenshot, si allega incollandola nel campo. */
  function allIncolla(evento: ClipboardEvent<HTMLTextAreaElement>): void {
    const incollati = [...evento.clipboardData.files];
    if (incollati.length === 0) return;
    evento.preventDefault();
    aggiungiFile(incollati);
  }

  async function invia(evento?: FormEvent): Promise<void> {
    evento?.preventDefault();
    const testo = bozza.trim();
    if ((testo === "" && scelti.length === 0 && commenti.length === 0) || bloccata !== undefined || invio) return;
    // "/btw ..." è una domanda a parte: non entra nella conversazione, e si può fare anche mentre Claude lavora.
    const domanda = scelti.length === 0 && !solaLettura ? domandaAParte(testo) : undefined;
    if (domanda !== undefined) {
      const numero = ++domandeAParte.current;
      setAParte({ domanda });
      setBozza("");
      const risposta = await chiediAParte(base, domanda).catch((causa: unknown) => ({
        motivo: causa instanceof Error ? causa.message : "La domanda a parte non è partita.",
      }));
      // Se intanto ne è partita un'altra, questa risposta non serve più.
      if (numero === domandeAParte.current) setAParte({ domanda, risposta });
      return;
    }
    // Al limite del piano il messaggio aspetta che il limite si azzeri, e intanto si può cambiare.
    const riparte = quandoRiparte(stato.stato?.limiti);
    if (riparte !== undefined && scelti.length === 0) {
      const messaggio = { testo, partiAlle: riparte };
      scriviInCoda(base, messaggio);
      setInCoda(messaggio);
      setBozza("");
      return;
    }
    const daAllegare = scelti;
    setErrore(undefined);
    setInvio(true);
    try {
      const allegati = await preparaAllegati(daAllegare);
      const peso = allegati.reduce((somma, allegato) => somma + allegato.dati.length, 0);
      const difetto = difettoDegliAllegati(allegati.length, peso);
      if (difetto !== undefined) throw new Error(difetto);
      // Il messaggio può tornare dal centro prima che la richiesta finisca: la chat lo segue già.
      segueIlFondo.current = true;
      await inviaMessaggio(base, conICommenti(testo, commenti), allegati);
      if (commenti.length > 0) svuotaCommenti(base);
      setBozza("");
      setScelti([]);
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Messaggio non inviato.");
    } finally {
      setInvio(false);
    }
  }

  /** Il proprietario manda la sua posizione: il browser gliela chiede, poi arriva alla Home. */
  async function mandaPosizione(): Promise<void> {
    if (bloccata !== undefined || invio) return;
    setErrore(undefined);
    setInvio(true);
    try {
      const posizione = await chiediPosizione(window);
      await inviaPosizione(base, posizione);
      segueIlFondo.current = true;
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "La posizione non è stata mandata.");
    } finally {
      setInvio(false);
    }
  }

  async function eseguiComando(): Promise<void> {
    if (comando === undefined || comandoInCorso) return;
    setErrore(undefined);
    setComandoInCorso(true);
    try {
      await comando.esegui();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è stato possibile.");
    } finally {
      setComandoInCorso(false);
    }
  }

  /**
   * Al computer Invio manda e Maiuscole+Invio va a capo; sul telefono Invio va a capo, e si manda
   * con il pulsante. Andando a capo in un elenco, la riga nuova comincia con il suo segno.
   */
  function scegliComando(comando: ComandoDisponibile): void {
    setBozza(testoDelComando(comando));
    setComandoScelto(0);
    campoTesto.current?.focus();
  }

  function alTasto(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    // Con il menu "/" aperto: frecce per scegliere, Invio o Tab per prendere, Esc per chiudere.
    if (comandiProposti.length > 0 && !evento.nativeEvent.isComposing) {
      if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        evento.preventDefault();
        const passo = evento.key === "ArrowDown" ? 1 : -1;
        setComandoScelto((prima) => (prima + passo + comandiProposti.length) % comandiProposti.length);
        return;
      }
      if (evento.key === "Tab" || (evento.key === "Enter" && !evento.shiftKey)) {
        const scelto = comandiProposti[comandoScelto] ?? comandiProposti[0];
        // Se il comando è già scritto per intero, Invio lo manda.
        if (scelto !== undefined && !(evento.key === "Enter" && testoDelComando(scelto).trim() === bozza.trim())) {
          evento.preventDefault();
          scegliComando(scelto);
          return;
        }
      }
      if (evento.key === "Escape") {
        evento.preventDefault();
        setMenuChiuso(bozza);
        return;
      }
    }
    if (evento.key !== "Enter" || evento.nativeEvent.isComposing || evento.altKey || evento.ctrlKey || evento.metaKey) return;
    evento.preventDefault();
    if (!evento.shiftKey && !sulTelefono()) {
      void invia();
      return;
    }
    const campo = evento.currentTarget;
    const { testo, cursore } = aCapo(bozza, campo.selectionStart, campo.selectionEnd);
    cursoreDaMettere.current = cursore;
    setBozza(testo);
  }

  const spia = !collegata
    ? { parola: "scollegata", tono: "male" }
    : (condizione ?? { parola: occupata ? "al lavoro" : "pronta", tono: "bene" });

  return (
    <FornitoreChat value={contesto}>
      <div className={stato.statoProgetto === undefined ? "app" : "app con-stato"} {...trascinamento}>
        {trascina && (
          <div className="lascia-qui" aria-hidden="true">
            <span>Lascia qui i file per allegarli al messaggio</span>
          </div>
        )}
        <header className="testata">
          {menu}
          <div className="titoli">
            <h1>{titolo}</h1>
            {sottotitolo !== undefined && <span className="sottotitolo">{sottotitolo}</span>}
          </div>
          <span className={`spia ${spia.tono}`} title={spia.parola}>
            {spia.parola}
          </span>
          {(stato.stato?.inSfondo ?? 0) > 0 && (
            <span
              className="in-sfondo"
              title="Comandi lanciati da Claude che lavorano in background: quando finiscono, Claude lo viene a sapere e riprende da solo."
            >
              {stato.stato?.inSfondo === 1 ? "1 in background" : `${stato.stato?.inSfondo} in background`}
            </span>
          )}
          {proprieta.strumenti}
          {!solaLettura && (
            <SchedaSessione
              base={base}
              {...(sottotitolo === undefined ? {} : { luogo: sottotitolo })}
              impostazioni={stato.impostazioni}
              stato={stato.stato}
              attivita={stato.attivita ?? []}
              {...(conModifiche ? { fileCambiati, alPannello: () => apriModifiche(turniModificati.at(-1)?.idTurno ?? "") } : {})}
            />
          )}
          <MenuEsporta base={base} />
          {comando !== undefined && (
            <button
              type="button"
              className="comando"
              title={comando.descrizione}
              disabled={occupata || comandoInCorso || !collegata}
              onClick={() => void eseguiComando()}
            >
              {comando.etichetta}
            </button>
          )}
        </header>

        {stato.statoProgetto !== undefined && (
          <details className="stato-progetto">
            <summary>
              <span className="colonna">Stato del progetto</span>
            </summary>
            <div className="contenuto">
              <div className="colonna riga claude">
                <Formattato testo={stato.statoProgetto} />
              </div>
            </div>
          </details>
        )}

        <div className="conversazione" ref={lista} onScroll={alloScorrimento}>
          <div className="colonna">
            {stato.elementi.length === 0 && collegata && <p className="vuota">{seVuota}</p>}
            {nascoste > 0 && (
              <button type="button" className="precedenti" onClick={mostraPrecedenti}>
                Mostra i precedenti ({nascoste})
              </button>
            )}
            {visibili.map((voce) => (
              <VistaVoce key={voce.chiave} voce={voce} />
            ))}
            {occupata && <Attesa aspettaTe={aspettaTe} ultimaNovita={() => ultimaNovita.current} />}
            {!occupata && aspettaTe && <div className="riga aspetta-te-riga">Aspetta una tua risposta</div>}
          </div>
        </div>


        <form className="scrittura" onSubmit={(evento) => void invia(evento)}>
          {/* Chi è salito a leggere torna all'ultimo messaggio con un tocco; la chat non lo tira giù da sola. */}
          {!inFondo && (
            <button type="button" className={aspettaTe ? "torna-giu aspetta" : "torna-giu"} onClick={vaiInFondo}>
              {aspettaTe ? "Aspetta una tua risposta ↓" : "Ultimo messaggio ↓"}
            </button>
          )}
          <div className="colonna">
            {bloccata !== undefined && <p className="bloccata">{bloccata}</p>}
            {bloccata !== undefined && comando?.inBasso !== undefined && (
              <button
                type="button"
                className="comando-in-basso"
                title={comando.descrizione}
                disabled={occupata || comandoInCorso || !collegata}
                onClick={() => void eseguiComando()}
              >
                {comandoInCorso ? "Un momento…" : comando.inBasso}
              </button>
            )}
            {errore !== undefined && (
              <p className="errore" role="alert">
                {errore}
              </p>
            )}
            {conAvvisoContesto && (
              <div className="avviso-contesto" role="status">
                <span>
                  Il contesto è pieno al {percentoContesto}%. Quando si riempie, {nomeMotore} lo compatta da solo riassumendo la conversazione; puoi farlo
                  adesso, a un punto che scegli tu.
                </span>
                <div className="pulsanti">
                  <button
                    type="button"
                    className="mini"
                    disabled={occupata || bloccata !== undefined}
                    title={occupata ? `Aspetta che ${nomeMotore} finisca` : undefined}
                    onClick={() => {
                      setAvvisoChiusoA(percentoContesto);
                      void inviaMessaggio(base, "/compact").catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "Non è partito."));
                    }}
                  >
                    Compatta adesso
                  </button>
                  <button type="button" className="mini discreto" onClick={() => setAvvisoChiusoA(percentoContesto)}>
                    Non ora
                  </button>
                </div>
              </div>
            )}
            {aParte !== undefined && (
              <RiquadroAParte
                aParte={aParte}
                allaChiusura={() => {
                  domandeAParte.current += 1;
                  setAParte(undefined);
                }}
              />
            )}
            {commenti.length > 0 && (
              <div className="commenti-in-attesa" aria-label="Commenti sui file">
                <span className="tenue">Partono con il prossimo messaggio:</span>
                <ul>
                  {commenti.map((voce, posizione) => (
                    <li key={`${voce.percorso}:${voce.riga}:${posizione}`}>
                      <code>
                        {voce.percorso.split("/").pop()}
                        {voce.riga > 0 ? `:${voce.riga}` : ""}
                      </code>{" "}
                      <span className="testo-commento">{voce.commento}</span>
                      <button type="button" className="discreto" aria-label={`Togli il commento a ${voce.percorso}:${voce.riga}`} onClick={() => togliCommento(base, posizione)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inCoda !== undefined && (
              <div className="messaggio-in-coda">
                <div>
                  <strong>Al limite del piano:</strong> partirà alle{" "}
                  {new Date(inCoda.partiAlle).toLocaleString("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" })}, se Shinka è aperta.
                </div>
                <div className="testo-in-coda">{inCoda.testo}</div>
                <div className="pulsanti">
                  <button
                    type="button"
                    className="mini"
                    onClick={() => {
                      setBozza(inCoda.testo);
                      scriviInCoda(base, undefined);
                      setInCoda(undefined);
                    }}
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="mini discreto"
                    onClick={() => {
                      scriviInCoda(base, undefined);
                      setInCoda(undefined);
                    }}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
            {scelti.length > 0 && (
              <ul className="da-allegare">
                {scelti.map((file, posizione) => (
                  <li key={`${file.name}-${posizione}`}>
                    <span className="nome">{file.name}</span>
                    <button
                      type="button"
                      className="discreto"
                      aria-label={`Togli ${file.name}`}
                      disabled={invio}
                      onClick={() => setScelti((prima) => prima.filter((_, i) => i !== posizione))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="campo">
              <input
                ref={campoFile}
                type="file"
                multiple
                hidden
                onChange={(evento) => {
                  aggiungiFile([...(evento.target.files ?? [])]);
                  // Svuotato, lo stesso file si può scegliere di nuovo.
                  evento.target.value = "";
                }}
              />
              <button
                type="button"
                className="allega"
                aria-label="Allega file o immagini"
                title="Allega file o immagini"
                disabled={bloccata !== undefined || invio}
                onClick={() => campoFile.current?.click()}
              >
                +
              </button>
              {proprieta.conPosizione === true && (
                <button
                  type="button"
                  className="allega posizione"
                  aria-label="Usa la mia posizione"
                  title="Usa la mia posizione: la mando alla Home, dopo che il browser te lo chiede"
                  disabled={bloccata !== undefined || invio}
                  onClick={() => void mandaPosizione()}
                >
                  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                    <path
                      d="M10 18s-5.5-5.2-5.5-9.5a5.5 5.5 0 0 1 11 0C15.5 12.8 10 18 10 18z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="8.5" r="2" fill="currentColor" />
                  </svg>
                </button>
              )}
              {comandiProposti.length > 0 && (
                <ul className="menu-comandi" role="listbox" aria-label="Comandi">
                  {comandiProposti.map((comando, posizione) => (
                    <li
                      key={comando.nome}
                      role="option"
                      aria-selected={posizione === comandoScelto}
                      className={posizione === comandoScelto ? "scelto" : undefined}
                      onMouseDown={(evento) => {
                        evento.preventDefault();
                        scegliComando(comando);
                      }}
                    >
                      <span className="nome-comando">/{comando.nome}</span>
                      {comando.argomenti !== undefined && <span className="argomenti-comando">{comando.argomenti}</span>}
                      <span className="descrizione-comando">{comando.descrizione}</span>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                ref={campoTesto}
                aria-label={segnaposto}
                placeholder={segnaposto}
                rows={1}
                value={bozza}
                disabled={bloccata !== undefined}
                onChange={(evento) => setBozza(evento.target.value)}
                onKeyDown={alTasto}
                onPaste={allIncolla}
              />
              <PulsanteDiInvio
                modo={modoDelPulsante({ occupata, invio, daMandare: bozza.trim() !== "" || scelti.length > 0 || commenti.length > 0, bloccata: bloccata !== undefined })}
                alInterrompi={() => void interrompi(base).catch(() => {})}
              />
            </div>
            {!solaLettura && <Controlli impostazioni={stato.impostazioni} stato={stato.stato} />}
          </div>
        </form>
      </div>
    </FornitoreChat>
  );
}
