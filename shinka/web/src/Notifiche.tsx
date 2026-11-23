/**
 * La sezione Notifiche della pagina Impostazioni: accende e spegne le notifiche dell'app su
 * questo dispositivo, le prova, e mostra i dispositivi iscritti.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { StatoNotifiche } from "../../src/centro/notifiche-app.ts";
import { CANALI_AVVISO, GENERI_AVVISO, type CanaleAvviso, type GenereAvviso } from "../../src/protocollo/avvisi.ts";
import { impostaContattoNotifiche, impostaScelteNotifiche, iscriviNotifiche, leggiNotifiche, provaNotifiche, togliNotifiche } from "./api.ts";
import { momentoInBreve } from "./descrivi.ts";
import { accendiNotifiche, condizioneNotifiche, nomeDiQuestoDispositivo, spegniNotifiche, type CondizioneNotifiche } from "./notifiche.ts";

const PERCHE_NO: Partial<Record<CondizioneNotifiche, string>> = {
  "non-disponibili": "Questo browser non sa ricevere notifiche.",
  "da-aggiungere":
    "Su iPhone e iPad le notifiche arrivano solo all'app aggiunta alla schermata Home: in Safari tocca Condividi, poi «Aggiungi alla schermata Home», apri Shinka da lì e torna in questa pagina. Serve iOS 16.4 o più recente.",
  "serve-https": "Le notifiche vogliono un collegamento sicuro: apri Shinka dal suo indirizzo HTTPS.",
  negate: "Le notifiche di Shinka sono negate in questo browser: si riaccendono dalle impostazioni del browser, o del telefono, alla voce di Shinka.",
};

const NOMI_GENERI: Record<GenereAvviso, { nome: string; nota: string }> = {
  richieste: { nome: "Richieste che aspettano te", nota: "consensi, approvazioni, schede da confermare" },
  lavori: { nome: "Lavori finiti", nota: "un progetto o la Home hanno finito, o aspettano una tua risposta" },
  programmati: { nome: "Lavori programmati", nota: "la loro risposta finale" },
};
const NOMI_CANALI: Record<CanaleAvviso, string> = { app: "App", telegram: "Telegram" };

export function SezioneNotifiche(): ReactNode {
  const [stato, setStato] = useState<StatoNotifiche>();
  const [qui, setQui] = useState<{ condizione: CondizioneNotifiche; endpoint?: string }>();
  const [lavoro, setLavoro] = useState(false);
  const [detto, setDetto] = useState<{ testo: string; errore?: true }>();
  const [contatto, setContatto] = useState<string>();

  const ricarica = useCallback(async () => {
    const [delCentro, diQui] = await Promise.all([leggiNotifiche(), condizioneNotifiche()]);
    setStato(delCentro);
    setQui(diQui);
  }, []);
  useEffect(() => {
    ricarica().catch((causa: unknown) => setDetto({ testo: causa instanceof Error ? causa.message : "Non riesco a leggere le notifiche.", errore: true }));
  }, [ricarica]);

  async function fai(azione: () => Promise<string | undefined>): Promise<void> {
    setLavoro(true);
    setDetto(undefined);
    try {
      const esito = await azione();
      await ricarica();
      if (esito !== undefined) setDetto({ testo: esito });
    } catch (causa) {
      setDetto({ testo: causa instanceof Error ? causa.message : "Non è stato possibile.", errore: true });
    } finally {
      setLavoro(false);
    }
  }

  const accendi = (): Promise<void> =>
    fai(async () => {
      if (stato === undefined) return undefined;
      await iscriviNotifiche(await accendiNotifiche(stato.chiave), nomeDiQuestoDispositivo());
      return "Accese su questo dispositivo. Prova a mandartene una.";
    });
  const spegni = (): Promise<void> =>
    fai(async () => {
      const endpoint = (await spegniNotifiche()) ?? qui?.endpoint;
      if (endpoint !== undefined) await togliNotifiche(endpoint);
      return "Spente su questo dispositivo.";
    });
  const prova = (endpoint?: string): Promise<void> =>
    fai(async () => {
      const esiti = await provaNotifiche(endpoint);
      if (esiti.length === 0) return "Nessun dispositivo iscritto.";
      const falliti = esiti.filter((uno) => uno.esito.esito !== "mandata");
      if (falliti.length === 0) return "Mandata: dovrebbe arrivare tra un momento. Se l'app è aperta in primo piano, alcuni telefoni non la mostrano.";
      throw new Error(falliti.map((uno) => `${uno.nome}: ${uno.esito.esito === "fallita" ? uno.esito.motivo : "l'iscrizione non valeva più, ed è stata tolta"}`).join(" "));
    });

  const diQuesto = stato?.dispositivi.find((uno) => uno.endpoint === qui?.endpoint);
  // Il browser ha un'iscrizione che il centro non conosce più: va rifatta.
  const daRifare = qui?.condizione === "accese" && stato !== undefined && diQuesto === undefined;

  return (
    <section aria-labelledby="titolo-notifiche">
      <h2 id="titolo-notifiche">Notifiche dell'app</h2>
      <p className="tenue">
        Gli stessi avvisi di Telegram, come notifiche su questo dispositivo: una richiesta che aspetta te, un lavoro finito, la risposta di un lavoro
        programmato. Toccandone una si apre la conversazione. Arrivano cifrate: il servizio di notifiche del browser le consegna senza poterle leggere.
      </p>
      {qui === undefined || stato === undefined ? (
        detto === undefined && <p className="tenue">Controllo…</p>
      ) : PERCHE_NO[qui.condizione] !== undefined ? (
        <p className="tenue">{PERCHE_NO[qui.condizione]}</p>
      ) : (
        <div className="pulsanti">
          {qui.condizione === "accese" && !daRifare ? (
            <>
              <button type="button" disabled={lavoro} onClick={() => void prova(qui.endpoint)}>
                Manda una notifica di prova
              </button>
              <button type="button" className="discreto" disabled={lavoro} onClick={() => void spegni()}>
                Spegni su questo dispositivo
              </button>
            </>
          ) : (
            <button type="button" disabled={lavoro} onClick={() => void accendi()}>
              {daRifare ? "Riaccendi le notifiche su questo dispositivo" : "Accendi le notifiche su questo dispositivo"}
            </button>
          )}
        </div>
      )}
      {detto !== undefined && (
        <p className={detto.errore === true ? "errore" : "tenue"} role={detto.errore === true ? "alert" : "status"}>
          {detto.testo}
        </p>
      )}
      {stato !== undefined && stato.dispositivi.length > 0 && (
        <ul className="elenco-dispositivi">
          {stato.dispositivi.map((dispositivo) => (
            <li key={dispositivo.endpoint}>
              <span className="nome">{dispositivo.nome}</span>
              <span className="tenue">
                {dispositivo.endpoint === qui?.endpoint ? "questo dispositivo · " : ""}dal {momentoInBreve(dispositivo.iscrittoIl)}
              </span>
              {dispositivo.endpoint !== qui?.endpoint && (
                <button type="button" className="discreto piccolo" disabled={lavoro} onClick={() => void fai(async () => void (await togliNotifiche(dispositivo.endpoint)))}>
                  Togli
                </button>
              )}
              {dispositivo.problema !== undefined && <span className="errore">L'ultima non è partita. {dispositivo.problema}</span>}
            </li>
          ))}
        </ul>
      )}
      {stato !== undefined && (
        <div className="scelte-avvisi">
          <h3>Che cosa arriva dove</h3>
          <table>
            <thead>
              <tr>
                <td />
                {CANALI_AVVISO.map((canale) => (
                  <th key={canale} scope="col">
                    {NOMI_CANALI[canale]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GENERI_AVVISO.map((genere) => (
                <tr key={genere}>
                  <th scope="row">
                    {NOMI_GENERI[genere].nome}
                    <span className="tenue">{NOMI_GENERI[genere].nota}</span>
                  </th>
                  {CANALI_AVVISO.map((canale) => (
                    <td key={canale}>
                      <input
                        type="checkbox"
                        aria-label={`${NOMI_GENERI[genere].nome}: ${NOMI_CANALI[canale]}`}
                        checked={stato.scelte[canale][genere]}
                        disabled={lavoro}
                        onChange={(evento) =>
                          void fai(async () => {
                            await impostaScelteNotifiche({ ...stato.scelte, [canale]: { ...stato.scelte[canale], [genere]: evento.target.checked } });
                            return undefined;
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tenue">
            Su Telegram una richiesta ha i pulsanti per decidere; dall'app la apri e decidi dalla scheda. Ciò che scrivi alla Home da Telegram ha
            sempre lì la sua risposta e le sue richieste, e così i messaggi del gateway. Se nessun dispositivo riceve le notifiche dell'app, su
            Telegram arriva tutto comunque: non resti senza avvisi.
          </p>
        </div>
      )}
      {stato !== undefined && (
        <details className="contatto-notifiche" open={stato.contattoGenerico}>
          <summary className="tenue">Il contatto dichiarato ai servizi di notifiche</summary>
          <p className="tenue">
            I servizi di notifiche chiedono a chi manda un contatto. Quello di Apple, per l'iPhone, vuole un indirizzo email vero: con quello
            generico di Shinka rifiuta le notifiche. L'indirizzo che scrivi qui va a quei servizi insieme a ogni notifica, come recapito di chi la manda.
          </p>
          <form
            className="modulo-impostazioni"
            onSubmit={(evento) => {
              evento.preventDefault();
              void fai(async () => {
                await impostaContattoNotifiche(contatto ?? "");
                setContatto(undefined);
                return "Contatto salvato.";
              });
            }}
          >
            <label>
              Indirizzo email
              <input type="text" inputMode="email" placeholder="nome@esempio.it" value={contatto ?? (stato.contattoGenerico ? "" : stato.contatto.replace(/^mailto:/, ""))} maxLength={200} autoCapitalize="none" spellCheck={false} onChange={(evento) => setContatto(evento.target.value)} />
            </label>
            <div className="pulsanti">
              <button type="submit" disabled={lavoro || contatto === undefined}>
                Salva
              </button>
              <button type="button" className="discreto" disabled={lavoro} onClick={() => void fai(async () => void (await impostaContattoNotifiche("")))}>
                Torna a quello generico
              </button>
            </div>
          </form>
        </details>
      )}
    </section>
  );
}
