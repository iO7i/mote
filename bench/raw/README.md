# Raw research artifacts

Live/locally-verified run records belong here or in an external immutable
artifact store, separate from rendered reports. Each record must carry its
run manifest, task/model/language/regime identity, oracle envelope, provider
usage, cost snapshot when applicable, and result hash. The analyzer consumes
JSON arrays or JSONL records:

```sh
node bench/analyze.mjs --input runs.jsonl --out analysis.json
```

This checkout contains no live-model raw run. Do not create a result file from
replayed fixtures and label it as live evidence.
