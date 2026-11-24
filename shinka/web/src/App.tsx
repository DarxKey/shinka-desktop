import { useCallback, useEffect, useState, type ReactNode } from "react";
import { leggiStato, type StatoAccesso } from "./api.ts";
import { Accesso, PrimoAvvio } from "./Accesso.tsx";
import { Guscio } from "./Guscio.tsx";

export function App(): ReactNode {
  const [accesso, setAccesso] = useState<StatoAccesso>();
  const [errore, setErrore] = useState<string>();

  const aggiorna = useCallback(async () => {
    try {
      setAccesso(await leggiStato());
      setErrore(undefined);
    } catch {
      setErrore("Il centro di Shinka non risponde.");
    }
  }, []);

  useEffect(() => {
    void aggiorna();
  }, [aggiorna]);

  if (errore !== undefined) {
    return (
      <Schermata>
        <p>{errore}</p>
        <button type="button" onClick={() => void aggiorna()}>
          Riprova
        </button>
      </Schermata>
    );
  }
  if (accesso === undefined) return <Schermata>Carico…</Schermata>;
  if (!accesso.configurato && accesso.primoAvvio === true) {
    return <PrimoAvvio alSuccesso={() => void aggiorna()} />;
  }
  if (!accesso.configurato) {
    return (
      <Schermata>
        <p>La password del proprietario non è ancora stata impostata.</p>
        <p>
          Sulla macchina dove gira il centro esegui <code>npm run imposta:password</code>, poi
          ricarica questa pagina.
        </p>
      </Schermata>
    );
  }
  if (!accesso.autenticato) return <Accesso alSuccesso={() => void aggiorna()} />;
  return <Guscio allUscita={() => void aggiorna()} />;
}

export function Schermata({ children }: { children: ReactNode }): ReactNode {
  return (
    <main className="schermata">
      <h1>Shinka</h1>
      {children}
    </main>
  );
}
