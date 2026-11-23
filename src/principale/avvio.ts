/**
 * L'avvio dell'app: una finestra sola (ADR 0009), la pagina servita da `shinka://app/`, il
 * collegamento con il centro tenuto qui nel processo principale (ADR 0002), i terminali locali.
 */

import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, net, protocol, safeStorage, session, shell, Tray, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { hostname } from "node:os";
import { join } from "node:path";
import type { StatoProgetti } from "../../shinka/src/protocollo/progetti.ts";
import { SCORCIATOIE, type Comando, type Gruppo } from "../ponte/scorciatoie.ts";
import { CANALI, type EsitoAccesso, type MessaggioDelFlusso, type StatoApp, type TerminaleAperto } from "../ponte/tipi.ts";
import { ErroreCentro, NonRaggiungibile, aggiungiDispositivo, indirizzoDelCentro, type Chiedi } from "./centro.ts";
import { Collegamento, buttaLaCache } from "./collegamento.ts";
import { Custodia } from "./dispositivo.ts";
import { cartellaSuQuestoPc, centroDelNodoDiQui, idDelNodoDiQui } from "./luogo.ts";
import { ORIGINE, SCHEMA, rispondiAllePagine } from "./pagine.ts";
import { siPuoRaggiungere } from "./rete.ts";
import { Terminali } from "./terminali.ts";

declare const __CENTRO_PREDEFINITO__: string;
declare const __VERSIONE__: string;

const qui = import.meta.dirname;
const CARTELLA_PAGINA = join(qui, "..", "pagina");
const FILE_PONTE = join(qui, "..", "ponte", "ponte.cjs");
const PROGRAMMA = `ShinkaDesktop/${__VERSIONE__}`;
const NOME = "Shinka Desktop";
/** Con questo argomento l'app parte senza mostrare la finestra: è così che la avvia Windows all'accesso. */
const IN_SILENZIO = "--in-silenzio";

// Per le prove: un profilo a parte, per non toccare quello vero.
if (process.env.SHINKA_DESKTOP_DATI !== undefined && process.env.SHINKA_DESKTOP_DATI !== "") app.setPath("userData", process.env.SHINKA_DESKTOP_DATI);
app.setName(NOME);

protocol.registerSchemesAsPrivileged([{ scheme: SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);

let finestra: BrowserWindow | undefined;
let icona: Tray | undefined;
let collegamento: Collegamento | undefined;
let custodia: Custodia;
let terminali: Terminali;
let avviso: string | undefined;
let staUscendo = false;
/** I flussi che la pagina sta seguendo: per ciascuno, come smettere. */
const flussi = new Map<string, () => void>();

/** Le richieste al centro passano dalla rete di Chromium: certificati e proxy sono quelli di Windows. */
const chiedi: Chiedi = (indirizzo, opzioni) => net.fetch(indirizzo, opzioni);

/** Le copie locali stanno in una cartella loro: `Cache` nel profilo è già di Chromium. */
function cartellaDelleCache(): string {
  return join(app.getPath("userData"), "copie-locali");
}

function statoApp(): StatoApp {
  const ultimo = custodia.ultimo();
  return {
    versione: __VERSIONE__,
    dentro: collegamento !== undefined,
    // Da proporre: l'ultimo usato, quello scritto alla costruzione, o quello del nodo di Shinka di questo PC.
    centro: collegamento?.dispositivo.centro ?? ultimo?.centro ?? (__CENTRO_PREDEFINITO__ !== "" ? __CENTRO_PREDEFINITO__ : (centroDelNodoDiQui() ?? "")),
    nome: collegamento?.dispositivo.nome ?? ultimo?.nome ?? hostname(),
    situazione: collegamento?.situazione,
    avviso,
    avvioConWindows: avvioConWindows(),
  };
}

/** Se l'app parte da sola all'accesso a Windows. Vale per l'app installata: quella in prova non si registra. */
function avvioConWindows(): boolean | undefined {
  return app.isPackaged ? app.getLoginItemSettings({ args: [IN_SILENZIO] }).openAtLogin : undefined;
}

function impostaLAvvioConWindows(si: boolean): void {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: si, args: [IN_SILENZIO] });
  preparaIlMenu();
  icona?.setContextMenu(menuDellIcona());
  avvisaLaPagina();
}

