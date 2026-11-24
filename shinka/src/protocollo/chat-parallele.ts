/**
 * Le chat parallele (ADR 0052): altre conversazioni aperte in schede accanto alla principale, nella
 * Home e in un progetto. Ciascuna ha un numero: 1 è la principale, le parallele vanno da 2 a 4.
 */

/** Quante chat può avere aperte una conversazione, la principale compresa. */
export const CHAT_MASSIME = 4;

/** Il numero della chat principale. */
export const CHAT_PRINCIPALE = 1;

/** Ciò che separa, nell'identificativo della conversazione di una chat parallela, il progetto dalla chat. */
const SEGNO_CHAT = "~chat-";

/** Vero se il numero è quello di una chat parallela. */
export function eNumeroDiChatParallela(numero: unknown): numero is number {
  return typeof numero === "number" && Number.isInteger(numero) && numero > CHAT_PRINCIPALE && numero <= CHAT_MASSIME;
}

/** L'identificativo della conversazione di una chat di un progetto: per la principale, quello del progetto. */
export function conversazioneDellaChat(idProgetto: string, numero: number): string {
  return numero === CHAT_PRINCIPALE ? idProgetto : `${idProgetto}${SEGNO_CHAT}${numero}`;
}

/** Il numero della chat di una conversazione di progetto: 1 se è la principale, o se non è una chat. */
export function numeroDellaChat(idConversazione: string): number {
  const trovato = /~chat-(\d+)$/.exec(idConversazione);
  const numero = trovato === null ? CHAT_PRINCIPALE : Number(trovato[1]);
  return eNumeroDiChatParallela(numero) ? numero : CHAT_PRINCIPALE;
}

/** Vero se la conversazione è una chat parallela di un progetto. */
export function eChatParallela(idConversazione: string): boolean {
  return numeroDellaChat(idConversazione) !== CHAT_PRINCIPALE;
}

/** Il primo numero libero per una chat parallela, se ce n'è uno. */
export function primoNumeroLibero(aperte: readonly number[]): number | undefined {
  for (let numero = CHAT_PRINCIPALE + 1; numero <= CHAT_MASSIME; numero += 1) {
    if (!aperte.includes(numero)) return numero;
  }
  return undefined;
}
