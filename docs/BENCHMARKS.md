# Benchmarks

**Do not read a single headline percentage off this.** Mote and Tarse act on
different token pools; the harness reports them separately, per task, per
tokenizer, with explicit verification and honesty flags.

## The four modes

For every task:

```txt
A. Normal prose + TypeScript
B. Tarse  prose + TypeScript
C. Normal prose + Mote
D. Tarse  prose + Mote
```

`A` is the baseline. Primary comparison = **Mote (typed + runtime validation)**
vs **strict TypeScript + equivalent runtime validation**. `typescript-untyped/`
is a secondary reference only — never the headline.

## Layout

```txt
bench/
  tokenizers.mjs        pluggable adapters (heuristic built-ins; real ones optional)
  lib.mjs               prose/code split + the saving calculations
  run.mjs               runner -> results.json + REPORT.md
  tasks/<NN-name>/      task.md, mote/, typescript/, typescript-untyped/, tests/, fixtures/, expected-output/
  runs/<NN-name>/<VARIANT>/  response.md + metadata.json   (manual mode inputs)
```

## Metrics (measured separately)

Prose tokens · code tokens · total output tokens · compile success (Mote &
strict TS) · behavior tests · runtime/validation correctness. Provider-level
prompt/system/billed/reasoning tokens are **not** available in manual mode and
are not invented.

## Calculations

```txt
mote_code_saving   = 1 - mote_code_tokens   / ts_code_tokens          # C vs A (code)
tarse_prose_saving = 1 - tarse_prose_tokens / normal_prose_tokens     # B vs A (prose)
whole_output(X)    = 1 - X_total_output     / A_total_output
```

Reported comparisons: `B vs A` (prose only), `C vs A` (code only),
`D vs A` (combined), `D vs B` (Mote's marginal value given Tarse),
`D vs C` (Tarse's marginal value given Mote). **Never** add Mote% + Tarse%.

## Tokenizers

Built-in adapters are **heuristics** and marked `UNVERIFIED`:
`chars-3.8`, `chars-4.0`, `whitespace-words`. To get `VERIFIED` numbers, install
a real tokenizer and it is picked up automatically:

```bash
npm i gpt-tokenizer           # OpenAI o200k — becomes the headline adapter
# add Anthropic/Gemini/Qwen/DeepSeek/Llama adapters in tokenizers.mjs the same way
```

## Running it

```bash
node bench/run.mjs
# -> bench/results.json  (all adapters, raw counts, comparison matrix)
# -> bench/REPORT.md     (headline table + separated breakdown + honesty safeguards)
```

## Status of current numbers

- Mode: **manual** (not provider-verified).
- Headline adapter: whatever `bench/tokenizers.mjs` resolves — currently a
  **heuristic (UNVERIFIED)** unless you installed a real one.
- Tasks `01`–`05` (webhook, api-route, csv-importer, database-mapper,
  queue-worker) are fully implemented: all four variants **compile** (Mote and
  strict TS) and pass the **same** behavior **and** mutation tests. Run
  `node bench/audit.mjs` for the independent fairness/parity gate and consult
  `bench/REVIEWER-CHECKLIST.md` for the human judgement calls.

### Cold-start vs amortized (fairness)

The runtime validator is a one-time shared cost. The report shows, per task:
Mote source (per module), generated TS (per module), the shared runtime
(~1.3k tokens, once), **cold-start** (Mote source + full runtime for a single
module — where Mote can LOSE, e.g. −283% on the smallest task), project totals at
N=1/5/10, and the **break-even module count** (~5) after which Mote's total beats
strict TS. Per-module (N large) Mote wins ~75%.

### Code-representation honesty (per task, headline tokenizer)

The report separates **Mote source**, **generated TypeScript** (what Mote emits
per file), **hand-written strict TS**, and the **shared runtime** (`mote-runtime.ts`,
~1.2k tokens) imported once and amortized across every `json<T>` user. The
generated per-file TS is *smaller* than the hand-written strict TS — the
validator is not a hidden per-file blob; it is one fixed shared cost.

### Public-headline threshold

Mechanical gate (≥5 tasks · ≥3 VERIFIED tokenizer families · shared behavioral +
mutation tests · median reported) is **MET**: 5 tasks; o200k_base, llama-3,
deepseek/v3. **But the public headline is HELD** — every run is `manual`
(representative prose, not production-workflow sessions). No sweeping "X% fewer tokens"
claim until production-workflow runs on real production modules are collected and reported
separately. Five small synthetic tasks are enough to *continue*, not to publish.

## How to state results (defensible wording)

- **Mote:** "In five audited benchmark tasks, Mote source used 71–75% fewer
  tokens than equivalent strict TypeScript across three tokenizers. Results
  currently use manual runs; production-workflow and production-module validation are
  next."
- **Tarse:** "Tarse compresses visible explanatory prose; Mote compresses code.
  Combined figures are exploratory until measured in real production sessions,
  including instruction overhead and repair loops."
- Do NOT say "saves 75% of AI cost" or "Mote + Tarse saves 65%". Output-token
  reduction does not prove lower session cost or better output quality.
- Always pair the win with the runtime break-even (a single tiny validated
  module loses until ~5 modules vendored, or immediately as `@mote/runtime`).

## Informal, clearly-labeled exploratory data

The plan noted an earlier ad-hoc observation:

```txt
Mote webhook-like example:            314
Untyped TypeScript equivalent:        421
Observed reduction:                   25.4%
```

This is **not** a formal benchmark: the tokenizer, exact files, and behavioral
equivalence were not pinned. It is retained only as an informal breadcrumb. The
formal, reproducible replacement is `bench/` above.
