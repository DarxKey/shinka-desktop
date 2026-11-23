/**
 * I comandi dell'app e i tasti che li chiamano. È un elenco solo, letto da tutti: la pagina, che
 * ascolta la tastiera e lo mostra nella palette; il processo principale, che ne fa il menu.
 *
 * I tasti li ascolta la pagina, non il menu: solo lei sa se si sta scrivendo in un terminale, dove
 * i tasti della shell (Ctrl+R, Ctrl+W, Ctrl+K…) devono restare della shell.
 */

export type Comando =
  | "vai-a"
  | "cerca"
  | "home"
  | "indietro"
  | "avanti"
  | "impostazioni"
  | "scorciatoie"
  | "terminali"
  | "fuoco"
  | "nuovo-terminale"
  | "dividi-a-destra"
  | "dividi-sotto"
  | "chiudi-terminale"
  | "scheda-dopo"
  | "scheda-prima"
  | "chiudi-finestra";

export type Gruppo = "Andare" | "Terminali" | "Finestra";

export interface Scorciatoia {
  comando: Comando;
  etichetta: string;
  gruppo: Gruppo;
  /** Come li scrive Electron nei menu: `Ctrl+Shift+T`, `Alt+Left`, `F1`. */
  tasti: string;
  /** Vero se vale anche mentre si scrive in un terminale: lì i tasti semplici sono della shell. */
  nelTerminale: boolean;
}

export const SCORCIATOIE: readonly Scorciatoia[] = [
  { comando: "vai-a", etichetta: "Vai a un progetto, un argomento, una pagina…", gruppo: "Andare", tasti: "Ctrl+K", nelTerminale: false },
  { comando: "cerca", etichetta: "Cerca nelle conversazioni", gruppo: "Andare", tasti: "Ctrl+Shift+F", nelTerminale: true },
  { comando: "home", etichetta: "Vai alla Home", gruppo: "Andare", tasti: "Ctrl+Shift+H", nelTerminale: true },
  { comando: "indietro", etichetta: "Indietro", gruppo: "Andare", tasti: "Alt+Left", nelTerminale: false },
  { comando: "avanti", etichetta: "Avanti", gruppo: "Andare", tasti: "Alt+Right", nelTerminale: false },
  { comando: "impostazioni", etichetta: "Impostazioni", gruppo: "Andare", tasti: "Ctrl+,", nelTerminale: false },
  { comando: "terminali", etichetta: "Mostra o nascondi i terminali", gruppo: "Terminali", tasti: "Ctrl+J", nelTerminale: true },
  { comando: "fuoco", etichetta: "Passa tra la chat e il terminale", gruppo: "Terminali", tasti: "Ctrl+Shift+J", nelTerminale: true },
  { comando: "nuovo-terminale", etichetta: "Nuovo terminale", gruppo: "Terminali", tasti: "Ctrl+Shift+T", nelTerminale: true },
  { comando: "dividi-a-destra", etichetta: "Dividi il terminale a destra", gruppo: "Terminali", tasti: "Ctrl+Shift+D", nelTerminale: true },
  { comando: "dividi-sotto", etichetta: "Dividi il terminale sotto", gruppo: "Terminali", tasti: "Ctrl+Shift+G", nelTerminale: true },
  { comando: "chiudi-terminale", etichetta: "Chiudi il terminale", gruppo: "Terminali", tasti: "Ctrl+Shift+W", nelTerminale: true },
  { comando: "scheda-dopo", etichetta: "Scheda di terminali successiva", gruppo: "Terminali", tasti: "Ctrl+Tab", nelTerminale: true },
  { comando: "scheda-prima", etichetta: "Scheda di terminali precedente", gruppo: "Terminali", tasti: "Ctrl+Shift+Tab", nelTerminale: true },
  { comando: "scorciatoie", etichetta: "Scorciatoie da tastiera", gruppo: "Finestra", tasti: "F1", nelTerminale: true },
  { comando: "chiudi-finestra", etichetta: "Chiudi la finestra", gruppo: "Finestra", tasti: "Ctrl+W", nelTerminale: false },
];

const COMANDI = new Set<string>(SCORCIATOIE.map((voce) => voce.comando));

export function eUnComando(valore: unknown): valore is Comando {
  return typeof valore === "string" && COMANDI.has(valore);
}

/** Ciò che di un tasto premuto serve per riconoscerlo: gli stessi campi di un `KeyboardEvent`. */
export interface Tasto {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

const NOMI_DEI_TASTI: Record<string, string> = { Left: "ArrowLeft", Right: "ArrowRight", Up: "ArrowUp", Down: "ArrowDown" };

function corrisponde(tasti: string, tasto: Tasto): boolean {
  const parti = tasti.split("+");
  const ultimo = parti.at(-1) ?? "";
  const nome = NOMI_DEI_TASTI[ultimo] ?? ultimo;
  // Con AltGr, che vale Ctrl e Alt insieme, si scrivono lettere: non è mai una scorciatoia di queste.
  return (
    tasto.key.toLowerCase() === nome.toLowerCase() &&
    tasto.ctrlKey === parti.includes("Ctrl") &&
    tasto.shiftKey === parti.includes("Shift") &&
    tasto.altKey === parti.includes("Alt") &&
    !tasto.metaKey
  );
}

/** Il comando chiamato da un tasto, se ce n'è uno che vale lì dove si sta scrivendo. */
export function comandoDelTasto(tasto: Tasto, nelTerminale: boolean): Comando | undefined {
  return SCORCIATOIE.find((voce) => (voce.nelTerminale || !nelTerminale) && corrisponde(voce.tasti, tasto))?.comando;
}

const IN_PAROLE: Record<string, string> = { Shift: "Maiusc", Left: "←", Right: "→", Up: "↑", Down: "↓", Tab: "Tab" };

/** I tasti come li legge il proprietario: `Ctrl+Maiusc+T`. */
export function tastiInParole(tasti: string): string {
  return tasti
    .split("+")
    .map((parte) => IN_PAROLE[parte] ?? parte)
    .join("+");
}