function avvisaLaPagina(): void {
  if (finestra !== undefined && !finestra.isDestroyed()) finestra.webContents.send(CANALI.cambio, statoApp());
}

function manda(canale: string, ...argomenti: unknown[]): void {
  if (finestra !== undefined && !finestra.isDestroyed() && !finestra.webContents.isDestroyed()) finestra.webContents.send(canale, ...argomenti);
}

function smettiDiSeguire(): void {
  for (const smetti of flussi.values()) smetti();
  flussi.clear();
}

async function apriIlCollegamento(): Promise<void> {
  const dispositivo = await custodia.dispositivo();
  if (dispositivo === undefined || collegamento !== undefined) return;
  let situazioneInArrivo = false;
  collegamento = new Collegamento({
    dispositivo,
    cartella: cartellaDelleCache(),
    chiedi,
    programma: PROGRAMMA,
    // Il rifiuto arriva nel mezzo di una richiesta: il collegamento si chiude appena finita.
    alRifiuto: () => setImmediate(() => rifiutato(dispositivo.centro)),
    // La sincronizzazione cambia stato molte volte al secondo: alla pagina basta saperlo ogni tanto.
    allaSituazione: () => {
      if (situazioneInArrivo) return;
      situazioneInArrivo = true;
      setTimeout(() => {
        situazioneInArrivo = false;
        avvisaLaPagina();
      }, 250);
    },
  });
}

function chiudiIlCollegamento(): void {
  smettiDiSeguire();
  collegamento?.chiudi();
  collegamento = undefined;
}

/** Il centro non riconosce più questo dispositivo: è stato tolto dal proprietario, e le copie locali non restano. */
function rifiutato(centro: string): void {
  if (collegamento === undefined || collegamento.dispositivo.centro !== centro) return;
  chiudiIlCollegamento();
  custodia.scordaIlGettone();
  buttaLaCache(cartellaDelleCache(), centro);
  avviso = "Il centro non riconosce più questo PC: per rientrare serve la password.";
  avvisaLaPagina();
}

async function esci(): Promise<void> {
  const aperto = collegamento;
  if (aperto === undefined) return;
  const centro = aperto.dispositivo.centro;
  // Il dispositivo si toglie anche dal centro; se il centro non risponde, da qui si esce lo stesso.
  await aperto.centro.chiama("POST", "/api/dispositivi/chiusura", {}, AbortSignal.timeout(5_000)).catch(() => {});
  chiudiIlCollegamento();
  custodia.scordaTutto();
  buttaLaCache(cartellaDelleCache(), centro);
  avviso = undefined;
  avvisaLaPagina();
}

async function entra(scritto: unknown, password: unknown, nome: unknown): Promise<EsitoAccesso> {
  if (typeof scritto !== "string" || typeof password !== "string" || typeof nome !== "string") return { riuscito: false, errore: "Richiesta non valida." };
  const indirizzo = indirizzoDelCentro(scritto);
  if (indirizzo === undefined) return { riuscito: false, errore: "Questo non è l'indirizzo di un centro: scrivilo come https://nome." };
  if (!siPuoRaggiungere(indirizzo)) return { riuscito: false, errore: "Fuori dalla tua rete il centro si raggiunge solo in https: su http la password viaggerebbe in chiaro." };
  const nomeDelDispositivo = nome.trim().slice(0, 60) || hostname();
  if (password === "") return { riuscito: false, errore: "Scrivi la password." };
  try {
    const { id, token } = await aggiungiDispositivo({ indirizzo, chiedi, programma: PROGRAMMA }, password, nomeDelDispositivo);
    chiudiIlCollegamento();
    await custodia.ricorda({ centro: indirizzo, id, nome: nomeDelDispositivo, gettone: token });
    avviso = undefined;
    await apriIlCollegamento();
    avvisaLaPagina();
    return { riuscito: true };
  } catch (errore) {
    if (errore instanceof ErroreCentro) {
      const messaggio = errore.stato === 404 ? "A questo indirizzo non c'è un centro che accetta i dispositivi: forse va aggiornato." : errore.message;
      return { riuscito: false, errore: messaggio, ...(errore.riprovaTraSecondi === undefined ? {} : { riprovaTraSecondi: errore.riprovaTraSecondi }) };
    }
    if (errore instanceof NonRaggiungibile) return { riuscito: false, errore: "Il centro non risponde a questo indirizzo." };
    return { riuscito: false, errore: errore instanceof Error ? errore.message : "L'accesso non è riuscito." };
  }
}

