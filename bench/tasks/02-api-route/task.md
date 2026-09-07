# Task 02 — API Route (auth + validation + typed response)

STATUS: **live** — behavior-identical Mote / strict-TS / untyped implementations.

`handle(token, secret, raw)`:

1. Authenticate: reject unless `token == secret`. On failure return
   `{ status: 401, userId: "", charged: 0, note: "unauthorized" }` **without**
   parsing the body (auth precedes validation).
2. On success, parse + runtime-validate the body against `Req`:
   `{ userId: str, amount: num, note: str? }`.
3. Invalid body → error naming the failing JSON path (`$.amount expected num, got str`).
4. Valid body → `{ status: 200, userId, charged: amount, note: note ?? "" }`.

Fairness: primary comparison is **Mote (typed + runtime validation)** vs
**strict TS + equivalent validation**. `typescript-untyped/` is secondary. All
variants share `tests/behavior.test.mjs` + `tests/mutation.test.mjs`.

Note: token comparison uses `==` for brevity; a production route would use a
constant-time compare (see task 01's `valid`).
