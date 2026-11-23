# Richiesta 2 al progetto Shinka: un token per un dispositivo

Da passare alla Home dopo che la richiesta 1 è stata fatta. Scritta guardando Shinka alla versione `31a7dfb` del 22 novembre 2026.

## Perché

Shinka Desktop resta acceso nell'area di notifica e deve aprirsi già collegato ([ADR 0004](../adr/0004-il-dispositivo-ricordato.md)). Oggi potrebbe entrare come un browser, con il cookie `shinka_sessione`, ma:

- la sessione dura trenta giorni fissi, senza rinnovo: ogni mese l'app tornerebbe a chiedere la password;
- nella pagina Sicurezza comparirebbe come un programma qualunque («node»), indistinguibile da uno script;
- il cookie è pensato per il browser: l'app parla dal suo processo principale, non da una pagina.

## Che cosa serve

### 1. Dare un token a un dispositivo

Una rotta libera come l'accesso, con lo stesso limite ai tentativi:

```
POST /api/dispositivi
{ "password": "…", "nome": "PC dello studio", "genere": "desktop" }
→ 201 { "id": "…", "token": "…" }
```

- Il token è lungo e casuale, e il centro ne conserva solo l'impronta, come per le sessioni.
- Il token si vede una volta sola, in questa risposta.
- `nome` lo sceglie il proprietario al primo avvio dell'app; `genere` dice che cos'è (per ora solo `desktop`).

### 2. Accettare il token al posto del cookie

Ogni rotta che oggi chiede la sessione accetta anche `Authorization: Bearer <token>`: richieste, flussi di eventi e upgrade a WebSocket.

- Un token di dispositivo vale quanto una sessione del proprietario: può tutto ciò che può il sito.
- Non scade a data fissa. Proposta: vale finché viene usato, e decade dopo novanta giorni senza uso; il centro annota l'ultimo uso e da dove, come fa già per le sessioni.
- **L'upgrade a WebSocket** oggi rifiuta chi non manda un'`Origin` uguale al centro. Una richiesta con il token non viene da una pagina di un altro sito (un browser non può aggiungere `Authorization` a un WebSocket): chiediamo che con un token valido l'`Origin` assente sia ammessa. Serve per il terminale del nodo, in una tappa successiva.
- Un token sbagliato o revocato risponde 401 **senza contare tra i tentativi falliti della password**: un'app revocata che riprova non deve chiudere fuori il browser.

### 3. Vederli e toglierli

- Nella pagina Sicurezza, accanto alle sessioni: i dispositivi con nome, genere, quando sono stati aggiunti, ultimo uso e da dove, e un pulsante per toglierne uno.
- `POST /api/dispositivi/chiusura` con il proprio token lo revoca: è ciò che fa l'app quando il proprietario sceglie «Esci da questo centro».
- Che cosa succede ai dispositivi quando il proprietario cambia la password lo decide il progetto Shinka. L'app regge tutti e due i casi: se il token non vale più passa in sola lettura sulla cache e richiede la password.

### 4. Riconoscere l'app nel registro

L'app si presenta con `User-Agent: ShinkaDesktop/<versione>`. Nel registro degli accessi e nell'elenco dei dispositivi basta che compaia come «Shinka Desktop» con la versione, invece di «node».

## Che cosa non serve

- Un secondo fattore, permessi ridotti per dispositivo, o più utenti.
- Cambiare l'accesso del sito.

## Come si prova che c'è

- Con la password giusta si ottiene un token; con quel token `/api/sicurezza` risponde, senza cookie.
- Il dispositivo compare nella pagina Sicurezza con il suo nome; tolto da lì, la richiesta successiva con quel token risponde 401.
- Dieci richieste con un token inventato non fanno scattare «troppi tentativi» per l'accesso con la password.
- Un flusso di eventi aperto con il token riceve gli eventi come uno aperto con il cookie.
