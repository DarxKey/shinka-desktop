/**
 * La libreria del ponte (ADR 0057): il centro la mette in cima a ogni pagina di un'estensione
 * dell'interfaccia, che la trova in `window.shinka`. La pagina resta nel suo riquadro, senza rete;
 * la libreria chiede all'interfaccia di Shinka, con `postMessage`, ciò che serve:
 *
 * - `shinka.alloStato(fai)`: lo stato (dove è aperta, progetti, ambienti, Home), subito e a ogni cambiamento;
 * - `shinka.api(metodo, percorso, corpo)`, e `get`, `post`, `put`, `del`: le API di Shinka, con la
 *   sessione del proprietario, solo per le rotte che l'estensione ha dichiarato;
 * - `shinka.segui(percorso, fai, nomi)`: un flusso di eventi delle API, finché non lo si chiude;
 * - `shinka.manda(testo, dove)`: un messaggio alla Home o a un progetto, come prima (ADR 0054);
 * - `shinka.altezza(px)`: l'altezza che vuole nei posti stretti (testata, barre, campo di scrittura);
 * - `shinka.etichette({ id: testo })`: piccole scritte accanto a progetti e argomenti nella barra laterale;
 * - `shinka.alSegnale(nome, fai)`: i comandi dell'estensione che danno un segnale alle sue pagine.
 *
 * È scritta in JavaScript semplice, perché finisce così com'è nella pagina.
 */

export const LIBRERIA_DEL_PONTE = `(function () {
  "use strict";
  var CAMPO = "shinka";
  var contatore = 0;
  var attese = new Map();
  var flussi = new Map();
  var segnali = new Map();
  var ascoltatori = new Set();
  var stato;
  function manda(messaggio) {
    var dati = { };
    dati[CAMPO] = messaggio.tipo;
    for (var chiave in messaggio) dati[chiave] = messaggio[chiave];
    window.parent.postMessage(dati, "*");
  }
  function chiedi(messaggio, ms) {
    return new Promise(function (risolvi, rifiuta) {
      var id = "r" + (++contatore);
      var scadenza = setTimeout(function () {
        attese.delete(id);
        rifiuta(new Error("Shinka non ha risposto: la pagina è fuori dalla sua interfaccia?"));
      }, ms || 60000);
      attese.set(id, function (risposta) { clearTimeout(scadenza); risolvi(risposta); });
      messaggio.id = id;
      manda(messaggio);
    });
  }
  window.addEventListener("message", function (evento) {
    if (evento.source !== window.parent) return;
    var dati = evento.data;
    if (dati === null || typeof dati !== "object") return;
    var tipo = dati[CAMPO];
    if (tipo === "stato") {
      stato = dati.stato;
      ascoltatori.forEach(function (fai) { try { fai(stato); } catch (errore) { console.error(errore); } });
    } else if ((tipo === "risposta" || tipo === "mandato") && typeof dati.id === "string") {
      var attesa = attese.get(dati.id);
      if (attesa !== undefined) { attese.delete(dati.id); attesa(dati); }
    } else if (tipo === "evento") {
      var flusso = flussi.get(dati.id);
      if (flusso !== undefined) { try { flusso(dati.nome, dati.dati); } catch (errore) { console.error(errore); } }
    } else if (tipo === "segnale") {
      (segnali.get(dati.nome) || []).forEach(function (fai) { try { fai(); } catch (errore) { console.error(errore); } });
    }
  });
  window.shinka = {
    get stato() { return stato; },
    alloStato: function (fai) {
      ascoltatori.add(fai);
      if (stato !== undefined) fai(stato);
      return function () { ascoltatori.delete(fai); };
    },
    api: function (metodo, percorso, corpo) {
      return chiedi({ tipo: "api", metodo: metodo, percorso: percorso, corpo: corpo }).then(function (risposta) {
        if (!risposta.ok) {
          var errore = new Error(risposta.errore || ("Shinka ha risposto " + risposta.stato + "."));
          errore.stato = risposta.stato;
          errore.dati = risposta.dati;
          throw errore;
        }
        return risposta.dati;
      });
    },
    get: function (percorso) { return window.shinka.api("GET", percorso); },
    post: function (percorso, corpo) { return window.shinka.api("POST", percorso, corpo); },
    put: function (percorso, corpo) { return window.shinka.api("PUT", percorso, corpo); },
    del: function (percorso) { return window.shinka.api("DELETE", percorso); },
    segui: function (percorso, fai, nomi) {
      var id = "f" + (++contatore);
      flussi.set(id, fai);
      manda({ tipo: "segui", id: id, percorso: percorso, nomi: nomi || ["message"] });
      return function () { flussi.delete(id); manda({ tipo: "smetti", id: id }); };
    },
    manda: function (testo, dove) {
      return chiedi({ tipo: "manda", testo: testo, dove: dove }).then(function (risposta) {
        if (!risposta.riuscito) throw new Error(risposta.motivo || "Il messaggio non è partito.");
      });
    },
    altezza: function (px) { manda({ tipo: "altezza", px: px }); },
    etichette: function (etichette) { manda({ tipo: "etichette", etichette: etichette }); },
    alSegnale: function (nome, fai) {
      var elenco = segnali.get(nome) || [];
      elenco.push(fai);
      segnali.set(nome, elenco);
    }
  };
  manda({ tipo: "stato" });
})();`;

/**
 * La pagina con la libreria in cima: dopo `<head>` se c'è, altrimenti dopo il doctype, altrimenti
 * all'inizio. Così la pagina la trova già pronta, e il doctype resta il primo.
 */
export function conLaLibreria(html: string): string {
  const script = `<script>${LIBRERIA_DEL_PONTE}</script>`;
  const testa = /<head(\s[^>]*)?>/i.exec(html);
  if (testa !== null) return html.slice(0, testa.index + testa[0].length) + script + html.slice(testa.index + testa[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype !== null) return doctype[0] + script + html.slice(doctype[0].length);
  return script + html;
}
