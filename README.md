# Shinka Desktop

Il client per Windows di [Shinka](https://github.com/DarxKey/Shinka): un'app da installare, per lavorare sulla Home e sui progetti senza passare dal browser. Tiene tutte le conversazioni in una cache locale, così si aprono senza attesa e si leggono anche senza connessione, e apre terminali veri del PC accanto alla chat.

**A che punto è.** La prima tappa è costruita e provata con un centro finto: l'app si collega a un centro con un accesso suo, mostra la Home e i progetti con l'interfaccia di Shinka, tiene le conversazioni in una cache locale che si riempie in background, si legge senza connessione, e apre terminali del PC in schede e riquadri accanto alla chat. Serve un centro di Shinka che abbia la storia incrementale e il token di dispositivo (ADR 0046 e 0047 di Shinka).

## Dove guardare

- [`docs/adr`](docs/adr): le decisioni, una per file.
- [`docs/funzioni-e-tappe.md`](docs/funzioni-e-tappe.md): che cosa fa il sito di Shinka e in quale tappa arriva nell'app.
- [`docs/dipendenze-dal-server.md`](docs/dipendenze-dal-server.md): che cosa serve dal centro, e a che punto è.
- [`docs/richieste`](docs/richieste): le richieste al progetto Shinka, una per file.
- `src/principale`: il processo principale (centro, cache, sincronizzazione, terminali); `src/ponte`: ciò che la pagina può chiedere all'app; `src/pagina`: ciò che l'app aggiunge all'interfaccia; [`shinka/`](shinka/DA-SHINKA.md): le pagine e il protocollo presi da Shinka, senza modifiche.

## Per lavorarci

Il repository è pubblico e ha una storia sola ([ADR 0008](docs/adr/0008-repository-pubblico-con-una-storia-pulita.md)): prima di ogni commit e di ogni invio un controllo ferma ciò che non deve uscire. Dopo aver clonato:

```
git config core.hooksPath .githooks
```

e serve un elenco delle espressioni vietate, una per riga, in `~/.config/shinka-desktop/pubblicazione-vietati.txt` (o dove dice la variabile `SHINKA_DESKTOP_VIETATI`). Senza elenco non si registra nulla.

Serve Node 24 o successivo. I comandi:

```
npm install
npm test            # le prove
npm run typecheck   # i tipi
npm run avvia       # costruisce e apre l'app
npm run installer   # l'installer per Windows, in release/
```

Per provare l'app senza un centro vero ce n'è uno finto, con conversazioni inventate:

```
node strumenti/centro-di-prova.ts 7890
```

Si entra con l'indirizzo `http://127.0.0.1:7890` e la password scritta in `src/principale/prove/centro-finto.ts`. Per non toccare il profilo vero dell'app, la variabile `SHINKA_DESKTOP_DATI` indica un'altra cartella dei dati.

## Licenza

MIT: vedi [`LICENSE`](LICENSE).
