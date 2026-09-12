# Compiler crash corpus

Each minimized regression case belongs in this directory with a stable file
name such as `M902-0001.mt`. Add a sidecar JSON file containing:

```json
{"seed":123,"failureClass":"parser-crash","command":"node tests/fuzz.mjs --seed 123","fixedIn":"<commit>"}
```

The bounded fuzz suite currently has no discovered crash to record. This
directory is retained so a future failure has a committed, reviewable home;
the extended fuzz job should minimize before adding a case.
