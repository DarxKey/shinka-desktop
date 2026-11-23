---
status: accepted
---

# La rete passa dal processo principale

Un'app Electron ha due parti: il processo principale, che è Node e può tutto ciò che può un programma, e la pagina che disegna l'interfaccia, che è un browser. Il centro di Shinka oggi parla con un browser: gli eventi delle conversazioni arrivano con flussi `text/event-stream`, i comandi partono con richieste POST, e l'unico WebSocket per il proprietario è il terminale di un progetto. Il centro rifiuta le richieste che cambiano qualcosa quando hanno un'intestazione `Origin` diversa dal suo indirizzo, e gli upgrade a WebSocket che non ne hanno una uguale.

## Decisioni

- **Con il centro parla solo il processo principale.** Accesso, flussi di eventi, richieste, scaricamenti e sincronizzazione della cache partono da lì. La pagina non raggiunge il centro e non ne conosce l'indirizzo se non per mostrarlo.
- **La pagina sta a `shinka://app/`, e le sue richieste alle API le serve l'app.** Ciò che la pagina chiede sotto `/api/` arriva al processo principale, che lo gira al centro aggiungendo il token e lasciando indietro biscotti e intestazioni della pagina. Così le pagine prese dal sito (ADR 0007) restano com'erano: chiedono `/api/…` come sul sito, e non sanno di passare dall'app. Fuori da `/api/` del suo centro la pagina non può chiedere nulla.
- **Il token di accesso non arriva mai alla pagina.** Sta nel processo principale, cifrato su disco da Windows (ADR 0004). Un errore in ciò che la pagina disegna, che è testo scritto da un modello e contenuto preso dal web, non può portarlo fuori.
- **La pagina è chiusa.** Isolamento del contesto acceso, integrazione di Node spenta, sandbox accesa; parla con il processo principale attraverso un ponte con poche funzioni dichiarate, ciascuna con i suoi dati controllati. Niente navigazione fuori dall'app: i collegamenti si aprono nel browser di sistema.
- **Le conversazioni e il quadro arrivano dalla cache, non dalla rete.** Nella pagina `EventSource` è sostituito: il flusso di una conversazione, o del quadro, lo manda il processo principale attraverso il ponte. Prima ciò che c'è in SQLite, subito; poi ciò che viene dal centro, già scritto in cache (ADR 0003).
- **Un solo centro per volta.** L'indirizzo si sceglie al primo avvio e si cambia dalle impostazioni; cambiarlo vuol dire un'altra cache.

## Conseguenze

- Le richieste partono senza `Origin`, come quelle di un programma: i controlli di origine del centro restano come sono, e non serve aggiungere l'app a un elenco di origini ammesse.
- Il ponte resta piccolo: accesso e uscita, i flussi, i terminali locali. Una funzione nuova del sito che usa solo richieste a `/api/` funziona senza toccarlo; una che apre un collegamento di altro genere (un WebSocket, una finestra del centro su un'altra porta) chiede lavoro nel processo principale.
- Le immagini e gli allegati la pagina li riceve dallo stesso protocollo, che li prende dal disco o dal centro.
- Chi è dentro la pagina può fare al centro ciò che può fare il proprietario dal sito, come con il biscotto di sessione; non può portare via il token, che vale trenta giorni e più.
- Il terminale del nodo, quando verrà integrato, userà il WebSocket del centro dal processo principale.
