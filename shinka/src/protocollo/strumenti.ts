/**
 * Gli strumenti che Shinka dà a ogni conversazione, della Home o di un progetto, in qualunque
 * ambiente: quelli per la memoria, per le skill, per le credenziali del vault, per il browser
 * del gateway e per gli stack di prova. Li esegue sempre il centro, dove memoria e skill stanno e da dove si raggiunge il
 * gateway; una conversazione che gira su un nodo glieli chiede attraverso il collegamento.
 *
 * Alcuni sono solo dei progetti: proporre al proprietario l'anteprima dell'applicazione, e dire
 * come la si avvia. Avviarla, fermarla e sapere com'è lo possono anche dalla Home, indicando il
 * progetto. Due sono solo del progetto Shinka: chiedere di installare la versione di Shinka che ha
 * appena scritto, e proporla al gateway.
 */

import type { Immagine } from "./allegati.ts";
import { ATTESA_AVVIO_MS } from "./applicazioni.ts";
import { SECONDI_AVVIO_STACK, SECONDI_OPERAZIONE_STACK } from "./stack.ts";
import { DURATA_INCARICO_MASSIMA_MS } from "./incarichi.ts";
import { APPROVAZIONE_MS, SECONDI_COMANDO_SU_HOST, SECONDI_COMANDO_SU_HOST_MASSIMI } from "./vault.ts";

/** Nome del gruppo: a Claude gli strumenti di Shinka compaiono come `mcp__shinka__…`. */
export const GRUPPO_STRUMENTI = "shinka";

export const STRUMENTI_COMUNI = [
  "ricorda",
  "correggi_memoria",
  "dimentica",
  "leggi_skill",
  "salva_skill",
  "elenca_credenziali",
  "leggi_credenziale",
  "salva_credenziale_in_chiaro",
  "esegui_su_host",
  "apri_sito",
  "leggi_sito",
  "agisci_nel_sito",
  "inserisci_credenziale",
  "chiudi_sito",
  "elenca_stack",
  "avvia_stack",
  "leggi_stack",
  "ferma_stack",
  "rimuovi_stack",
  "proponi_anteprima",
  "imposta_anteprima",
  "avvia_anteprima",
  "ferma_anteprima",
  "stato_anteprima",
  "chiedi_installazione",
  "aggiorna_gateway",
  "programma_lavoro",
  "elenca_programmati",
  "togli_programmato",
  "cartelle_collegate",
  "esegui_nella_collegata",
  "leggi_nella_collegata",
  "scrivi_nella_collegata",
  "modifica_nella_collegata",
  "affida_incarico",
] as const;

export type StrumentoComune = (typeof STRUMENTI_COMUNI)[number];

/**
 * Tra gli strumenti comuni, quelli che non chiedono il consenso del proprietario: memoria e skill
 * sono compiti che Shinka dà a Claude, l'elenco delle credenziali dice solo i nomi, il valore di
 * una credenziale in chiaro il proprietario ha scelto che Claude lo legga senza chiedere, e
 * salvarne una nuova mostra una scheda con cui decide lui (ADR 0034), rileggere o
 * chiudere la pagina già aperta nel browser non cambia nulla, e proporre l'anteprima mette solo un
 * pulsante nella conversazione: ad aprirla è il proprietario. Chiedere di installare una versione
 * di Shinka la prepara e la prova su una copia, e poi mostra una scheda: a decidere è lui. Proporre al
 * gateway una versione nuova non la installa: il sì lo chiede il gateway al proprietario. Gli stack di prova Claude li gestisce
 * da sé: a tenerli nel loro recinto è il gateway, nel momento in cui esegue. Eseguire un comando
 * su un host, aprire un sito, agire in una pagina e inserirvi una credenziale seguono invece il
 * modo dei permessi della conversazione. Proporre un lavoro programmato mostra una scheda, con cui
 * decide il proprietario (ADR 0035); toglierne uno segue il modo dei permessi. Affidare un incarico
 * non chiede nulla: è chi implementa a chiedere, per ogni sua azione, ciò che il modo dei permessi
 * del progetto vuole (ADR 0051).
 */
const CON_RICHIESTA: readonly StrumentoComune[] = [
  "esegui_su_host",
  "apri_sito",
  "agisci_nel_sito",
  "inserisci_credenziale",
  "imposta_anteprima",
  "togli_programmato",
  // Nelle cartelle collegate, come nella cartella del progetto: comandi e file scritti seguono il
  // modo dei permessi; leggere e sapere quali sono no (ADR 0050).
  "esegui_nella_collegata",
  "scrivi_nella_collegata",
  "modifica_nella_collegata",
];

export const STRUMENTI_COMUNI_SENZA_RICHIESTA: readonly StrumentoComune[] = STRUMENTI_COMUNI.filter(
  (nome) => !CON_RICHIESTA.includes(nome),
);

