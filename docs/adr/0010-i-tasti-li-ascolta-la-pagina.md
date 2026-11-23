---
status: accepted
---

# I tasti li ascolta la pagina, non il menu

L'app ha scorciatoie da tastiera sue, e accanto alla chat ha dei terminali. Nei terminali molti tasti sono già della shell: Ctrl+R cerca tra i comandi dati, Ctrl+W cancella una parola, Ctrl+K taglia la riga. Un menu di Electron che registra quei tasti li porta via alla shell: con Ctrl+R la pagina si ricaricava e chiudeva tutti i terminali.

## Decisioni

- **Un elenco solo di comandi**, in `src/ponte/scorciatoie.ts`: per ciascuno il nome, i tasti, e se vale anche mentre si scrive in un terminale. Lo leggono la pagina, il menu dell'app, la palette e la schermata delle scorciatoie (F1).
- **I tasti li ascolta la pagina.** Solo lei sa dove si sta scrivendo. Nel menu i tasti sono scritti accanto alle voci ma non registrati; scegliere una voce manda il comando alla pagina, che lo esegue come se fosse arrivato dalla tastiera.
- **In un terminale valgono solo i tasti che una shell non usa**: quelli con Maiusc, i tasti funzione, Ctrl+Tab, Ctrl+J. Gli altri arrivano alla shell e a nessun altro: nemmeno la pagina di Shinka li sente, così Ctrl+K nel terminale non apre la palette.
- **La palette resta quella di Shinka**, con Ctrl+K, e in più mostra i comandi dell'app. Si ottiene sostituendo il suo file alla costruzione, senza cambiare la copia ([ADR 0007](0007-si-riusa-la-conversazione-e-la-cornice-e-nuova.md)).
- **Ricaricare è F5**, non Ctrl+R.

## Conseguenze

- Un comando nuovo si aggiunge in un posto e compare in menu, palette e schermata delle scorciatoie.
- I tasti dipendono dalla lettera prodotta, non dalla posizione sulla tastiera: per questo le scorciatoie usano lettere, tasti funzione e frecce, e non i segni che sulla tastiera italiana stanno altrove.
- Restano registrati dal menu i tasti che non danno fastidio in un terminale: zoom, schermo intero, F12, Ctrl+Q.
