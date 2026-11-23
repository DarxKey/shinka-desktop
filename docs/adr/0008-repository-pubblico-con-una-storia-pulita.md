---
status: accepted
---

# Un repository pubblico, con una storia pulita dall'inizio

Il proprietario ha scelto di tenere questo progetto in un repository pubblico su GitHub, accanto alla copia pubblica di Shinka, con la licenza MIT. Ciò che diventa pubblico non si ritira, e chi lavora a questo progetto conosce l'installazione del proprietario: gli indirizzi della sua rete, il nome con cui raggiunge Shinka, i nomi delle sue macchine. Shinka ha risolto con una copia pubblica dalla storia separata (ADR 0044 di Shinka), perché aveva già una storia da non mostrare. Qui la storia comincia adesso.

## Decisioni

- **Una storia sola, ed è quella pubblica.** Non c'è un ramo di lavoro privato da filtrare: ogni commit è scritto per essere letto da chiunque.
- **Il brief e lo stato restano fuori da Git.** `BRIEF.md` e `STATO.md` raccontano l'installazione del proprietario e ciò che aspetta da lui: stanno nella cartella del progetto, ignorati da Git.
- **Gli esempi sono inventati.** Nel codice, nelle prove e nei documenti gli indirizzi e i nomi sono di esempio (`https://shinka.example`).
- **Un elenco di espressioni vietate ferma commit e invii.** `strumenti/controlla-vietati.mjs` guarda i nomi dei file e le righe aggiunte prima di ogni commit, il messaggio del commit, e prima di ogni invio tutti i commit che stanno per uscire, autore compreso. Se trova un'espressione dell'elenco non passa nulla, e il rifiuto dice dove senza ripetere che cosa. L'elenco sta fuori dal repository, nella cartella di configurazione dell'utente, perché contiene proprio ciò che non deve uscire. Senza elenco non si registra e non si invia.
- **L'autore dei commit è Shinka**, come nella copia pubblica di Shinka: nome ed email di chi lavora non passano.
- **A GitHub si scrive con una chiave del solo repository.** Una chiave SSH generata sul PC di sviluppo, la cui parte pubblica il proprietario aggiunge alle deploy key del repository con il permesso di scrittura. Vale solo lì, e la toglie lui quando vuole.

## Conseguenze

- Chi clona il repository per lavorarci deve accendere i controlli (`git config core.hooksPath .githooks`) e avere il suo elenco: non si accendono da soli.
- Il controllo ferma ciò che è nell'elenco, non ciò che nessuno ha pensato di metterci: un dato nuovo che non deve uscire va aggiunto all'elenco prima di scriverlo da qualche parte.
- Un commit sbagliato, una volta inviato, resta pubblico anche se lo si corregge dopo.
- Lo stato del progetto non è nel repository: chi lo legge da GitHub trova le decisioni e le tappe, non a che punto è il lavoro di oggi.