/** Vero se un messaggio viene dalla pagina dell'app, e non da un riquadro o da una finestra aperta da lei. */
function dallaPagina(evento: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const riquadro = evento.senderFrame;
  if (finestra === undefined || finestra.isDestroyed() || riquadro === null) return false;
  return evento.sender === finestra.webContents && riquadro === finestra.webContents.mainFrame && riquadro.url.startsWith(`${ORIGINE}/`) && !riquadro.url.startsWith(`${ORIGINE}/api/`);
}

function ascoltaLaPagina(): void {
  ipcMain.handle(CANALI.stato, (evento) => (dallaPagina(evento) ? statoApp() : undefined));
  ipcMain.handle(CANALI.entra, async (evento, centro: unknown, password: unknown, nome: unknown) => {
    if (!dallaPagina(evento)) return { riuscito: false, errore: "Richiesta non valida." } satisfies EsitoAccesso;
    return await entra(centro, password, nome);
  });
  ipcMain.handle(CANALI.esci, async (evento) => {
    if (dallaPagina(evento)) await esci();
  });

  ipcMain.on(CANALI.chiudiFinestra, (evento) => {
    if (dallaPagina(evento)) finestra?.close();
  });
  ipcMain.handle(CANALI.avvioConWindows, (evento, si: unknown) => {
    if (dallaPagina(evento) && typeof si === "boolean") impostaLAvvioConWindows(si);
  });

  ipcMain.on(CANALI.segui, (evento, id: unknown, che: unknown) => {
    if (!dallaPagina(evento) || typeof id !== "string" || typeof che !== "string" || flussi.has(id) || flussi.size > 64) return;
    const ricevi = (messaggi: MessaggioDelFlusso[]): void => manda(CANALI.flusso, id, messaggi);
    if (collegamento === undefined) {
      ricevi([{ nome: "error", dati: "" }]);
      return;
    }
    if (che === "quadro") {
      // Il quadro in cache arriva tutto insieme, poi ogni cambiamento.
      let primi: MessaggioDelFlusso[] | undefined = [];
      const smetti = collegamento.quadro.segui((messaggio) => {
        if (primi !== undefined) primi.push(messaggio);
        else ricevi([messaggio]);
      });
      ricevi([{ nome: "open", dati: "" }, ...primi]);
      primi = undefined;
      flussi.set(id, smetti);
      return;
    }
    flussi.set(id, collegamento.seguite.segui(che, ricevi));
  });
  ipcMain.on(CANALI.smetti, (evento, id: unknown) => {
    if (!dallaPagina(evento) || typeof id !== "string") return;
    flussi.get(id)?.();
    flussi.delete(id);
  });

  ipcMain.handle(CANALI.shell, (evento) => (dallaPagina(evento) ? terminali.shell : []));
  ipcMain.handle(CANALI.apri, (evento, id: unknown, richiesta: unknown): TerminaleAperto => {
    if (!dallaPagina(evento) || typeof id !== "string" || typeof richiesta !== "object" || richiesta === null) throw new Error("Richiesta non valida.");
    const { shell: scelta, idProgetto, colonne, righe } = richiesta as { shell?: unknown; idProgetto?: unknown; colonne?: unknown; righe?: unknown };
    // La cartella non la sceglie la pagina: è quella del progetto, se vive su questo PC.
    const progetti = collegamento?.cache.quadro().find((voce) => voce.nome === "progetti");
    let cartella: string | undefined;
    if (typeof idProgetto === "string" && progetti !== undefined) {
      try {
        cartella = cartellaSuQuestoPc(JSON.parse(progetti.dati) as StatoProgetti, idProgetto, idDelNodoDiQui());
      } catch {
        cartella = undefined;
      }
    }
    const aperto = terminali.apri(
      id,
      { ...(typeof scelta === "string" ? { shell: scelta } : {}), ...(cartella === undefined ? {} : { cartella }), colonne: Number(colonne), righe: Number(righe) },
      (quale, dati) => manda(CANALI.dati, quale, dati),
      (quale, codice) => manda(CANALI.fine, quale, codice),
    );
    return { shell: aperto.shell, cartella: aperto.cartella, delProgetto: cartella !== undefined && aperto.cartella === cartella };
  });
  ipcMain.on(CANALI.scrivi, (evento, id: unknown, dati: unknown) => {
    if (dallaPagina(evento) && typeof id === "string" && typeof dati === "string") terminali.scrivi(id, dati);
  });
  ipcMain.on(CANALI.misura, (evento, id: unknown, colonne: unknown, righe: unknown) => {
    if (dallaPagina(evento) && typeof id === "string") terminali.misura(id, Number(colonne), Number(righe));
  });
  ipcMain.on(CANALI.chiudi, (evento, id: unknown) => {
    if (dallaPagina(evento) && typeof id === "string") terminali.chiudi(id);
  });
}

