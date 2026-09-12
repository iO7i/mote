# Mote research-platform evidence

This document records the local, reproducible state of the AI-engineering
research platform as of 2026-09-12. It is an evidence boundary, not a claim
that Mote improves model capability, speed, cost, or reliability.

## Scientific verdict

**E — inconclusive / no live model evidence.** The repository now has the
protocol, corpus controls, fake-provider harness, compiler robustness
campaigns, representation experiments, application fixture, and evidence
dashboard needed for the next authorized phase. No provider-backed model run
was performed. The only valid conclusion about Mote versus TypeScript for
AI-engineering efficacy is therefore **not established**.

The live runner refuses to proceed without explicit `--live`, a model, a
supported transport, and Docker isolation. The no-authorization boundary is
recorded as:

`LIVE MODEL RUNS: BLOCKED PENDING AUTHORIZATION`

## Completed local workstreams

| Workstream | Local evidence | Interpretation |
| --- | --- | --- |
| Paired benchmark protocol | `bench/protocol.mjs`, `docs/AI-ENGINEERING-BENCHMARK.md` | Versioned budgets, task-set hashes, paired arms, counterbalancing, fresh workspaces, tool/repair accounting, exclusions, and resumable identities are implemented. |
| Skeptical pilot audit | `bench/corpus/reports/pilot-review-latest.json` | 20/20 accepted pilot tasks pass reference equivalence and mutation-control checks; all 20 carry high-familiarity warnings. The 200-task roadmap remains `NOT_READY_FOR_FREEZE`. |
| Fake agent campaign | `bench/raw/fake-agent-campaign-latest.json` | 20 paired tasks / 40 arms pass as `SIMULATION_ONLY`. The scripted agent writes the private reference, so these are harness checks, not model observations. |
| Compiler mutation campaign | `bench/raw/compiler-mutation-latest.json` | 60 valid mutants: 39 killed, 21 observationally equivalent on the oracle, 0 survivors, 0 invalid. The 65% score is oracle-campaign coverage, not product quality or efficacy. |
| Attack fuzzing | `bench/raw/attack-fuzz-latest.json` | 512 deterministic cases: 512 contained, 0 compiler crashes, 738 whitespace/readability metamorphic checks, 0 metamorphic failures. |
| Real application slice | `examples/ledger-app/` and `tests/ledger-app.mjs` | A multi-module typed ledger adapter, persistence path, CLI, API-shaped responses, and checked-in metrics are exercised locally. |
| Representation stress | `bench/experiments/representation/` and `bench/raw/representation-measurement-latest.json` | Paired Mote/TypeScript fixtures exist at 4, 12, 30, and 60 source modules. Measurements are design accounting only; no agent ran. |
| Ablations and density | `bench/raw/ablation-design-latest.json`, `bench/raw/semantic-density-latest.json` | Soundness-limited ablations and 40 descriptive density rows are materialized without treating accounting as an outcome. |
| Evidence dashboard | `bench/dashboard/index.html` and `bench/dashboard/data.json` | Cards and tables are generated from raw artifacts. With no live JSONL records it displays `NO LIVE MODEL DATA`. |

## Reproducibility

The archived JSON artifacts above were generated from the same committed
source revision. The milestone branch is `feat/research-platform`; the
source revision stamped into the artifacts is the full SHA for commit
`45051d28139901acc2ed6927966e5257430a3909` before this final artifact refresh
commit.

Representative commands:

```sh
node tests/mutation.mjs
node tests/attack-fuzz.mjs --cases 512
node eval/fake-campaign.mjs
node bench/corpus/review.mjs
npm test
npm run verify
```

The first four commands regenerate the raw evidence. `npm test` and
`npm run verify` are the repository gates; any environment-dependent check is
reported separately rather than converted into a pass.

## Blocked or deliberately deferred

- No paid provider request, live model request, publication, deployment, or
  remote push was performed.
- Live model execution is blocked pending explicit authorization, model and
  provider configuration, credentials, and Docker isolation.
- The 200-task corpus is not frozen: the accepted pilot is only 20 tasks and
  remains synthetic and familiarity-risk-heavy.
- A production VSIX/package publication is not claimed; the VS Code extension
  remains locally checked/prepared only.

The next scientifically meaningful step is to obtain authorization and run
the pre-registered paired matrix. Only records with status `LIVE RUN`, valid
manifests, successful independent oracles, and no exclusion reason may enter
the efficacy analysis.
