/**
 * La pagina di un ambiente (ADR 0038): come stanno processore, memoria e disco, in tempo reale
 * finché la pagina è aperta, i processi che pesano di più e i container di Docker. I numeri li
 * legge il nodo dell'ambiente a ogni richiesta; la storia dei grafici sta solo in questa pagina.
 */

import { Parte, PostoEstensioni } from "./Interfaccia.tsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { CampioneRisorse, ContenitoreDocker, DettaglioDellAmbiente, DockerLetto, ProcessoAttivo, ProcessoDiShinka } from "../../src/protocollo/risorse.ts";
import type { Ambiente } from "../../src/protocollo/nodi.ts";
import { leggiRisorseAmbiente, terminaProcesso } from "./api.ts";
import { cheCosE, processiPerProgetto } from "./processi.ts";
import { useQuadroCorrente } from "./Quadro.tsx";
import { grandezzaInBreve as pesoInBreve, sottotitoloAmbiente, versioneAmbiente } from "./descrivi.ts";
import { frammentoDi } from "./vista.ts";

/** Ogni quanto si chiede un campione, e quanta storia mostrano i grafici. */
const OGNI_MS = 3_000;
const FINESTRA_MS = 5 * 60_000;

type Risorse = Exclude<DettaglioDellAmbiente, { motivo: string }>;

const percento = (valore: number): string => `${valore.toLocaleString("it-IT", { maximumFractionDigits: valore < 10 ? 1 : 0 })}%`;

function durata(secondi: number): string {
  const giorni = Math.floor(secondi / 86_400);
  const ore = Math.floor((secondi % 86_400) / 3600);
  if (giorni > 0) return `${giorni} ${giorni === 1 ? "giorno" : "giorni"}${ore === 0 ? "" : ` e ${ore} h`}`;
  const minuti = Math.floor((secondi % 3600) / 60);
  return ore > 0 ? `${ore} h e ${minuti} min` : `${minuti} min`;
}

