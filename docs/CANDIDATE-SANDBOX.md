# Candidate execution boundary

`eval/candidate-runner.mjs` is the execution boundary for generated candidates.
Its Docker mode is the only mode admissible for a research result:

* each candidate gets a fresh temporary workspace;
* `--network=none`, an explicit Node image, dropped capabilities,
  `no-new-privileges`, read-only root filesystem, and a writable `/tmp` are
  applied;
* CPU, memory, process, wall-clock, and bounded stdout/stderr limits are
  recorded;
* no host environment is passed into the container; dependencies must come
  from the pinned image or an explicit task fixture/cache;
* phases stop at the first failure and return a machine-readable envelope.

Example phase configuration:

```js
runPhases({
  workspace,
  mode: "docker",
  phases: [
    { name: "typecheck", command: ["node", "tools/check.mjs"] },
    { name: "hidden-tests", command: ["node", "hidden/run.mjs"] }
  ]
});
```

`mode: "local"` requires `allowLocal: true` and is labeled
`local-unsafe`. It is useful for compiler development on Windows when Docker
is unavailable, but it does not provide a security boundary and must not be
used to make a hardened or multi-tenant claim. The runner also does not solve
kernel/container escape risk, supply-chain risk in an approved image, or
malicious hardware-level behavior.
