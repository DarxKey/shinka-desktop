---
status: accepted
---

# Si riusa la conversazione, la cornice è nuova

Il sito di Shinka è un'interfaccia React di un centinaio di file. La parte più delicata è quella che disegna una conversazione: testo con formule, diagrammi e codice evidenziato, azioni raggruppate, permessi, domande, differenze dei file, immagini nel testo. Rifarla vorrebbe dire riscrivere e riprovare ciò che funziona già. La parte intorno, invece, è pensata per una pagina del browser e per il telefono, e l'app deve sembrare un programma di Windows.

## Decisioni

- **Le pagine del sito si copiano così come sono.** Stanno sotto `shinka/`, con la stessa disposizione che hanno in Shinka, senza modifiche: così si confrontano con l'originale e una novità del sito si riporta copiando il file. Ciò che nell'app deve andare diversamente si cambia da fuori: le richieste a `/api/` le serve l'app, e `EventSource` è sostituito perché i flussi partano dalla cache (ADR 0002). Shinka è sotto licenza MIT, come questo progetto; la provenienza di ogni parte è in `shinka/DA-SHINKA.md`, insieme ai file che un giorno andassero cambiati, con il perché.
- **I tipi del protocollo si copiano così come sono.** `src/protocollo` di Shinka è la descrizione di ciò che il centro manda e riceve: l'app ne tiene una copia senza modifiche, con annotata la versione, e la aggiorna insieme al numero di protocollo che dichiara di capire (ADR 0006).
- **La cornice è nuova, ma non subito.** Finestra, area di notifica, menu, schermata di accesso e terminali sono scritti per il desktop fin dalla prima tappa, in `src/pagina`. La barra laterale e i pannelli nella prima tappa sono quelli del sito: è ciò che ha permesso di avere tutta la chat funzionante in una volta. Rifarli nello stile di Claude Desktop resta da fare, una parte per volta, sostituendo il guscio del sito senza toccare la conversazione.
- **L'aspetto è quello di Shinka.** Colori, tema chiaro e scuro e caratteri riprendono quelli del sito, così una conversazione sembra la stessa nei due posti. Il tema segue Windows, e si può fissare.
- **L'interfaccia è in italiano**, come il sito e come i messaggi del centro.
- **Niente pacchetto in comune con il sito.** Dividere i componenti in un pacchetto usato da tutti e due chiederebbe di riorganizzare il progetto Shinka e legherebbe i rilasci dei due progetti.

## Conseguenze

- Le due interfacce evolvono separate: una novità della conversazione nel sito va riportata qui a mano. A ogni versione di Shinka che cambia il protocollo o la chat si guarda che cosa riportare.
- Insieme alla conversazione arrivano nell'app anche le pagine previste per le tappe successive (file, elaborati, vault, memoria, skill e le altre): funzionano quando usano solo richieste a `/api/`, e vanno provate una per una. Non funziona ancora ciò che apre altri collegamenti: il terminale del progetto nel suo ambiente, l'anteprima dell'applicazione, le notifiche del browser.
- Le pagine che si usano di rado (copie di sicurezza, HTTPS e certificato, inviti per ambienti nuovi, installazione di una versione di Shinka, primo avvio) restano da usare nel sito.
