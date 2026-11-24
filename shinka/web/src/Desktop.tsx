/**
 * La sezione Shinka Desktop delle Impostazioni (ADR 0049): quale versione dell'app il centro serve
 * agli aggiornamenti, e da quando; e la pubblicazione di una nuova, presa dalla cartella del
 * progetto Shinka Desktop in cui electron-builder l'ha costruita, con la password di Shinka.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { FonteDiPubblicazione, StatoDesktop } from "../../src/protocollo/desktop.ts";
import { leggiDesktop, pubblicaDesktop } from "./api.ts";
import { momentoInBreve } from "./descrivi.ts";

const CHIAVE_SCELTE = "shinka.desktop.pubblicazione";

function scelteRicordate(): { fonte?: string; cartella?: string } {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_SCELTE) ?? "{}") as { fonte?: string; cartella?: string };
  } catch {
    return {};
  }
}

/** Una fonte in una chiave sola: il progetto, e l'ambiente se è una cartella collegata. */
function chiaveDi(fonte: FonteDiPubblicazione): string {
  return `${fonte.idProgetto}|${fonte.idAmbiente ?? ""}`;
}

export function SezioneDesktop(): ReactNode {
  const [stato, setStato] = useState<StatoDesktop>();
  const ricordate = scelteRicordate();
  const fonti = stato?.fonti ?? [];
  const proposta = fonti.find((fonte) => chiaveDi(fonte) === ricordate.fonte) ?? fonti.find((fonte) => /desktop/i.test(fonte.cartella)) ?? fonti[0];
  const [chiave, setChiave] = useState("");
  const scelta = fonti.find((fonte) => chiaveDi(fonte) === chiave) ?? proposta;
  const [cartella, setCartella] = useState(ricordate.cartella ?? "release");
  const [password, setPassword] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<{ errore?: string; fatto?: string }>({});

  useEffect(() => {
    leggiDesktop()
      .then(setStato)
      .catch(() => setStato({}));
  }, []);

  const pubblicata = stato?.pubblicata;
  return (
    <section aria-labelledby="titolo-desktop" className="sezione-desktop">
      <h2 id="titolo-desktop">Shinka Desktop</h2>
      <p className="tenue">
        L'app per Windows si aggiorna da qui: all'avvio e ogni qualche ora chiede al centro se c'è una versione nuova, e la scarica da sola.
      </p>
      {stato !== undefined && (
        <p>
          {pubblicata === undefined ? (
            "Nessuna versione pubblicata."
          ) : (
            <>
              Pubblicata la versione <strong>{pubblicata.versione}</strong>, {momentoInBreve(pubblicata.quando)} ({pubblicata.dimensione < 1024 * 1024 ? `${Math.max(1, Math.round(pubblicata.dimensione / 1024))} KB` : `${(pubblicata.dimensione / 1024 / 1024).toFixed(1)} MB`}).
            </>
          )}
        </p>
      )}
      <form
        className="modulo-impostazioni pubblica-desktop"
        onSubmit={(evento) => {
          evento.preventDefault();
          setLavoro(true);
          setEsito({});
          if (scelta === undefined) return;
          localStorage.setItem(CHIAVE_SCELTE, JSON.stringify({ fonte: chiaveDi(scelta), cartella }));
          pubblicaDesktop({ idProgetto: scelta.idProgetto, ...(scelta.idAmbiente === undefined ? {} : { idAmbiente: scelta.idAmbiente }), cartella, password })
            .then((nuovo) => {
              setStato(nuovo);
              setPassword("");
              setEsito({ fatto: `Pubblicata la versione ${nuovo.pubblicata?.versione ?? ""}: le app la prendono al prossimo controllo.` });
            })
            .catch((causa: unknown) => setEsito({ errore: causa instanceof Error ? causa.message : "Non si è pubblicata." }))
            .finally(() => setLavoro(false));
        }}
      >
        <p className="tenue">
          Per pubblicarne una nuova: la cartella in cui l'hai costruita (di un progetto, o collegata a un progetto) e, dentro, quella in cui
          electron-builder ha messo latest.yml, l'installer e il suo .blockmap. Il centro li prende da lì, controlla che l'installer sia quello di latest.yml e che la versione venga dopo quella pubblicata.
        </p>
        <label>
          Dove l'hai costruita
          <select value={scelta === undefined ? "" : chiaveDi(scelta)} onChange={(evento) => setChiave(evento.target.value)} required disabled={lavoro}>
            {fonti.length === 0 && <option value="">Nessun progetto</option>}
            {fonti.map((fonte) => (
              <option key={chiaveDi(fonte)} value={chiaveDi(fonte)}>
                {fonte.idAmbiente === undefined ? `${fonte.nomeProgetto} · ${fonte.nomeAmbiente}` : `${fonte.cartella} · ${fonte.nomeAmbiente}, collegata a ${fonte.nomeProgetto}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cartella, dentro quella
          <input value={cartella} onChange={(evento) => setCartella(evento.target.value)} placeholder="release" spellCheck={false} autoCapitalize="none" disabled={lavoro} />
        </label>
        <label>
          Password di Shinka
          <input type="password" value={password} onChange={(evento) => setPassword(evento.target.value)} autoComplete="current-password" required disabled={lavoro} />
        </label>
        <div className="pulsanti">
          <button type="submit" className="approva" disabled={lavoro || scelta === undefined || password === ""}>
            {lavoro ? "Pubblico…" : "Pubblica"}
          </button>
        </div>
        {esito.fatto !== undefined && (
          <p className="tenue" role="status">
            {esito.fatto}
          </p>
        )}
        {esito.errore !== undefined && (
          <p className="errore" role="alert">
            {esito.errore}
          </p>
        )}
      </form>
    </section>
  );
}
