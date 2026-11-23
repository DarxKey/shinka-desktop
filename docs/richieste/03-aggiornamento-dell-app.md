# Richiesta 3 al progetto Shinka: l'app si aggiorna dal centro

Da passare alla Home. Scritta guardando Shinka alla versione `2367123` del 23 novembre 2026.

## Perché

Shinka Desktop parla con un centro che cambia spesso: una versione dell'app rimasta indietro può non capire più ciò che riceve. Il proprietario vuole che l'app resti allineata da sola, prendendo le versioni nuove dal suo centro e non da un servizio esterno ([ADR 0006](../adr/0006-l-app-si-aggiorna-dal-centro.md)). Oggi una versione nuova si installa a mano, su ogni PC.

Servono tre cose: un posto da cui l'app scarica la versione nuova, un modo protetto per mettercela, e un numero con cui il centro dice quale protocollo parla.

## Che cosa serve

### 1. Servire l'ultima versione dell'app

L'app usa `electron-updater` con il fornitore generico: legge un file di descrizione e scarica l'installer dallo stesso posto. Servono queste rotte, in sola lettura:

```
GET /api/desktop/aggiornamenti/latest.yml
GET /api/desktop/aggiornamenti/<nome del file>
```

- Rispondono a chi ha una sessione o un token di dispositivo, come le altre rotte: l'app si presenta con `Authorization: Bearer <token>`.
- `latest.yml` è il file che `electron-builder` produce insieme all'installer: versione, nome del file, impronta SHA-512, peso. Il centro lo serve com'è.
- I file sono quelli che `latest.yml` nomina: l'installer (`Shinka-Desktop-<versione>-installa.exe`, oggi circa 120 MB) e il suo `.blockmap`. Nessun altro nome viene servito.
- Le rotte dei file accettano l'intestazione `Range`: `electron-updater` scarica solo i pezzi cambiati rispetto alla versione installata, e riprende uno scaricamento interrotto.
- Finché nessuna versione è stata consegnata, `latest.yml` risponde 404: l'app lo prende come «niente di nuovo».

### 2. Consegnare una versione al centro

Le versioni le costruisce il progetto Shinka Desktop su Windows: un installer, il suo `.blockmap` e `latest.yml`. Vanno messe nel centro.

Chi può consegnare una versione fa girare codice su tutti i PC del proprietario al loro prossimo aggiornamento. Per questo:

- **Un token di dispositivo non può consegnare.** Un PC perso o compromesso non deve poter aggiornare gli altri. La consegna chiede una sessione del proprietario aperta con la password, e conviene che richieda di nuovo la password, come le azioni delicate del sito.
- Il centro controlla ciò che riceve prima di servirlo: l'impronta SHA-512 dell'installer è quella scritta in `latest.yml`, i nomi dei file sono quelli attesi, la versione è maggiore di quella servita adesso.
- La consegna compare nel registro degli accessi.
- Il centro tiene solo l'ultima versione; la precedente si può buttare.

Come avviene la consegna lo sceglie il progetto Shinka. Due modi che bastano all'app:

- una pagina del sito (accanto all'installazione di una versione di Shinka) in cui il proprietario carica i tre file;
- oppure una cartella tra i dati del centro in cui il proprietario li copia, e che il centro rilegge.

Nella pagina conviene mostrare quale versione dell'app il centro sta servendo e da quando.

### 3. Dire quale protocollo parla il centro

L'app conosce la versione del protocollo per cui è stata scritta. Chiediamo che `GET /api/stato`, che è già libera, aggiunga due campi:

```
{ "configurato": true, "autenticato": false, "protocollo": 1, "versione": "2367123" }
```

- `protocollo` è un numero intero. Cresce quando un cambiamento del centro romperebbe un'app scritta per il numero di prima: un evento di una conversazione che cambia forma o significato, una rotta che l'app usa e che cambia o sparisce. Aggiungere un campo, un evento o una rotta non lo fa crescere: l'app ignora ciò che non conosce.
- `versione` è quella di Shinka, da mostrare al proprietario.
- Quando il numero è più alto di quello che l'app conosce, l'app smette di scrivere, lo dice, e cerca subito una versione nuova. Per questo conviene consegnare l'app nuova prima di installare un centro con un protocollo nuovo.

Le rotte e gli eventi che l'app usa oggi sono elencati in [`docs/dipendenze-dal-server.md`](../dipendenze-dal-server.md).

## Che cosa non serve

- Canali diversi (prova, stabile), versioni per altri sistemi, o aggiornamenti a scaglioni: c'è un proprietario, e i PC sono i suoi.
- Che il centro costruisca l'app.
- Firmare l'installer: la verifica è l'impronta dichiarata in `latest.yml`, che arriva dal centro con l'accesso del dispositivo.
- Che il centro avvisi l'app di una versione nuova: l'app chiede all'avvio e poi ogni qualche ora.

## Come si prova che c'è

- Prima di ogni consegna, `latest.yml` risponde 404 con un token valido e 401 senza.
- Consegnati i tre file dal proprietario, `latest.yml` risponde con la versione nuova e l'installer scaricato ha l'impronta dichiarata.
- Una richiesta con `Range: bytes=0-1023` sull'installer risponde 206 con 1024 byte.
- Una consegna tentata con un token di dispositivo viene rifiutata; una con l'impronta sbagliata, o con una versione non maggiore, anche.
- `GET /api/stato` senza accesso riporta `protocollo` e `versione`.