export function PaginaAmbiente({ menu, ambiente, caricato }: { menu: ReactNode; ambiente: Ambiente | undefined; caricato: boolean }): ReactNode {
  const [risorse, setRisorse] = useState<Risorse>();
  const [motivo, setMotivo] = useState<string>();
  const [storia, setStoria] = useState<CampioneRisorse[]>([]);
  const id = ambiente?.id;
  const attivo = ambiente?.attivo === true;

  useEffect(() => {
    document.title = `${ambiente?.nome ?? "Ambiente"} · Shinka`;
  }, [ambiente?.nome]);

  useEffect(() => {
    setRisorse(undefined);
    setStoria([]);
    setMotivo(undefined);
    if (id === undefined || !attivo) return;
    let vivo = true;
    let sveglia: ReturnType<typeof setTimeout> | undefined;
    const giro = async (): Promise<void> => {
      // Con la pagina in secondo piano non si chiede nulla: il nodo non lavora per nessuno.
      if (document.visibilityState === "visible") {
        try {
          const letto = await leggiRisorseAmbiente(id);
          if (!vivo) return;
          if ("motivo" in letto) setMotivo(letto.motivo);
          else {
            setMotivo(undefined);
            setRisorse(letto);
            setStoria((prima) => [...prima, letto.campione].filter((campione) => Date.parse(letto.campione.quando) - Date.parse(campione.quando) <= FINESTRA_MS));
          }
        } catch (causa) {
          if (vivo) setMotivo(causa instanceof Error ? causa.message : "Le risorse non si sono potute leggere.");
        }
      }
      if (vivo) sveglia = setTimeout(() => void giro(), OGNI_MS);
    };
    void giro();
    return () => {
      vivo = false;
      clearTimeout(sveglia);
    };
  }, [id, attivo]);

  const versione = ambiente === undefined ? undefined : versioneAmbiente(ambiente);
  return (
    <div className="app pagina">
      <header className="testata">
        {menu}
        <div className="titoli">
          <h1>{ambiente?.nome ?? "Ambiente"}</h1>
          <span className="sottotitolo">
            {ambiente === undefined ? "Ambiente" : `${sottotitoloAmbiente(ambiente.sistema, ambiente.descrizione)}${ambiente.delCentro ? " · qui gira il centro" : ""}`}
          </span>
        </div>
        {ambiente !== undefined && <span className={attivo ? "spia bene" : "spia"}>{attivo ? "attivo" : "spento"}</span>}
      </header>
      <div className="corpo-pagina">
        <div className="colonna-pagina pagina-ambiente">
          {ambiente === undefined ? (
            <p className="tenue">{caricato ? "Questo ambiente non esiste, o non esiste più." : "Carico…"}</p>
          ) : !attivo ? (
            <p className="tenue">Questo ambiente è spento: le sue risorse si vedono quando il suo nodo è collegato.</p>
          ) : (
            <>
              {motivo !== undefined && (
                <p className="errore" role="alert">
                  {motivo}
                </p>
              )}
              {risorse === undefined && motivo === undefined && <p className="tenue">Leggo le risorse…</p>}
              {risorse !== undefined && (
                <Parte nome="ambiente-risorse" qui={{ tipo: "ambiente", id: ambiente.id, nome: ambiente.nome }}>
                  <div data-parte="ambiente-risorse">
                    <Risorse risorse={risorse} storia={storia} versione={versione} />
                  </div>
                </Parte>
              )}
              {risorse?.processiDiShinka !== undefined && id !== undefined && <ProcessiDiShinka idAmbiente={id} processi={risorse.processiDiShinka} />}
            </>
          )}
          {ambiente !== undefined && <PostoEstensioni posto="ambiente" qui={{ tipo: "ambiente", id: ambiente.id, nome: ambiente.nome }} />}
          <p className="tenue">
            <a href={frammentoDi({ tipo: "home" })}>Torna alla Home</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Risorse({ risorse, storia, versione }: { risorse: Risorse; storia: CampioneRisorse[]; versione: string | undefined }): ReactNode {
  const { campione, sistema } = risorse;
  const memoria = (campione.memoria.usata / campione.memoria.totale) * 100;
  return (
    <>
      <p className="tenue sistema-ambiente">
        {sistema.nome} · {sistema.macchina} · {sistema.nuclei} {sistema.nuclei === 1 ? "nucleo" : "nuclei"}
        {sistema.processore === undefined ? "" : ` · ${sistema.processore}`} · acceso da {durata(sistema.accesoDa)}
        {versione === undefined ? "" : ` · ${versione}`}
      </p>

      <div className="grafici-ambiente">
        <Andamento titolo="Processore" storia={storia} valore={(uno) => uno.cpu} adesso={percento(campione.cpu)} dettaglio={(uno) => percento(uno.cpu)} />
        <Andamento
          titolo="Memoria"
          storia={storia}
          valore={(uno) => (uno.memoria.usata / uno.memoria.totale) * 100}
          adesso={percento(memoria)}
          dettaglio={(uno) => `${pesoInBreve(uno.memoria.usata)} di ${pesoInBreve(uno.memoria.totale)}`}
        />
      </div>

      <div className="riquadri-ambiente">
        <Riquadro nome="Memoria" valore={pesoInBreve(campione.memoria.usata)} nota={`di ${pesoInBreve(campione.memoria.totale)}`} pieno={memoria} />
        {campione.disco !== undefined && (
          <Riquadro
            nome="Disco dei progetti"
            valore={pesoInBreve(campione.disco.usato)}
            nota={`di ${pesoInBreve(campione.disco.totale)}`}
            pieno={(campione.disco.usato / campione.disco.totale) * 100}
          />
        )}
        {(campione.gpu ?? []).map((scheda, posto) => (
          <Riquadro
            key={`gpu-${posto}`}
            nome={scheda.nome}
            valore={`${Math.round(scheda.uso)}%`}
            nota={`${pesoInBreve(scheda.memoria.usata)} di ${pesoInBreve(scheda.memoria.totale)}${scheda.temperatura === undefined ? "" : ` · ${Math.round(scheda.temperatura)} °C`}`}
            pieno={scheda.uso}
          />
        ))}
        {campione.carico !== undefined && <Riquadro nome="Carico (1 minuto)" valore={campione.carico.toLocaleString("it-IT", { maximumFractionDigits: 2 })} nota={`su ${sistema.nuclei} nuclei`} />}
        {campione.contenitore !== undefined && (
          <Riquadro
            nome="Container di Shinka"
            valore={pesoInBreve(campione.contenitore.memoria)}
            nota={
              campione.contenitore.limiteMemoria === undefined
                ? "di memoria"
                : `di ${pesoInBreve(campione.contenitore.limiteMemoria)}${campione.contenitore.limiteCpu === undefined ? "" : ` · al più ${campione.contenitore.limiteCpu.toLocaleString("it-IT")} nuclei`}`
            }
            {...(campione.contenitore.limiteMemoria === undefined ? {} : { pieno: (campione.contenitore.memoria / campione.contenitore.limiteMemoria) * 100 })}
          />
        )}
      </div>

      <section>
        <h2 className="titolo-sezione">Processi</h2>
        {risorse.inContenitore === true && (
          <p className="tenue">Qui Shinka gira in un container: vede i suoi processi, non quelli del resto della macchina. Processore e memoria qui sopra sono invece quelli della macchina intera.</p>
        )}
        {risorse.motivoProcessi !== undefined ? <p className="tenue">{risorse.motivoProcessi}</p> : <Processi processi={risorse.processi} quanti={risorse.quantiProcessi} />}
      </section>

      <section>
        <h2 className="titolo-sezione">Container</h2>
        {risorse.docker.stato !== "assente" && <Docker letto={risorse.docker} />}
        {risorse.hostDocker?.map((host) => <Docker key={host.host} letto={host} host={host.host} />)}
        {risorse.motivoHostDocker !== undefined && <p className="tenue">I container dell'host per gli stack non si leggono adesso. {risorse.motivoHostDocker}</p>}
        {risorse.docker.stato === "assente" && (risorse.hostDocker?.length ?? 0) === 0 && risorse.motivoHostDocker === undefined && (
          <p className="tenue">
            {risorse.hostDocker === undefined
              ? "In questo ambiente Docker non c'è, o il nodo non lo può usare."
              : "Da qui Docker non si vede. I container di un server si leggono dal gateway, con la credenziale di un host per gli stack: si dichiara nella pagina del vault."}
          </p>
        )}
      </section>
    </>
  );
}

/** Un numero con la sua barra: quanto è pieno, e quanto manca. */
function Riquadro({ nome, valore, nota, pieno }: { nome: string; valore: string; nota: string; pieno?: number }): ReactNode {
  const livello = pieno === undefined ? undefined : pieno >= 90 ? "pieno" : pieno >= 75 ? "quasi" : "bene";
  return (
    <div className="riquadro-ambiente">
      <div className="nome-riquadro">{nome}</div>
      <div className="valore-riquadro">{valore}</div>
      <div className="tenue nota-riquadro">{nota}</div>
      {pieno !== undefined && livello !== undefined && (
        <div className={`misura-ambiente ${livello}`} role="meter" aria-label={nome} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pieno)}>
          <span style={{ width: `${Math.min(Math.max(pieno, 0), 100)}%` }} />
        </div>
      )}
      {livello === "pieno" && <div className="avviso-riquadro">Quasi pieno</div>}
    </div>
  );
}

const LARGO = 320;
const ALTO = 120;
const MARGINE = { sopra: 8, destra: 8, sotto: 18, sinistra: 30 };

/** L'andamento di una misura da 0 a 100 negli ultimi minuti: una linea, con il valore di adesso in testa. */
function Andamento({
  titolo,
  storia,
  valore,
  adesso,
  dettaglio,
}: {
  titolo: string;
  storia: CampioneRisorse[];
  valore: (campione: CampioneRisorse) => number;
  adesso: string;
  dettaglio: (campione: CampioneRisorse) => string;
}): ReactNode {
  const idTitolo = useId();
  const tela = useRef<SVGSVGElement>(null);
  const [puntato, setPuntato] = useState<number>();
  const ultimo = storia.at(-1);
  const fine = ultimo === undefined ? Date.now() : Date.parse(ultimo.quando);
  // La finestra parte da un minuto e si allarga con la storia, fino a cinque: appena aperta la pagina il grafico non è schiacciato in un angolo.
  const primo = storia[0];
  const minuti = Math.min(Math.max(Math.ceil((fine - (primo === undefined ? fine : Date.parse(primo.quando))) / 60_000), 1), FINESTRA_MS / 60_000);
  const finestra = minuti * 60_000;
  const larghezza = LARGO - MARGINE.sinistra - MARGINE.destra;
  const altezza = ALTO - MARGINE.sopra - MARGINE.sotto;
  const x = (quando: string): number => MARGINE.sinistra + larghezza * (1 - (fine - Date.parse(quando)) / finestra);
  const y = (percentuale: number): number => MARGINE.sopra + altezza * (1 - Math.min(Math.max(percentuale, 0), 100) / 100);
  const punti = storia.map((campione) => ({ campione, x: x(campione.quando), y: y(valore(campione)) }));
  const linea = punti.map((punto, posto) => `${posto === 0 ? "M" : "L"}${punto.x.toFixed(1)},${punto.y.toFixed(1)}`).join(" ");
  const base = MARGINE.sopra + altezza;
  const area = punti.length < 2 ? "" : `${linea} L${punti.at(-1)?.x.toFixed(1)},${base} L${punti[0]?.x.toFixed(1)},${base} Z`;
  const scelto = puntato === undefined ? undefined : punti[puntato];
  const valori = storia.map(valore);

  // Il puntatore trova il campione più vicino in orizzontale: non serve centrare la linea.
  function trova(clientX: number): void {
    const riquadro = tela.current?.getBoundingClientRect();
    if (riquadro === undefined || punti.length === 0) return;
    const dove = ((clientX - riquadro.left) / riquadro.width) * LARGO;
    let vicino = 0;
    punti.forEach((punto, posto) => {
      if (Math.abs(punto.x - dove) < Math.abs((punti[vicino]?.x ?? 0) - dove)) vicino = posto;
    });
    setPuntato(vicino);
  }

  return (
    <figure className="andamento">
      <figcaption id={idTitolo}>
        <span className="nome-riquadro">{titolo}</span>
        <span className="valore-riquadro">{adesso}</span>
      </figcaption>
      <svg
        ref={tela}
        viewBox={`0 0 ${LARGO} ${ALTO}`}
        role="img"
        aria-labelledby={idTitolo}
        aria-description={valori.length === 0 ? "Ancora nessun campione." : `Negli ultimi minuti: da ${percento(Math.min(...valori))} a ${percento(Math.max(...valori))}.`}
        tabIndex={0}
        onPointerMove={(evento) => trova(evento.clientX)}
        onPointerDown={(evento) => trova(evento.clientX)}
        onPointerLeave={() => setPuntato(undefined)}
        onBlur={() => setPuntato(undefined)}
        onKeyDown={(evento) => {
          if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
          evento.preventDefault();
          setPuntato((prima) => Math.min(Math.max((prima ?? punti.length - 1) + (evento.key === "ArrowLeft" ? -1 : 1), 0), punti.length - 1));
        }}
      >
        {[0, 50, 100].map((tacca) => (
          <g key={tacca}>
            <line className="griglia" x1={MARGINE.sinistra} x2={LARGO - MARGINE.destra} y1={y(tacca)} y2={y(tacca)} />
            <text className="tacca" x={MARGINE.sinistra - 6} y={y(tacca)} textAnchor="end" dominantBaseline="middle">
              {tacca}%
            </text>
          </g>
        ))}
        <text className="tacca" x={MARGINE.sinistra} y={ALTO - 4}>
          {minuti} min fa
        </text>
        <text className="tacca" x={LARGO - MARGINE.destra} y={ALTO - 4} textAnchor="end">
          adesso
        </text>
        {area !== "" && <path className="campitura" d={area} />}
        {punti.length > 1 && <path className="linea" d={linea} />}
        {scelto !== undefined && <line className="mirino" x1={scelto.x} x2={scelto.x} y1={MARGINE.sopra} y2={base} />}
        {(scelto ?? punti.at(-1)) !== undefined && <circle className="punto" cx={(scelto ?? punti.at(-1))?.x} cy={(scelto ?? punti.at(-1))?.y} r={4} />}
      </svg>
      <div className="lettura-andamento" aria-live="off">
        {scelto === undefined ? (
          <span className="tenue">{punti.length < 2 ? "Il grafico si riempie mentre guardi." : "Tocca il grafico, o passaci sopra, per leggere un momento."}</span>
        ) : (
          <>
            <strong>{dettaglio(scelto.campione)}</strong>{" "}
            <span className="tenue">alle {new Date(scelto.campione.quando).toLocaleTimeString("it-IT")}</span>
          </>
        )}
      </div>
    </figure>
  );
}

function Processi({ processi, quanti }: { processi: ProcessoAttivo[]; quanti: number }): ReactNode {
  const massimo = Math.max(100, ...processi.map((uno) => uno.cpu));
  return (
    <>
      <div className="tabella-scorre">
        <table className="tabella-ambiente">
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col" className="numero">
                Processore
              </th>
              <th scope="col" className="numero">
                Memoria
              </th>
              <th scope="col" className="numero">
                PID
              </th>
            </tr>
          </thead>
          <tbody>
            {processi.map((processo) => (
              <tr key={processo.pid}>
                <td>
                  <div className="nome">{processo.nome}</div>
                  {processo.comando !== undefined && processo.comando !== processo.nome && <div className="tenue comando-processo">{processo.comando}</div>}
                </td>
                <td className="numero">
                  {percento(processo.cpu)}
                  <span className="barretta" aria-hidden="true">
                    <span style={{ width: `${(processo.cpu / massimo) * 100}%` }} />
                  </span>
                </td>
                <td className="numero">{pesoInBreve(processo.memoria)}</td>
                <td className="numero tenue">{processo.pid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tenue">
        {processi.length < quanti ? `I ${processi.length} che pesano di più, su ${quanti}.` : `${quanti} ${quanti === 1 ? "processo" : "processi"}.`} Il processore è in percentuale di un nucleo.
      </p>
    </>
  );
}

/**
 * I processi accesi da Shinka in questo ambiente, per progetto: le conversazioni con i loro comandi e
 * i loro server (CodeGraph, i modelli locali), i terminali, le applicazioni. Uno bloccato si termina,
 * con ciò che ha avviato.
 */
function ProcessiDiShinka({ idAmbiente, processi }: { idAmbiente: string; processi: ProcessoDiShinka[] }): ReactNode {
  const quadro = useQuadroCorrente();
  const progetti = (quadro.progetti?.progetti ?? []).filter((progetto) => progetto.idAmbiente === idAmbiente);
  const gruppi = processiPerProgetto(processi, progetti);
  const [daTerminare, setDaTerminare] = useState<number>();
  const [esito, setEsito] = useState<{ pid: number; errore?: string }>();
  const termina = (pid: number): void => {
    setDaTerminare(undefined);
    setEsito({ pid });
    terminaProcesso(idAmbiente, pid)
      .then(() => setEsito(undefined))
      .catch((causa: unknown) => setEsito({ pid, errore: causa instanceof Error ? causa.message : "Non si è terminato." }));
  };
  return (
    <section className="processi-di-shinka">
      <h2 className="titolo-sezione">Processi di Shinka</h2>
      {gruppi.length === 0 && <p className="tenue">In questo momento Shinka non ha processi accesi qui, oltre a sé stessa.</p>}
      {gruppi.map((gruppo) => (
        <div key={gruppo.progetto?.id ?? "shinka"} className="gruppo-processi">
          <h3>
            {gruppo.progetto === undefined ? "Shinka" : <a href={frammentoDi({ tipo: "progetto", id: gruppo.progetto.id })}>{gruppo.progetto.nome}</a>}
            <span className="tenue">
              {" "}
              · {percento(gruppo.cpu)} · {pesoInBreve(gruppo.memoria)}
            </span>
          </h3>
          <ul>
            {gruppo.righe.map(({ processo, livello }) => {
              const tipo = cheCosE(processo);
              return (
                <li key={processo.pid} style={{ paddingLeft: `${livello * 16}px` }}>
                  <div className="riga-processo">
                    <span className="nome">
                      {processo.nome}
                      {tipo !== undefined && <span className="tenue"> · {tipo}</span>}
                    </span>
                    <span className="numero">{percento(processo.cpu)}</span>
                    <span className="numero">{pesoInBreve(processo.memoria)}</span>
                    {daTerminare === processo.pid ? (
                      <span className="pulsanti">
                        <button type="button" className="mini pericolo" onClick={() => termina(processo.pid)}>
                          Termina
                        </button>
                        <button type="button" className="mini discreto" onClick={() => setDaTerminare(undefined)}>
                          No
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="mini discreto" disabled={esito?.pid === processo.pid && esito.errore === undefined} onClick={() => setDaTerminare(processo.pid)}>
                        {esito?.pid === processo.pid && esito.errore === undefined ? "Termino…" : "Termina…"}
                      </button>
                    )}
                  </div>
                  {processo.comando !== undefined && <div className="tenue comando-processo">{processo.comando}</div>}
                  {esito?.pid === processo.pid && esito.errore !== undefined && <p className="errore">{esito.errore}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="tenue">Terminare un processo ferma anche ciò che ha avviato. Una conversazione terminata riparte al prossimo messaggio.</p>
    </section>
  );
}

const STATI: Record<string, { parola: string; tono: "bene" | "male" | "attesa" | "fermo" }> = {
  running: { parola: "acceso", tono: "bene" },
  exited: { parola: "fermo", tono: "fermo" },
  created: { parola: "creato", tono: "fermo" },
  paused: { parola: "in pausa", tono: "attesa" },
  restarting: { parola: "si riavvia", tono: "attesa" },
  dead: { parola: "guasto", tono: "male" },
};

function Docker({ letto, host }: { letto: DockerLetto; host?: string }): ReactNode {
  const accesi = letto.contenitori.filter((uno) => uno.stato === "running").length;
  return (
    <div className="docker-ambiente">
      <h3>
        {host === undefined ? "Docker di questo ambiente" : `Docker di ${host}`}
        {letto.stato === "attivo" && (
          <span className="tenue">
            {" "}
            · {accesi} accesi su {letto.contenitori.length}
          </span>
        )}
      </h3>
      {host !== undefined && <p className="tenue">Letti dal gateway con la credenziale dell'host per gli stack, in sola lettura, finché questa pagina è aperta.</p>}
      {letto.stato === "non-raggiungibile" && <p className="tenue">Docker non si lascia leggere. {letto.motivo}</p>}
      {letto.stato === "assente" && <p className="tenue">Su questa macchina Docker non c'è.</p>}
      {letto.stato === "attivo" && letto.contenitori.length === 0 && <p className="tenue">Nessun container.</p>}
      {letto.contenitori.length > 0 && (
        <div className="tabella-scorre">
          <table className="tabella-ambiente">
            <thead>
              <tr>
                <th scope="col">Container</th>
                <th scope="col">Stato</th>
                <th scope="col" className="numero">
                  Processore
                </th>
                <th scope="col" className="numero">
                  Memoria
                </th>
              </tr>
            </thead>
            <tbody>
              {letto.contenitori.map((contenitore) => (
                <RigaContenitore key={contenitore.nome} contenitore={contenitore} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RigaContenitore({ contenitore }: { contenitore: ContenitoreDocker }): ReactNode {
  const stato = STATI[contenitore.stato] ?? { parola: contenitore.stato, tono: "fermo" as const };
  return (
    <tr>
      <td>
        <div className="nome">
          {contenitore.nome}
          {contenitore.diShinka === true && <span className="genere-spazio">stack di Shinka</span>}
        </div>
        <div className="tenue comando-processo">
          {contenitore.immagine}
          {contenitore.porte === "" ? "" : ` · ${contenitore.porte}`}
        </div>
      </td>
      <td>
        <span className={`stato-contenitore ${stato.tono}`}>{stato.parola}</span>
        <div className="tenue">{contenitore.dettaglio}</div>
      </td>
      <td className="numero">{contenitore.cpu === undefined ? "" : percento(contenitore.cpu)}</td>
      <td className="numero">
        {contenitore.memoria === undefined ? (
          ""
        ) : (
          <>
            {pesoInBreve(contenitore.memoria.usata)}
            {contenitore.memoria.limite > 0 && <div className="tenue">di {pesoInBreve(contenitore.memoria.limite)}</div>}
          </>
        )}
      </td>
    </tr>
  );
}
