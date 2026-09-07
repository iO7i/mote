# Compiler authoring evaluation protocol

`npm run eval` replays fixed compiler-authoring fixtures with seed `1592639710`. A replay checks expected diagnostics without invoking a model or executing generated candidate code. It is deterministic and suitable for CI.

Live authoring evaluation is deliberately gated. It requires all of the following: an explicit `--live` request, `MOTE_EVAL_MODEL`, and `MOTE_EVAL_ISOLATION=authorized`. This repository currently ships no model adapter or candidate-execution sandbox, so even a requested live run reports `NOT RUN`; it never substitutes replay results for a live result.

The evaluation output records replay status separately from live status. A passing replay demonstrates only regression coverage of the stored fixtures. It is not evidence of model quality, autonomous code-authoring performance, security isolation, or end-to-end productivity.
