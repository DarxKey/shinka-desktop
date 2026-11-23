/**
 * L'anteprima dell'applicazione web di un progetto: ciò che il centro chiede a chi sta
 * nell'ambiente, ciò che ne torna, e ciò che l'interfaccia ne sa. Sono dati semplici.
 *
 * L'applicazione ascolta su una porta di `localhost` nell'ambiente del progetto. Il browser del
 * proprietario non la raggiunge direttamente: chiede al centro, su una porta a parte, e il centro
 * inoltra ogni richiesta a chi sta in quell'ambiente.
 */

/** La porta su cui il centro serve l'anteprima, se non ne viene indicata un'altra. */
export const PORTA_ANTEPRIMA = 7852;

/** Quanto può pesare il corpo di una richiesta inoltrata all'applicazione. */
export const CORPO_ANTEPRIMA_MASSIMO = 8 * 1024 * 1024;

/** Quanto pesa al massimo un pezzo di risposta, prima di essere scritto in base64. */
export const PEZZO_ANTEPRIMA = 192 * 1024;

/** Quanto pesa al massimo un messaggio che viaggia su un collegamento aperto dall'applicazione. */
export const MESSAGGIO_ANTEPRIMA_MASSIMO = 4 * 1024 * 1024;

/** Intestazioni come coppie: un nome può comparire più volte. */
export type Intestazioni = [string, string][];

/** Ciò che il centro chiede a chi fa da tramite in un ambiente. */
export type ComandoAnteprima =
  /** Una richiesta HTTP per `localhost:porta`. Il corpo, se c'è, è in base64. */
  | {
      tipo: "anteprima-richiesta";
      idRichiesta: string;
      porta: number;
      metodo: string;
      percorso: string;
      intestazioni: Intestazioni;
      corpo?: string;
    }
  /** Chi aveva fatto la richiesta se n'è andato. */
  | { tipo: "anteprima-annulla"; idRichiesta: string }
  /** L'applicazione nel browser apre un WebSocket verso il suo server. */
  | { tipo: "anteprima-ws-apri"; idCanale: string; porta: number; percorso: string; protocolli: string[] }
  /** Un messaggio dal browser al server: testo, oppure binario in base64. */
  | { tipo: "anteprima-ws-manda"; idCanale: string; testo?: string; binario?: string }
  | { tipo: "anteprima-ws-chiudi"; idCanale: string };

/** Ciò che torna dall'ambiente. */
export type RiferitoAnteprima =
  | { tipo: "anteprima-inizio"; idRichiesta: string; stato: number; intestazioni: Intestazioni }
  /** Un pezzo del corpo della risposta, in base64. */
  | { tipo: "anteprima-pezzo"; idRichiesta: string; dati: string }
  | { tipo: "anteprima-fine"; idRichiesta: string }
  /** La richiesta non è arrivata in fondo: `motivo` lo dice al proprietario. */
  | { tipo: "anteprima-errore"; idRichiesta: string; motivo: string }
  | { tipo: "anteprima-ws-aperto"; idCanale: string; protocollo: string }
  | { tipo: "anteprima-ws-arrivo"; idCanale: string; testo?: string; binario?: string }
  | { tipo: "anteprima-ws-chiuso"; idCanale: string };

/** Chi fa da tramite verso le applicazioni di un ambiente, visto dal centro. */
export interface PortaAnteprima {
  esegui(comando: ComandoAnteprima): void;
}

/** L'anteprima come la vede l'interfaccia. */
export interface StatoAnteprima {
  /** La porta su cui il centro serve l'anteprima; nulla se in questa installazione non c'è. */
  porta: number | null;
  /** L'anteprima aperta in questo momento: una sola per tutto Shinka. */
  aperta?: { idProgetto: string; porta: number; percorso: string };
}

/** Una porta su cui può ascoltare l'applicazione di un progetto. */
export function portaValida(valore: unknown): valore is number {
  return typeof valore === "number" && Number.isInteger(valore) && valore >= 1 && valore <= 65535;
}

/** Il percorso da cui parte l'anteprima: comincia con una barra sola e non esce dal sito. */
/** Quanto è lungo al massimo il percorso della pagina da mostrare. */
export const PERCORSO_ANTEPRIMA_MASSIMO = 2000;

export function percorsoValido(valore: unknown): valore is string {
  return typeof valore === "string" && valore.length <= PERCORSO_ANTEPRIMA_MASSIMO && /^\/(?!\/)[^\s\\]*$/.test(valore);
}

function testo(campi: Record<string, unknown>, nome: string, massimo: number): string | undefined {
  const valore = campi[nome];
  return typeof valore === "string" && valore.length <= massimo ? valore : undefined;
}

function id(campi: Record<string, unknown>, nome: string): string | undefined {
  const valore = testo(campi, nome, 100);
  return valore === undefined || valore === "" ? undefined : valore;
}

function leggiIntestazioni(valore: unknown): Intestazioni | undefined {
  if (!Array.isArray(valore) || valore.length > 200) return undefined;
  const intestazioni: Intestazioni = [];
  for (const voce of valore as unknown[]) {
    if (!Array.isArray(voce) || voce.length !== 2) return undefined;
    const [nome, contenuto] = voce as unknown[];
    if (typeof nome !== "string" || typeof contenuto !== "string") return undefined;
    intestazioni.push([nome, contenuto]);
  }
  return intestazioni;
}

