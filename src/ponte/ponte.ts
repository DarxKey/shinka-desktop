/**
 * Il ponte: l'unica cosa dell'app che la pagina vede. Gira accanto alla pagina, chiuso nella
 * sandbox, e passa al processo principale poche richieste precise.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { Comando } from "./scorciatoie.ts";
import { CANALI, NOME_DEL_PONTE, type EsitoAccesso, type MessaggioDelFlusso, type Ponte, type ShellDisponibile, type StatoApp, type TerminaleAperto } from "./tipi.ts";

const flussi = new Map<string, (messaggi: MessaggioDelFlusso[]) => void>();
const terminali = new Map<string, { alDato: (dati: string) => void; allaFine: (codice: number) => void }>();
let prossimo = 1;

function nuovoId(genere: string): string {
  const id = `${genere}-${prossimo}-${Math.random().toString(36).slice(2, 10)}`;
  prossimo += 1;
  return id;
}

ipcRenderer.on(CANALI.flusso, (_evento: IpcRendererEvent, id: string, messaggi: MessaggioDelFlusso[]) => {
  flussi.get(id)?.(messaggi);
});
ipcRenderer.on(CANALI.dati, (_evento: IpcRendererEvent, id: string, dati: string) => {
  terminali.get(id)?.alDato(dati);
});
ipcRenderer.on(CANALI.fine, (_evento: IpcRendererEvent, id: string, codice: number) => {
  const terminale = terminali.get(id);
  terminali.delete(id);
  terminale?.allaFine(codice);
});

function ascolta<T>(canale: string, ricevi: (valore: T) => void): () => void {
  const ascoltatore = (_evento: IpcRendererEvent, valore: T): void => ricevi(valore);
  ipcRenderer.on(canale, ascoltatore);
  return () => ipcRenderer.removeListener(canale, ascoltatore);
}

const ponte: Ponte = {
  stato: () => ipcRenderer.invoke(CANALI.stato) as Promise<StatoApp>,
  alCambio: (ricevi) => ascolta<StatoApp>(CANALI.cambio, ricevi),
  entra: (centro, password, nome) => ipcRenderer.invoke(CANALI.entra, centro, password, nome) as Promise<EsitoAccesso>,
  esci: () => ipcRenderer.invoke(CANALI.esci) as Promise<void>,
  segui: (che, ricevi) => {
    const id = nuovoId("flusso");
    flussi.set(id, ricevi);
    ipcRenderer.send(CANALI.segui, id, che);
    return () => {
      if (flussi.delete(id)) ipcRenderer.send(CANALI.smetti, id);
    };
  },
  alComando: (ricevi) => ascolta<Comando>(CANALI.comando, ricevi),
  chiudiLaFinestra: () => ipcRenderer.send(CANALI.chiudiFinestra),
  avviaConWindows: (si) => ipcRenderer.invoke(CANALI.avvioConWindows, si) as Promise<void>,
  riavviaPerAggiornare: () => ipcRenderer.send(CANALI.aggiorna),
  terminali: {
    shell: () => ipcRenderer.invoke(CANALI.shell) as Promise<ShellDisponibile[]>,
    apri: (richiesta, alDato, allaFine) => {
      // L'identificativo nasce qui, così ciò che la shell scrive subito trova già chi lo ascolta.
      const id = nuovoId("terminale");
      terminali.set(id, { alDato, allaFine });
      const aperto = (ipcRenderer.invoke(CANALI.apri, id, richiesta) as Promise<TerminaleAperto>).catch((errore: unknown) => {
        terminali.delete(id);
        throw errore;
      });
      return { id, aperto };
    },
    scrivi: (id, dati) => ipcRenderer.send(CANALI.scrivi, id, dati),
    misura: (id, colonne, righe) => ipcRenderer.send(CANALI.misura, id, colonne, righe),
    chiudi: (id) => ipcRenderer.send(CANALI.chiudi, id),
  },
};

contextBridge.exposeInMainWorld(NOME_DEL_PONTE, ponte);
