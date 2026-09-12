# Research corpus registry

`manifest.json` is a versioned registry, not a result file. The pilot contains
24 entries: P01–P20 are accepted paired task definitions and P21–P24 remain
explicit hard-negative specifications. Acceptance requires a paired starting
repository, language-specific visible starter, hidden independent oracle,
meaningful mutation control, and review record. The five historical fixtures
remain under `bench/tasks/` and are not silently promoted into the primary
corpus.

The registry supports at least 200 main-corpus entries through the same schema.
Main-corpus task IDs must be frozen and hashed before a final run. Hard
negatives are explicitly marked so a null result is visible rather than
filtered out.

See [TASK-SCHEMA.md](TASK-SCHEMA.md) for the acceptance contract for a real
task definition.

Regenerate task files after changing the private fixture registry with
`node bench/corpus/accepted/generate.mjs`. Run the local acceptance gate with
`npm run benchmark:accept`; it executes both reference arms and never contacts
a provider.

Run the structural audit with:

```sh
node bench/research.mjs audit-corpus
```
