---
status: accepted
---

# Electron, React e TypeScript

Shinka Desktop è il client per Windows di [Shinka](https://github.com/DarxKey/Shinka): un'app da installare, per lavorare sulla Home e sui progetti senza passare dal browser, con la sensazione di Claude Desktop. Il proprietario ha lasciato a noi la scelta della tecnologia, con quel riferimento. Le due strade vere erano Electron e Tauri.

## Decisioni

- **Electron.** Il processo principale è Node, lo stesso linguaggio e lo stesso ambiente di Shinka: i tipi e gli schemi del protocollo (`src/protocollo` di Shinka, TypeScript con zod) si usano così come sono, senza riscriverli in un altro linguaggio.
- **React e TypeScript per l'interfaccia.** Il sito di Shinka è scritto così, e i componenti che disegnano la conversazione si riusano (ADR 0007).
- **I terminali locali con `node-pty` e `xterm.js`.** Sono le stesse due librerie che Shinka usa già per il terminale dei progetti; su Windows `node-pty` apre ConPTY (ADR 0005).
- **Installer con `electron-builder`, bersaglio NSIS per utente.** Si installa senza diritti di amministratore, nel profilo dell'utente. Non è firmato: l'app è per i PC del proprietario, e la prima volta Windows SmartScreen avvisa.
- **Aggiornamento con `electron-updater`**, da un feed servito dal centro (ADR 0006).
- **Il codice è in italiano**, come quello di Shinka: nomi di file, di funzioni e di tipi, commenti, messaggi. Le prove si scrivono con il motore di prova di Node (`node --test`), come in Shinka.

## Perché non Tauri

Tauri darebbe un installer molto più piccolo e meno memoria occupata. Ma il suo processo principale è Rust: il protocollo andrebbe riscritto o tenuto tutto nell'interfaccia, i terminali chiederebbero una libreria diversa da quella che Shinka conosce, e la pagina sarebbe disegnata da WebView2 invece che dallo stesso Chromium per tutti, con formule, diagrammi e codice da riprovare. Per un'app che gira su pochi PC di una sola persona, la dimensione dell'installer pesa meno del codice in comune con Shinka.

## Conseguenze

- L'installer pesa un centinaio di MB e l'app tiene in memoria un Chromium suo.
- `node-pty` è un modulo nativo: va compilato per la versione di Electron in uso, e la compilazione fa parte della costruzione dell'installer. Per questo si sviluppa e si prova su Windows.
- A ogni versione nuova di Electron vanno riprovati i terminali e l'installer.