/**
 * Tra gli strumenti comuni, quelli che hanno solo le conversazioni dei progetti: la Home non ha
 * un'applicazione da mostrare, e una versione di Shinka la chiede solo il progetto Shinka.
 */
export const STRUMENTI_SOLO_DEI_PROGETTI: readonly StrumentoComune[] = [
  "proponi_anteprima",
  "imposta_anteprima",
  "chiedi_installazione",
  "aggiorna_gateway",
  "cartelle_collegate",
  "esegui_nella_collegata",
  "leggi_nella_collegata",
  "scrivi_nella_collegata",
  "modifica_nella_collegata",
  "affida_incarico",
];

/** Gli strumenti che passano dal browser del gateway. */
const DEL_BROWSER: readonly StrumentoComune[] = ["apri_sito", "leggi_sito", "agisci_nel_sito", "inserisci_credenziale", "chiudi_sito"];

/** Gli strumenti degli stack di prova. */
const DEGLI_STACK: readonly StrumentoComune[] = ["elenca_stack", "avvia_stack", "leggi_stack", "ferma_stack", "rimuovi_stack"];

/**
 * Quanto può durare al massimo un'operazione su uno stack: l'avvio può dover scaricare
 * un'immagine, e prima e dopo il gateway guarda che cosa c'è sull'host.
 */
export function attesaDelloStack(avvio: boolean): number {
  return ((avvio ? SECONDI_AVVIO_STACK : SECONDI_OPERAZIONE_STACK) + 3 * SECONDI_OPERAZIONE_STACK) * 1000;
}

/** Quanto può durare al massimo un'operazione del browser del gateway. */
export const ATTESA_BROWSER_MS = 75_000;

export function eStrumentoComune(nome: unknown): nome is StrumentoComune {
  return typeof nome === "string" && (STRUMENTI_COMUNI as readonly string[]).includes(nome);
}

/** Il nome con cui l'harness conosce uno strumento di Shinka. */
export function nomePerHarness(nome: string): string {
  return `mcp__${GRUPPO_STRUMENTI}__${nome}`;
}

/** Ciò che uno strumento risponde a Claude. */
export interface EsitoStrumento {
  testo: string;
  /** Presente quando lo strumento non ha potuto fare ciò che gli era stato chiesto. */
  errore?: true;
  /** Un'immagine che Claude vede insieme al testo: la pagina aperta nel browser del gateway. */
  immagine?: Immagine;
}

/** Chiede al centro di eseguire uno strumento comune per conto di una conversazione. */
export type ChiamaStrumento = (nome: StrumentoComune, argomenti: Record<string, unknown>) => Promise<EsitoStrumento>;

/** Quanto una conversazione su un nodo aspetta la risposta del centro a uno strumento. */
export const ATTESA_STRUMENTO_MS = 30_000;

/**
 * Quanto aspettare la risposta a uno strumento usato con questi argomenti: un comando su un host
 * può durare a lungo, e così una pagina lenta: chi li aspetta deve dargli il loro tempo più un margine.
 */
export function attesaDelloStrumento(nome: StrumentoComune, argomenti: Record<string, unknown>, base: number = ATTESA_STRUMENTO_MS): number {
  if (DEL_BROWSER.includes(nome)) return ATTESA_BROWSER_MS + base;
  if (DEGLI_STACK.includes(nome)) return attesaDelloStack(nome === "avvia_stack") + base;
  // L'avvio dell'applicazione aspetta che risponda sulla sua porta.
  if (nome === "avvia_anteprima") return ATTESA_AVVIO_MS + base;
  // Salvare una credenziale in chiaro aspetta il sì del proprietario.
  if (nome === "salva_credenziale_in_chiaro" || nome === "programma_lavoro") return APPROVAZIONE_MS + base;
  // Un incarico aspetta che chi implementa finisca, con i permessi che chiede strada facendo.
  if (nome === "affida_incarico") return DURATA_INCARICO_MASSIMA_MS + base;
  if (nome === "esegui_nella_collegata") {
    const secondi = typeof argomenti.secondi === "number" && Number.isFinite(argomenti.secondi) ? argomenti.secondi : 120;
    return Math.min(Math.max(secondi, 1), 600) * 1000 + base;
  }
  if (nome !== "esegui_su_host") return base;
  const chiesti = typeof argomenti.secondi === "number" && Number.isFinite(argomenti.secondi) ? argomenti.secondi : SECONDI_COMANDO_SU_HOST;
  // Su un host per gli stack il comando aspetta prima l'approvazione del proprietario.
  return Math.min(Math.max(chiesti, 1), SECONDI_COMANDO_SU_HOST_MASSIMI) * 1000 + APPROVAZIONE_MS + base;
}
