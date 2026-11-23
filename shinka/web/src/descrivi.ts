/** Come presentare le cose in poche parole: le azioni di Claude, i progetti, le cartelle. */

import { percorsoValido, portaValida } from "../../src/protocollo/anteprima.ts";
import type { VoceArgomento } from "../../src/protocollo/argomenti.ts";
import type { CondizioneProgetto } from "../../src/protocollo/progetti.ts";
import type { VaultInBreve } from "../../src/protocollo/vault.ts";
import { STRUMENTO_ANTEPRIMA } from "../../src/protocollo/azioni-in-parole.ts";

export { comandoSuHost, dettaglioDi, etichettaDi, STRUMENTO_ANTEPRIMA } from "../../src/protocollo/azioni-in-parole.ts";

/** La porta e la pagina che Claude ha proposto di guardare, se la proposta è riuscita. */
export function anteprimaProposta(azione: {
  strumento: string;
  ingresso: unknown;
  conclusa: boolean;
  errore?: boolean;
}): { porta: number; percorso: string } | undefined {
  if (azione.strumento !== STRUMENTO_ANTEPRIMA || !azione.conclusa || azione.errore === true) return undefined;
  if (typeof azione.ingresso !== "object" || azione.ingresso === null) return undefined;
  const { porta, percorso } = azione.ingresso as Record<string, unknown>;
  if (!portaValida(porta)) return undefined;
  return { porta, percorso: percorsoValido(percorso) ? percorso : "/" };
}

/** L'indirizzo da cui il browser vede l'anteprima: lo stesso host di Shinka, sulla porta dell'anteprima. */
export function indirizzoAnteprima(qui: { protocol: string; hostname: string }, porta: number, percorso: string): string {
  return `${qui.protocol}//${qui.hostname}:${porta}${percorso}`;
}

/** Ciò che Ctrl fa del tasto battuto subito dopo: Ctrl e C diventano il carattere 3, e così via. */
export function conCtrl(dati: string): string {
  if (dati.length !== 1) return dati;
  const codice = dati.toUpperCase().charCodeAt(0);
  return codice >= 64 && codice <= 95 ? String.fromCharCode(codice - 64) : dati;
}

