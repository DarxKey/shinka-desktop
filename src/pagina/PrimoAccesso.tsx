import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { StatoApp } from "../ponte/tipi.ts";
import { ponte } from "./ponte.ts";

/**
 * Il primo accesso (ADR 0004): l'indirizzo del centro, la password del proprietario e il nome con
 * cui questo PC comparirà tra i dispositivi. La password serve una volta sola: da lì in poi l'app
 * entra con un gettone suo, che il proprietario può togliere dal centro quando vuole.
 */
export function PrimoAccesso({ stato }: { stato: StatoApp }): ReactNode {
  const [centro, setCentro] = useState(stato.centro);
  const [nome, setNome] = useState(stato.nome);
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string>();
  const [inCorso, setInCorso] = useState(false);
  /** Quando si può riprovare, se il centro ha chiesto di aspettare. */
  const [riprovaAlle, setRiprovaAlle] = useState<number>();
  const [adesso, setAdesso] = useState(() => Date.now());

  useEffect(() => {
    if (riprovaAlle === undefined) return;
    const battito = setInterval(() => setAdesso(Date.now()), 1000);
    return () => clearInterval(battito);
  }, [riprovaAlle]);

  const attesa = riprovaAlle === undefined ? 0 : Math.max(0, Math.ceil((riprovaAlle - adesso) / 1000));

  async function invia(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setInCorso(true);
    setErrore(undefined);
    try {
      const esito = await ponte.entra(centro, password, nome);
      if (esito.riuscito) return;
      setErrore(esito.errore);
      setPassword("");
      if (esito.riprovaTraSecondi !== undefined) {
        setAdesso(Date.now());
        setRiprovaAlle(Date.now() + esito.riprovaTraSecondi * 1000);
      }
    } catch {
      setErrore("L'accesso non è riuscito.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main className="schermata primo-accesso">
      <h1>Shinka</h1>
      {stato.avviso !== undefined && (
        <p className="avviso-accesso" role="status">
          {stato.avviso}
        </p>
      )}
      <form className="accesso" onSubmit={(evento) => void invia(evento)}>
        <label htmlFor="centro">Indirizzo del centro</label>
        <input
          id="centro"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://shinka.example"
          autoFocus={centro === ""}
          value={centro}
          onChange={(evento) => setCentro(evento.target.value)}
        />
        <label htmlFor="password">Password del proprietario</label>
        <input
          id="password"
          type="password"
          autoComplete="off"
          autoFocus={centro !== ""}
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
        <label htmlFor="nome">Nome di questo PC</label>
        <input id="nome" type="text" autoComplete="off" maxLength={60} value={nome} onChange={(evento) => setNome(evento.target.value)} />
        <button type="submit" disabled={inCorso || attesa > 0 || password === "" || centro.trim() === ""}>
          {inCorso ? "Controllo…" : attesa > 0 ? `Riprova tra ${attesa} s` : "Collega questo PC"}
        </button>
        {errore !== undefined && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </form>
      <p className="nota-accesso">
        La password serve solo adesso e non viene conservata. Questo PC riceve un accesso suo, che puoi togliere dal centro alla pagina Sicurezza.
      </p>
    </main>
  );
}
