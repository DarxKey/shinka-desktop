/**
 * Le risorse di un ambiente, per la sua pagina (ADR 0038): quanto lavorano processore, memoria e
 * disco, i processi che pesano di più, e i container di Docker dove ci sono. Le legge il nodo
 * dell'ambiente, nel momento in cui il proprietario guarda; i container di un host che il nodo non
 * vede li legge il gateway, in sola lettura. Qui ciò che nodo, gateway, centro e interfaccia si dicono.
 */

/** Un campione: com'è l'ambiente in un momento. */
export interface CampioneRisorse {
  quando: string;
  /** Quanto lavora il processore, da 0 a 100, su tutti i suoi nuclei. */
  cpu: number;
  /** In byte. */
  memoria: { usata: number; totale: number };
  /** Il carico medio dell'ultimo minuto; manca dove il sistema non lo dice (Windows). */
  carico?: number;
  /** Il disco su cui stanno i progetti, in byte. */
  disco?: { usato: number; totale: number };
  /** Se il nodo gira in un container con dei limiti: quanta memoria usa il container, e il suo tetto. */
  contenitore?: { memoria: number; limiteMemoria?: number; limiteCpu?: number };
}

export interface ProcessoAttivo {
  pid: number;
  nome: string;
  /** Percentuale di un nucleo: può passare 100 su più nuclei. */
  cpu: number;
  /** Memoria residente, in byte. */
  memoria: number;
  /** La riga di comando, accorciata, dove il sistema la dà. */
  comando?: string;
}

/** Un processo acceso da Shinka in un ambiente: una conversazione, un suo comando o server, un terminale. */
export interface ProcessoDiShinka {
  pid: number;
  /** Il processo che lo ha avviato; 0 se lo ha avviato direttamente Shinka. */
  genitore: number;
  nome: string;
  cpu: number;
  memoria: number;
  comando?: string;
  /** La cartella in cui lavora, dove il sistema la dice (non su Windows). */
  cartella?: string;
}

export interface ContenitoreDocker {
  nome: string;
  immagine: string;
  /** Lo stato come lo dice Docker: running, exited, paused, restarting, created, dead. */
  stato: string;
  /** Lo stato in parole di Docker: "Up 3 days", "Exited (0) 2 hours ago". */
  dettaglio: string;
  porte: string;
  /** Presenti per i container accesi: percentuale di un nucleo, e memoria in byte. */
  cpu?: number;
  memoria?: { usata: number; limite: number };
  /** Vero per i container degli stack di prova di Shinka. */
  diShinka?: true;
}

/** Il Docker di una macchina: se c'è, se si lascia leggere, e i suoi container. */
export interface DockerLetto {
  stato: "assente" | "non-raggiungibile" | "attivo";
  /** Perché non si è potuto leggere. */
  motivo?: string;
  contenitori: ContenitoreDocker[];
}

/** Ciò che un nodo dice del suo ambiente. */
export interface RisorseDellAmbiente {
  sistema: {
    /** In parole: "Linux 6.12", "Windows 11". */
    nome: string;
    macchina: string;
    nuclei: number;
    processore?: string;
    /** Da quanti secondi il sistema è acceso. */
    accesoDa: number;
  };
  campione: CampioneRisorse;
  /** I processi che pesano di più, dal più pesante. */
  processi: ProcessoAttivo[];
  /** Quanti processi ci sono in tutto, per ciò che il nodo vede. */
  quantiProcessi: number;
  /** Perché i processi non si sono potuti leggere, se è successo. */
  motivoProcessi?: string;
  /** Vero se il nodo gira in un container: vede i suoi processi, non quelli della macchina. */
  inContenitore?: true;
  docker: DockerLetto;
  /** I processi accesi da Shinka in questo ambiente, per progetto nella pagina; manca dove il nodo non li dice. */
  processiDiShinka?: ProcessoDiShinka[];
}

/** Il Docker di un host per gli stack, letto dal gateway con la sua credenziale. */
export interface DockerDiUnHost extends DockerLetto {
  host: string;
}

/** Ciò che la pagina di un ambiente riceve. */
export type DettaglioDellAmbiente =
  | { motivo: string }
  | (RisorseDellAmbiente & {
      /** Per l'ambiente del centro: i container degli host per gli stack, letti dal gateway. */
      hostDocker?: DockerDiUnHost[];
      /** Perché il gateway non li ha potuti leggere: vault chiuso, gateway che non risponde. */
      motivoHostDocker?: string;
    });

export const PROCESSI_MOSTRATI = 20;
export const CONTENITORI_MASSIMI = 300;

const UNITA: Record<string, number> = { b: 1, kb: 1000, mb: 1000 ** 2, gb: 1000 ** 3, tb: 1000 ** 4, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };

