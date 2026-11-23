# Shinka Desktop

Il client per Windows di [Shinka](https://github.com/DarxKey/Shinka): un'app da installare, per lavorare sulla Home e sui progetti senza passare dal browser. Tiene tutte le conversazioni in una cache locale, così si aprono senza attesa e si leggono anche senza connessione, e apre terminali veri del PC accanto alla chat.

**A che punto è.** Per ora ci sono le decisioni e le richieste al centro, non ancora l'app: il codice comincia quando il centro di Shinka sa dare la storia di una conversazione da un punto in poi e un token per un dispositivo.

## Dove guardare

- [`docs/adr`](docs/adr): le decisioni, una per file.
- [`docs/funzioni-e-tappe.md`](docs/funzioni-e-tappe.md): che cosa fa il sito di Shinka e in quale tappa arriva nell'app.
- [`docs/dipendenze-dal-server.md`](docs/dipendenze-dal-server.md): che cosa serve dal centro, e a che punto è.
- [`docs/richieste`](docs/richieste): le richieste al progetto Shinka, una per file.

## Per lavorarci

Il repository è pubblico e ha una storia sola ([ADR 0008](docs/adr/0008-repository-pubblico-con-una-storia-pulita.md)): prima di ogni commit e di ogni invio un controllo ferma ciò che non deve uscire. Dopo aver clonato:

```
git config core.hooksPath .githooks
```

e serve un elenco delle espressioni vietate, una per riga, in `~/.config/shinka-desktop/pubblicazione-vietati.txt` (o dove dice la variabile `SHINKA_DESKTOP_VIETATI`). Senza elenco non si registra nulla.

Le prove:

```
node --test "strumenti/**/*.test.mjs"
```

## Licenza

MIT: vedi [`LICENSE`](LICENSE).
