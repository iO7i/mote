# Mote AI-engineering benchmark protocol

Protocol version: **1.0.0**
Status: **implemented locally; live model runs not collected**
Primary artifact: `bench/corpus/manifest.json` and run manifests emitted by
`bench/research.mjs`.

## Question and hypotheses

The primary question is:

> Under identical model, task, tool, context, and cumulative engineering-budget
> conditions, does implementation in Mote produce a different amount of
> verified engineering work than implementation in strict TypeScript?

The primary hypothesis is a two-sided difference: Mote may improve, worsen, or
not change verified work. The null hypothesis is that, within a model,
language, regime, task stratum, and budget checkpoint, the paired distribution
of verified work is equal. The representation microbenchmark is a secondary
question and cannot establish either hypothesis.

## Experimental unit

The unit is one fresh, isolated model × task × language × regime run. Mote and
strict TypeScript are paired on the same task specification, starting
repository, visible tools, tests, context ceiling, cumulative budget, and
wall-clock ceiling. The implementation language is the only intended treatment
difference. Execution order is randomized or counterbalanced and recorded.

The current five fixtures in `bench/tasks/` are historical representation and
compiler-evidence fixtures. They are not the primary AI-engineering corpus.
`bench/corpus/manifest.json` contains 24 pilot entries and capacity for at
least 200 main-corpus tasks. P01–P20 are accepted locally by the paired
reference/oracle/mutation gate; P21–P24 remain hard-negative specifications
until their complete repositories and review records exist.

## Conditions

Every task is run in two separate regimes:

* **cold-start**: the Mote grammar, reference, and setup instructions are
  included in the visible context and counted in input/context accounting;
* **warm-tooling**: the same compiler/tool environment is preinstalled and
  available through the declared tools. Cache and tool-result accounting are
  still recorded; warm tooling is never merged with cold-start results.

The TypeScript arm receives an equivalently useful task environment and does not
receive hidden tests or the Mote implementation.

## Primary and secondary outcomes

The predeclared primary outcome is **verified engineering work completed before
the budget checkpoint**. A task contributes a work unit only when its source
parses, type-checks, generated TypeScript compiles where applicable, public and
hidden behavioral tests pass, boundary/runtime checks pass, and regressions are
absent. A complete task is one unit; multi-stage tasks may define additional
ordered work units in their manifest. Source token count is not the primary
outcome.

Secondary outcomes are recorded independently: task success; parse/type/
generated-TS success; hidden tests; mutation score; repair rounds; cumulative
input/output/provider/cache/reasoning/billed tokens; pinned-snapshot dollar
cost; wall time; tool calls; type errors; runtime-validation failures;
hallucinated APIs; regressions; budget exhaustion; generated and authored
source size; and runtime/library amortization.

No composite score is used. If a future paper needs one, its formula, weights,
missing-value policy, and direction must be frozen before final runs.

## Budget and accounting

Context capacity and cumulative engineering budget are distinct. Each manifest
records maximum simultaneous context, cumulative input/output tokens, provider
tokens, cached tokens, reasoning tokens when exposed, tool-result tokens when
measurable, cost from a dated pricing snapshot, wall-clock limit, tool-call
limit, repair-round limit, and checkpoints such as 8k/32k/100k cumulative
tokens. Provider-reported values are preferred; estimates are labeled and never
silently substituted. Costs are `input × pinned input price + output × pinned
output price`, with cached/reasoning price rules recorded by provider.

## Correctness oracle

The oracle reports separate statuses for parse, type-check, generated TypeScript
compile, public tests, hidden tests, boundary validation, mutation tests, API
existence, property/output invariants, regression tests, timeout, budget
exhaustion, and infrastructure failure. A failure envelope retains the phase,
exit code, bounded stdout/stderr, and stable failure class. Hidden tests and
reference implementations stay outside the model-visible workspace.

Candidate execution uses `eval/candidate-runner.mjs`. Docker mode is the
research default: network disabled, explicit image, CPU/memory/process/time and
output limits, a temporary workspace, no inherited secrets, and cleanup. The
local escape hatch is intentionally labeled unsafe and is not admissible for a
security or multi-tenant claim.

## Analysis plan

The primary comparison is within model and paired by task. Before inspecting
outcomes, exclusions are limited to malformed task manifests, infrastructure
failure before candidate execution, and a documented provider outage; partial
candidate failures remain failures. Reports contain per-model paired outcomes,
absolute and relative differences where defined, medians and distributions for
skewed metrics, deterministic bootstrap confidence intervals, McNemar exact
tests for binary paired success, effect sizes, stratum results, paired
token/cost differences, and budget-response curves. Cross-model rankings are
secondary. All exclusions and their reasons are reported.

## Run statuses and evidence

Each run is labeled `IMPLEMENTED`, `LOCALLY VERIFIED`, `LIVE RUN`, `NOT RUN`, or
`BLOCKED`. A replay fixture is never promoted to live-model evidence. Every
manifest includes the Mote SHA, protocol and task-set hashes, exact provider /
model / snapshot and settings, prompt and tool-definition hashes, OS/arch/Node,
compiler and lockfile hashes, seed, context and budget limits, usage/cost
metadata, timestamps, and result hashes. Raw results are immutable inputs to
reports; charts are generated from raw data.

No live provider run, paid API call, npm publish, VS Code publish, or deployment
is authorized by this repository change. The infrastructure is ready to run
once credentials, model choices, a pricing snapshot, and execution approval are
provided.
