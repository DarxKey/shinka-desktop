/**
 * Le notifiche dell'app su questo dispositivo: se il browser le sa ricevere, l'iscrizione al
 * servizio di notifiche del browser, e ciò che fa l'app quando una notifica viene toccata.
 */

import { vaiA, vistaDa } from "./vista.ts";

/** Come stanno le notifiche su questo dispositivo. */
export type CondizioneNotifiche =
  /** Il browser non le sa ricevere. */
  | "non-disponibili"
  /** Su iPhone e iPad arrivano solo all'app aggiunta alla schermata Home. */
  | "da-aggiungere"
  /** La pagina è aperta in HTTP: servono un indirizzo HTTPS. */
  | "serve-https"
  /** Il proprietario le ha negate nel browser: si riaccendono dalle impostazioni del browser. */
  | "negate"
  | "spente"
  | "accese";

const suApple = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
const comeApp = (): boolean => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function disponibili(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Registra il service worker delle notifiche, dove serve, e ascolta i tocchi sulle notifiche. */
export function avviaNotifiche(): void {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (evento: MessageEvent) => {
    const dati = evento.data as { tipo?: unknown; vai?: unknown } | null;
    if (dati?.tipo === "vai" && typeof dati.vai === "string") vaiA(vistaDa(`#${dati.vai}`));
  });
  // Chi apre l'app ha visto: il numero sull'icona si toglie.
  const togli = (): void => {
    if (document.visibilityState === "visible") void (navigator as { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
  };
  document.addEventListener("visibilitychange", togli);
  togli();
}

async function iscrizioneDiQui(): Promise<PushSubscription | null> {
  const registrazione = await navigator.serviceWorker.getRegistration("/");
  return (await registrazione?.pushManager.getSubscription()) ?? null;
}

/** La condizione di questo dispositivo, e l'indirizzo della sua iscrizione se è acceso. */
export async function condizioneNotifiche(): Promise<{ condizione: CondizioneNotifiche; endpoint?: string }> {
  if (!window.isSecureContext) return { condizione: "serve-https" };
  if (!disponibili()) return { condizione: suApple() && !comeApp() ? "da-aggiungere" : "non-disponibili" };
  if (Notification.permission === "denied") return { condizione: "negate" };
  const iscrizione = await iscrizioneDiQui().catch(() => null);
  return iscrizione === null ? { condizione: "spente" } : { condizione: "accese", endpoint: iscrizione.endpoint };
}

/**
 * Accende le notifiche su questo dispositivo: chiede il permesso al proprietario e iscrive il
 * browser con la chiave del centro. Va chiamata dal tocco su un pulsante. Restituisce l'iscrizione
 * da mandare al centro.
 */
export async function accendiNotifiche(chiaveDelCentro: string): Promise<PushSubscriptionJSON> {
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Il permesso non è stato dato: le notifiche restano spente.");
  const registrazione = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  // Un'iscrizione fatta con un'altra chiave, per esempio dopo che il centro ha rifatto le sue, non vale più.
  const diPrima = await registrazione.pushManager.getSubscription();
  if (diPrima !== null) await diPrima.unsubscribe();
  const chiave = Uint8Array.from(atob(chiaveDelCentro.replace(/-/g, "+").replace(/_/g, "/")), (carattere) => carattere.charCodeAt(0));
  const iscrizione = await registrazione.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiave });
  return iscrizione.toJSON();
}

/** Spegne le notifiche su questo dispositivo. Restituisce l'indirizzo dell'iscrizione tolta, da dire al centro. */
export async function spegniNotifiche(): Promise<string | undefined> {
  const iscrizione = await iscrizioneDiQui();
  if (iscrizione === null) return undefined;
  await iscrizione.unsubscribe();
  return iscrizione.endpoint;
}

/** Un nome per questo dispositivo, da ciò che il browser dice di sé. */
export function nomeDiQuestoDispositivo(): string {
  const dice = navigator.userAgent;
  const macchina = /iPhone/.test(dice)
    ? "iPhone"
    : /iPad/.test(dice) || (dice.includes("Macintosh") && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(dice)
        ? "Android"
        : /Windows/.test(dice)
          ? "PC Windows"
          : /Macintosh/.test(dice)
            ? "Mac"
            : "Computer";
  const browser = /Edg\//.test(dice) ? "Edge" : /Firefox\//.test(dice) ? "Firefox" : /Chrome\//.test(dice) ? "Chrome" : /Safari\//.test(dice) ? "Safari" : "";
  return macchina === "iPhone" || macchina === "iPad" || browser === "" ? macchina : `${macchina} · ${browser}`;
}
