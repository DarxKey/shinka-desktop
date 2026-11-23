---
status: accepted
---

# L'app si aggiorna dal centro

L'app parla con un centro che cambia spesso: una versione rimasta indietro può non capire più ciò che riceve. Il proprietario vuole che resti allineata da sola, prendendo le versioni nuove da Shinka e non da un servizio esterno.

## Decisioni

- **Il feed lo serve il centro.** `electron-updater`, con il fornitore generico, legge dal centro la descrizione dell'ultima versione (`latest.yml`: versione, nome del file, impronta SHA-512) e scarica l'installer dallo stesso posto, presentandosi con il token di dispositivo. Nessun file dell'app sta su un servizio di terzi.
- **Scarica da sola, installa alla chiusura.** La versione nuova si scarica in background; un avviso discreto offre «Riavvia per aggiornare», e altrimenti si installa quando il proprietario esce dall'app. L'app non si riavvia mai da sola: chiuderebbe i terminali aperti.
- **L'impronta è la verifica.** L'installer non è firmato (ADR 0001): `electron-updater` controlla che il file scaricato abbia l'impronta dichiarata nel feed, e il feed arriva dal centro su HTTPS, con l'accesso del dispositivo.
- **Il centro dice quale protocollo parla.** L'app conosce la versione del protocollo per cui è stata scritta. Se il centro ne dichiara una che l'app non capisce, l'app passa in sola lettura sulla cache, lo dice, e si aggiorna appena può; non prova a interpretare eventi che non conosce.
- **Le versioni le costruisce questo progetto, su Windows.** Un comando costruisce l'installer e il feed e li consegna al centro. Il numero di versione è quello dell'app, indipendente da quello di Shinka.

## Conseguenze

- Il centro serve il feed, riceve le versioni dalle sue Impostazioni (sezione Shinka Desktop, con la password del proprietario, dalla cartella `release`) e dichiara il protocollo in `/api/stato` (ADR 0049 di Shinka). L'app lo usa dalla 0.3.0 (`src/principale/aggiornamenti.ts`): controlla 20 secondi dopo l'avvio, poi ogni quattro ore, e quando il centro torna raggiungibile. La 0.3.0 si installa a mano un'ultima volta; da lì le versioni arrivano da sole.
- `package.json` ha la configurazione `publish` con il fornitore generico solo perché electron-builder scriva `latest.yml`: l'indirizzo scritto lì non si usa, l'app lo prende dal centro a cui è collegata.
- Per pubblicare una versione: si alza `version` in `package.json`, `npm run installer`, poi Pubblica nelle Impostazioni del centro. Se la versione cambia il protocollo, va pubblicata prima di installare il centro che lo cambia.
- Se il centro non è raggiungibile l'app non si aggiorna: va bene, perché senza centro non c'è nemmeno un protocollo da rispettare.
- Chi può consegnare una versione al centro può far girare codice sui PC del proprietario: la consegna va protetta quanto l'installazione di una versione di Shinka, e un token di dispositivo non deve bastare, perché un PC perso non possa aggiornare gli altri.
