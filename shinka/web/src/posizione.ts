/**
 * La posizione del proprietario presa dal browser, solo quando lui preme il pulsante e il browser
 * glielo chiede. Nulla di continuo: una posizione, adesso.
 */

/** Ciò che arriva al centro: la stessa forma di una posizione da Telegram. */
export interface PosizioneDalBrowser {
  lat: number;
  lon: number;
  precisioneM?: number;
  quando: string;
}

/** Il browser dà la posizione solo a una pagina sicura: in HTTP la chiede e la nega da sé. */
export const SERVE_HTTPS =
  "Il browser dà la posizione solo a una pagina sicura (HTTPS), e questa non lo è. Da qui mandala con Telegram: scrivi /posizione al bot.";

/** La posizione del browser nella forma che il centro aspetta. */
export function dalBrowser(posizione: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }): PosizioneDalBrowser {
  return {
    lat: posizione.coords.latitude,
    lon: posizione.coords.longitude,
    ...(Number.isFinite(posizione.coords.accuracy) && posizione.coords.accuracy >= 0 ? { precisioneM: Math.round(posizione.coords.accuracy) } : {}),
    quando: new Date(Number.isFinite(posizione.timestamp) && posizione.timestamp > 0 ? posizione.timestamp : Date.now()).toISOString(),
  };
}

/** Perché il browser non ha dato la posizione, in parole per il proprietario. */
export function perchéNo(codice: number): string {
  switch (codice) {
    case 1:
      return "Il browser non ha il permesso di dare la posizione a Shinka: lo concedi dalle impostazioni del sito.";
    case 3:
      return "Il browser non ha trovato la posizione in tempo: riprova all'aperto, o da Telegram con /posizione.";
    default:
      return "Il browser non è riuscito a trovare la posizione: riprova, o mandala da Telegram con /posizione.";
  }
}

/** Chiede la posizione al browser. Lancia con il motivo, in parole, se non arriva. */
export function chiediPosizione(contesto: { isSecureContext: boolean; navigator: Navigator }): Promise<PosizioneDalBrowser> {
  if (!contesto.isSecureContext || !("geolocation" in contesto.navigator)) return Promise.reject(new Error(SERVE_HTTPS));
  return new Promise((risolvi, rifiuta) => {
    contesto.navigator.geolocation.getCurrentPosition(
      (posizione) => risolvi(dalBrowser(posizione)),
      (errore) => rifiuta(new Error(perchéNo(errore.code))),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}
