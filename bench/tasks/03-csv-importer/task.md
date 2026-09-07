# Task 03 — CSV Importer (typed row validation + error reporting)

STATUS: **live** — behavior-identical Mote / strict-TS / untyped implementations.

Each impl exposes `parseRow(cells: string[]) -> Result<Row>`:

- Coerce cells → `Row = { id: num, email: str, active: bool }`
  (`id` via `Number(...)`, `active` via `== "true"`).
- Runtime-validate the coerced row. A bad cell (e.g. non-numeric `id`) yields
  `{ ok: false, error: { path: "$.id", ... } }` — it is NOT imported.

The mechanical CSV split + row iteration is a **shared harness** in the tests
(identical across all variants); the measured code is the typed, validated core
— the part a developer writes repeatedly. Mote validates with the
`check<Row>(value)` builtin (validate an already-parsed value → `Result<Row>`).

`typescript-untyped/` imports every row unvalidated (the unsafe baseline).
Shared tests: `tests/behavior.test.mjs` (2 valid, 1 bad → error on `$.id`) +
`tests/mutation.test.mjs` (break validation and coercion; both killed).
