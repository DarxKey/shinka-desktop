/**
 * Le chat parallele (ADR 0052): le schede sopra la chat della Home e di un progetto. La principale
 * ha il numero 1; le altre si aprono con «Nuova chat» e si chiudono con la ×. Nella Home chiudere
 * archivia l'argomento della chat; in un progetto ne cancella la storia, e lo chiede prima.
 */

import { useState, type ReactNode } from "react";
import { CHAT_MASSIME } from "../../src/protocollo/chat-parallele.ts";
import type { CondizioneProgetto } from "../../src/protocollo/progetti.ts";
import { apriChatParallela, chiudiChatParallela } from "./api.ts";
import { condizioneInParole } from "./descrivi.ts";

/** Una chat parallela aperta, con la sua condizione. */
export interface ChatAperta {
  numero: number;
  condizione: CondizioneProgetto;
}

/** Dove questo browser ricorda quale chat era scelta, per la Home o per un progetto. */
function chiaveScelta(idProgetto: string | undefined): string {
  return `shinka.chat.${idProgetto ?? "home"}`;
}

/** La chat scelta l'ultima volta in questo browser: la principale se non lo ricorda. */
export function leggiChatScelta(idProgetto: string | undefined): number {
  try {
    const letto = Number(window.localStorage.getItem(chiaveScelta(idProgetto)));
    return Number.isInteger(letto) && letto >= 1 && letto <= CHAT_MASSIME ? letto : 1;
  } catch {
    return 1;
  }
}

export function scriviChatScelta(idProgetto: string | undefined, numero: number): void {
  try {
    if (numero === 1) window.localStorage.removeItem(chiaveScelta(idProgetto));
    else window.localStorage.setItem(chiaveScelta(idProgetto), String(numero));
  } catch {
    // Senza memoria del browser si riparte dalla principale: non è grave.
  }
}

/** Il pulsante della testata che apre una chat parallela; nulla se sono già tutte aperte. */
export function PulsanteNuovaChat({
  idProgetto,
  aperte,
  allApertura,
}: {
  idProgetto?: string;
  aperte: readonly ChatAperta[];
  allApertura: (numero: number) => void;
}): ReactNode {
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string>();
  if (aperte.length >= CHAT_MASSIME - 1) return null;
  return (
    <button
      type="button"
      className="discreto icona nuova-chat"
      aria-label="Nuova chat parallela"
      title={errore ?? "Nuova chat parallela: un'altra conversazione accanto a questa, che lavora anche mentre questa lavora"}
      disabled={inCorso}
      onClick={() => {
        setInCorso(true);
        setErrore(undefined);
        apriChatParallela(idProgetto)
          .then(allApertura)
          .catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "La chat non si è aperta."))
          .finally(() => setInCorso(false));
      }}
    >
      {/* Un fumetto con un più: un'altra chat. */}
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5z" />
        <path d="M10 7.2v4.6M7.7 9.5h4.6" />
      </svg>
    </button>
  );
}

/** Le schede: la principale e le chat parallele aperte. Nulla se non ce n'è nessuna aperta. */
export function SchedeDelleChat({
  idProgetto,
  aperte,
  scelta,
  allaScelta,
}: {
  idProgetto?: string;
  aperte: readonly ChatAperta[];
  scelta: number;
  allaScelta: (numero: number) => void;
}): ReactNode {
  const [daConfermare, setDaConfermare] = useState<number>();
  const [errore, setErrore] = useState<string>();
  if (aperte.length === 0) return null;

  const chiudi = (numero: number): void => {
    setDaConfermare(undefined);
    setErrore(undefined);
    if (scelta === numero) allaScelta(1);
    chiudiChatParallela(numero, idProgetto).catch((causa: unknown) => setErrore(causa instanceof Error ? causa.message : "La chat non si è chiusa."));
  };

  return (
    <nav className="schede-chat" aria-label="Chat">
      <span className="scheda-chat" aria-current={scelta === 1}>
        <button type="button" className="nome-scheda" onClick={() => allaScelta(1)}>
          Principale
        </button>
      </span>
      {aperte.map((chat) => (
        <span key={chat.numero} className="scheda-chat" aria-current={scelta === chat.numero}>
          <button
            type="button"
            className="nome-scheda"
            title={chat.condizione === "fermo" ? undefined : condizioneInParole(chat.condizione)}
            onClick={() => allaScelta(chat.numero)}
          >
            {chat.condizione !== "fermo" && <span className={`pallino-scheda ${chat.condizione}`} aria-label={condizioneInParole(chat.condizione)} />}
            Chat {chat.numero}
          </button>
          {daConfermare === chat.numero ? (
            <span className="conferma-chiusura-chat">
              <span className="tenue">La sua storia si cancella.</span>
              <button type="button" className="mini" onClick={() => chiudi(chat.numero)}>
                Chiudi
              </button>
              <button type="button" className="mini discreto" onClick={() => setDaConfermare(undefined)}>
                Annulla
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="chiudi-scheda"
              aria-label={`Chiudi la chat ${chat.numero}`}
              title={
                idProgetto === undefined
                  ? "Chiudi la chat: il suo argomento va tra gli archiviati, con titolo e riassunto"
                  : "Chiudi la chat: la sua storia si cancella, e restano i file"
              }
              onClick={() => (idProgetto === undefined ? chiudi(chat.numero) : setDaConfermare(chat.numero))}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {errore !== undefined && (
        <span className="errore" role="alert">
          {errore}
        </span>
      )}
    </nav>
  );
}
