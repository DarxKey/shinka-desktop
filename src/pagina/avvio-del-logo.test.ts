import assert from "node:assert/strict";
import { test } from "node:test";
import { tempiDellAvvio } from "./avvio-del-logo.ts";

test("l'avvio del logo dura meno di tre secondi, e con le animazioni ridotte meno di uno", () => {
  const pieno = tempiDellAvvio(false);
  assert.ok(pieno.luceMs + pieno.dissolvenzaMs <= 3000);
  assert.ok(pieno.giroMs > 0);
  const ridotto = tempiDellAvvio(true);
  assert.ok(ridotto.luceMs + ridotto.dissolvenzaMs < 1000);
  assert.equal(ridotto.giroMs, 0);
});
