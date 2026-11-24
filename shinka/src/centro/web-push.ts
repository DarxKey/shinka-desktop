/**
 * Le notifiche push del web, scritte con ciò che Node ha già: la cifratura del messaggio per il
 * browser che lo riceverà (RFC 8291, con la codifica aes128gcm della RFC 8188) e la firma con cui
 * il centro si presenta al servizio di notifiche (VAPID, RFC 8292). Il servizio (di Apple, di
 * Google, di Mozilla) consegna il messaggio senza poterlo leggere: lo apre solo il browser.
 */

import { createCipheriv, createECDH, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign, type ECDH } from "node:crypto";

const CURVA = "prime256v1";
/** La grandezza di un pezzo cifrato: il messaggio sta in uno solo. */
const PEZZO = 4096;
/** Quanto può pesare al massimo il testo di una notifica: i servizi accettano messaggi fino a 4 KB. */
export const NOTIFICA_MASSIMA = 3000;

/** L'iscrizione di un browser alle notifiche, come la dà `PushManager.subscribe`. */
export interface IscrizionePush {
  endpoint: string;
  /** La chiave pubblica del browser e il suo segreto, in base64url. */
  p256dh: string;
  auth: string;
}

/** Le chiavi con cui il centro si presenta ai servizi di notifiche: la pubblica la conoscono i browser iscritti. */
export interface ChiaviVapid {
  /** La chiave pubblica, 65 byte, in base64url. */
  pubblica: string;
  /** La chiave privata come JWK. */
  privata: { kty: "EC"; crv: "P-256"; x: string; y: string; d: string };
}

function hkdf(ikm: Buffer, sale: Buffer, info: Buffer, lunghezza: number): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, sale, info, lunghezza));
}

/**
 * Cifra un messaggio per un browser iscritto. Restituisce il corpo da mandare al servizio, con
 * `Content-Encoding: aes128gcm`. Sale e chiave del mittente si danno solo nelle prove.
 */
export function cifraPerIlBrowser(
  messaggio: Buffer,
  iscrizione: Pick<IscrizionePush, "p256dh" | "auth">,
  prova: { sale?: Buffer; mittente?: ECDH } = {},
): Buffer {
  const delBrowser = Buffer.from(iscrizione.p256dh, "base64url");
  const segreto = Buffer.from(iscrizione.auth, "base64url");
  if (delBrowser.length !== 65 || delBrowser[0] !== 4) throw new Error("La chiave del browser non è una chiave P-256.");
  if (segreto.length !== 16) throw new Error("Il segreto dell'iscrizione non è di 16 byte.");
  if (messaggio.length > PEZZO - 17 - 1) throw new Error("Il messaggio è troppo lungo per una notifica.");
  let mittente = prova.mittente;
  if (mittente === undefined) {
    mittente = createECDH(CURVA);
    mittente.generateKeys();
  }
  const delMittente = mittente.getPublicKey();
  const condiviso = mittente.computeSecret(delBrowser);
  // La chiave nasce dal segreto condiviso, dal segreto dell'iscrizione e dalle due chiavi pubbliche.
  const ikm = hkdf(condiviso, segreto, Buffer.concat([Buffer.from("WebPush: info\0"), delBrowser, delMittente]), 32);
  const sale = prova.sale ?? randomBytes(16);
  const chiave = hkdf(ikm, sale, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, sale, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cifra = createCipheriv("aes-128-gcm", chiave, nonce);
  // Il byte 2 dice che questo è l'ultimo pezzo.
  const cifrato = Buffer.concat([cifra.update(Buffer.concat([messaggio, Buffer.from([2])])), cifra.final(), cifra.getAuthTag()]);
  const testa = Buffer.alloc(21);
  sale.copy(testa, 0);
  testa.writeUInt32BE(PEZZO, 16);
  testa.writeUInt8(delMittente.length, 20);
  return Buffer.concat([testa, delMittente, cifrato]);
}

/** Una coppia di chiavi nuova, per un'installazione che non ne ha ancora. */
export function nuoveChiaviVapid(): ChiaviVapid {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: CURVA });
  const jwk = privateKey.export({ format: "jwk" }) as { x: string; y: string; d: string };
  const pubblica = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
  return { pubblica, privata: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d } };
}

