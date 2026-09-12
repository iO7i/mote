# Mote ledger adapter

This is a constrained, runnable application slice rather than a benchmark
fixture. Mote owns the typed ledger core and runtime JSON boundary; a small
TypeScript adapter owns command-line I/O and presentation.

## Build and run

From the repository root:

```sh
node examples/ledger-app/build.mjs
node examples/ledger-app/run.mjs '{"amount":100,"fee":3,"kind":"credit"}'
```

The build emits `generated/` locally and is intentionally not committed. The
adapter accepts a JSON string, calls the Mote-generated module, and prints a
stable summary. Invalid input fails through Mote's runtime path-aware
validation.

## Ownership metrics

The checked-in core has two exported business functions plus one decoder in
Mote. The TypeScript adapter has one exported presentation function and one
CLI entrypoint. `adapter-metrics.json` records the frozen accounting rule and
the resulting 25% adapter statement share; it is not a performance claim.
