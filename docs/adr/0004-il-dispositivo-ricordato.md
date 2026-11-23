---
status: accepted
---

# Il dispositivo ricordato

Nel sito si entra con la password, e il centro dà al browser un cookie di sessione che vale trenta giorni, senza rinnovo. Un'app che resta nell'area di notifica e si apre già collegata non può chiedere la password ogni mese, e nella pagina Sicurezza di Shinka deve comparire con il suo nome, non come un programma qualunque.

## Decisioni

- **La password si scrive una volta per PC.** Al primo avvio l'app chiede l'indirizzo del centro e la password, e riceve dal centro un token di dispositivo: lungo, casuale, con il nome che il proprietario dà a quel PC.
- **Il token lo custodisce Windows.** L'app lo salva cifrato con `safeStorage` di Electron, che su Windows usa DPAPI: lo decifra solo lo stesso utente sullo stesso PC. Non sta nella cache, non arriva alla pagina (ADR 0002) e non finisce nei registri.
- **La password non si salva.** Serve solo a ottenere il token, e l'app la dimentica subito.
- **Si revoca dal centro.** Nella pagina Sicurezza il proprietario vede i dispositivi e ne toglie uno. Un'app il cui token non vale più torna alla schermata di accesso e butta le copie locali di quel centro: chi toglie un dispositivo, magari perché il PC è stato perso, si aspetta che lì non resti nulla da leggere. Rientrando con la password la cache si ricostruisce da sola. L'app non riprova da sola, perché i tentativi falliti il centro li conta per tutti.
- **Uscire dall'app toglie il dispositivo.** «Esci» chiede al centro di revocare il token, cancella quello salvato e butta la cache di quel centro.
- **In chiaro solo restando in casa.** L'app si collega a un centro in `https`; in `http` solo se l'indirizzo è di questo PC o di una rete privata, dove password e token non attraversano Internet.
- **L'indirizzo proposto viene dal PC.** Al primo accesso l'app propone l'ultimo centro usato, oppure quello a cui è collegato il nodo di Shinka installato sul PC, se c'è.

## Conseguenze

- Il token di dispositivo c'è dall'ADR 0047 di Shinka, nato dalla seconda richiesta al progetto (`docs/richieste/02-token-di-dispositivo.md`).
- Chi entra nell'utente di Windows del proprietario può usare l'app come lui, finché il dispositivo non viene revocato da un altro posto.
- Un PC reinstallato, o un profilo di Windows nuovo, è un dispositivo nuovo: si rientra con la password e quello vecchio si toglie dalla pagina Sicurezza.
