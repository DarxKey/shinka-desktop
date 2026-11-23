import { createContext, useContext, useEffect, useState } from "react";
import type { StatoAnteprima } from "../../src/protocollo/anteprima.ts";
import type { StatoArgomenti } from "../../src/protocollo/argomenti.ts";
import type { StatoEstensioni } from "../../src/protocollo/estensioni.ts";
import type { StatoMemoria } from "../../src/protocollo/memoria.ts";
import type { StatoAmbienti } from "../../src/protocollo/nodi.ts";
import type { StatoSkill } from "../../src/protocollo/skill.ts";
import type { CondizioneProgetto, StatoProgetti } from "../../src/protocollo/progetti.ts";
import type { VaultInBreve } from "../../src/protocollo/vault.ts";

/**
 * Il quadro: ambienti, progetti, argomenti della Home, memoria, skill, estensioni, vault e anteprima come stanno ora.
 * Ciascuno manca finché il centro non lo ha mandato.
 */
export interface Quadro {
  ambienti: StatoAmbienti | undefined;
  progetti: StatoProgetti | undefined;
  argomenti: StatoArgomenti | undefined;
  memoria: StatoMemoria | undefined;
  skill: StatoSkill | undefined;
  /** Manca anche in un'installazione di Shinka che non ha le estensioni. */
  estensioni: StatoEstensioni | undefined;
  vault: VaultInBreve | undefined;
  /** Quale anteprima è aperta, e da quale porta del centro la si vede. */
  anteprima: StatoAnteprima | undefined;
  /** Se la Home lavora o aspetta il proprietario. */
  home: { condizione: CondizioneProgetto } | undefined;
}

const QUADRO_VUOTO: Quadro = {
  ambienti: undefined,
  progetti: undefined,
  argomenti: undefined,
  memoria: undefined,
  skill: undefined,
  estensioni: undefined,
  vault: undefined,
  anteprima: undefined,
  home: undefined,
};

/**
 * Il quadro, tenuto aggiornato dal centro con un solo flusso per tutto:
 * un browser tiene aperti pochi collegamenti verso lo stesso sito, e ogni flusso ne occupa uno.
 */
export function useQuadro(): Quadro {
  const [quadro, setQuadro] = useState<Quadro>(QUADRO_VUOTO);
  useEffect(() => {
    const sorgente = new EventSource("/api/quadro/eventi");
    sorgente.addEventListener("ambienti", (messaggio: MessageEvent<string>) => {
      const ambienti = JSON.parse(messaggio.data) as StatoAmbienti;
      setQuadro((prima) => ({ ...prima, ambienti }));
    });
    sorgente.addEventListener("progetti", (messaggio: MessageEvent<string>) => {
      const progetti = JSON.parse(messaggio.data) as StatoProgetti;
      setQuadro((prima) => ({ ...prima, progetti }));
    });
    sorgente.addEventListener("argomenti", (messaggio: MessageEvent<string>) => {
      const argomenti = JSON.parse(messaggio.data) as StatoArgomenti;
      setQuadro((prima) => ({ ...prima, argomenti }));
    });
    sorgente.addEventListener("memoria", (messaggio: MessageEvent<string>) => {
      const memoria = JSON.parse(messaggio.data) as StatoMemoria;
      setQuadro((prima) => ({ ...prima, memoria }));
    });
    sorgente.addEventListener("skill", (messaggio: MessageEvent<string>) => {
      const skill = JSON.parse(messaggio.data) as StatoSkill;
      setQuadro((prima) => ({ ...prima, skill }));
    });
    sorgente.addEventListener("estensioni", (messaggio: MessageEvent<string>) => {
      const estensioni = JSON.parse(messaggio.data) as StatoEstensioni;
      setQuadro((prima) => ({ ...prima, estensioni }));
    });
    sorgente.addEventListener("vault", (messaggio: MessageEvent<string>) => {
      const vault = JSON.parse(messaggio.data) as VaultInBreve;
      setQuadro((prima) => ({ ...prima, vault }));
    });
    sorgente.addEventListener("home", (messaggio: MessageEvent<string>) => {
      const home = JSON.parse(messaggio.data) as { condizione: CondizioneProgetto };
      setQuadro((prima) => ({ ...prima, home }));
    });
    sorgente.addEventListener("anteprima", (messaggio: MessageEvent<string>) => {
      const anteprima = JSON.parse(messaggio.data) as StatoAnteprima;
      setQuadro((prima) => ({ ...prima, anteprima }));
    });
    return () => sorgente.close();
  }, []);
  return quadro;
}

const ContestoQuadro = createContext<Quadro>(QUADRO_VUOTO);

export const FornitoreQuadro = ContestoQuadro.Provider;

/** Il quadro per i componenti che ne hanno bisogno senza riceverlo da chi li usa. */
export function useQuadroCorrente(): Quadro {
  return useContext(ContestoQuadro);
}
