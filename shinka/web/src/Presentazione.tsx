/**
 * La presentazione guidata di Shinka: poche schede che dicono che cosa sa fare e da dove si comincia.
 * Ci arriva chi ha appena preparato un'installazione nuova, dal benvenuto delle Impostazioni; poi si
 * riapre dal menu delle pagine.
 */

import { useEffect, useState, type ReactNode } from "react";
import { frammentoDi, vaiA } from "./vista.ts";

interface Passo {
  titolo: string;
  testo: string[];
  /** Qualcosa da chiedere alla Home per provarlo. */
  prova?: string;
  /** Una pagina di Shinka in cui guardare. */
  pagina?: { nome: string; indirizzo: string };
}

export const PASSI_PRESENTAZIONE: readonly Passo[] = [
  {
    titolo: "Benvenuto in Shinka",
    testo: [
      "Shinka è il tuo assistente personale, che gira su un tuo server e lavora sulle tue macchine con il tuo abbonamento a Claude (o a ChatGPT, con Codex).",
      "C'è una chat sola a cui chiedi qualunque cosa, la Home, e ci sono i progetti per i lavori lunghi. Queste schede ti dicono da dove cominciare; puoi rileggerle dal menu delle pagine.",
    ],
  },
  {
    titolo: "La Home",
    testo: [
      "Chiedile ciò che vuoi: una ricerca, uno script, un documento, un'azione su un PC. I lavori che si chiudono in una seduta li fa lei.",
      "Ogni questione è un argomento: quando cambi discorso lo archivia con un titolo, e lo ritrovi nella barra laterale. Con il fumetto in alto apri una chat parallela, che lavora mentre l'altra lavora.",
      "Le scrivi anche da Telegram, e le chiedi lavori programmati: «ogni mattina controlla i backup».",
    ],
    prova: "Che cosa sai fare? Fammi tre esempi pratici per me.",
  },
  {
    titolo: "I progetti",
    testo: [
      "Per un lavoro lungo (un'app, un sito, un gioco) la Home ti propone un progetto: una cartella con il suo repository Git, in un ambiente, con la sua conversazione.",
      "Accanto alla chat di un progetto hai le modifiche ai file, i file, il terminale e l'anteprima dell'applicazione. Nella scheda della sessione scegli modello, permessi ed estensioni, e chi implementa, se vuoi affidare l'implementazione a un altro modello.",
    ],
    pagina: { nome: "Nuovo progetto", indirizzo: frammentoDi({ tipo: "nuovo-progetto" }) },
  },
  {
    titolo: "Gli ambienti",
    testo: [
      "Un ambiente è una macchina su cui Shinka lavora: il server su cui gira e, se vuoi, i tuoi PC Windows o Linux. Si aggiunge con un comando di una riga, dalla pagina Ambienti nel menu delle pagine.",
      "Di ogni ambiente vedi processore, memoria, disco, processi e container. Su Windows il nodo ha un'icona nell'area di notifica e, se vuoi, parte con Windows.",
    ],
    prova: "Come aggiungo il mio PC come ambiente?",
  },
  {
    titolo: "Le estensioni",
    testo: [
      "Le estensioni danno strumenti in più: server MCP (Notion, il browser, un database…), plugin di Claude Code e modelli locali, come Qwen sulla scheda video di un PC, da scegliere come modello di un progetto o della Home.",
      "Ci sono anche le estensioni dell'interfaccia: temi, pagine e pulsanti che la Home scrive per te. Ogni estensione la chiedi alla Home: ti mostra una scheda, e nulla si installa finché non confermi.",
    ],
    prova: "Quali estensioni mi consigli, e come si aggiunge un modello locale?",
    pagina: { nome: "Estensioni", indirizzo: frammentoDi({ tipo: "estensioni" }) },
  },
  {
    titolo: "Le tue chiavi restano tue",
    testo: [
      "Password e chiavi stanno nel vault, in un gateway separato: le conversazioni le usano per nome e non ne vedono il valore. Pagare, cambiare password e cancellare account sono vietati, sempre.",
      "Ogni azione che cambia qualcosa segue il modo dei permessi che scegli tu, chat per chat: Approva e Nega, oppure «Approva sempre» per le cose che fai spesso.",
    ],
    pagina: { nome: "Vault", indirizzo: frammentoDi({ tipo: "vault" }) },
  },
  {
    titolo: "Shinka si sviluppa da sé",
    testo: [
      "Se a Shinka manca qualcosa, chiedilo alla Home: ti propone uno sviluppo, e se lo confermi il progetto Shinka lo scrive, con le sue prove.",
      "Una versione nuova entra in funzione solo dopo che tutte le prove sono passate e tu l'hai approvata dalla scheda; se non parte, torna da sola quella di prima.",
    ],
    prova: "Vorrei che Shinka facesse… (scrivi tu che cosa)",
  },
];

export function PaginaPresentazione({ menu }: { menu: ReactNode }): ReactNode {
  const [passo, setPasso] = useState(0);
  const [copiato, setCopiato] = useState(false);
  const corrente = PASSI_PRESENTAZIONE[passo] ?? PASSI_PRESENTAZIONE[0];
  const ultimo = passo === PASSI_PRESENTAZIONE.length - 1;

  useEffect(() => {
    document.title = "Presentazione · Shinka";
  }, []);
  useEffect(() => setCopiato(false), [passo]);

  if (corrente === undefined) return null;
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>Presentazione</h1>
          <span className="sottotitolo">
            {passo + 1} di {PASSI_PRESENTAZIONE.length}
          </span>
        </div>
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-presentazione">
          <ol className="tappe-presentazione" aria-label="Le schede">
            {PASSI_PRESENTAZIONE.map((uno, posto) => (
              <li key={uno.titolo}>
                <button type="button" className={posto === passo ? "tappa attuale" : "tappa"} aria-current={posto === passo ? "step" : undefined} aria-label={uno.titolo} onClick={() => setPasso(posto)} />
              </li>
            ))}
          </ol>
          <section className="scheda-presentazione" aria-live="polite">
            <h2>{corrente.titolo}</h2>
            {corrente.testo.map((riga) => (
              <p key={riga}>{riga}</p>
            ))}
            {corrente.prova !== undefined && (
              <div className="prova-presentazione">
                <span className="tenue">Prova a chiedere alla Home:</span>
                <q>{corrente.prova}</q>
                <button
                  type="button"
                  className="mini discreto"
                  onClick={() => {
                    void navigator.clipboard?.writeText(corrente.prova ?? "").then(() => setCopiato(true), () => {});
                  }}
                >
                  {copiato ? "Copiato" : "Copia"}
                </button>
              </div>
            )}
            {corrente.pagina !== undefined && (
              <a className="pagina-presentazione-collegamento" href={corrente.pagina.indirizzo}>
                Apri {corrente.pagina.nome}
              </a>
            )}
          </section>
          <div className="pulsanti presentazione-pulsanti">
            <button type="button" className="discreto" onClick={() => vaiA({ tipo: "home" })}>
              Salta
            </button>
            <span className="spazio" />
            {passo > 0 && (
              <button type="button" onClick={() => setPasso(passo - 1)}>
                Indietro
              </button>
            )}
            {ultimo ? (
              <button type="button" className="approva" onClick={() => vaiA({ tipo: "home" })}>
                Vai alla Home
              </button>
            ) : (
              <button type="button" className="approva" onClick={() => setPasso(passo + 1)}>
                Avanti
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