/**
 * L'intestazione `Authorization` con cui il centro si presenta al servizio di notifiche di
 * quell'indirizzo: un gettone firmato che vale dodici ore, e la chiave pubblica.
 */
export function intestazioneVapid(endpoint: string, chiavi: ChiaviVapid, contatto: string, adesso: number = Date.now()): string {
  const base = (oggetto: unknown): string => Buffer.from(JSON.stringify(oggetto)).toString("base64url");
  const daFirmare = `${base({ typ: "JWT", alg: "ES256" })}.${base({ aud: new URL(endpoint).origin, exp: Math.floor(adesso / 1000) + 12 * 60 * 60, sub: contatto })}`;
  const firma = sign("sha256", Buffer.from(daFirmare), { key: createPrivateKey({ key: chiavi.privata, format: "jwk" }), dsaEncoding: "ieee-p1363" });
  return `vapid t=${daFirmare}.${firma.toString("base64url")}, k=${chiavi.pubblica}`;
}

/** I servizi di notifiche dei browser: un'iscrizione che punta altrove non si accetta, perché il centro non scriva a indirizzi qualunque. */
const SERVIZI = [".push.apple.com", "fcm.googleapis.com", ".push.services.mozilla.com", ".notify.windows.com"];

/** Vero se l'indirizzo è quello di un servizio di notifiche conosciuto, in HTTPS. */
export function servizioConosciuto(endpoint: string): boolean {
  try {
    const indirizzo = new URL(endpoint);
    if (indirizzo.protocol !== "https:" || indirizzo.username !== "" || (indirizzo.port !== "" && indirizzo.port !== "443")) return false;
    return SERVIZI.some((servizio) => (servizio.startsWith(".") ? indirizzo.hostname.endsWith(servizio) : indirizzo.hostname === servizio));
  } catch {
    return false;
  }
}

export type EsitoPush = { esito: "mandata" } | { esito: "scaduta" } | { esito: "fallita"; motivo: string };

/** Manda una notifica a un browser iscritto. «Scaduta»: l'iscrizione non vale più, e va tolta. */
export async function mandaPush(
  iscrizione: IscrizionePush,
  messaggio: string,
  chiavi: ChiaviVapid,
  contatto: string,
  opzioni: { urgente?: boolean; manda?: typeof fetch } = {},
): Promise<EsitoPush> {
  if (!servizioConosciuto(iscrizione.endpoint)) return { esito: "fallita", motivo: "L'indirizzo dell'iscrizione non è quello di un servizio di notifiche conosciuto." };
  try {
    const corpo = cifraPerIlBrowser(Buffer.from(messaggio, "utf8"), iscrizione);
    const risposta = await (opzioni.manda ?? fetch)(iscrizione.endpoint, {
      method: "POST",
      headers: {
        Authorization: intestazioneVapid(iscrizione.endpoint, chiavi, contatto),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        // Se il telefono è spento, il servizio la tiene da parte per un giorno.
        TTL: "86400",
        Urgency: opzioni.urgente === true ? "high" : "normal",
      },
      body: new Uint8Array(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    if (risposta.status === 404 || risposta.status === 410) return { esito: "scaduta" };
    if (risposta.status >= 200 && risposta.status < 300) return { esito: "mandata" };
    const dettaglio = (await risposta.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    return { esito: "fallita", motivo: `Il servizio di notifiche ha risposto ${risposta.status}${dettaglio === "" ? "" : `: ${dettaglio}`}` };
  } catch (errore) {
    return { esito: "fallita", motivo: `Il servizio di notifiche non risponde: ${errore instanceof Error ? errore.message : String(errore)}` };
  }
}
