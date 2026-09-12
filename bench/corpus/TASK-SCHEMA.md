# Task-definition schema

An accepted task is more than a prompt. Its `task.json` must include:

* stable `id`, `prompt`, and `taskSet`/corpus hash;
* visible starter files and language-specific instructions;
* `phases.mote` and `phases.typescript` as argv arrays, with the same semantic
  phase names and budgets;
* public tests and hidden tests kept outside the model-visible workspace;
* meaningful benchmark mutations and an independent expected-value/property
  oracle;
* `verifiedWorkUnits`, repository seed/commit, dependency lockfile, and review
  record.

The pilot uses `privateFixture` to point at a reproducible local registry. The
registry contains reference solutions and inputs that are never materialized
in the model-visible workspace; `bench/corpus/oracles.mjs` computes expected
values independently of those references. `taskSetHash` in every task file
must equal the canonical hash of `manifest.json`.

Each phase command is an argv array, never an unchecked shell string. The
candidate runner supplies the workspace as the process working directory and
stops after the first failed phase. A task is accepted only when its Mote and
strict-TypeScript arms are semantically paired and its hidden oracle detects
meaningful hard-coded or superficially passing implementations.
