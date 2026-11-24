/**
 * Shinka Desktop e il centro (ADR 0049): il protocollo dei clienti e la versione pubblicata.
 */

/**
 * Il protocollo che il centro parla con i clienti come Shinka Desktop, in `/api/stato`. Cresce di
 * uno solo quando un cambio a rotte o eventi rompe un cliente fatto per il protocollo di prima: le
 * aggiunte che un cliente vecchio può ignorare non lo cambiano. Un cliente che vede un protocollo
 * più alto del suo smette di scrivere, avvisa e cerca un aggiornamento: per questo un cambio di
 * protocollo si rilascia pubblicando prima il cliente nuovo, e solo dopo il centro.
 */
export const PROTOCOLLO_DEI_CLIENTI = 1;

/** La versione di Shinka Desktop che il centro serve, se ce n'è una. */
export interface StatoDesktop {
  pubblicata?: {
    versione: string;
    /** Quando è stata pubblicata. */
    quando: string;
    /** I byte dell'installer. */
    dimensione: number;
  };
  /** Le cartelle da cui si può pubblicare. */
  fonti?: FonteDiPubblicazione[];
}

/**
 * Da dove si può pubblicare: la cartella di un progetto, o una sua cartella collegata in un altro
 * ambiente (ADR 0050). Le dice il centro nello stato.
 */
export interface FonteDiPubblicazione {
  idProgetto: string;
  nomeProgetto: string;
  /** Presente per una cartella collegata: l'ambiente in cui sta. */
  idAmbiente?: string;
  nomeAmbiente: string;
  cartella: string;
}

/** Ciò che serve per pubblicare una versione: da quale progetto e cartella, e la password di Shinka. */
export interface RichiestaDiPubblicazione {
  idProgetto: string;
  /** Per pubblicare da una cartella collegata del progetto: l'ambiente in cui sta. */
  idAmbiente?: string;
  /** La cartella, dentro il progetto, in cui electron-builder ha messo latest.yml, l'installer e il .blockmap. */
  cartella: string;
  password: string;
}
