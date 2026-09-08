# Compiler trust evidence

The verification commands are intentionally split by claim:

- `npm test`: deterministic compiler, runtime, quoted-key, and 512-case seeded differential checks.
- `node tests/cli.mjs`: JSON diagnostics, failed-output atomicity, generated TypeScript compilation, and execution of the typed JSON-boundary example.
- `node tests/consumer.mjs`: `npm pack`, installation into a fresh temporary consumer, and import of `mote/api`.
- `npm run audit`: structural and behavioral audit of benchmark fixtures.
- `npm run audit:extended`: the same audit plus 12,000 seeded property/differential cases.
- `npm run eval`: deterministic replay only; live status is `NOT RUN` without explicit authorized facilities.

These checks cover compiler behavior and packaging, not arbitrary untrusted program execution. `mote run` executes a checked program with Node and should only be used with code you trust.
