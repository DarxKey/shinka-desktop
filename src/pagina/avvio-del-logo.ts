/** Quanto dura l'avvio del logo: la luce che corre sul contorno, poi la dissolvenza sull'interfaccia. */
export interface TempiDellAvvio {
  /** Quanto resta il logo con la luce, prima di svanire. */
  luceMs: number;
  /** Quanto dura la dissolvenza. */
  dissolvenzaMs: number;
  /** Quanto ci mette la luce a fare un giro del contorno. */
  giroMs: number;
}

/** Con le animazioni ridotte il logo si vede un attimo, fermo, e svanisce in fretta. */
export function tempiDellAvvio(animazioniRidotte: boolean): TempiDellAvvio {
  return animazioniRidotte ? { luceMs: 500, dissolvenzaMs: 200, giroMs: 0 } : { luceMs: 2200, dissolvenzaMs: 700, giroMs: 1600 };
}
