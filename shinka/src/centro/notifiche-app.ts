/**
 * Solo i tipi che la pagina legge da `src/centro/notifiche-app.ts` di Shinka: qui il centro non
 * c'è, e la pagina ne importa soltanto la forma.
 */
import type { ScelteAvvisi } from "../protocollo/avvisi.ts";

/** Un avviso da mostrare sul dispositivo. */
export interface AvvisoApp {
  titolo: string;
  corpo: string;
  /** Dove porta il tocco sulla notifica: la parte dell'indirizzo dopo il cancelletto, come "/progetti/…"; vuoto per la Home. */
  vai?: string;
  /** Vero se qualcosa aspetta il proprietario. */
  urgente?: boolean;
  /** Quante cose aspettano il proprietario. */
  distintivo?: number;
}

/** Un dispositivo iscritto, come lo vede la pagina. */
export interface DispositivoIscritto {
  endpoint: string;
  nome: string;
  iscrittoIl: string;
  problema?: string;
}

export interface StatoNotifiche {
  chiave: string;
  dispositivi: DispositivoIscritto[];
  contatto: string;
  contattoGenerico: boolean;
  scelte: ScelteAvvisi;
}
