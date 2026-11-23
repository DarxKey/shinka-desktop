# Ciò che viene da Shinka

Questa cartella è una copia di parti di [Shinka](https://github.com/DarxKey/Shinka) (licenza MIT), tenuta con la stessa disposizione dell'originale perché i file restino confrontabili e si possano riportare le novità (ADR 0007).

| Qui | In Shinka | Versione | Modifiche |
|---|---|---|---|
| `src/protocollo/` | `src/protocollo/` (senza le prove) | `f43fe24` | nessuna |
| `web/src/` | `web/src/` (senza le prove) | `2367123` | vedi sotto |
| `web/public/` | `web/public/` (senza service worker e manifest) | `2367123` | nessuna |
| `src/centro/notifiche-app.ts`, `src/centro/web-push.ts` | gli omonimi | `2367123` | solo i tipi che la pagina importa |

## File di `web/src/` cambiati rispetto a Shinka

Nessuno, finora. La pagina di Shinka Desktop (`src/pagina`) sostituisce da fuori ciò che cambia: il flusso degli eventi (`EventSource`), l'accesso, l'avvio.

Quando un file va cambiato lo si scrive qui, con il perché.
