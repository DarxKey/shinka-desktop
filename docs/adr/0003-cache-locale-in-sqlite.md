---
status: accepted
---

# Tutte le conversazioni in una cache locale

Il proprietario vuole che un argomento o un progetto si apra senza alcun tempo di caricamento, e che le conversazioni si leggano anche senza connessione. Il sito oggi, a ogni apertura, riceve dal centro tutta la storia della conversazione: è ciò che l'app deve evitare.

## Decisioni

- **Una cache in SQLite, nel profilo dell'utente di Windows.** Un file per centro, nella cartella dei dati dell'app. La libreria è `node:sqlite`, il modulo che Electron porta con sé: la prova fatta all'inizio della prima tappa ha mostrato che ha la ricerca nel testo (FTS5), che scrive in fretta migliaia di eventi per volta, e che non chiede di compilare nulla per Electron, a differenza di `better-sqlite3`.
- **In chiaro.** Il file lo legge solo l'utente di Windows del proprietario; cifrarlo proteggerebbe da chi copia il disco, non da chi è già dentro quell'utente, e costerebbe velocità e una dipendenza nativa in più. Il token di accesso invece è cifrato (ADR 0004).
- **Dentro ci sono tutte le conversazioni.** Dopo il primo accesso l'app scarica in background la storia di tutti gli argomenti della Home e di tutti i progetti, dai più recenti, mentre il proprietario già lavora. Poi arriva solo ciò che è nuovo.
- **La storia è quella leggera del centro.** Testo intero, e delle azioni concluse il riassunto: è ciò che il sito mostra. Il dettaglio di un'azione, le immagini e gli allegati entrano in cache la prima volta che compaiono a schermo, e ci restano fino a un tetto di spazio (5 GB all'inizio, regolabile): superato il tetto escono i meno usati. Il testo delle conversazioni non esce mai.
- **Si apre dalla cache, sempre.** La pagina mostra subito ciò che c'è in locale; il confronto con il centro avviene dopo, e ciò che arriva si aggiunge sotto.
- **Di ogni conversazione la cache ricorda fin dove è arrivata**: il numero dell'ultimo evento e la versione dell'archivio dichiarata dal centro. Se la versione cambia (il centro ha tagliato o riscritto quella storia) la conversazione si riscarica da capo; se una conversazione non è più negli elenchi del centro, esce dalla cache.
- **Senza connessione si legge e basta.** Niente messaggi in coda: scrivere, rispondere a un permesso, cambiare un'impostazione chiedono il centro. L'app dice che è scollegata e da quando.
- **La ricerca è locale**, sul testo in cache, e funziona anche senza connessione. L'indice è una tabella FTS5 a gruppi di tre lettere sul testo senza accenti e in minuscolo: così dà gli stessi risultati della ricerca del centro, che trova anche un pezzo di parola. La pagina Cerca del sito chiede `/api/cerca` come sempre, e l'app risponde dalla cache quando la copia è in pari, e comunque quando il centro non si raggiunge; mentre la copia si sta ancora riempiendo risponde il centro, che ha tutto.

## Conseguenze

- Serve che il centro sappia dare «solo ciò che viene dopo l'evento N» e dichiari la versione di un archivio: lo fa dall'ADR 0046 di Shinka, nato dalla prima richiesta al progetto (`docs/richieste/01-sincronizzazione-incrementale.md`). La sincronizzazione in background usa la rotta della storia, che non ha effetti; il flusso degli eventi, che sul centro prepara il motore, si apre solo per la conversazione a schermo.
- In cache ci sono il testo delle conversazioni con il suo indice, il quadro e le immagini viste. Il dettaglio delle azioni si chiede ancora al centro.
- Quando cambia la forma delle tabelle, una cache della forma di prima si aggiorna sul posto se si può (l'indice dei testi si è aggiunto così), altrimenti si butta e si riscarica.
- Senza connessione le azioni mai aperte mostrano solo il riassunto, e le immagini mai viste un segnaposto.
- La cache è una copia: si può cancellare dalle impostazioni e si ricostruisce da sola. Non è una copia di sicurezza di Shinka.
- Chi entra nell'utente di Windows del proprietario legge le sue conversazioni, come già legge i file dei suoi progetti.
