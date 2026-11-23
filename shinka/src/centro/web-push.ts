/**
 * Solo i tipi che la pagina legge da `src/centro/web-push.ts` di Shinka: qui il centro non c'è,
 * e la pagina ne importa soltanto la forma.
 */
export type EsitoPush = { esito: "mandata" } | { esito: "scaduta" } | { esito: "fallita"; motivo: string };
