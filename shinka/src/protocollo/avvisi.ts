/**
 * Gli avvisi che Shinka manda al proprietario, e dove li vuole: su Telegram, come notifiche
 * dell'app, o in tutti e due i posti. La scelta è per genere di avviso.
 */

/** Richieste che aspettano il proprietario; lavori finiti o in attesa di una risposta; risposte dei lavori programmati. */
export const GENERI_AVVISO = ["richieste", "lavori", "programmati"] as const;
export type GenereAvviso = (typeof GENERI_AVVISO)[number];

export const CANALI_AVVISO = ["app", "telegram"] as const;
export type CanaleAvviso = (typeof CANALI_AVVISO)[number];

export type ScelteAvvisi = Record<CanaleAvviso, Record<GenereAvviso, boolean>>;

/** Finché il proprietario non sceglie, tutto arriva dappertutto. */
export function scelteDiPartenza(): ScelteAvvisi {
  const tutti = (): Record<GenereAvviso, boolean> => ({ richieste: true, lavori: true, programmati: true });
  return { app: tutti(), telegram: tutti() };
}

/** Legge le scelte arrivate da fuori o dal disco: ciò che manca, o non è un sì o un no, resta com'era in `base`. */
export function leggiScelte(valore: unknown, base: ScelteAvvisi = scelteDiPartenza()): ScelteAvvisi {
  const lette = scelteDiPartenza();
  const campi = (typeof valore === "object" && valore !== null ? valore : {}) as Record<string, unknown>;
  for (const canale of CANALI_AVVISO) {
    const delCanale = (typeof campi[canale] === "object" && campi[canale] !== null ? campi[canale] : {}) as Record<string, unknown>;
    for (const genere of GENERI_AVVISO) lette[canale][genere] = typeof delCanale[genere] === "boolean" ? (delCanale[genere] as boolean) : base[canale][genere];
  }
  return lette;
}
