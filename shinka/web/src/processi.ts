/**
 * I processi accesi da Shinka in un ambiente, messi in ordine per la pagina: per progetto, ciascuno
 * con i suoi discendenti sotto. Un processo è di un progetto se lavora nella sua cartella o la nomina
 * nella riga di comando; i suoi figli lo seguono. Gli altri sono di Shinka.
 */

import type { ProcessoDiShinka } from "../../src/protocollo/risorse.ts";

export interface ProgettoDiUnProcesso {
  id: string;
  nome: string;
  cartella: string;
}

export interface RigaProcesso {
  processo: ProcessoDiShinka;
  /** Quanto è rientrato sotto chi l'ha avviato. */
  livello: number;
}

export interface GruppoDiProcessi {
  /** Il progetto; manca per i processi di Shinka che non sono di un progetto. */
  progetto?: ProgettoDiUnProcesso;
  righe: RigaProcesso[];
  cpu: number;
  memoria: number;
}

/** Un percorso confrontabile: barre dritte, senza quella finale, e senza maiuscole se è di Windows. */
function pulito(percorso: string): string {
  const dritto = percorso.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[A-Za-z]:/.test(dritto) ? dritto.toLowerCase() : dritto;
}

/** Il progetto di cui è un processo, guardando la sua cartella e la sua riga di comando. */
function progettoDi(processo: ProcessoDiShinka, progetti: readonly ProgettoDiUnProcesso[]): ProgettoDiUnProcesso | undefined {
  const cartella = processo.cartella === undefined ? undefined : pulito(processo.cartella);
  const comando = processo.comando === undefined ? undefined : pulito(processo.comando);
  // Il progetto con la cartella più lunga che corrisponde: uno dentro un altro vince sul suo contenitore.
  return [...progetti]
    .sort((a, b) => b.cartella.length - a.cartella.length)
    .find((progetto) => {
      const sua = pulito(progetto.cartella);
      // Su Windows le maiuscole non contano: anche nella riga di comando.
      const diWindows = /^[a-z]:/.test(sua);
      return (
        (cartella !== undefined && (cartella === sua || cartella.startsWith(`${sua}/`))) ||
        (comando !== undefined && (diWindows ? comando.toLowerCase() : comando).includes(sua))
      );
    });
}

export function processiPerProgetto(processi: readonly ProcessoDiShinka[], progetti: readonly ProgettoDiUnProcesso[]): GruppoDiProcessi[] {
  const perPid = new Map(processi.map((uno) => [uno.pid, uno]));
  const figli = new Map<number, ProcessoDiShinka[]>();
  for (const uno of processi) {
    const genitore = perPid.has(uno.genitore) ? uno.genitore : 0;
    figli.set(genitore, [...(figli.get(genitore) ?? []), uno]);
  }
  const gruppi = new Map<string, GruppoDiProcessi>();
  const gruppoDi = (progetto: ProgettoDiUnProcesso | undefined): GruppoDiProcessi => {
    const chiave = progetto?.id ?? "";
    let gruppo = gruppi.get(chiave);
    if (gruppo === undefined) {
      gruppo = { ...(progetto === undefined ? {} : { progetto }), righe: [], cpu: 0, memoria: 0 };
      gruppi.set(chiave, gruppo);
    }
    return gruppo;
  };
  const visita = (processo: ProcessoDiShinka, livello: number, ereditato: ProgettoDiUnProcesso | undefined): void => {
    const progetto = progettoDi(processo, progetti) ?? ereditato;
    const gruppo = gruppoDi(progetto);
    // Sotto un processo di un altro gruppo si ricomincia da sinistra.
    gruppo.righe.push({ processo, livello: progetto === ereditato ? livello : 0 });
    gruppo.cpu += processo.cpu;
    gruppo.memoria += processo.memoria;
    for (const figlio of figli.get(processo.pid) ?? []) visita(figlio, progetto === ereditato ? livello + 1 : 1, progetto);
  };
  for (const radice of figli.get(0) ?? []) visita(radice, 0, undefined);
  // Prima i progetti, per nome; in fondo quelli di Shinka.
  return [...gruppi.values()].sort((a, b) => (a.progetto === undefined ? 1 : b.progetto === undefined ? -1 : a.progetto.nome.localeCompare(b.progetto.nome, "it")));
}

/** Che cos'è un processo, in parole, quando lo si riconosce. */
export function cheCosE(processo: ProcessoDiShinka): string | undefined {
  const testo = `${processo.nome} ${processo.comando ?? ""}`.toLowerCase();
  if (testo.includes("llama-server")) return "modello locale";
  if (testo.includes("codegraph")) return "CodeGraph";
  if (/^claude(\.exe)?$/.test(processo.nome.toLowerCase()) || /claude-agent-sdk|[\\/]claude(\.exe)?\b/.test(testo)) return "conversazione";
  if (testo.includes("codex")) return "conversazione (Codex)";
  if (/\b(powershell|pwsh|bash|zsh|sh|cmd)(\.exe)?\b/.test(processo.nome.toLowerCase())) return "shell";
  return undefined;
}
