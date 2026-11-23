/**
 * La posizione del proprietario, quando la condivide: da Telegram, anche dal vivo, oppure dal
 * browser. Vale per l'argomento in cui arriva, con la sua ora, e non va in memoria: il centro la
 * tiene finché è acceso, e la Home la legge quando le serve.
 */

/** Da dove arriva una posizione. */
export type FontePosizione = "telegram" | "browser";

export interface Posizione {
  lat: number;
  lon: number;
  /** Il raggio entro cui sta davvero, in metri, se chi la manda lo dice. */
  precisioneM?: number;
  /** Quando è stata presa. */
  quando: string;
  fonte: FontePosizione;
  /** Vero per una posizione condivisa dal vivo da Telegram, che si aggiorna da sola. */
  dalVivo?: boolean;
  /** Fino a quando si aggiorna, per una posizione dal vivo. */
  finoA?: string;
}

/** Riconosce una posizione arrivata dall'esterno; nulla se non è ben formata. */
export function leggiPosizione(letta: unknown, fonte: FontePosizione): Posizione | undefined {
  if (typeof letta !== "object" || letta === null) return undefined;
  const { lat, lon, precisioneM, quando, dalVivo, finoA } = letta as Record<string, unknown>;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return undefined;
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) return undefined;
  if (typeof quando !== "string" || Number.isNaN(Date.parse(quando))) return undefined;
  const precisione =
    typeof precisioneM === "number" && Number.isFinite(precisioneM) && precisioneM >= 0 && precisioneM < 1_000_000
      ? Math.round(precisioneM)
      : undefined;
  return {
    lat,
    lon,
    ...(precisione === undefined ? {} : { precisioneM: precisione }),
    quando: new Date(quando).toISOString(),
    fonte,
    ...(dalVivo === true ? { dalVivo: true } : {}),
    ...(dalVivo === true && typeof finoA === "string" && !Number.isNaN(Date.parse(finoA)) ? { finoA: new Date(finoA).toISOString() } : {}),
  };
}

/** Le coordinate come si scrivono e si incollano: cinque decimali, circa un metro. */
export function coordinate(posizione: Pick<Posizione, "lat" | "lon">): string {
  return `${posizione.lat.toFixed(5)}, ${posizione.lon.toFixed(5)}`;
}

/** Da quanto tempo, in parole: "adesso", "3 minuti fa", "2 ore fa". */
export function quantoFa(quando: string, adesso: number): string {
  const minuti = Math.round((adesso - Date.parse(quando)) / 60_000);
  if (minuti < 1) return "adesso";
  if (minuti === 1) return "un minuto fa";
  if (minuti < 60) return `${minuti} minuti fa`;
  const ore = Math.round(minuti / 60);
  return ore === 1 ? "un'ora fa" : `${ore} ore fa`;
}

/** Il messaggio con cui il proprietario condivide la posizione, come lo leggono lui e la Home. */
export function messaggioDellaPosizione(posizione: Posizione): string {
  const ora = new Date(posizione.quando).toISOString().slice(11, 16);
  const precisione = posizione.precisioneM === undefined ? "" : `, precisione ±${posizione.precisioneM} m`;
  const vivo = posizione.dalVivo === true ? " Condivisa dal vivo: si aggiorna da sola." : "";
  return `📍 La mia posizione: ${coordinate(posizione)}${precisione} (presa alle ${ora} UTC).${vivo}`;
}
