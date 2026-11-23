/**
 * La cache locale delle conversazioni (ADR 0003): un file SQLite nel profilo dell'utente, con la
 * storia leggera di ogni conversazione, fin dove è arrivata e in quale versione dell'archivio.
 * È una copia: si può cancellare e si ricostruisce dal centro.
 */

import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { EventoArchiviato, IndiceArchivio } from "../../shinka/src/protocollo/eventi.ts";

/** Cambia quando cambia la forma delle tabelle: una cache di un'altra forma si butta. */
const FORMA = 1;

const TABELLE = `
  create table conversazioni (
    chiave text primary key,
    versione text not null,
    ultimo integer not null
  ) without rowid;
  create table eventi (
    chiave text not null,
    n integer not null,
    riga text not null,
    primary key (chiave, n)
  ) without rowid;
  create table ricordati (
    chiave text not null,
    tipo text not null,
    riga text not null,
    primary key (chiave, tipo)
  ) without rowid;
  create table quadro (
    nome text primary key,
    dati text not null
  ) without rowid;
  create table valori (
    nome text primary key,
    valore text not null
  ) without rowid;
`;

/** La chiave di una conversazione nella cache: `progetti/<id>` oppure `argomenti/<id>`. */
export type Chiave = `progetti/${string}` | `argomenti/${string}`;

export function chiaveDelProgetto(id: string): Chiave {
  return `progetti/${id}`;
}

export function chiaveDellArgomento(id: string): Chiave {
  return `argomenti/${id}`;
}

/** Il percorso delle API di una conversazione, dalla sua chiave. */
export function baseDi(chiave: Chiave): string {
  const taglio = chiave.indexOf("/");
  return `/api/${chiave.slice(0, taglio)}/${encodeURIComponent(chiave.slice(taglio + 1))}`;
}

export class Cache {
  readonly #db: DatabaseSync;
  readonly #preparati = new Map<string, StatementSync>();

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /** Apre la cache in un file, o in memoria con `:memory:`. */
  static apri(file: string): Cache {
    const db = new DatabaseSync(file);
    db.exec("pragma journal_mode = wal; pragma synchronous = normal;");
    const forma = (db.prepare("pragma user_version").get() as { user_version: number }).user_version;
    if (forma !== FORMA) {
      const tabelle = db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'").all() as { name: string }[];
      for (const { name } of tabelle) db.exec(`drop table "${name}"`);
      db.exec(TABELLE);
      db.exec(`pragma user_version = ${FORMA}`);
    }
    return new Cache(db);
  }

  chiudi(): void {
    this.#preparati.clear();
    this.#db.close();
  }

  #sql(testo: string): StatementSync {
    let preparato = this.#preparati.get(testo);
    if (preparato === undefined) {
      preparato = this.#db.prepare(testo);
      this.#preparati.set(testo, preparato);
    }
    return preparato;
  }

  #insieme<T>(lavoro: () => T): T {
    this.#db.exec("begin immediate");
    try {
      const esito = lavoro();
      this.#db.exec("commit");
      return esito;
    } catch (errore) {
      this.#db.exec("rollback");
      throw errore;
    }
  }

  /** Fin dove è arrivata la copia di una conversazione, se c'è. */
  indice(chiave: Chiave): IndiceArchivio | undefined {
    const riga = this.#sql("select versione, ultimo from conversazioni where chiave = ?").get(chiave) as { versione: string; ultimo: number } | undefined;
    return riga === undefined ? undefined : { versione: riga.versione, ultimo: riga.ultimo };
  }

  /** Le conversazioni in cache. */
  chiavi(): Chiave[] {
    return (this.#sql("select chiave from conversazioni").all() as { chiave: Chiave }[]).map((riga) => riga.chiave);
  }

  /** Gli eventi di una conversazione, in ordine, ciascuno come il JSON di un `EventoArchiviato`. */
  righe(chiave: Chiave): string[] {
    return (this.#sql("select riga from eventi where chiave = ? order by n").all(chiave) as { riga: string }[]).map((riga) => riga.riga);
  }

  /**
   * Aggiunge eventi alla copia di una conversazione, nella versione detta. Se la copia era di
   * un'altra versione viene buttata prima: quegli eventi potrebbero non valere più.
   * `ultimo` dice fin dove arriva la copia dopo l'aggiunta; se manca, è l'ultimo evento aggiunto.
   */
  aggiungi(chiave: Chiave, versione: string, eventi: readonly EventoArchiviato[], ultimo?: number): void {
    this.#insieme(() => {
      const prima = this.indice(chiave);
      if (prima !== undefined && prima.versione !== versione) this.#butta(chiave);
      const partenza = prima !== undefined && prima.versione === versione ? prima.ultimo : 0;
      const aggiungi = this.#sql("insert or replace into eventi (chiave, n, riga) values (?, ?, ?)");
      let arrivo = partenza;
      for (const evento of eventi) {
        if (evento.n <= 0) continue;
        aggiungi.run(chiave, evento.n, JSON.stringify(evento));
        if (evento.n > arrivo) arrivo = evento.n;
      }
      this.#sql("insert or replace into conversazioni (chiave, versione, ultimo) values (?, ?, ?)").run(chiave, versione, ultimo ?? arrivo);
    });
  }

  /** Butta la copia di una conversazione: eventi, eventi ricordati e indice. */
  togli(chiave: Chiave): void {
    this.#insieme(() => this.#butta(chiave));
  }

  #butta(chiave: Chiave): void {
    this.#sql("delete from eventi where chiave = ?").run(chiave);
    this.#sql("delete from ricordati where chiave = ?").run(chiave);
    this.#sql("delete from conversazioni where chiave = ?").run(chiave);
  }

  /** Riscrive un evento già in cache, per esempio un'azione che ora è conclusa e si può accorciare. */
  riscrivi(chiave: Chiave, evento: EventoArchiviato): void {
    this.#sql("update eventi set riga = ? where chiave = ? and n = ?").run(JSON.stringify(evento), chiave, evento.n);
  }

  /** Un evento della copia, se c'è. */
  evento(chiave: Chiave, n: number): EventoArchiviato | undefined {
    const riga = this.#sql("select riga from eventi where chiave = ? and n = ?").get(chiave, n) as { riga: string } | undefined;
    return riga === undefined ? undefined : (JSON.parse(riga.riga) as EventoArchiviato);
  }

  /** Gli eventi di cui conta solo l'ultimo (stato, impostazioni, attività), come li si è visti l'ultima volta. */
  ricordati(chiave: Chiave): string[] {
    return (this.#sql("select riga from ricordati where chiave = ? order by tipo").all(chiave) as { riga: string }[]).map((riga) => riga.riga);
  }

  ricorda(chiave: Chiave, tipo: string, riga: string): void {
    this.#sql("insert or replace into ricordati (chiave, tipo, riga) values (?, ?, ?)").run(chiave, tipo, riga);
  }

  /** Il quadro come lo si è visto l'ultima volta: per ogni nome, il JSON mandato dal centro. */
  quadro(): { nome: string; dati: string }[] {
    return this.#sql("select nome, dati from quadro order by nome").all() as { nome: string; dati: string }[];
  }

  scriviQuadro(nome: string, dati: string): void {
    this.#sql("insert or replace into quadro (nome, dati) values (?, ?)").run(nome, dati);
  }

  valore(nome: string): string | undefined {
    return (this.#sql("select valore from valori where nome = ?").get(nome) as { valore: string } | undefined)?.valore;
  }

  scriviValore(nome: string, valore: string): void {
    this.#sql("insert or replace into valori (nome, valore) values (?, ?)").run(nome, valore);
  }
}
