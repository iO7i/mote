# Mote ledger adapter

This is a constrained, runnable application slice rather than a benchmark
fixture. Mote owns the typed ledger domain, policy, summary, configuration, and
runtime JSON boundary; a small TypeScript adapter owns persistence, the
HTTP-shaped response, and command-line I/O.

## Build and run

From the repository root:

```sh
node examples/ledger-app/build.mjs
node examples/ledger-app/run.mjs '{"amount":100,"fee":3,"kind":"credit"}'
```

The build emits `generated/` locally and is intentionally not committed. The
adapter accepts a JSON string, calls Mote-generated modules, and exposes both a
summary and an API-shaped response. `cli.ts` supports `summarize`, `append`,
and `list`; invalid input fails through Mote's runtime path-aware validation.

## Ownership metrics

Run `node examples/ledger-app/metrics.mjs --write` after a build to regenerate
the source-derived accounting record. `adapter-metrics.json` records the
frozen accounting rule, line/token counts, generated-output metadata, test
assertions, and the zero external-runtime-dependency count; it is not a
performance claim.
