/** Le skill: procedure riutilizzabili che Claude crea e migliora, con la loro storia. */

/** Il nome con cui le skill di Shinka compaiono a Claude Code: `shinka:<nome>`. */
export const GRUPPO_SKILL = "shinka";

export const NOME_SKILL = /^[a-z0-9][a-z0-9-]{1,47}$/;
export const DESCRIZIONE_SKILL_MASSIMA = 400;
export const CONTENUTO_SKILL_MASSIMO = 20_000;
export const MOTIVO_SKILL_MASSIMO = 200;

/** Il nome del file di una skill dentro la sua cartella, come lo vuole Claude Code. */
export const FILE_SKILL = "SKILL.md";

export interface VoceSkill {
  nome: string;
  descrizione: string;
  /** Quando è stata creata o modificata l'ultima volta. */
  modificataIl: string;
  /** Quante volte è stata creata, modificata o ripristinata. */
  modifiche: number;
}

export interface StatoSkill {
  skill: VoceSkill[];
}

export type TipoModifica = "creata" | "modificata" | "annullata";

/** Una riga della storia di una skill. */
export interface ModificaSkill {
  id: string;
  quando: string;
  tipo: TipoModifica;
  /** Perché è stata fatta, nelle parole di chi l'ha fatta. */
  motivo: string;
  /** Dove è stata fatta: la Home, un progetto, oppure il proprietario. */
  origine: string;
}

export interface DettaglioSkill {
  nome: string;
  descrizione: string;
  contenuto: string;
  /** Dalla modifica più recente. */
  storia: ModificaSkill[];
}

/** Com'era la skill prima e dopo una modifica. Manca ciò che non esisteva. */
export interface VersioniSkill {
  prima?: { descrizione: string; contenuto: string };
  dopo?: { descrizione: string; contenuto: string };
}

/** Il manifesto che fa di una cartella di skill un plugin di Claude Code. */
export const MANIFESTO_PLUGIN = `${JSON.stringify(
  { name: GRUPPO_SKILL, description: "Le skill che Shinka ha creato per il proprietario.", version: "1.0.0" },
  null,
  2,
)}\n`;

/** Una skill come viaggia verso un nodo: il nome e il suo file intero. */
export interface SkillDistribuita {
  nome: string;
  file: string;
}

/** Il file di una skill: intestazione con nome e descrizione, poi il contenuto. */
export function componiSkill(nome: string, descrizione: string, contenuto: string): string {
  return `---\nname: ${nome}\ndescription: ${JSON.stringify(descrizione)}\n---\n\n${contenuto.trim()}\n`;
}

/** Legge descrizione e contenuto dal file di una skill. Nulla se non ha la forma attesa. */
export function scomponiSkill(file: string): { descrizione: string; contenuto: string } | undefined {
  const trovato = /^---\r?\nname: [^\r\n]+\r?\ndescription: ([^\r\n]+)\r?\n---\r?\n([\s\S]*)$/.exec(file);
  if (trovato?.[1] === undefined || trovato[2] === undefined) return undefined;
  let descrizione: unknown;
  try {
    descrizione = JSON.parse(trovato[1]);
  } catch {
    descrizione = trovato[1];
  }
  return { descrizione: typeof descrizione === "string" ? descrizione : trovato[1], contenuto: trovato[2].trim() };
}
