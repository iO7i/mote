# Local verification evidence — 2026-09-12

This is a recoverable record of the non-billable checks run while extending the
Mote research infrastructure. It deliberately contains no fabricated live
model, provider-token, latency, cost, or publication result.

## Repository identity

* starting HEAD: `23cdcfa7b7e5fcd55609df846a77aa47abf4818c`
* fetched `origin/main`: `23cdcfa7b7e5fcd55609df846a77aa47abf4818c`
* ending HEAD: `23cdcfa7b7e5fcd55609df846a77aa47abf4818c` (working-tree changes
  are uncommitted)
* branch: `main`, not detached; no stashes; no tags in the checkout
* remote: `https://github.com/iO7i/mote.git`

## Commands and results

| Command | Result |
| --- | --- |
| `npm test` | PASS — 122 compiler tests, 512 seeded properties, 256 fuzz, 128 semantic differential (+32 boundary/record), LSP, interop, and research-infrastructure checks |
| `npm run verify` | PASS — fast suite, CLI, fresh consumer install/import/declaration check, five-task audit, replay evaluation |
| `npm run audit:extended` | PASS — 12,000 seeded properties and five audited fixtures |
| `npm run fuzz:extended` | PASS — 12,000 cases; 4,144 malformed, 7,856 valid, 7,856 emitted-TypeScript syntax checks |
| `npm run differential:extended` | PASS — 2,080 executions against independent expected values |
| `npm run mutation:compiler` | PASS — 4/4 meaningful mutants killed; measured compiler mutation score 1.0 |
| `npm run mutation:benchmark` | PASS — 12/12 meaningful historical benchmark mutants killed; controls excluded; measured score 1.0 |
| `node bench/research.mjs audit-corpus` | PASS — versioned 24-entry pilot specification registry; accepted task count remains 0; task-set hash `f32cdd9b00f02e0da585b9376df7cf707489f31e0f79e4e92e372b3613c10cb3` |
| `node interop/audit.mjs` | PASS — eight versioned cases: four PASS, three PARTIAL, one NOT RUN |
| `node editors/vscode/build.mjs` | Static manifest/grammar/extension syntax PASS; VSIX packaging BLOCKED because `@vscode/vsce` is not installed |
| Docker availability probe | `DOCKER_UNAVAILABLE`; candidate-runner Docker policy is implemented but not exercised on this host; local unsafe mode is tested |
| `node eval/run.mjs` | Replay PASS, live status NOT RUN |

## Evidence boundary

The old five-fixture token benchmark remains a manual representation
microbenchmark and was not promoted to AI-engineering evidence. No live model
matrix was run, no provider tokens or costs were collected, no statistical
efficacy result is estimable, and no npm/VS Code publication or deployment was
performed. The pilot registry is specification-only until paired repositories,
hidden oracles, mutations, and review records are added.

No commit, push, or pull request was requested, so changes are left in the
working tree for review. The pre-existing dirty changes in
`bench/REPORT.md` and `bench/results.json` were preserved untouched.
