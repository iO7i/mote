# Compiler trust evidence

The verification commands are intentionally split by claim:

- `npm test`: deterministic compiler, runtime, quoted-key, and 512-case seeded differential checks.
- `node tests/cli.mjs`: JSON diagnostics, failed-output atomicity, generated TypeScript compilation, and execution of the typed JSON-boundary example.
- `node tests/consumer.mjs`: `npm pack`, installation into a fresh temporary consumer, and import of `mote/api`.
- `npm run audit`: structural and behavioral audit of benchmark fixtures.
- `npm run audit:extended`: the same audit plus 12,000 seeded property/differential cases.
- `npm run eval`: deterministic replay only; live status is `NOT RUN` without explicit authorized facilities.
- `node tests/fuzz.mjs --cases 256`: bounded seeded lexer/parser/formatter/emitter property checks; `npm run fuzz:extended` runs 12,000 cases.
- `node tests/mutation.mjs`: four meaningful compiler mutants are executed in temporary copies and reports killed/survived status and score.
- `node bench/mutation.mjs`: aggregates the meaningful mutants in all five historical benchmark fixtures without counting their control cases.
- `npm run benchmark:accept`: locally executes the 20 accepted paired pilot reference arms and 40 mutation controls against the independent oracle.
- `node tests/minimize.test.mjs`: verifies deterministic crash reduction metadata; fuzz failures are archived under `tests/crash-corpus/`.
- `node tests/fake-provider.mjs`: exercises deterministic provider transcripts, tool order, malformed arguments, usage accounting, and budget exhaustion.
- `node interop/fixture-matrix.mjs`: runs eight scoped/nested/ESM/CJS/async/JSON/declaration fixtures entirely offline.
- `node tests/ledger-app.mjs`: builds and runs the Mote-majority ledger application slice with a TypeScript adapter.
- `npm run release:check`: audits package contents and the dependency-free VS Code manifest smoke check.
- `node tests/run.mjs`: includes statement/column source-map anchor checks.
- `node tests/lsp.mjs`: protocol-level LSP checks built on compiler APIs.
- `node tests/research.mjs`: manifest hashing, provider-adapter normalization, candidate-runner envelope, and paired-analysis checks.
- `node interop/audit.mjs`: validates the versioned Node/npm compatibility matrix; unrun third-party probes remain `NOT RUN`.
- `npm pack --dry-run --json`: audits package contents; the manual release workflow adds a SHA-256 checksum without publishing.

These checks cover compiler behavior, benchmark infrastructure, and package metadata, not arbitrary untrusted program execution. `mote run` executes a checked program with Node and should only be used with code you trust. The research candidate boundary is documented in [CANDIDATE-SANDBOX.md](CANDIDATE-SANDBOX.md).