/** Una grandezza come la scrive Docker ("12.3MiB", "1.2GB") in byte; zero se non si capisce. */
export function inByte(scritto: string): number {
  const letto = /^\s*([\d.]+)\s*([a-zA-Z]+)\s*$/.exec(scritto);
  const unita = letto === null ? undefined : UNITA[(letto[2] ?? "").toLowerCase()];
  return letto === null || unita === undefined ? 0 : Math.round(Number(letto[1]) * unita);
}

/** Le righe JSON che Docker scrive con `--format '{{json .}}'`; quelle che non si leggono si saltano. */
function righeJson(uscita: string): Record<string, unknown>[] {
  return uscita.split("\n").flatMap((riga) => {
    if (riga.trim() === "") return [];
    try {
      const letta: unknown = JSON.parse(riga);
      return typeof letta === "object" && letta !== null ? [letta as Record<string, unknown>] : [];
    } catch {
      return [];
    }
  });
}

/**
 * I container, da ciò che scrivono `docker ps -a --format '{{json .}}'` e
 * `docker stats --no-stream --format '{{json .}}'`. `etichettaDiShinka` è l'etichetta che hanno
 * quelli degli stack di prova.
 */
export function contenitoriDa(ps: string, stats: string, etichettaDiShinka?: string): ContenitoreDocker[] {
  const risorse = new Map<string, { cpu: number; memoria: { usata: number; limite: number } }>();
  for (const riga of righeJson(stats)) {
    const [usata = "", limite = ""] = String(riga.MemUsage ?? "").split("/");
    risorse.set(String(riga.Name ?? ""), { cpu: Number.parseFloat(String(riga.CPUPerc ?? "0")) || 0, memoria: { usata: inByte(usata), limite: inByte(limite) } });
  }
  const testo = (valore: unknown, massimo: number): string => String(valore ?? "").slice(0, massimo);
  return righeJson(ps)
    .slice(0, CONTENITORI_MASSIMI)
    .map((riga) => {
      const nome = testo(riga.Names, 200);
      const sue = risorse.get(nome);
      const etichette = String(riga.Labels ?? "");
      return {
        nome,
        immagine: testo(riga.Image, 300),
        stato: testo(riga.State, 40),
        dettaglio: testo(riga.Status, 120),
        porte: testo(riga.Ports, 500),
        ...(sue === undefined ? {} : sue),
        ...(etichettaDiShinka !== undefined && etichette.split(",").some((una) => una.startsWith(`${etichettaDiShinka}=`)) ? { diShinka: true as const } : {}),
      };
    })
    .sort((a, b) => Number(b.stato === "running") - Number(a.stato === "running") || a.nome.localeCompare(b.nome));
}

const numero = (valore: unknown, minimo = 0, massimo = Number.MAX_SAFE_INTEGER): number | undefined =>
  typeof valore === "number" && Number.isFinite(valore) ? Math.min(Math.max(valore, minimo), massimo) : undefined;
const scritto = (valore: unknown, massimo: number): string => (typeof valore === "string" ? valore.slice(0, massimo) : "");

function leggiCoppia(valore: unknown, primo: string, secondo: string): Record<string, number> | undefined {
  const campi = (typeof valore === "object" && valore !== null ? valore : {}) as Record<string, unknown>;
  const a = numero(campi[primo]);
  const b = numero(campi[secondo]);
  return a === undefined || b === undefined ? undefined : { [primo]: a, [secondo]: b };
}

/** Legge il Docker arrivato da un nodo o dal gateway: ciò che non è fatto come deve vale come non letto. */
export function leggiDocker(valore: unknown): DockerLetto {
  const campi = (typeof valore === "object" && valore !== null ? valore : {}) as Record<string, unknown>;
  const stato = campi.stato === "attivo" || campi.stato === "non-raggiungibile" ? campi.stato : "assente";
  const elenco = Array.isArray(campi.contenitori) ? (campi.contenitori as unknown[]).slice(0, CONTENITORI_MASSIMI) : [];
  return {
    stato,
    ...(typeof campi.motivo === "string" ? { motivo: campi.motivo.slice(0, 500) } : {}),
    contenitori: elenco.flatMap((voce) => {
      const uno = (typeof voce === "object" && voce !== null ? voce : {}) as Record<string, unknown>;
      if (typeof uno.nome !== "string" || uno.nome === "") return [];
      const cpu = numero(uno.cpu, 0, 100_000);
      const memoria = leggiCoppia(uno.memoria, "usata", "limite") as { usata: number; limite: number } | undefined;
      return [
        {
          nome: scritto(uno.nome, 200),
          immagine: scritto(uno.immagine, 300),
          stato: scritto(uno.stato, 40),
          dettaglio: scritto(uno.dettaglio, 120),
          porte: scritto(uno.porte, 500),
          ...(cpu === undefined ? {} : { cpu }),
          ...(memoria === undefined ? {} : { memoria }),
          ...(uno.diShinka === true ? { diShinka: true as const } : {}),
        },
      ];
    }),
  };
}

