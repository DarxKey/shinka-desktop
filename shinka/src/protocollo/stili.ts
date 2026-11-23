/**
 * Gli stili di risposta: come Claude scrive in una conversazione, scelto dal proprietario. Uno stile
 * è un'istruzione che si aggiunge a quelle di sistema; senza stile Claude scrive come fa di solito.
 * Shinka ne ha alcuni suoi; gli altri li scrive Claude a partire da una descrizione del proprietario,
 * e restano al centro, validi in ogni conversazione. Dati semplici, serializzabili in JSON.
 */

export interface StileDiRisposta {
  /** Per quelli di Shinka una parola; per quelli del proprietario un identificativo nato con lo stile. */
  id: string;
  nome: string;
  /** Una riga, per scegliere. */
  descrizione: string;
  /** Ciò che si aggiunge alle istruzioni di sistema. */
  istruzioni: string;
  /** Vero per gli stili di Shinka, che non si cancellano. */
  diShinka?: boolean;
}

/** Lo stile scelto per una conversazione: ne viaggia il testo, perché vale anche negli altri ambienti. */
export interface StileScelto {
  id: string;
  nome: string;
  istruzioni: string;
}

export const NOME_MASSIMO = 40;
export const DESCRIZIONE_MASSIMA = 1000;
export const ISTRUZIONI_MASSIME = 4000;

export const STILI_DI_SHINKA: readonly StileDiRisposta[] = [
  {
    id: "conciso",
    nome: "Conciso",
    descrizione: "Risposte brevi e dirette, senza preamboli.",
    istruzioni:
      "Rispondi nel modo più breve che basta: prima la risposta, poi solo i dettagli indispensabili. Niente preamboli, " +
      "niente riassunti finali, niente elenchi se una frase basta. Se il proprietario vuole di più, lo chiederà.",
    diShinka: true,
  },
  {
    id: "spiegato",
    nome: "Spiegato",
    descrizione: "Dice anche il perché delle scelte e ciò che c'è da sapere intorno.",
    istruzioni:
      "Mentre lavori e quando rispondi, spiega il perché delle scelte che fai: le alternative che hai scartato, " +
      "ciò che conviene sapere sul codice o sull'argomento, le conseguenze da tenere a mente. Fallo in brevi note " +
      "chiare accanto al lavoro, senza rallentarlo.",
    diShinka: true,
  },
  {
    id: "didattico",
    nome: "Didattico",
    descrizione: "Insegna: spiega passo passo e lascia al proprietario qualcosa da fare.",
    istruzioni:
      "Il proprietario vuole imparare. Spiega passo passo, con parole semplici ed esempi concreti; controlla che i " +
      "concetti siano chiari prima di andare avanti. Quando c'è un pezzo piccolo e utile da scrivere o da decidere, " +
      "lascialo fare a lui: digli che cosa serve e dove, e poi guarda insieme a lui il risultato.",
    diShinka: true,
  },
];

/** Il testo che si aggiunge alle istruzioni di sistema per uno stile. */
export function istruzioniDelloStile(stile: StileScelto): string {
  return `# Stile delle risposte: ${stile.nome}\n\nIl proprietario ha scelto questo stile per le tue risposte in questa conversazione:\n\n${stile.istruzioni}`;
}

/** Lo stile scelto, se arrivato da fuori è fatto come deve; undefined altrimenti. */
export function leggiStileScelto(valore: unknown): StileScelto | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const { id, nome, istruzioni } = valore as Record<string, unknown>;
  if (typeof id !== "string" || id === "" || id.length > 100) return undefined;
  if (typeof nome !== "string" || nome.trim() === "" || nome.length > NOME_MASSIMO) return undefined;
  if (typeof istruzioni !== "string" || istruzioni.trim() === "" || istruzioni.length > ISTRUZIONI_MASSIME) return undefined;
  return { id, nome, istruzioni };
}

/** Ciò che di uno stile serve a una conversazione. */
export function sceltoDa(stile: StileDiRisposta): StileScelto {
  return { id: stile.id, nome: stile.nome, istruzioni: stile.istruzioni };
}