// La finestra

interface Posto {
  x?: number;
  y?: number;
  width: number;
  height: number;
  massimizzata?: boolean;
}

function fileDelPosto(): string {
  return join(app.getPath("userData"), "finestra.json");
}

function leggiIlPosto(): Posto {
  try {
    const letto = JSON.parse(readFileSync(fileDelPosto(), "utf8")) as Partial<Posto>;
    if (typeof letto.width === "number" && typeof letto.height === "number" && letto.width >= 480 && letto.height >= 360) {
      return {
        width: letto.width,
        height: letto.height,
        ...(typeof letto.x === "number" && typeof letto.y === "number" ? { x: letto.x, y: letto.y } : {}),
        ...(letto.massimizzata === true ? { massimizzata: true } : {}),
      };
    }
  } catch {
    // Prima apertura.
  }
  return { width: 1320, height: 860 };
}

function scriviIlPosto(): void {
  if (finestra === undefined || finestra.isDestroyed()) return;
  try {
    writeFileSync(fileDelPosto(), JSON.stringify({ ...finestra.getNormalBounds(), massimizzata: finestra.isMaximized() }), "utf8");
  } catch {
    // Il posto della finestra si può perdere.
  }
}

function immagine(nome: string): Electron.NativeImage {
  return nativeImage.createFromPath(join(CARTELLA_PAGINA, nome));
}

function mostraLaFinestra(): void {
  if (finestra === undefined || finestra.isDestroyed()) {
    apriLaFinestra();
    return;
  }
  if (finestra.isMinimized()) finestra.restore();
  finestra.show();
  finestra.focus();
}

