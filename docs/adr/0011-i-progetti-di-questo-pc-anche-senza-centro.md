---
status: accepted
---

# I progetti di questo PC, anche senza centro

Il proprietario ha chiesto di poter lavorare ai progetti del PC su cui gira l'app anche quando il centro non si raggiunge: su un portatile il nodo non è sempre collegato. Fino a qui, senza centro, l'app mostrava la copia locale e basta. Shinka ha dato al nodo uno sportello ([ADR 0056 di Shinka](https://github.com/DarxKey/Shinka/blob/main/docs/adr/0056-il-lavoro-offline-sui-progetti-del-pc.md)): ascolta solo da questa macchina, con un gettone scritto tra i dati del nodo, risponde alle stesse rotte del centro per i progetti, e quando il centro torna gli consegna ciò che è stato fatto. Il proprietario ha scelto che l'app passi dal nodo solo quando il centro non c'è.

## Decisioni

- **Lo sportello si guarda ogni tre secondi** dal processo principale (`SportelloDiQui`): rileggendo ogni volta `sportello.json` tra i dati del nodo (dove `luogo.ts` già trova il nodo), perché porta e gettone cambiano a ogni avvio del nodo. Le richieste vanno su `127.0.0.1`, con il gettone; la pagina non lo vede, come il gettone del dispositivo (ADR 0002).
- **Offline vuol dire**: il centro non risponde all'app, e lo sportello risponde e dice che il nodo non è collegato al centro nemmeno lui. Se l'app non raggiunge il centro ma il nodo sì, non si lavora offline: il progetto lo tocca il centro.
- **Le richieste di un progetto di questo PC vanno allo sportello** offline, e anche dopo, finché il lavoro cominciato offline non è finito (un turno in corso, un permesso che aspetta): il centro, intanto, a quel progetto non scrive. Vanno allo sportello solo le rotte che sa servire: messaggi, fermare, permessi, domande, impostazioni, azioni, storia. Il resto va al centro e, senza centro, non risponde.
- **La conversazione**: la storia della cache, e sotto quella offline dello sportello, con i numeri che continuano quelli della cache. La parte offline non entra in cache: arriva dal centro quando il nodo gliel'ha consegnata, con i numeri del centro. Quando la strada cambia, la conversazione passa all'altra subito, senza mostrarsi caduta; tornata al centro, la storia si rimanda da capo.
- **Il quadro, offline, come lo vede la pagina**: l'ambiente di questo PC è attivo e gli altri no; i suoi progetti sono fermi o al lavoro come dice lo sportello, senza chat parallele; quelli nati offline si aggiungono; gli altri progetti risultano con l'ambiente spento. In cache resta il quadro com'era: la pagina ne vede una trasformazione.
- **Un progetto nuovo, offline**, nasce dalla scheda di sempre, solo nell'ambiente di questo PC, con nome e brief: le altre scelte della scheda offline non valgono.
- **L'avviso in cima** dice che i progetti dell'ambiente di questo PC vanno avanti da qui, e che il centro riceverà ciò che si fa.

## Conseguenze

- Con un nodo di una versione che non ha lo sportello, l'app resta in sola lettura offline, come prima.
- Il terminale di un progetto nato offline si apre nella sua cartella: la sa lo sportello.
- Offline non ci sono le chat parallele, il pannello File, le modifiche dei turni da annullare, le estensioni del progetto, la Home: sono del centro.
