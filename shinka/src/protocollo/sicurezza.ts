/**
 * La pagina Sicurezza (ADR 0039): le sessioni aperte del proprietario e il registro delle richieste
 * al centro. Qui ciò che centro e interfaccia si dicono.
 */

export const TIPI_ACCESSO = [
  "entrata",
  "entrata-fallita",
  "entrata-frenata",
  "uscita",
  "password-cambiata",
  "password-non-cambiata",
  "primo-avvio",
  "primo-avvio-fallito",
  "sessione-chiusa",
  "senza-sessione",
  "origine-rifiutata",
  "pagina-inesistente",
  "evento-accolto",
  "evento-rifiutato",
  "ambiente-preparato",
  "invito-rifiutato",
  "nodo-presentato",
  "nodo-in-chiaro",
  "copia-preparata",
  "copia-caricata",
  "trasloco",
  "ripristino-chiesto",
  "ripristino-rifiutato",
  "dispositivo-aggiunto",
  "dispositivo-non-aggiunto",
  "dispositivo-tolto",
  "dispositivo-rifiutato",
  "desktop-pubblicato",
  "desktop-non-pubblicato",
  "richiesta-estensione",
  "richiesta-estensione-rifiutata",
] as const;
export type TipoAccesso = (typeof TIPI_ACCESSO)[number];

/** Ciò che merita uno sguardo: qualcuno ha provato qualcosa che non gli è riuscito. */
export const DA_GUARDARE: readonly TipoAccesso[] = [
  "entrata-fallita",
  "entrata-frenata",
  "password-non-cambiata",
  "primo-avvio-fallito",
  "senza-sessione",
  "origine-rifiutata",
  "pagina-inesistente",
  "evento-rifiutato",
  "invito-rifiutato",
  "nodo-in-chiaro",
  "ripristino-rifiutato",
  "dispositivo-non-aggiunto",
  "dispositivo-rifiutato",
  "desktop-non-pubblicato",
  "richiesta-estensione-rifiutata",
];

/** Una riga del registro delle richieste. */
export interface VoceAccesso {
  quando: string;
  tipo: TipoAccesso;
  /** L'indirizzo da cui è arrivata, con quello per conto di cui dice di arrivare. */
  da: string;
  programma?: string;
  /** Il percorso chiesto, senza ciò che segue il punto interrogativo. */
  percorso?: string;
  dettaglio?: string;
  /** Quante volte è successo, se più d'una, e fino a quando. */
  volte?: number;
  finoA?: string;
}

/** Una sessione come la vede la pagina Sicurezza: l'identificativo non serve a entrare. */
export interface SessioneInVista {
  id: string;
  apertaIl?: string;
  da?: string;
  programma?: string;
  vistaIl?: string;
  vistaDa?: string;
  scadeIl: string;
}

/** Che cos'è un dispositivo (ADR 0047): per ora solo l'app per il computer. */
export const GENERI_DISPOSITIVO = ["desktop"] as const;
export type GenereDispositivo = (typeof GENERI_DISPOSITIVO)[number];

/** Un dispositivo come lo vede la pagina Sicurezza: l'identificativo non serve a entrare. */
export interface DispositivoInVista {
  id: string;
  nome: string;
  genere: GenereDispositivo;
  aggiuntoIl: string;
  /** Da dove è stato aggiunto, e con che cosa. */
  da?: string;
  programma?: string;
  vistoIl?: string;
  vistoDa?: string;
  /** Se non viene più usato, decade da qui. */
  scadeIl: string;
}

/** Il collegamento dei nodi con il centro (ADR 0040). */
export interface CollegamentoDeiNodi {
  /** Vero se il centro accetta solo i nodi con il collegamento cifrato. */
  soloCifrati: boolean;
  /** L'impronta del certificato con cui il centro si fa riconoscere dai nodi; manca se non ne ha uno. */
  impronta?: string;
}

export interface StatoSicurezza {
  /** Manca in un centro che non ha ambienti oltre al suo. */
  nodi?: CollegamentoDeiNodi;
  /** L'identificativo della sessione di chi guarda. */
  questa?: string;
  sessioni: SessioneInVista[];
  /** I dispositivi con un gettone loro, come Shinka Desktop. */
  dispositivi?: DispositivoInVista[];
  /** L'identificativo del dispositivo di chi guarda, se guarda da un dispositivo. */
  questoDispositivo?: string;
  /** Le ultime righe del registro, dalla più recente. */
  voci: VoceAccesso[];
}

const IN_PAROLE: Record<TipoAccesso, string> = {
  entrata: "Entrata con la password",
  "entrata-fallita": "Password sbagliata",
  "entrata-frenata": "Entrata frenata: troppi tentativi",
  uscita: "Uscita",
  "password-cambiata": "Password cambiata",
  "password-non-cambiata": "Cambio della password rifiutato",
  "primo-avvio": "Primo avvio: password impostata",
  "primo-avvio-fallito": "Primo avvio: codice sbagliato",
  "sessione-chiusa": "Sessione chiusa",
  "senza-sessione": "Richiesta senza essere entrati",
  "origine-rifiutata": "Richiesta da un'altra pagina, rifiutata",
  "pagina-inesistente": "Pagina che non c'è",
  "evento-accolto": "Evento accolto",
  "evento-rifiutato": "Evento rifiutato",
  "ambiente-preparato": "Ambiente preparato con un invito",
  "invito-rifiutato": "Invito rifiutato",
  "nodo-presentato": "Nodo che si presenta",
  "nodo-in-chiaro": "Nodo in chiaro, non ascoltato",
  "copia-preparata": "Copia di sicurezza preparata",
  "copia-caricata": "Copia di sicurezza caricata",
  trasloco: "Memoria e skill portate da una copia",
  "ripristino-chiesto": "Ripristino dei dati da una copia",
  "ripristino-rifiutato": "Ripristino rifiutato: password sbagliata",
  "dispositivo-aggiunto": "Dispositivo aggiunto con la password",
  "dispositivo-non-aggiunto": "Dispositivo non aggiunto: password sbagliata",
  "dispositivo-tolto": "Dispositivo tolto",
  "dispositivo-rifiutato": "Richiesta con un gettone di dispositivo che non vale",
  "desktop-pubblicato": "Versione di Shinka Desktop pubblicata",
  "desktop-non-pubblicato": "Versione di Shinka Desktop non pubblicata",
  "richiesta-estensione": "Richiesta di un'estensione dell'interfaccia",
  "richiesta-estensione-rifiutata": "Richiesta di un'estensione dell'interfaccia, rifiutata",
};

/** Che cosa è successo, in parole per il proprietario. */
export function accessoInParole(tipo: TipoAccesso): string {
  return IN_PAROLE[tipo] ?? tipo;
}

const SETTE_GIORNI_MS = 7 * 24 * 60 * 60 * 1000;

/** Quante entrate e quanti tentativi non riusciti nell'ultima settimana, tra le voci lette. */
export function settimanaInBreve(voci: readonly VoceAccesso[], ora: number = Date.now()): { entrate: number; falliti: number } {
  const recenti = voci.filter((voce) => ora - Date.parse(voce.quando) < SETTE_GIORNI_MS);
  const somma = (tipi: readonly string[]): number => recenti.filter((voce) => tipi.includes(voce.tipo)).reduce((totale, voce) => totale + (voce.volte ?? 1), 0);
  return { entrate: somma(["entrata", "dispositivo-aggiunto"]), falliti: somma(["entrata-fallita", "entrata-frenata", "password-non-cambiata", "primo-avvio-fallito", "ripristino-rifiutato", "dispositivo-non-aggiunto"]) };
}
