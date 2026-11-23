# Le funzioni del sito e le tappe dell'app

L'obiettivo è la parità con il sito di Shinka, a tappe. L'elenco viene da `web/src` e dalle rotte del centro, alla versione `31a7dfb` del 22 novembre 2026. La colonna «Tappa» dice quando la funzione arriva nell'app; «browser» vuol dire che l'app apre il sito nel browser di sistema ([ADR 0007](adr/0007-si-riusa-la-conversazione-e-la-cornice-e-nuova.md)).

## Prima di ogni tappa

Niente codice dell'app finché il centro non ha la storia incrementale e il token di dispositivo ([dipendenze dal server](dipendenze-dal-server.md)). Nel frattempo: decisioni, richieste, repository.

## Funzioni

| Area | Funzione del sito | Tappa |
|---|---|---|
| Accesso | Entrare con la password, uscire | 1 (con il token di dispositivo) |
| Accesso | Primo avvio con il codice, cambio della password | browser |
| Barra laterale | Home, argomenti archiviati, progetti con la loro condizione, progetti fissati | 1 |
| Barra laterale | Cerca in tutte le conversazioni | 2 (ricerca locale sulla cache) |
| Home | Argomento nuovo, riaprire o eliminare un argomento archiviato | 1 |
| Progetti | Aprire, rinominare, fissare, eliminare; progetto nuovo a mano; confermare una proposta della Home | 1 |
| Chat | Scrivere, risposta in diretta, fermare il turno, bozze | 1 |
| Chat | Permessi, domande di Claude, approvazioni di comandi sugli host | 1 |
| Chat | Allegati, immagini nel testo, immagini esterne | 1 |
| Chat | Motore, modello, impegno, permessi, stile della conversazione | 1 |
| Chat | Modificare un messaggio e ripartire, riavvolgere, ramo in un argomento nuovo, domanda a parte | 1 |
| Chat | Dettaglio delle azioni, uscita delle attività, piano, ragionamento | 1 |
| Chat | Modifiche di un turno: differenze dei file, annullarle | 1 |
| Chat | Formule, diagrammi, codice evidenziato, copia, esportazione in Markdown | 1 |
| Chat | Proposte di sviluppo e di estensioni nella conversazione | 1 |
| Terminali | Terminali locali del PC, in schede e pannelli affiancati | 1 (solo nell'app) |
| Terminali | Terminale del progetto dentro il suo ambiente | 3 |
| File | Pannello dei file del progetto: elenco, ricerca, contenuto | 3 |
| Elaborati | Elenco, apertura, elaborati vivi, modifica e commenti | 3 |
| Applicazione | Comando e porta, avvio e arresto, anteprima accanto alla chat | 3 |
| Vault | Credenziali per nome, host, registro, stato di Telegram | 4 |
| Estensioni | Elenco, accendere e spegnere per ambiente, togliere, guardare un ambiente | 4 |
| Skill | Elenco, testo e storia, annullare una modifica | 4 |
| Memoria | Voci, aggiungere, correggere, cancellare | 4 |
| Programmati | Elenco, creare, modificare, eseguire adesso, togliere | 4 |
| Impostazioni | Motore predefinito, accessi dei motori negli ambienti, stili | 5 |
| Sicurezza | Sessioni e dispositivi, registro delle richieste | 5 |
| Ambienti | Elenco, pagina di un ambiente con le risorse, aggiornare un nodo, consenso a un nodo nuovo | 5 |
| Uso | Token e limiti del piano, spazio occupato e pulizia | 5 |
| Notifiche | Scelte di che cosa arriva e dove | 5 (le notifiche di Windows arrivano nella 2) |
| Ambienti | Invito per un ambiente nuovo, rimozione | browser |
| Copie | Copia di sicurezza, ripristino, trasloco | browser |
| HTTPS | Scelta dell'HTTPS e certificato da installare | browser |
| Sviluppo | Installazione di una versione di Shinka | browser |

## Tappe

### Tappa 1: lavorare sulle conversazioni

Finestra con barra laterale e tema chiaro e scuro; primo avvio con indirizzo del centro e password; dispositivo ricordato; quadro con Home, argomenti e progetti; chat con tutto ciò che fa sul sito; cache locale completa con sincronizzazione in background; lettura senza connessione; terminali locali accanto alla chat; area di notifica; installer.

Finita quando: su un PC appena installato si entra una volta, ogni conversazione si apre senza attesa dopo la prima sincronizzazione, e per le chat non serve mai aprire il sito.

### Tappa 2: un'app che vive da sola

Aggiornamento automatico dal centro; notifiche di Windows; ricerca locale; scorciatoie da tastiera e tavolozza dei comandi; scrittura al volo con una scorciatoia di sistema; avvio con Windows.

### Tappa 3: il progetto intorno alla chat

Pannello dei file; elaborati; applicazione e anteprima; terminale del nodo accanto a quelli locali.

### Tappa 4: gli strumenti di Shinka

Vault e approvazioni fuori dalla chat; estensioni; skill; memoria; lavori programmati.

### Tappa 5: il resto

Impostazioni, sicurezza, ambienti, uso e archiviazione, scelte delle notifiche. Le pagine rare restano nel browser.
