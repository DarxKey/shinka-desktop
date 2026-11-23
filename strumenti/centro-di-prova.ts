/**
 * Un centro di prova in ascolto su questo PC, per avviare l'app senza un centro vero: è il centro
 * finto delle prove (`src/principale/prove/centro-finto.ts`) dietro una porta, con qualche
 * conversazione inventata. Non ha motori: i messaggi che si mandano non hanno risposta.
 *
 *   node strumenti/centro-di-prova.ts [porta]
 *
 * La password è quella delle prove, scritta in `centro-finto.ts`.
 */

import { createServer } from "node:http";
import { Readable } from "node:stream";
import type { EventoConversazione } from "../shinka/src/protocollo/eventi.ts";
import { CentroFinto, PASSWORD_FINTA } from "../src/principale/prove/centro-finto.ts";

const porta = Number(process.argv[2] ?? "7890");
const finto = new CentroFinto();

function scambio(domanda: string, risposta: string, numero: number): EventoConversazione[] {
  return [
    { tipo: "messaggio-proprietario", id: `m${numero}`, testo: domanda },
    { tipo: "turno-iniziato" },
    { tipo: "testo-iniziato", idTesto: `t${numero}` },
    { tipo: "testo-concluso", idTesto: `t${numero}`, testo: risposta },
    { tipo: "turno-concluso", riuscito: true, durataMs: 1200 },
  ] as EventoConversazione[];
}

function conversazione(quanti: number, di: string): EventoConversazione[] {
  return Array.from({ length: quanti }, (_, indice) =>
    scambio(`Domanda ${indice + 1} su ${di}`, `Risposta ${indice + 1} su **${di}**.\n\n- un punto\n- un altro\n\n\`\`\`ts\nconst n = ${indice + 1};\n\`\`\``, indice + 1),
  ).flat();
}

const aperto = `argomenti/${finto.idAperto}`;
finto.archivio(aperto, conversazione(4, "la Home"));
finto.archivio("argomenti/2026-11-20-vecchio", conversazione(30, "un argomento archiviato"));
finto.archivio("progetti/demo", conversazione(400, "il progetto di prova"));
finto.archivio("progetti/altro", conversazione(3, "un altro progetto"));

const AMBIENTE = "ambiente-di-prova";

function quadro(): [string, unknown][] {
  const progetto = (id: string, nome: string): unknown => ({
    id,
    nome,
    cartella: `/home/prova/progetti/${id}`,
    idAmbiente: AMBIENTE,
    creatoIl: "2026-11-01T09:00:00.000Z",
    brief: "",
    nomeAmbiente: "Prova",
    condizione: "fermo",
    ...finto.indice(`progetti/${id}`),
  });
  return [
    ["ambienti", { ambienti: [{ id: AMBIENTE, nome: "Prova", descrizione: "Un ambiente inventato", sistema: "linux", radiceProgetti: "/home/prova/progetti", attivo: true, delCentro: true }], richieste: [] }],
    ["progetti", { progetti: [progetto("demo", "Progetto di prova"), progetto("altro", "Un altro progetto")] }],
    [
      "argomenti",
      {
        idAperto: finto.idAperto,
        aperto: finto.indice(aperto),
        archiviati: [{ id: "2026-11-20-vecchio", titolo: "Un argomento archiviato", riassunto: "", apertoIl: "2026-11-20T09:00:00.000Z", archiviatoIl: "2026-11-21T09:00:00.000Z", ...finto.indice("argomenti/2026-11-20-vecchio") }],
      },
    ],
    ["home", { condizione: "fermo", argomento: { id: finto.idAperto, ...finto.indice(aperto) } }],
  ];
}

finto.quadroAllApertura = quadro();

createServer((richiesta, risposta) => {
  const pezzi: Buffer[] = [];
  richiesta.on("data", (pezzo: Buffer) => pezzi.push(pezzo));
  richiesta.on("end", () => {
    const fine = new AbortController();
    risposta.on("close", () => fine.abort());
    const metodo = richiesta.method ?? "GET";
    const intestazioni = new Headers();
    for (const [nome, valore] of Object.entries(richiesta.headers)) if (typeof valore === "string") intestazioni.set(nome, valore);
    const corpo = Buffer.concat(pezzi);
    void finto
      .chiedi(`http://127.0.0.1:${porta}${richiesta.url ?? "/"}`, { method: metodo, headers: intestazioni, signal: fine.signal, ...(metodo === "GET" || metodo === "HEAD" || corpo.length === 0 ? {} : { body: corpo.toString("utf8") }) })
      .then((esito) => {
        console.log(`${metodo} ${richiesta.url ?? "/"} → ${esito.status}${corpo.length === 0 ? "" : ` (corpo di ${corpo.length} byte)`}`);
        risposta.writeHead(esito.status, Object.fromEntries(esito.headers));
        if (esito.body === null) risposta.end();
        else Readable.fromWeb(esito.body as import("node:stream/web").ReadableStream).pipe(risposta);
      })
      .catch(() => {
        risposta.writeHead(500).end();
      });
  });
}).listen(porta, "127.0.0.1", () => {
  console.log(`Centro di prova su http://127.0.0.1:${porta} (password: ${PASSWORD_FINTA})`);
});

// Ogni tanto arriva un messaggio nuovo nel progetto di prova: serve a vedere la diretta e la sincronizzazione.
let numero = 1000;
setInterval(() => {
  numero += 1;
  for (const evento of scambio(`Domanda in diretta ${numero}`, `Risposta in diretta ${numero}.`, numero)) finto.pubblica("progetti/demo", evento);
  finto.quadroAllApertura = quadro();
  for (const [nome, dati] of finto.quadroAllApertura) if (nome === "progetti") finto.quadro(nome, dati);
}, 20_000).unref();