function semplifica(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Gli argomenti che nel titolo o nel riassunto contengono tutte le parole cercate. */
export function filtraArgomenti(argomenti: VoceArgomento[], cercato: string): VoceArgomento[] {
  const parole = semplifica(cercato).split(/\s+/).filter((parola) => parola !== "");
  if (parole.length === 0) return argomenti;
  return argomenti.filter((argomento) => {
    const dove = semplifica(`${argomento.titolo}\n${argomento.riassunto}`);
    return parole.every((parola) => dove.includes(parola));
  });
}

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** Un giorno in breve, nell'ora di chi guarda: "11 nov", con l'anno se non è quello in corso. */
export function giornoInBreve(quando: string, ora: Date = new Date()): string {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return "";
  const giorno = `${data.getDate()} ${MESI[data.getMonth()]}`;
  return data.getFullYear() === ora.getFullYear() ? giorno : `${giorno} ${data.getFullYear()}`;
}

const CONDIZIONI: Record<CondizioneProgetto, string> = {
  "al-lavoro": "al lavoro",
  "aspetta-te": "aspetta te",
  fermo: "fermo",
  "ambiente-spento": "ambiente spento",
};

/** La condizione di un progetto, in una parola o due. */
export function condizioneInParole(condizione: CondizioneProgetto): string {
  return CONDIZIONI[condizione];
}

/**
 * Il percorso che avrà la cartella di un progetto, scritto come lo scrive il suo ambiente:
 * con la barra rovesciata se la cartella dei progetti è di Windows, con quella dritta altrimenti.
 */
export function cartellaPrevista(radiceProgetti: string, nomeCartella: string): string {
  const diWindows = /^[A-Za-z]:|\\/.test(radiceProgetti);
  const separatore = diWindows ? "\\" : "/";
  const radice = radiceProgetti.replace(/[\\/]+$/, "");
  return `${radice}${separatore}${nomeCartella}`;
}

/** Giorno e ora in breve, nell'ora di chi guarda: "11 nov, 18:05". */
export function momentoInBreve(quando: string, ora: Date = new Date()): string {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return "";
  const minuti = String(data.getMinutes()).padStart(2, "0");
  return `${giornoInBreve(quando, ora)}, ${data.getHours()}:${minuti}`;
}

/** La dimensione di un file in breve: "820 byte", "12 kB", "3,4 MB". */
export function pesoInBreve(byte: number): string {
  if (byte < 1000) return `${byte} byte`;
  if (byte < 1_000_000) return `${Math.round(byte / 1000)} kB`;
  const mega = byte / 1_000_000;
  return `${(mega < 10 ? mega.toFixed(1) : String(Math.round(mega))).replace(".", ",")} MB`;
}

/** Una quantità di memoria o di disco, in parole: "512 MB", "16,1 GB", "12,7 TB". */
export function grandezzaInBreve(byte: number): string {
  const scala = (valore: number, unita: string): string => `${valore.toLocaleString("it-IT", { maximumFractionDigits: valore < 100 ? 1 : 0 })} ${unita}`;
  if (byte >= 1024 ** 4) return scala(byte / 1024 ** 4, "TB");
  if (byte >= 1024 ** 3) return scala(byte / 1024 ** 3, "GB");
  return scala(byte / 1024 ** 2, "MB");
}

/** L'ora in breve, nell'ora di chi guarda: "18:05". */
export function oraInBreve(quando: string): string {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return "";
  return `${data.getHours()}:${String(data.getMinutes()).padStart(2, "0")}`;
}

/** Le skill create o cambiate dopo l'ultima volta che il proprietario ha guardato la pagina Skill. */
export function skillNonViste<T extends { nome: string; modificataIl: string }>(skill: readonly T[], visteFinoA: number): T[] {
  return skill.filter((voce) => {
    const quando = Date.parse(voce.modificataIl);
    return Number.isFinite(quando) && quando > visteFinoA;
  });
}

/** Il vault in una parola, per la barra laterale; nulla se non c'è niente da dire. */
export function vaultInBreve(vault: VaultInBreve | undefined): string | undefined {
  if (vault === undefined || vault.gateway === "non-configurato") return undefined;
  if (vault.gateway === "irraggiungibile") return "non risponde";
  if (vault.condizione === "da-impostare") return "da impostare";
  if (vault.condizione === "chiuso") return "chiuso";
  return String(vault.quante);
}

/** Sistema e ciò che l'ambiente offre, in una riga. */
export function sottotitoloAmbiente(sistema: string, descrizione: string): string {
  return descrizione === "" ? sistema : `${sistema} · ${descrizione}`;
}

/** Che cosa dire della versione di Shinka in un ambiente, sotto il suo nome; nulla se non c'è niente da dire. */
export function versioneAmbiente(ambiente: {
  attivo: boolean;
  delCentro: boolean;
  versione?: string;
  indietro?: boolean;
}): string | undefined {
  if (!ambiente.attivo) return undefined;
  if (ambiente.delCentro || ambiente.indietro !== true) {
    return ambiente.versione === undefined ? undefined : `Versione ${ambiente.versione}`;
  }
  return ambiente.versione === undefined
    ? "Non dice a che versione è: può essere indietro rispetto al centro"
    : `Versione ${ambiente.versione} · indietro rispetto al centro`;
}

/** Che cosa dire del collegamento di un nodo con il centro; nulla per l'ambiente del centro e per un nodo spento. */
export function collegamentoAmbiente(ambiente: { attivo: boolean; delCentro: boolean; cifrato?: boolean }): { testo: string; inChiaro: boolean } | undefined {
  if (!ambiente.attivo || ambiente.delCentro || ambiente.cifrato === undefined) return undefined;
  return ambiente.cifrato ? { testo: "Collegamento cifrato", inChiaro: false } : { testo: "Collegamento in chiaro: il nodo non è ancora passato a quello cifrato", inChiaro: true };
}

/** Le migliaia di token in breve: 46200 diventa "46k". */
export function inMigliaia(token: number): string {
  return token < 1000 ? String(token) : `${Math.round(token / 1000)}k`;
}

/** Quando riparte una finestra di utilizzo, in parole brevi. */
export function quandoRiparte(azzeraIl: string | undefined, ora: number = Date.now()): string {
  if (azzeraIl === undefined) return "";
  const mancano = new Date(azzeraIl).getTime() - ora;
  if (!Number.isFinite(mancano) || mancano <= 0) return "";
  const minuti = Math.round(mancano / 60_000);
  if (minuti < 60) return `riparte tra ${minuti} min`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return `riparte tra ${ore} h`;
  return `riparte tra ${Math.round(ore / 24)} giorni`;
}
