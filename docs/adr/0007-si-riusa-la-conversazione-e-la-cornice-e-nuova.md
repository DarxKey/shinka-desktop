---
status: accepted
---

# Si riusa la conversazione, la cornice è nuova

Il sito di Shinka è un'interfaccia React di un centinaio di file. La parte più delicata è quella che disegna una conversazione: testo con formule, diagrammi e codice evidenziato, azioni raggruppate, permessi, domande, differenze dei file, immagini nel testo. Rifarla vorrebbe dire riscrivere e riprovare ciò che funziona già. La parte intorno, invece, è pensata per una pagina del browser e per il telefono, e l'app deve sembrare un programma di Windows.

## Decisioni

- **I componenti della conversazione si copiano e si adattano.** Entrano in questo repository quelli che disegnano una conversazione e la logica pura che li serve (raggruppare le azioni, descriverle, formule, evidenziazione, immagini nel testo, bozze, invio), con le loro prove. Shinka è sotto licenza MIT, come questo progetto; di ogni file copiato si annota da quale versione di Shinka viene.
- **I tipi del protocollo si copiano così come sono.** `src/protocollo` di Shinka è la descrizione di ciò che il centro manda e riceve: l'app ne tiene una copia senza modifiche, con annotata la versione, e la aggiorna insieme al numero di protocollo che dichiara di capire (ADR 0006).
- **La cornice è nuova.** Finestra, barra laterale, pannelli, impostazioni, scorciatoie da tastiera, area di notifica e terminali si scrivono per il desktop, nello stile di Claude Desktop.
- **L'aspetto è quello di Shinka.** Colori, tema chiaro e scuro e caratteri riprendono quelli del sito, così una conversazione sembra la stessa nei due posti. Il tema segue Windows, e si può fissare.
- **L'interfaccia è in italiano**, come il sito e come i messaggi del centro.
- **Niente pacchetto in comune con il sito.** Dividere i componenti in un pacchetto usato da tutti e due chiederebbe di riorganizzare il progetto Shinka e legherebbe i rilasci dei due progetti.

## Conseguenze

- Le due interfacce evolvono separate: una novità della conversazione nel sito va riportata qui a mano. A ogni versione di Shinka che cambia il protocollo o la chat si guarda che cosa riportare.
- I componenti copiati leggono i dati dal sito con richieste al centro: qui vanno riscritti perché leggano dal ponte con il processo principale (ADR 0002).
- Le pagine che si usano di rado (copie di sicurezza, HTTPS e certificato, inviti per ambienti nuovi, installazione di una versione di Shinka, primo avvio) non si rifanno: l'app apre il sito nel browser di sistema.
