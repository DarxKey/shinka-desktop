# Dipendenze dal server

Che cosa Shinka Desktop ha bisogno che il centro di Shinka faccia, e a che punto è. Ciò che va cambiato nel centro non si scrive in questo progetto: diventa una richiesta, passata alla Home una per volta, che la propone al progetto Shinka.

Confronto fatto con Shinka alla versione `31a7dfb` del 22 novembre 2026.

## Che cosa c'è già e basta così

| Che cosa | Dove | Note per l'app |
|---|---|---|
| Elenchi di ambienti, progetti, argomenti, memoria, skill, estensioni, vault, anteprima | flusso `GET /api/quadro/eventi` | Stato completo all'iscrizione e a ogni cambiamento |
| Eventi di una conversazione in diretta | flussi `…/eventi` di Home, argomenti e progetti | Per la conversazione a schermo; preparano il motore |
| Scrivere, fermare, rispondere a permessi, domande e approvazioni, modificare, ramificare, riavvolgere, domande a parte | richieste POST | Senza intestazione `Origin` passano i controlli di oggi |
| Dettaglio di un'azione, immagini, allegati | `…/azioni/:idAzione`, `…/immagini/:id` | Le immagini sono immutabili: si tengono in cache senza riconvalida |
| Cartella e ambiente di un progetto | elenco dei progetti | Con l'identificativo del nodo locale dicono se il progetto è su questo PC |
| Terminale del nodo | WebSocket `/api/progetti/:id/terminale` | Chiede un'`Origin` uguale al centro; tappa 3 |
| File, elaborati, applicazione e anteprima, vault, estensioni, skill, memoria, programmati, impostazioni, sicurezza, uso | rotte `/api/…` | Tappe 3, 4 e 5 |

## Che cosa manca

| N. | Richiesta | Serve per | Stato |
|---|---|---|---|
| 1 | [Storia di una conversazione da un punto in poi](richieste/01-sincronizzazione-incrementale.md): rotta di sola lettura senza effetti, versione dell'archivio, `ultimo` e `versione` negli elenchi, ripresa del flusso, elenchi completi | Cache e apertura istantanea (tappa 1) | In funzione nel centro (ADR 0046 di Shinka) |
| 2 | [Token di dispositivo](richieste/02-token-di-dispositivo.md): rilascio con la password, `Authorization: Bearer`, elenco e revoca nella pagina Sicurezza | Accesso senza password a ogni avvio (tappa 1) | In funzione nel centro (ADR 0047 di Shinka) |
| 3 | Aggiornamento dell'app dal centro: feed `latest.yml` e installer serviti al dispositivo, consegna protetta di una versione nuova, versione del protocollo dichiarata dal centro | Aggiornamento automatico (tappa 2) | Da scrivere quando è il suo turno |
| 4 | Canale degli avvisi: gli stessi avvisi delle notifiche dell'app (richieste, lavori, programmati), secondo le scelte del proprietario, su un flusso che l'app può ascoltare | Notifiche di Windows (tappa 2) | Da scrivere quando è il suo turno |

Le richieste 1 e 2 sono in funzione, e la prima tappa dell'app le usa. Le richieste 3 e 4 si passano alla Home quando comincia la seconda tappa.

## Che cosa si sa e non è una richiesta

- **Il limite ai tentativi di accesso è uno per tutti**, non per indirizzo: l'app non riprova mai da sola con una password o un token rifiutati.
- **I messaggi d'errore del centro sono testo in italiano**, senza un codice: l'app li mostra così come sono e distingue i casi dal codice HTTP.
- **Le notifiche del sito viaggiano con il push del web**, che accetta solo i servizi dei browser: l'app non può iscriversi come un browser, da qui la richiesta 4.
- **Il centro non dice su quale macchina sta un ambiente**: per questo l'app guarda il nodo installato sul PC ([ADR 0005](adr/0005-terminali-locali.md)).
