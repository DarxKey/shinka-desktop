import { useState, type FormEvent, type ReactNode } from "react";
import { entra, primoAvvio } from "./api.ts";
import { Schermata } from "./App.tsx";

export function Accesso({ alSuccesso }: { alSuccesso: () => void }): ReactNode {
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);

  async function invia(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setInCorso(true);
    setErrore(undefined);
    try {
      await entra(password);
      alSuccesso();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Accesso non riuscito.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Schermata>
      <form className="accesso" onSubmit={(evento) => void invia(evento)}>
        <label htmlFor="password">Password del proprietario</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
        <button type="submit" disabled={inCorso || password === ""}>
          {inCorso ? "Controllo…" : "Entra"}
        </button>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
    </Schermata>
  );
}

/** Chiave di sessione con cui la pagina Impostazioni sa di dover dare il benvenuto. */
export const CHIAVE_BENVENUTO = "shinka-benvenuto";

/**
 * Il primo avvio di un'installazione nuova: il codice che installa.sh ha mostrato, e la password
 * scelta due volte. Poi la pagina Impostazioni guida per il resto.
 */
export function PrimoAvvio({ alSuccesso }: { alSuccesso: () => void }): ReactNode {
  const [codice, setCodice] = useState("");
  const [password, setPassword] = useState("");
  const [ripetuta, setRipetuta] = useState("");
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  const corta = password !== "" && password.length < 10;
  const diverse = ripetuta !== "" && password !== ripetuta;

  async function invia(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    if (corta || diverse) return;
    setInCorso(true);
    setErrore(undefined);
    try {
      await primoAvvio(codice, password);
      sessionStorage.setItem(CHIAVE_BENVENUTO, "1");
      window.location.hash = "#/impostazioni";
      alSuccesso();
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : "Non è andata.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Schermata>
      <form className="accesso" onSubmit={(evento) => void invia(evento)}>
        <p>Benvenuto: questa installazione di Shinka è nuova. Scegli la password con cui entrerai.</p>
        <label htmlFor="codice">Codice di primo avvio</label>
        <input id="codice" autoComplete="off" spellCheck={false} autoFocus value={codice} onChange={(evento) => setCodice(evento.target.value)} />
        <p className="tenue">L'ha scritto installa.sh alla fine; c'è anche nel registro del centro (docker compose logs centro).</p>
        <label htmlFor="nuova">Password nuova</label>
        <input id="nuova" type="password" autoComplete="new-password" value={password} onChange={(evento) => setPassword(evento.target.value)} />
        <label htmlFor="ripetuta">Ripeti la password</label>
        <input id="ripetuta" type="password" autoComplete="new-password" value={ripetuta} onChange={(evento) => setRipetuta(evento.target.value)} />
        {corta && <p className="tenue">Almeno 10 caratteri.</p>}
        {diverse && <p className="tenue">Le due password non sono uguali.</p>}
        <button type="submit" disabled={inCorso || codice.trim() === "" || password === "" || ripetuta === "" || corta || diverse}>
          {inCorso ? "Controllo…" : "Comincia"}
        </button>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
    </Schermata>
  );
}