/** Testo oppure binario: un messaggio di WebSocket porta l'uno o l'altro. */
function leggiCarico(campi: Record<string, unknown>): { testo: string } | { binario: string } | undefined {
  // In base64 il peso cresce di un terzo.
  const scritto = testo(campi, "testo", MESSAGGIO_ANTEPRIMA_MASSIMO);
  if (scritto !== undefined) return { testo: scritto };
  const binario = testo(campi, "binario", Math.ceil(MESSAGGIO_ANTEPRIMA_MASSIMO / 3) * 4 + 4);
  return binario === undefined ? undefined : { binario };
}

/** Riconosce un comando per il tramite dell'anteprima; nulla se non è scritto come deve. */
export function leggiComandoAnteprima(campi: Record<string, unknown>): ComandoAnteprima | undefined {
  switch (campi.tipo) {
    case "anteprima-richiesta": {
      const idRichiesta = id(campi, "idRichiesta");
      const metodo = testo(campi, "metodo", 20);
      const percorso = testo(campi, "percorso", 16_000);
      const intestazioni = leggiIntestazioni(campi.intestazioni);
      const corpo = campi.corpo === undefined ? undefined : testo(campi, "corpo", Math.ceil(CORPO_ANTEPRIMA_MASSIMO / 3) * 4 + 4);
      if (idRichiesta === undefined || metodo === undefined || !/^[A-Z]+$/.test(metodo)) return undefined;
      if (!portaValida(campi.porta) || percorso === undefined || !percorso.startsWith("/") || intestazioni === undefined) {
        return undefined;
      }
      if (campi.corpo !== undefined && corpo === undefined) return undefined;
      return {
        tipo: "anteprima-richiesta",
        idRichiesta,
        porta: campi.porta,
        metodo,
        percorso,
        intestazioni,
        ...(corpo === undefined ? {} : { corpo }),
      };
    }
    case "anteprima-annulla": {
      const idRichiesta = id(campi, "idRichiesta");
      return idRichiesta === undefined ? undefined : { tipo: "anteprima-annulla", idRichiesta };
    }
    case "anteprima-ws-apri": {
      const idCanale = id(campi, "idCanale");
      const percorso = testo(campi, "percorso", 16_000);
      const protocolli = campi.protocolli;
      if (idCanale === undefined || !portaValida(campi.porta) || percorso === undefined || !percorso.startsWith("/")) {
        return undefined;
      }
      if (!Array.isArray(protocolli) || protocolli.length > 20 || !protocolli.every((p) => typeof p === "string" && p.length <= 200)) {
        return undefined;
      }
      return { tipo: "anteprima-ws-apri", idCanale, porta: campi.porta, percorso, protocolli: protocolli as string[] };
    }
    case "anteprima-ws-manda": {
      const idCanale = id(campi, "idCanale");
      const carico = leggiCarico(campi);
      if (idCanale === undefined || carico === undefined) return undefined;
      return { tipo: "anteprima-ws-manda", idCanale, ...carico };
    }
    case "anteprima-ws-chiudi": {
      const idCanale = id(campi, "idCanale");
      return idCanale === undefined ? undefined : { tipo: "anteprima-ws-chiudi", idCanale };
    }
    default:
      return undefined;
  }
}

/** Riconosce ciò che un ambiente riferisce dell'anteprima; nulla se non è scritto come deve. */
export function leggiRiferitoAnteprima(campi: Record<string, unknown>): RiferitoAnteprima | undefined {
  switch (campi.tipo) {
    case "anteprima-inizio": {
      const idRichiesta = id(campi, "idRichiesta");
      const intestazioni = leggiIntestazioni(campi.intestazioni);
      const stato = campi.stato;
      if (idRichiesta === undefined || intestazioni === undefined) return undefined;
      if (typeof stato !== "number" || !Number.isInteger(stato) || stato < 100 || stato > 599) return undefined;
      return { tipo: "anteprima-inizio", idRichiesta, stato, intestazioni };
    }
    case "anteprima-pezzo": {
      const idRichiesta = id(campi, "idRichiesta");
      const dati = testo(campi, "dati", Math.ceil(PEZZO_ANTEPRIMA / 3) * 4 + 4);
      if (idRichiesta === undefined || dati === undefined) return undefined;
      return { tipo: "anteprima-pezzo", idRichiesta, dati };
    }
    case "anteprima-fine": {
      const idRichiesta = id(campi, "idRichiesta");
      return idRichiesta === undefined ? undefined : { tipo: "anteprima-fine", idRichiesta };
    }
    case "anteprima-errore": {
      const idRichiesta = id(campi, "idRichiesta");
      const motivo = testo(campi, "motivo", 2000);
      if (idRichiesta === undefined || motivo === undefined) return undefined;
      return { tipo: "anteprima-errore", idRichiesta, motivo };
    }
    case "anteprima-ws-aperto": {
      const idCanale = id(campi, "idCanale");
      const protocollo = testo(campi, "protocollo", 200);
      if (idCanale === undefined || protocollo === undefined) return undefined;
      return { tipo: "anteprima-ws-aperto", idCanale, protocollo };
    }
    case "anteprima-ws-arrivo": {
      const idCanale = id(campi, "idCanale");
      const carico = leggiCarico(campi);
      if (idCanale === undefined || carico === undefined) return undefined;
      return { tipo: "anteprima-ws-arrivo", idCanale, ...carico };
    }
    case "anteprima-ws-chiuso": {
      const idCanale = id(campi, "idCanale");
      return idCanale === undefined ? undefined : { tipo: "anteprima-ws-chiuso", idCanale };
    }
    default:
      return undefined;
  }
}
