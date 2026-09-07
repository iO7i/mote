# Task 04 — Database Mapper (nullable fields + pagination)

STATUS: **live** — behavior-identical Mote / strict-TS / untyped implementations.

- `load(raw)` — parse + runtime-validate a DB row against
  `Row = { id: num, name: str, deleted_at: str? }`, then map to
  `User = { id, name, active }` where `active = deleted_at == nil`.
  Invalid row (bad `id`, null `name`) → error naming the JSON path.
- `mapUser(row)` — the pure nullable-column mapping.
- `page(total, size, n)` — pagination math:
  `{ page: n, pages: ceil(total/size), offset: n*size }`.

Assumes the `deleted_at` column is **present** (null or a timestamp), as DB rows
are — `active` = "column is null". `typescript-untyped/` skips validation.
Shared tests: `tests/behavior.test.mjs` + `tests/mutation.test.mjs` (invert
active flag, break pagination, weaken validation — all killed).
