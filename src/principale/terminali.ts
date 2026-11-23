/**
 * I terminali locali (ADR 0005): shell vere di questo PC, aperte con ConPTY attraverso `node-pty`.
 * Non passano dal centro e funzionano anche senza connessione. La pagina sceglie una shell tra
 * quelle trovate qui e un luogo; quale programma parte e in quale cartella lo decide questo file.
 */

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { IPty } from "node-pty";

export interface ShellDisponibile {
  id: string;
  nome: string;
}

interface Shell extends ShellDisponibile {
  file: string;
  argomenti: string[];
}

function primoEsistente(candidati: (string | undefined)[]): string | undefined {
  return candidati.find((file): file is string => file !== undefined && existsSync(file));
}

function nelPercorso(nome: string, ambiente: NodeJS.ProcessEnv): string | undefined {
  const cartelle = (ambiente.PATH ?? ambiente.Path ?? "").split(delimiter).filter((cartella) => cartella !== "");
  return primoEsistente(cartelle.map((cartella) => join(cartella, nome)));
}

function sotto(radice: string | undefined, ...resto: string[]): string | undefined {
  return radice === undefined || radice === "" ? undefined : join(radice, ...resto);
}

/** Le shell che questo PC ha, nell'ordine in cui proporle: la prima è quella dei terminali nuovi. */
export function trovaShell(ambiente: NodeJS.ProcessEnv = process.env): Shell[] {
  const sistema = ambiente.SystemRoot ?? ambiente.windir;
  const programmi = [ambiente.ProgramFiles, ambiente["ProgramFiles(x86)"], sotto(ambiente.LOCALAPPDATA, "Programs")];
  const trovate: (Shell | undefined)[] = [
    shell("pwsh", "PowerShell", primoEsistente([sotto(ambiente.ProgramFiles, "PowerShell", "7", "pwsh.exe"), nelPercorso("pwsh.exe", ambiente)]), ["-NoLogo"]),
    shell("powershell", "Windows PowerShell", primoEsistente([sotto(sistema, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")]), ["-NoLogo"]),
    shell("cmd", "Prompt dei comandi", primoEsistente([ambiente.ComSpec, sotto(sistema, "System32", "cmd.exe")]), []),
    shell("git-bash", "Git Bash", primoEsistente(programmi.map((cartella) => sotto(cartella, "Git", "bin", "bash.exe"))), ["--login", "-i"]),
    shell("wsl", "WSL", primoEsistente([sotto(sistema, "System32", "wsl.exe")]), []),
  ];
  return trovate.filter((trovata): trovata is Shell => trovata !== undefined);
}

function shell(id: string, nome: string, file: string | undefined, argomenti: string[]): Shell | undefined {
  return file === undefined ? undefined : { id, nome, file, argomenti };
}

/** La cartella in cui aprire un terminale: quella chiesta se esiste, altrimenti quella dell'utente. */
export function cartellaDiPartenza(chiesta: string | undefined): string {
  if (chiesta !== undefined) {
    try {
      if (statSync(chiesta).isDirectory()) return chiesta;
    } catch {
      // Non c'è, o non si può leggere: si parte da casa.
    }
  }
  return homedir();
}

function misura(valore: number, minimo: number, massimo: number, seManca: number): number {
  return Number.isFinite(valore) ? Math.min(massimo, Math.max(minimo, Math.floor(valore))) : seManca;
}

type Avvia = typeof import("node-pty").spawn;

export interface TerminaleAperto {
  id: string;
  shell: ShellDisponibile;
  cartella: string;
}

export class Terminali {
  readonly #avvia: Avvia;
  readonly #shell: Shell[];
  readonly #aperti = new Map<string, IPty>();

  constructor(avvia: Avvia, shell: Shell[] = trovaShell()) {
    this.#avvia = avvia;
    this.#shell = shell;
  }

  get shell(): ShellDisponibile[] {
    return this.#shell.map(({ id, nome }) => ({ id, nome }));
  }

  /**
   * Apre una shell con l'identificativo scelto da chi la chiede. `alDato` riceve ciò che scrive;
   * `allaFine` arriva quando si chiude da sé o viene chiusa.
   */
  apri(
    id: string,
    richiesta: { shell?: string; cartella?: string; colonne: number; righe: number },
    alDato: (id: string, dati: string) => void,
    allaFine: (id: string, codice: number) => void,
  ): TerminaleAperto {
    const scelta = this.#shell.find((voce) => voce.id === richiesta.shell) ?? this.#shell[0];
    if (scelta === undefined) throw new Error("Su questo PC non ho trovato una shell da aprire.");
    if (!/^[a-z0-9-]{1,64}$/.test(id) || this.#aperti.has(id)) throw new Error("Identificativo del terminale non valido.");
    const cartella = cartellaDiPartenza(richiesta.cartella);
    const processo = this.#avvia(scelta.file, scelta.argomenti, {
      name: "xterm-256color",
      cols: misura(richiesta.colonne, 2, 500, 80),
      rows: misura(richiesta.righe, 2, 300, 24),
      cwd: cartella,
      env: { ...process.env, TERM_PROGRAM: "ShinkaDesktop", COLORTERM: "truecolor" } as Record<string, string>,
    });
    this.#aperti.set(id, processo);

    // Una shell che scrive tanto manda molti pezzi piccoli: si raccolgono per qualche millisecondo.
    let raccolti = "";
    let sveglia: NodeJS.Timeout | undefined;
    const manda = (): void => {
      sveglia = undefined;
      if (raccolti === "") return;
      const dati = raccolti;
      raccolti = "";
      alDato(id, dati);
    };
    processo.onData((dati) => {
      raccolti += dati;
      sveglia ??= setTimeout(manda, 4);
    });
    processo.onExit(({ exitCode }) => {
      if (sveglia !== undefined) clearTimeout(sveglia);
      manda();
      this.#aperti.delete(id);
      allaFine(id, exitCode);
    });
    return { id, shell: { id: scelta.id, nome: scelta.nome }, cartella };
  }

  scrivi(id: string, dati: string): void {
    this.#aperti.get(id)?.write(dati);
  }

  misura(id: string, colonne: number, righe: number): void {
    const processo = this.#aperti.get(id);
    if (processo === undefined) return;
    try {
      processo.resize(misura(colonne, 2, 500, 80), misura(righe, 2, 300, 24));
    } catch {
      // Chiuso nel frattempo.
    }
  }

  chiudi(id: string): void {
    const processo = this.#aperti.get(id);
    if (processo === undefined) return;
    try {
      processo.kill();
    } catch {
      // Già chiuso.
    }
  }

  chiudiTutti(): void {
    for (const id of [...this.#aperti.keys()]) this.chiudi(id);
  }
}