/** `nascosta`: la finestra si prepara ma non si mostra, e l'app resta nell'area di notifica. */
function apriLaFinestra(nascosta = false): void {
  const posto = leggiIlPosto();
  const nuova = new BrowserWindow({
    ...posto,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: NOME,
    icon: immagine("icona-192.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#18181a" : "#f7f7f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: FILE_PONTE,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });
  finestra = nuova;
  if (posto.massimizzata === true) nuova.maximize();
  if (!nascosta) nuova.once("ready-to-show", () => nuova.show());

  // Chiudere la finestra non chiude l'app: resta nell'area di notifica (ADR 0009).
  nuova.on("close", (evento) => {
    scriviIlPosto();
    if (staUscendo) return;
    evento.preventDefault();
    nuova.hide();
  });
  nuova.on("closed", () => {
    if (finestra === nuova) finestra = undefined;
  });
  // I tasti laterali del mouse vanno avanti e indietro, come in un browser.
  nuova.on("app-command", (_evento, comando) => {
    if (comando === "browser-backward") manda(CANALI.comando, "indietro" satisfies Comando);
    else if (comando === "browser-forward") manda(CANALI.comando, "avanti" satisfies Comando);
  });

  const pagina = nuova.webContents;
  // La pagina resta la pagina dell'app: ogni altro indirizzo si apre nel browser.
  pagina.on("will-navigate", (evento, indirizzo) => {
    if (indirizzo.startsWith(`${ORIGINE}/`) && !indirizzo.startsWith(`${ORIGINE}/api/`)) return;
    evento.preventDefault();
    apriFuori(indirizzo);
  });
  pagina.setWindowOpenHandler(({ url }) => {
    // Un elaborato o un file del centro si apre in una finestra a parte, senza il ponte.
    if (url.startsWith(`${ORIGINE}/api/`)) {
      return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    }
    apriFuori(url);
    return { action: "deny" };
  });
  // Una pagina ricaricata non segue più nulla, e i suoi terminali non hanno più chi li guarda.
  pagina.on("did-start-navigation", (dettagli) => {
    if (!dettagli.isMainFrame || dettagli.isSameDocument) return;
    smettiDiSeguire();
    terminali.chiudiTutti();
  });
  pagina.on("render-process-gone", () => {
    smettiDiSeguire();
    terminali.chiudiTutti();
  });

  void nuova.loadURL(`${ORIGINE}/`);
}

function apriFuori(indirizzo: string): void {
  try {
    const { protocol: schema } = new URL(indirizzo);
    if (schema === "https:" || schema === "http:" || schema === "mailto:") void shell.openExternal(indirizzo);
  } catch {
    // Non è un indirizzo: non si apre.
  }
}

function chiudiTutto(): void {
  staUscendo = true;
  app.quit();
}

/**
 * Una voce del menu per un comando. I tasti sono solo scritti accanto: li ascolta la pagina, che sa
 * se si sta scrivendo in un terminale e allora lascia alla shell i suoi.
 */
function voceDi(comando: Comando): MenuItemConstructorOptions {
  const voce = SCORCIATOIE.find((una) => una.comando === comando);
  return { label: voce?.etichetta ?? comando, ...(voce === undefined ? {} : { accelerator: voce.tasti }), registerAccelerator: false, click: () => manda(CANALI.comando, comando) };
}

function vociDi(gruppo: Gruppo, tranne: readonly Comando[] = []): MenuItemConstructorOptions[] {
  return SCORCIATOIE.filter((voce) => voce.gruppo === gruppo && !tranne.includes(voce.comando)).map((voce) => voceDi(voce.comando));
}

function preparaIlMenu(): void {
  const conStrumenti = !app.isPackaged || process.env.SHINKA_DESKTOP_STRUMENTI === "1";
  const allAccesso = avvioConWindows();
  const modello: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        voceDi("nuovo-terminale"),
        { type: "separator" },
        voceDi("chiudi-finestra"),
        { label: `Esci da ${NOME}`, accelerator: "CmdOrCtrl+Q", click: chiudiTutto },
      ],
    },
    {
      label: "Modifica",
      submenu: [
        { label: "Annulla", role: "undo" },
        { label: "Ripeti", role: "redo" },
        { type: "separator" },
        { label: "Taglia", role: "cut" },
        { label: "Copia", role: "copy" },
        { label: "Incolla", role: "paste" },
        { label: "Seleziona tutto", role: "selectAll" },
      ],
    },
    { label: "Vai", submenu: vociDi("Andare") },
    { label: "Terminali", submenu: vociDi("Terminali") },
    {
      label: "Vista",
      submenu: [
        // Non Ctrl+R: in un terminale è la ricerca nei comandi già dati.
        { label: "Ricarica", role: "reload", accelerator: "F5" },
        { label: "Ingrandisci", role: "zoomIn", accelerator: "CmdOrCtrl+=" },
        { label: "Rimpicciolisci", role: "zoomOut" },
        { label: "Dimensione normale", role: "resetZoom" },
        { label: "Schermo intero", role: "togglefullscreen" },
        ...(conStrumenti ? ([{ type: "separator" }, { label: "Strumenti di sviluppo", role: "toggleDevTools", accelerator: "F12" }] satisfies MenuItemConstructorOptions[]) : []),
      ],
    },
    {
      label: "Aiuto",
      submenu: [
        voceDi("scorciatoie"),
        ...(allAccesso === undefined ? [] : [voceDellAvvio(allAccesso)]),
        { type: "separator" },
        { label: `${NOME} ${__VERSIONE__}`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modello));
}

function voceDellAvvio(acceso: boolean): MenuItemConstructorOptions {
  return { label: "Avvia con Windows", type: "checkbox", checked: acceso, click: (voce) => impostaLAvvioConWindows(voce.checked) };
}

function menuDellIcona(): Menu {
  const allAccesso = avvioConWindows();
  return Menu.buildFromTemplate([
    { label: "Apri Shinka", click: mostraLaFinestra },
    ...(allAccesso === undefined ? [] : [voceDellAvvio(allAccesso)]),
    { type: "separator" },
    { label: "Esci", click: chiudiTutto },
  ]);
}

function preparaLIcona(): void {
  icona = new Tray(immagine("favicon-32.png"));
  icona.setToolTip(NOME);
  icona.setContextMenu(menuDellIcona());
  icona.on("click", mostraLaFinestra);
}

// Un'istanza sola: riaprire l'app porta davanti la finestra che c'è già.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostraLaFinestra);
  app.on("before-quit", () => {
    staUscendo = true;
  });
  app.on("will-quit", () => {
    terminali?.chiudiTutti();
    chiudiIlCollegamento();
  });
  // Senza finestre l'app resta: vive nell'area di notifica.
  app.on("window-all-closed", () => {});

  void app.whenReady().then(async () => {
    app.setAppUserModelId("app.shinka.desktop");
    custodia = new Custodia(join(app.getPath("userData"), "dispositivo.json"), {
      disponibile: () => safeStorage.isAsyncEncryptionAvailable(),
      cifra: (testo) => safeStorage.encryptStringAsync(testo),
      decifra: async (cifrato) => {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(cifrato);
        return { testo: result, daRicifrare: shouldReEncrypt };
      },
    });
    const { spawn } = createRequire(import.meta.url)("node-pty") as typeof import("node-pty");
    terminali = new Terminali(spawn);

    protocol.handle(
      SCHEMA,
      rispondiAllePagine({
        cartella: CARTELLA_PAGINA,
        centro: () => collegamento?.centro,
        immagini: () => collegamento?.immagini,
        cerca: (cercato) => collegamento?.cerca(cercato),
        esci,
      }),
    );
    // La pagina può copiare negli appunti, mandare notifiche e andare a schermo intero; il resto no.
    const CONCESSI = new Set(["clipboard-sanitized-write", "clipboard-read", "notifications", "fullscreen", "media"]);
    session.defaultSession.setPermissionRequestHandler((contenuti, permesso, rispondi) => {
      rispondi(contenuti === finestra?.webContents && CONCESSI.has(permesso));
    });

    ascoltaLaPagina();
    preparaIlMenu();
    preparaLIcona();
    // Il gettone si legge prima di aprire la finestra: la pagina sa subito se questo PC è collegato.
    await apriIlCollegamento().catch(() => {});
    // Avviata da Windows all'accesso resta nell'area di notifica, con la finestra già pronta.
    apriLaFinestra(process.argv.includes(IN_SILENZIO));
  });
}
