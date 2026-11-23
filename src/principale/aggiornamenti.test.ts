import assert from "node:assert/strict";
import { test } from "node:test";
import { Aggiornamenti, PROTOCOLLO, indirizzoDelFeed, protocolloTroppoNuovo, type Aggiornatore } from "./aggiornamenti.ts";

/** Un `electron-updater` finto: tiene nota di ciò che gli si chiede, e manda gli eventi quando gli si dice. */
function aggiornatoreFinto() {
  const ascoltatori = new Map<string, ((...argomenti: unknown[]) => void)[]>();
  const finto = {
    feed: undefined as { provider: string; url: string } | undefined,
    requestHeaders: null as Record<string, string> | null,
    autoDownload: false,
    autoInstallOnAppQuit: false,
    controlli: 0,
    installazioni: [] as [boolean | undefined, boolean | undefined][],
    setFeedURL(opzioni: { provider: "generic"; url: string }) {
      this.feed = opzioni;
    },
    async checkForUpdates() {
      this.controlli += 1;
      return null;
    },
    quitAndInstall(silenzioso?: boolean, riapri?: boolean) {
      this.installazioni.push([silenzioso, riapri]);
    },
    on(evento: string, ascolta: (...argomenti: never[]) => void) {
      ascoltatori.set(evento, [...(ascoltatori.get(evento) ?? []), ascolta as (...argomenti: unknown[]) => void]);
    },
    emetti(evento: string, ...argomenti: unknown[]) {
      for (const ascolta of ascoltatori.get(evento) ?? []) ascolta(...argomenti);
    },
  };
  return finto;
}

function prepara(protocollo: unknown = PROTOCOLLO, attivo = true) {
  const finto = aggiornatoreFinto();
  const stato = { protocollo, cambi: 0, primaDiInstallare: 0, chiesti: [] as string[] };
  const aggiornamenti = new Aggiornamenti({
    aggiornatore: finto as unknown as Aggiornatore,
    attivo,
    statoDelCentro: async (centro) => {
      stato.chiesti.push(centro);
      if (stato.protocollo instanceof Error) throw stato.protocollo;
      return { protocollo: stato.protocollo };
    },
    alCambio: () => {
      stato.cambi += 1;
    },
    primaDiInstallare: () => {
      stato.primaDiInstallare += 1;
    },
    primoDopoMs: 60_000,
  });
  return { finto, stato, aggiornamenti };
}

test("collegato a un centro, il feed è quello del centro, con il gettone, e scarica e installa da sé all'uscita", async (t) => {
  const { finto, stato, aggiornamenti } = prepara();
  t.after(() => aggiornamenti.scollega());
  assert.equal(finto.autoDownload, true);
  assert.equal(finto.autoInstallOnAppQuit, true);
  aggiornamenti.collega("https://shinka.esempio.it", "gettone-0123", "ShinkaDesktop/0.3.0");
  assert.deepEqual(finto.feed, { provider: "generic", url: "https://shinka.esempio.it/api/desktop/aggiornamenti" });
  assert.deepEqual(finto.requestHeaders, { Authorization: "Bearer gettone-0123", "User-Agent": "ShinkaDesktop/0.3.0" });
  assert.equal(indirizzoDelFeed("https://shinka.esempio.it/"), "https://shinka.esempio.it/api/desktop/aggiornamenti");

  await aggiornamenti.controlla();
  assert.deepEqual(stato.chiesti, ["https://shinka.esempio.it"]);
  assert.equal(finto.controlli, 1);
  assert.equal(aggiornamenti.soloLettura, false);

  aggiornamenti.scollega();
  assert.equal(finto.requestHeaders, null);
  await aggiornamenti.controlla();
  assert.equal(finto.controlli, 1);
});

test("mentre scarica e quando è pronta lo dice; riavviare installa solo una versione pronta", async () => {
  const { finto, stato, aggiornamenti } = prepara();
  aggiornamenti.collega("https://shinka.esempio.it", "g", "ShinkaDesktop/0.3.0");
  assert.equal(aggiornamenti.riavviaPerAggiornare(), false);

  finto.emetti("update-available", { version: "0.4.0" });
  assert.deepEqual(aggiornamenti.stato, { fase: "scarica", versione: "0.4.0" });
  finto.emetti("download-progress", { percent: 41.7 });
  assert.deepEqual(aggiornamenti.stato, { fase: "scarica", versione: "0.4.0", percento: 41 });
  // Mentre scarica non si ricomincia.
  await aggiornamenti.controlla();
  assert.equal(finto.controlli, 0);

  finto.emetti("update-downloaded", { version: "0.4.0" });
  assert.deepEqual(aggiornamenti.stato, { fase: "pronta", versione: "0.4.0" });
  // Un errore dopo non toglie la versione pronta.
  finto.emetti("error", new Error("rete"));
  assert.equal(aggiornamenti.stato.fase, "pronta");

  assert.equal(aggiornamenti.riavviaPerAggiornare(), true);
  assert.equal(stato.primaDiInstallare, 1);
  assert.deepEqual(finto.installazioni, [[true, true]]);
  aggiornamenti.scollega();
});

test("uno scaricamento che non riesce torna a nulla, e si riprova al controllo dopo", async () => {
  const { finto, aggiornamenti } = prepara();
  aggiornamenti.collega("https://shinka.esempio.it", "g", "p");
  finto.emetti("update-available", { version: "0.4.0" });
  finto.emetti("error", new Error("impronta sbagliata"));
  assert.deepEqual(aggiornamenti.stato, { fase: "nessuno" });
  await aggiornamenti.controlla();
  assert.equal(finto.controlli, 1);
  aggiornamenti.scollega();
});

test("un centro con un protocollo più nuovo mette l'app in sola lettura, e cerca subito un aggiornamento", async () => {
  const { finto, stato, aggiornamenti } = prepara(PROTOCOLLO + 1);
  aggiornamenti.collega("https://shinka.esempio.it", "g", "p");
  await aggiornamenti.controlla();
  assert.equal(aggiornamenti.soloLettura, true);
  assert.equal(aggiornamenti.protocolloDelCentro, PROTOCOLLO + 1);
  assert.equal(finto.controlli, 1);
  assert.ok(stato.cambi >= 1);

  // Il centro non risponde: resta ciò che si sapeva.
  stato.protocollo = new Error("spento");
  await aggiornamenti.controlla();
  assert.equal(aggiornamenti.soloLettura, true);

  // Torna al protocollo di questa versione (per esempio: il centro è tornato indietro).
  stato.protocollo = PROTOCOLLO;
  await aggiornamenti.controlla();
  assert.equal(aggiornamenti.soloLettura, false);
  aggiornamenti.scollega();
});

test("l'app non installata non si aggiorna, ma guarda il protocollo", async () => {
  const { finto, aggiornamenti } = prepara(PROTOCOLLO + 1, false);
  aggiornamenti.collega("https://shinka.esempio.it", "g", "p");
  await aggiornamenti.controlla();
  assert.equal(finto.controlli, 0);
  assert.equal(aggiornamenti.soloLettura, true);
  aggiornamenti.scollega();
});

test("protocolli troppo nuovi", () => {
  assert.equal(protocolloTroppoNuovo(PROTOCOLLO), false);
  assert.equal(protocolloTroppoNuovo(PROTOCOLLO + 1), true);
  assert.equal(protocolloTroppoNuovo("2"), false);
  assert.equal(protocolloTroppoNuovo(undefined), false);
});
