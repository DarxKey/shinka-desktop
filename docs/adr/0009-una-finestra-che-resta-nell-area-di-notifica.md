---
status: accepted
---

# Una finestra, che resta nell'area di notifica

L'app tiene accesi dei terminali, sincronizza una cache e deve avvisare quando una conversazione aspetta il proprietario. Tutto questo deve continuare anche quando lui non la sta guardando.

## Decisioni

- **Una finestra sola**, con la barra laterale: si passa tra Home, argomenti e progetti dalla barra o con le scorciatoie. Lo stato di ciò che è aperto sta nel processo principale e non nella finestra, così aprire un progetto in una seconda finestra si potrà aggiungere senza rifare nulla.
- **La X chiude la finestra, non l'app.** L'app resta nell'area di notifica: i terminali restano vivi, la cache continua a sincronizzarsi, le notifiche arrivano. Si esce con «Esci» dal menu dell'icona; la prima volta che si chiude la finestra l'app lo spiega.
- **Una sola copia in esecuzione.** Avviare l'app una seconda volta porta in primo piano la finestra di quella accesa.
- **L'avvio con Windows è una scelta**, spenta all'inizio: si accende dal menu dell'icona, dal menu Aiuto o dalla palette. Avviata così l'app non mostra la finestra: resta nell'area di notifica, già collegata.
- **Le notifiche di Windows seguono le scelte del sito.** Il proprietario ha già deciso, nella pagina Notifiche di Shinka, che cosa gli arriva come notifica dell'app: richieste che aspettano lui, lavori finiti, lavori programmati. L'app usa quelle scelte, senza una pagina sua. Un clic sulla notifica apre la conversazione giusta. Non si avvisa di una conversazione che è già a schermo nella finestra attiva.
- **Scrivere al volo arriva dopo.** Una scorciatoia di sistema che apre un piccolo riquadro per scrivere alla Home da qualsiasi programma è prevista nella seconda tappa.

## Conseguenze

- Le notifiche del sito viaggiano con il push del web, che un'app Electron non riceve: serve che il centro mandi gli stessi avvisi su un canale che l'app può ascoltare. È la quarta richiesta al progetto Shinka (`docs/dipendenze-dal-server.md`). Arrivano solo mentre l'app è accesa, anche se con la finestra chiusa.
- Sul telefono e sul PC può arrivare lo stesso avviso due volte, una dal sito e una dall'app: fa parte delle scelte del sito decidere dove.
- Un'app che non si vede continua a occupare memoria e a parlare con il centro finché non si esce davvero.
