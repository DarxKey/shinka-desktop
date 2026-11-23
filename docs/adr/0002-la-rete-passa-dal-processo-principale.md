---
status: accepted
---

# La rete passa dal processo principale

Un'app Electron ha due parti: il processo principale, che è Node e può tutto ciò che può un programma, e la pagina che disegna l'interfaccia, che è un browser. Il centro di Shinka oggi parla con un browser: gli eventi delle conversazioni arrivano con flussi `text/event-stream`, i comandi partono con richieste POST, e l'unico WebSocket per il proprietario è il terminale di un progetto. Il centro rifiuta le richieste che cambiano qualcosa quando hanno un'intestazione `Origin` diversa dal suo indirizzo, e gli upgrade a WebSocket che non ne hanno una uguale.

## Decisioni

- **Con il centro parla solo il processo principale.** Accesso, flussi di eventi, richieste, scaricamenti e sincronizzazione della cache partono da lì. La pagina non fa richieste al centro e non ne conosce l'indirizzo se non per mostrarlo.
- **Il token di accesso non arriva mai alla pagina.** Sta nel processo principale, cifrato su disco da Windows (ADR 0004). Un errore in ciò che la pagina disegna, che è testo scritto da un modello e contenuto preso dal web, non può portarlo fuori.
- **La pagina è chiusa.** Isolamento del contesto acceso, integrazione di Node spenta, sandbox accesa; parla con il processo principale attraverso un ponte con poche funzioni dichiarate, ciascuna con i suoi dati controllati. Niente navigazione fuori dall'app: i collegamenti si aprono nel browser di sistema.
- **La pagina legge dalla cache, non dalla rete.** Chiede al processo principale una conversazione e riceve ciò che c'è in SQLite, subito; gli eventi nuovi le arrivano dopo, quando il processo principale li ha scritti (ADR 0003).
- **Un solo centro per volta.** L'indirizzo si sceglie al primo avvio e si cambia dalle impostazioni; cambiarlo vuol dire un'altra cache.

## Conseguenze

- Le richieste partono senza `Origin`, come quelle di un programma: i controlli di origine del centro restano come sono, e non serve aggiungere l'app a un elenco di origini ammesse.
- Ogni funzione nuova che tocca il centro chiede una voce nel ponte: è lavoro in più, ed è il punto in cui si controlla che cosa la pagina può chiedere.
- Le immagini e gli allegati la pagina li riceve da un protocollo dell'app servito dal processo principale, che li prende dalla cache o dal centro.
- Il terminale del nodo, quando verrà integrato, userà il WebSocket del centro dal processo principale.
