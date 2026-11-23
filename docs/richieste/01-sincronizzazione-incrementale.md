# Richiesta 1 al progetto Shinka: la storia di una conversazione, solo da un punto in poi

Da passare alla Home, che la propone al progetto Shinka con una scheda di sviluppo. Scritta guardando Shinka alla versione `31a7dfb` del 22 novembre 2026.

## Perché

Shinka Desktop tiene in una cache locale tutte le conversazioni (Home, argomenti archiviati, progetti), per aprirle senza attesa e leggerle senza connessione ([ADR 0003](../adr/0003-cache-locale-in-sqlite.md)). Per tenerla aggiornata deve poter chiedere al centro «che cosa c'è di nuovo dopo ciò che ho già».

Oggi l'unico modo di avere la storia è aprire il flusso degli eventi (`GET /api/progetti/:id/eventi`, `/api/argomenti/:id/eventi`, `/api/home/eventi`), che:

- manda ogni volta **tutta** la storia, dal primo evento;
- **prepara il motore** della conversazione (`lavori.prepara`, `home.prepara`) e la conta come seguita da una pagina (`Canale.seguito`): va bene per chi la sta guardando, non per un programma che in background passa tutte le conversazioni;
- non dice se la storia che il cliente ha già è ancora valida: `taglia` riscrive l'archivio, e al caricamento i numeri degli eventi vengono riassegnati, senza che chi ha una copia lo possa sapere.

## Che cosa serve

### 1. Leggere la storia da un punto, senza effetti

Una rotta di sola lettura per ogni genere di conversazione, per esempio:

```
GET /api/progetti/:id/storia?dopo=<n>&limite=<quanti>
GET /api/argomenti/:id/storia?dopo=<n>&limite=<quanti>
```

(l'argomento aperto della Home si chiede con il suo identificativo, come gli archiviati).

Risposta:

```jsonc
{
  "versione": "…",   // la versione dell'archivio, vedi il punto 2
  "ultimo": 1234,     // il numero dell'ultimo evento archiviato in questo momento
  "eventi": [ /* EventoArchiviato con n > dopo, in ordine, al massimo `limite` */ ],
  "altri": false      // vero se dopo questi ce ne sono ancora
}
```

- Gli eventi sono quelli della **storia leggera** (`storiaLeggera`), calcolata sull'archivio intero e poi tagliata da `dopo`: il dettaglio di un'azione l'app lo chiede con la rotta che c'è già (`…/azioni/:idAzione`).
- Solo eventi archiviati: niente frammenti di testo, niente eventi ricordati.
- **Nessun effetto**: non prepara il motore, non conta come pagina che segue la conversazione, non compare come attività del proprietario.
- Senza `dopo` parte dall'inizio. `limite` ha un massimo deciso dal centro.
- Se il cliente manda anche `versione=<quella che ha>` e non coincide, il centro può rispondere subito dall'inizio: basta che la risposta dica sempre la versione di ciò che contiene.

### 2. Una versione dell'archivio

Un identificativo per conversazione che **cambia ogni volta che eventi già dati potrebbero non valere più**: quando `taglia` toglie eventi, quando al caricamento una riga persa fa riassegnare i numeri, quando un archivio viene ricreato con lo stesso identificativo. Finché cambia solo perché si aggiunge in fondo, resta uguale.

Con la stessa versione l'app chiede solo `dopo` l'ultimo evento che ha; con una versione diversa butta la sua copia di quella conversazione e la riscarica.

### 3. Sapere quali conversazioni sono cambiate, senza chiederle una per una

Negli elenchi che il quadro manda già (`progetti`, `argomenti`, e la Home per l'argomento aperto), per ogni conversazione:

- `ultimo`: il numero dell'ultimo evento archiviato;
- `versione`: la versione dell'archivio.

Non serve che il quadro li rimandi a ogni evento: basta che siano giusti ogni volta che l'elenco viene mandato, e che l'elenco venga mandato almeno quando una conversazione smette di lavorare o comincia ad aspettare il proprietario (come già succede per `condizione`). L'app confronta con ciò che ha e chiede la differenza solo dove serve; la conversazione che il proprietario ha a schermo continua a usare il flusso degli eventi di oggi.

### 4. Riprendere il flusso degli eventi senza ricominciare

Per la conversazione a schermo, il flusso degli eventi accetta un punto di partenza:

```
GET /api/progetti/:id/eventi?dopo=<n>&versione=<v>
```

e manda solo gli eventi archiviati con `n > dopo`, poi `storia`, poi quelli nuovi come oggi (compresi il testo in corso e gli eventi ricordati). Se la versione non coincide manda prima `azzera` e poi tutta la storia, come già fa la Home al cambio di argomento. Così una caduta di rete di due secondi non rimanda una conversazione di mesi. Senza parametri resta com'è, per il sito.

### 5. Una garanzia sugli elenchi

Che gli elenchi del quadro siano **completi**: un progetto o un argomento che non c'è più nell'elenco è stato eliminato. L'app toglie dalla cache ciò che non trova. Se oggi è già così, basta scriverlo; se un elenco può arrivare parziale, serve un modo per distinguerlo.

## Che cosa non serve

- La storia intera delle azioni: resta a richiesta.
- Messaggi in coda scritti senza connessione: l'app senza centro legge e basta.
- Cambiare ciò che riceve il sito.

## Come si prova che c'è

- Chiedere la storia di un progetto `dopo` un evento restituisce solo quelli successivi, in ordine, e non avvia il suo motore.
- Dopo un `taglia` la versione di quell'argomento è diversa da prima; dopo un'aggiunta è uguale.
- Il quadro dichiara `ultimo` e `versione` per ogni progetto e argomento, e `ultimo` coincide con quello della rotta della storia.
- Riaprire il flusso degli eventi con `dopo` uguale all'ultimo evento ricevuto non rimanda nulla di archiviato.
