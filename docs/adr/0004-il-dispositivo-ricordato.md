---
status: accepted
---

# Il dispositivo ricordato

Nel sito si entra con la password, e il centro dà al browser un cookie di sessione che vale trenta giorni, senza rinnovo. Un'app che resta nell'area di notifica e si apre già collegata non può chiedere la password ogni mese, e nella pagina Sicurezza di Shinka deve comparire con il suo nome, non come un programma qualunque.

## Decisioni

- **La password si scrive una volta per PC.** Al primo avvio l'app chiede l'indirizzo del centro e la password, e riceve dal centro un token di dispositivo: lungo, casuale, con il nome che il proprietario dà a quel PC.
- **Il token lo custodisce Windows.** L'app lo salva cifrato con `safeStorage` di Electron, che su Windows usa DPAPI: lo decifra solo lo stesso utente sullo stesso PC. Non sta nella cache, non arriva alla pagina (ADR 0002) e non finisce nei registri.
- **La password non si salva.** Serve solo a ottenere il token, e l'app la dimentica subito.
- **Si revoca dal centro.** Nella pagina Sicurezza il proprietario vede i dispositivi e ne toglie uno. Un'app il cui token non vale più passa in sola lettura sulla cache e richiede la password; non riprova da sola, perché i tentativi falliti il centro li conta per tutti.
- **Uscire dall'app toglie il dispositivo.** «Esci da questo centro» chiede al centro di revocare il token, cancella quello salvato e, se il proprietario lo sceglie, la cache.

## Conseguenze

- Il token di dispositivo non esiste ancora nel centro: è la seconda richiesta al progetto Shinka (`docs/richieste/02-token-di-dispositivo.md`), e il codice dell'app comincia quando c'è.
- Chi entra nell'utente di Windows del proprietario può usare l'app come lui, finché il dispositivo non viene revocato da un altro posto.
- Un PC reinstallato, o un profilo di Windows nuovo, è un dispositivo nuovo: si rientra con la password e quello vecchio si toglie dalla pagina Sicurezza.
