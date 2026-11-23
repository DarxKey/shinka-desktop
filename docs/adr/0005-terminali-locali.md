---
status: accepted
---

# Terminali locali, accanto alla chat

Shinka ha già un terminale: uno per progetto, che gira nell'ambiente del progetto e si raggiunge attraverso il centro (ADR 0007 di Shinka). Il proprietario vuole un'altra cosa: terminali veri sul PC su cui sta lavorando, aperti dall'app senza passare dal centro, più d'uno insieme.

## Decisioni

- **Sono processi di questo PC.** Li apre il processo principale con `node-pty` (ConPTY) e li disegna `xterm.js`. Il centro non li vede e non li conosce.
- **Le shell si trovano da sole.** PowerShell, Windows PowerShell, cmd, le distribuzioni di WSL e Git Bash, se ci sono. Quella predefinita si sceglie nelle impostazioni; all'inizio è PowerShell.
- **Appartengono a un progetto, o alla Home.** Ogni progetto ha il suo gruppo: più schede, e in una scheda più pannelli affiancati. Non c'è una vista che li raccoglie tutti e non ci sono terminali senza un posto.
- **Stanno a destra, accanto alla chat**, come il terminale del sito: si scrive nel terminale guardando la conversazione. Il bordo si trascina e la scelta resta.
- **Restano accesi.** Cambiando progetto, pagina o chiudendo la finestra i processi continuano: la X manda l'app nell'area di notifica (ADR 0009). Si chiudono chiudendo la scheda o uscendo davvero dall'app, che prima lo chiede se ce ne sono di aperti.
- **Partono nella cartella del progetto, se il progetto è su questo PC.** L'app lo capisce dal nodo di Shinka installato sul PC: legge dal suo file d'identità il solo identificativo del nodo e lo confronta con l'ambiente del progetto. Il segreto del nodo, che sta nello stesso file, l'app non lo usa e non lo copia. Dove sta il nodo si indica nelle impostazioni.
- **Altrimenti partono nella cartella dell'utente**, con un'etichetta che dice «questo PC»: un progetto che vive su un'altra macchina ha comunque un terminale locale, e non va scambiato per un terminale di quella macchina.
- **Al riavvio torna la disposizione, non i processi.** L'app ricorda per ogni progetto schede, pannelli, shell, cartella e titolo, e li riapre con shell nuove la prima volta che si torna su quel progetto. Ciò che c'era a schermo non si salva.

## Conseguenze

- Il terminale di Shinka dentro il nodo resta un'altra cosa: verrà integrato in una tappa successiva, distinto da quelli locali.
- Su un PC senza nodo di Shinka nessun progetto risulta locale, e i terminali partono sempre nella cartella dell'utente.
- Un terminale locale ha i permessi dell'utente di Windows, senza i recinti di Shinka: ciò che ci si scrive non passa da permessi né da approvazioni.
- Molti terminali accesi tengono occupata memoria anche quando la finestra è chiusa.
