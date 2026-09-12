# Compiler authoring evaluation protocol

`npm run eval` replays fixed compiler-authoring fixtures with seed `1592639710`. A replay checks expected diagnostics without invoking a model or executing generated candidate code. It is deterministic and suitable for CI.

Live authoring evaluation is deliberately gated. The provider-neutral adapters in `eval/adapters.mjs` support OpenAI Responses, OpenAI-compatible Chat Completions, and Anthropic Messages transports. `eval/live.mjs` requires an explicit `--live`, a runtime model ID/API key, and `MOTE_EVAL_ISOLATION=docker`; candidate phases are delegated to `eval/candidate-runner.mjs`. No provider request is made by CI or `npm run eval`, and this repository does not claim a live result until a raw manifest is emitted.

The evaluation output records replay status separately from live status. A passing replay demonstrates only regression coverage of the stored fixtures. It is not evidence of model quality, autonomous code-authoring performance, security isolation, or end-to-end productivity.