/** Legge le risorse arrivate da un nodo; undefined se non sono fatte come devono. */
export function leggiRisorse(valore: unknown): RisorseDellAmbiente | undefined {
  if (typeof valore !== "object" || valore === null) return undefined;
  const campi = valore as Record<string, unknown>;
  const sistema = (typeof campi.sistema === "object" && campi.sistema !== null ? campi.sistema : {}) as Record<string, unknown>;
  const campione = (typeof campi.campione === "object" && campi.campione !== null ? campi.campione : {}) as Record<string, unknown>;
  const cpu = numero(campione.cpu, 0, 100);
  const memoria = leggiCoppia(campione.memoria, "usata", "totale") as { usata: number; totale: number } | undefined;
  if (cpu === undefined || memoria === undefined || typeof campione.quando !== "string") return undefined;
  const carico = numero(campione.carico, 0, 100_000);
  const disco = leggiCoppia(campione.disco, "usato", "totale") as { usato: number; totale: number } | undefined;
  const contenitore = (typeof campione.contenitore === "object" && campione.contenitore !== null ? campione.contenitore : undefined) as Record<string, unknown> | undefined;
  const memoriaContenitore = numero(contenitore?.memoria);
  const processi = Array.isArray(campi.processi) ? (campi.processi as unknown[]).slice(0, PROCESSI_MOSTRATI) : [];
  return {
    sistema: {
      nome: scritto(sistema.nome, 80),
      macchina: scritto(sistema.macchina, 80),
      nuclei: numero(sistema.nuclei, 1, 4096) ?? 1,
      ...(typeof sistema.processore === "string" && sistema.processore !== "" ? { processore: sistema.processore.slice(0, 120) } : {}),
      accesoDa: numero(sistema.accesoDa) ?? 0,
    },
    campione: {
      quando: campione.quando.slice(0, 40),
      cpu,
      memoria,
      ...(carico === undefined ? {} : { carico }),
      ...(disco === undefined ? {} : { disco }),
      ...(memoriaContenitore === undefined
        ? {}
        : {
            contenitore: {
              memoria: memoriaContenitore,
              ...(numero(contenitore?.limiteMemoria) === undefined ? {} : { limiteMemoria: numero(contenitore?.limiteMemoria) as number }),
              ...(numero(contenitore?.limiteCpu) === undefined ? {} : { limiteCpu: numero(contenitore?.limiteCpu) as number }),
            },
          }),
    },
    processi: processi.flatMap((voce) => {
      const uno = (typeof voce === "object" && voce !== null ? voce : {}) as Record<string, unknown>;
      const pid = numero(uno.pid);
      if (pid === undefined) return [];
      return [
        {
          pid,
          nome: scritto(uno.nome, 80),
          cpu: numero(uno.cpu, 0, 100_000) ?? 0,
          memoria: numero(uno.memoria) ?? 0,
          ...(typeof uno.comando === "string" && uno.comando !== "" ? { comando: uno.comando.slice(0, 240) } : {}),
        },
      ];
    }),
    quantiProcessi: numero(campi.quantiProcessi) ?? 0,
    ...(typeof campi.motivoProcessi === "string" ? { motivoProcessi: campi.motivoProcessi.slice(0, 300) } : {}),
    ...(campi.inContenitore === true ? { inContenitore: true as const } : {}),
    docker: leggiDocker(campi.docker),
    ...(Array.isArray(campi.processiDiShinka)
      ? {
          processiDiShinka: (campi.processiDiShinka as unknown[]).slice(0, 200).flatMap((voce): ProcessoDiShinka[] => {
            const uno = (typeof voce === "object" && voce !== null ? voce : {}) as Record<string, unknown>;
            const pid = numero(uno.pid);
            if (pid === undefined) return [];
            return [
              {
                pid,
                genitore: numero(uno.genitore) ?? 0,
                nome: scritto(uno.nome, 80),
                cpu: numero(uno.cpu, 0, 100_000) ?? 0,
                memoria: numero(uno.memoria) ?? 0,
                ...(typeof uno.comando === "string" && uno.comando !== "" ? { comando: uno.comando.slice(0, 400) } : {}),
                ...(typeof uno.cartella === "string" && uno.cartella !== "" ? { cartella: uno.cartella.slice(0, 1000) } : {}),
              },
            ];
          }),
        }
      : {}),
  };
}
