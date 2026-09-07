# Task 05 — Async Queue Worker

STATUS: **live** — behavior-identical Mote / strict-TS / untyped implementations.
This task is deliberately NOT winnable by shape-compression alone: it tests async
flow, error classification, boundaries, idempotency, and testable side effects.

`process(raw, store, write)` (async):

1. Runtime-validate `raw` against `Job = { id: str, userId: str, amount: num, key: str }`
   (untrusted input). Invalid → reject with the failing JSON path; **no write**.
2. Idempotency: if `store.seen(job.key)` → `{ status: "duplicate", ... }` and
   **do not** call `write`.
3. Otherwise `await write(job)` (async DB write returning a structured
   `{ ok } | { ok: false, error }`).
4. Structured outcome: `ok` → `{ status: "ok", ... }`; failure → `retry` for
   transient codes (`timeout`, `503`) else `failed`.

Side effects are injected (`store`, `write`) and asserted in tests: the writer's
call count proves the write happened exactly once on success, zero times on a
duplicate or a validation failure.

`typescript-untyped/` skips validation (processes junk). Shared tests:
`tests/behavior.test.mjs` + `tests/mutation.test.mjs` (break retry, idempotency,
validation — all killed).

Note: the async write returns a Result (`{ ok } | { ok:false, error }`) rather
than throwing, so the worker classifies failures without try/catch (Mote v0.2 has
no try/catch; Result-returning IO is the idiom).
