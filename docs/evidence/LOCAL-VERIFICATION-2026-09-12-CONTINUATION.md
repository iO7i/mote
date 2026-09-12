# Local verification evidence — continuation — 2026-09-12

This record covers the follow-on work after the initial research-infrastructure
pass. It contains no live-model, provider-token, cost, deployment, npm
publication, or Marketplace publication result.

## Repository identity

* remote: `https://github.com/iO7i/mote.git`
* branch: `main`, attached, upstream `origin/main`
* fetched `origin/main`: `23cdcfa7b7e5fcd55609df846a77aa47abf4818c`
* local `HEAD`: `23cdcfa7b7e5fcd55609df846a77aa47abf4818c`; divergence `0/0`
* no stashes; working tree intentionally contains the Mote changes and the
  pre-existing `bench/REPORT.md` / `bench/results.json` modifications

## New evidence

| Command | Result |
| --- | --- |
| `npm run benchmark:accept` | PASS — 20/20 accepted paired reference tasks; 40/40 mutation controls killed; task-set hash `7e20309aa06063d9330ec507ba2c1b26036328a1078802ace6b5abdb197f0247` |
| `node bench/research.mjs audit-corpus` | PASS — 24 pilot entries, 20 accepted, four explicit hard-negative specifications |
| `npm run benchmark:fake` | PASS — deterministic scripted provider completion/tool order, malformed arguments, cumulative usage, and tool budget |
| `node interop/fixture-matrix.mjs` | PASS — 8/8 offline ESM, default-like, CJS, async, JSON, scoped, nested, and declaration fixtures |
| `node tests/minimize.test.mjs` | PASS — deterministic source shrinking and failure metadata |
| `node tests/ledger-app.mjs` | PASS — Mote-majority ledger core, generated TypeScript, adapter execution, and runtime boundary failure |
| `npm run release:check` | PASS — package-content assertions and dependency-free VS Code smoke check |
| `npm test` | PASS — 124 compiler/infrastructure/app checks |
| `npm run verify` | PASS — fast suite, CLI, external consumer, historical audit, and replay |
| `npm run audit:extended` | PASS — 12,000 properties plus five historical fixtures |
| `npm run fuzz:extended` | PASS — 12,000 cases; 4,144 malformed, 7,856 valid, 7,856 emitted |
| `npm run differential:extended` | PASS — 2,080 independent semantic checks |
| `npm run mutation:compiler` | PASS — 4/4 killed |
| `npm run mutation:benchmark` | PASS — 12/12 killed |
| `node interop/audit.mjs` | PASS — six PASS and two PARTIAL capability entries |
| `node editors/vscode/check.mjs` | PASS — manifest, grammar, activation, and extension syntax |

## Remaining evidence boundary

Docker remains unavailable on this host, so the research candidate runner's
Docker isolation was not exercised locally. `@vscode/vsce` is not installed,
so VSIX packaging remains a separate explicit gate. No live provider matrix was
run and no efficacy claim about Mote versus strict TypeScript is estimable.

No commit, push, or pull request was requested; changes remain in the working
tree for review. The earlier evidence record is retained separately rather
than rewritten.
