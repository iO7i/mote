# Benchmark Reviewer Checklist

Run `node bench/audit.mjs` for the automated gates, then a human confirms the
judgement calls below. A task's numbers are trustworthy only when BOTH pass.

## Automated (bench/audit.mjs)

- [ ] `impls-present` — mote / typescript / typescript-untyped all exist.
- [ ] `mote-typechecks` — Mote compiles with no diagnostics.
- [ ] `strict-ts-compiles` — strict-TS reference passes `tsc --strict`.
- [ ] `has-behavior-tests` / `behavior-passes`.
- [ ] `has-mutation-tests` / `mutation-passes` — intentional breakage is killed.
- [ ] `tests-error-paths` — a precise `$.<path>` is asserted.
- [ ] `validated-vs-unsafe-parity` — same tests assert validated impls throw AND
      the unsafe baseline does not.
- [ ] `has-negative-fixtures` — ≥2 fixtures (happy + at least one edge/negative).

## Human judgement (not automatable)

- [ ] **Behavior parity** — Mote and strict-TS compute the *same* result on every
      fixture, not merely similar-looking output.
- [ ] **Competent TS baseline** — the strict-TS validation is compact and
      idiomatic (hand-written or a real lib), NOT padded boilerplate or verbose
      Zod chosen to inflate the baseline.
- [ ] **Full source counted** — the measured code solves the whole task, not just
      the "interesting core". Any shared harness is identical across variants and
      excluded from the per-variant code count.
- [ ] **Security guarantees equal** — both validate the same untrusted boundaries;
      neither smuggles an `as`-cast or skips a check the other performs.
- [ ] **Cold-start honesty** — the report shows Mote's source + full runtime for a
      single module (where Mote can lose) and the break-even module count.
- [ ] **Error-path parity** — Mote and strict-TS report the *same* failing path
      for the same bad input.
- [ ] **No hidden runtime win** — generated TS per file is reported next to the
      shared runtime; the validator is not a huge per-file blob.

## Task-specific spot checks

- **01 webhook** — signature valid/invalid; timing-safe compare; null vs absent currency.
- **02 api-route** — auth precedes validation (bad body + wrong token → 401, no parse).
- **03 csv-importer** — bad row reported by row number + `$.id`, not imported.
- **04 db-mapper** — nullable `deleted_at` (present-null) vs required fields; pagination math.
- **05 queue-worker** — idempotent skip does NO write; retry vs failed classification;
      validation failure does NO write (side-effect assertions).
