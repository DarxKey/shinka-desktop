# Ciò che viene da Shinka

Questa cartella è una copia di parti di [Shinka](https://github.com/DarxKey/Shinka) (licenza MIT), tenuta con la stessa disposizione dell'originale perché i file restino confrontabili e si possano riportare le novità (ADR 0007).

| Qui | In Shinka | Versione | Modifiche |
|---|---|---|---|
| `src/protocollo/` | `src/protocollo/` (senza le prove) | `b55eea5` | nessuna |
| `web/src/` | `web/src/` (senza le prove) | `b55eea5` | vedi sotto |
| `web/public/` | `web/public/` (senza service worker e manifest) | `b55eea5` | nessuna |
| `src/centro/notifiche-app.ts`, `src/centro/web-push.ts` | gli omonimi | `b55eea5` | solo i tipi che la pagina importa |

## File di `web/src/` cambiati rispetto a Shinka

Nessuno, finora. La pagina di Shinka Desktop (`src/pagina`) sostituisce da fuori ciò che cambia: il flusso degli eventi (`EventSource`), l'accesso, l'avvio.

## File che alla costruzione hanno un sostituto

Restano qui com'erano, ma chi li importa riceve un file di `src/pagina`, che importa l'originale e gli aggiunge qualcosa. L'elenco è in `electron.vite.config.ts`.

| File | Sostituto | Perché |
|---|---|---|
| `web/src/Palette.tsx` | `src/pagina/PaletteDesktop.tsx` | La palette mostra anche i comandi dell'app: terminali, scorciatoie, avvio con Windows |

Quando un file va cambiato lo si scrive qui, con il perché.
