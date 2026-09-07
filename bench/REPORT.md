# Mote × Tarse Benchmark Report

- Run mode: **manual** (not provider-verified)
- Headline tokenizer: **openai/o200k_base** (gpt-tokenizer) — status **VERIFIED**
- Adapters measured: chars-3.8 (code-ish) [UNVERIFIED], chars-4.0 (prose-ish) [UNVERIFIED], whitespace-words [UNVERIFIED], openai/o200k_base [VERIFIED], meta/llama-3 [VERIFIED], deepseek/v3 [VERIFIED]

## 01-webhook-verifier

Compile: Mote **Pass**, strict TS **Pass** · Behavior tests: **Pass** · Mutation tests: **Pass**

Code representation (openai/o200k_base):
```txt
Mote source:              236 tokens
Generated TypeScript:     564 tokens  (what Mote expands to, per file)
Hand-written strict TS:   764 tokens
Shared runtime (once):    1273 tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)

Fairness accounting (cold-start vs amortized):
  Per-module (N large):   Mote 236 vs strict-TS 764  -> 69.1% fewer
  Cold-start (1 module):  Mote 1509 (src+runtime) vs strict-TS 764  -> -97.5%  (Mote LOSES on a single tiny module)
  Project total @ N=1:  Mote 1509 vs strict-TS 764  -> -97.5%
  Project total @ N=5:  Mote 2453 vs strict-TS 3820  -> 35.8%
  Project total @ N=10: Mote 3633 vs strict-TS 7640  -> 52.4%
  Break-even (vendored):  Mote's total beats strict TS from ~3 validated module(s) onward
  Dependency view (N=1):  Mote 248 (src+import) vs strict-TS 764  -> 67.5%  (runtime installed as @mote/runtime, not counted per module)
```

| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| A: Normal + TS | 156 | 661 | 817 | Pass | Pass | — |
| B: Tarse + TS | 73 | 661 | 734 | Pass | Pass | 10.2% |
| C: Normal + Mote | 156 | 167 | 323 | Pass | Pass | 60.5% |
| D: Tarse + Mote | 73 | 167 | 240 | Pass | Pass | 70.6% |

Breakdown (separated — do NOT add these together):
```txt
Mote code saving        (C code vs A code): 74.7%
Tarse prose saving      (B prose vs A prose): 53.2%
Prose-only whole-output (B vs A): 10.2%
Code-only whole-output  (C vs A): 60.5%
Combined whole-output   (D vs A): 70.6%
Mote value given Tarse  (D vs B): 67.3%
Tarse value given Mote  (D vs C): 25.7%
System/skill overhead:  not measured in manual mode
Net saving after overhead: = combined (overhead unmeasured)
```

## 02-api-route

Compile: Mote **Pass**, strict TS **Pass** · Behavior tests: **Pass** · Mutation tests: **Pass**

Code representation (openai/o200k_base):
```txt
Mote source:              126 tokens
Generated TypeScript:     379 tokens  (what Mote expands to, per file)
Hand-written strict TS:   481 tokens
Shared runtime (once):    1273 tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)

Fairness accounting (cold-start vs amortized):
  Per-module (N large):   Mote 126 vs strict-TS 481  -> 73.8% fewer
  Cold-start (1 module):  Mote 1399 (src+runtime) vs strict-TS 481  -> -190.9%  (Mote LOSES on a single tiny module)
  Project total @ N=1:  Mote 1399 vs strict-TS 481  -> -190.9%
  Project total @ N=5:  Mote 1903 vs strict-TS 2405  -> 20.9%
  Project total @ N=10: Mote 2533 vs strict-TS 4810  -> 47.3%
  Break-even (vendored):  Mote's total beats strict TS from ~4 validated module(s) onward
  Dependency view (N=1):  Mote 138 (src+import) vs strict-TS 481  -> 71.3%  (runtime installed as @mote/runtime, not counted per module)
```

| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| A: Normal + TS | 127 | 470 | 597 | Pass | Pass | — |
| B: Tarse + TS | 88 | 470 | 558 | Pass | Pass | 6.5% |
| C: Normal + Mote | 127 | 126 | 253 | Pass | Pass | 57.6% |
| D: Tarse + Mote | 88 | 126 | 214 | Pass | Pass | 64.2% |

Breakdown (separated — do NOT add these together):
```txt
Mote code saving        (C code vs A code): 73.2%
Tarse prose saving      (B prose vs A prose): 30.7%
Prose-only whole-output (B vs A): 6.5%
Code-only whole-output  (C vs A): 57.6%
Combined whole-output   (D vs A): 64.2%
Mote value given Tarse  (D vs B): 61.6%
Tarse value given Mote  (D vs C): 15.4%
System/skill overhead:  not measured in manual mode
Net saving after overhead: = combined (overhead unmeasured)
```

## 03-csv-importer

Compile: Mote **Pass**, strict TS **Pass** · Behavior tests: **Pass** · Mutation tests: **Pass**

Code representation (openai/o200k_base):
```txt
Mote source:              57 tokens
Generated TypeScript:     187 tokens  (what Mote expands to, per file)
Hand-written strict TS:   347 tokens
Shared runtime (once):    1273 tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)

Fairness accounting (cold-start vs amortized):
  Per-module (N large):   Mote 57 vs strict-TS 347  -> 83.6% fewer
  Cold-start (1 module):  Mote 1330 (src+runtime) vs strict-TS 347  -> -283.3%  (Mote LOSES on a single tiny module)
  Project total @ N=1:  Mote 1330 vs strict-TS 347  -> -283.3%
  Project total @ N=5:  Mote 1558 vs strict-TS 1735  -> 10.2%
  Project total @ N=10: Mote 1843 vs strict-TS 3470  -> 46.9%
  Break-even (vendored):  Mote's total beats strict TS from ~5 validated module(s) onward
  Dependency view (N=1):  Mote 69 (src+import) vs strict-TS 347  -> 80.1%  (runtime installed as @mote/runtime, not counted per module)
```

| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| A: Normal + TS | 102 | 336 | 438 | Pass | Pass | — |
| B: Tarse + TS | 91 | 336 | 427 | Pass | Pass | 2.5% |
| C: Normal + Mote | 102 | 57 | 159 | Pass | Pass | 63.7% |
| D: Tarse + Mote | 91 | 57 | 148 | Pass | Pass | 66.2% |

Breakdown (separated — do NOT add these together):
```txt
Mote code saving        (C code vs A code): 83%
Tarse prose saving      (B prose vs A prose): 10.8%
Prose-only whole-output (B vs A): 2.5%
Code-only whole-output  (C vs A): 63.7%
Combined whole-output   (D vs A): 66.2%
Mote value given Tarse  (D vs B): 65.3%
Tarse value given Mote  (D vs C): 6.9%
System/skill overhead:  not measured in manual mode
Net saving after overhead: = combined (overhead unmeasured)
```

## 04-database-mapper

Compile: Mote **Pass**, strict TS **Pass** · Behavior tests: **Pass** · Mutation tests: **Pass**

Code representation (openai/o200k_base):
```txt
Mote source:              110 tokens
Generated TypeScript:     429 tokens  (what Mote expands to, per file)
Hand-written strict TS:   471 tokens
Shared runtime (once):    1273 tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)

Fairness accounting (cold-start vs amortized):
  Per-module (N large):   Mote 110 vs strict-TS 471  -> 76.6% fewer
  Cold-start (1 module):  Mote 1383 (src+runtime) vs strict-TS 471  -> -193.6%  (Mote LOSES on a single tiny module)
  Project total @ N=1:  Mote 1383 vs strict-TS 471  -> -193.6%
  Project total @ N=5:  Mote 1823 vs strict-TS 2355  -> 22.6%
  Project total @ N=10: Mote 2373 vs strict-TS 4710  -> 49.6%
  Break-even (vendored):  Mote's total beats strict TS from ~4 validated module(s) onward
  Dependency view (N=1):  Mote 122 (src+import) vs strict-TS 471  -> 74.1%  (runtime installed as @mote/runtime, not counted per module)
```

| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| A: Normal + TS | 102 | 455 | 557 | Pass | Pass | — |
| B: Tarse + TS | 81 | 455 | 536 | Pass | Pass | 3.8% |
| C: Normal + Mote | 102 | 110 | 212 | Pass | Pass | 61.9% |
| D: Tarse + Mote | 81 | 110 | 191 | Pass | Pass | 65.7% |

Breakdown (separated — do NOT add these together):
```txt
Mote code saving        (C code vs A code): 75.8%
Tarse prose saving      (B prose vs A prose): 20.6%
Prose-only whole-output (B vs A): 3.8%
Code-only whole-output  (C vs A): 61.9%
Combined whole-output   (D vs A): 65.7%
Mote value given Tarse  (D vs B): 64.4%
Tarse value given Mote  (D vs C): 9.9%
System/skill overhead:  not measured in manual mode
Net saving after overhead: = combined (overhead unmeasured)
```

## 05-queue-worker

Compile: Mote **Pass**, strict TS **Pass** · Behavior tests: **Pass** · Mutation tests: **Pass**

Code representation (openai/o200k_base):
```txt
Mote source:              204 tokens
Generated TypeScript:     482 tokens  (what Mote expands to, per file)
Hand-written strict TS:   645 tokens
Shared runtime (once):    1273 tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)

Fairness accounting (cold-start vs amortized):
  Per-module (N large):   Mote 204 vs strict-TS 645  -> 68.4% fewer
  Cold-start (1 module):  Mote 1477 (src+runtime) vs strict-TS 645  -> -129%  (Mote LOSES on a single tiny module)
  Project total @ N=1:  Mote 1477 vs strict-TS 645  -> -129%
  Project total @ N=5:  Mote 2293 vs strict-TS 3225  -> 28.9%
  Project total @ N=10: Mote 3313 vs strict-TS 6450  -> 48.6%
  Break-even (vendored):  Mote's total beats strict TS from ~3 validated module(s) onward
  Dependency view (N=1):  Mote 216 (src+import) vs strict-TS 645  -> 66.5%  (runtime installed as @mote/runtime, not counted per module)
```

| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| A: Normal + TS | 112 | 619 | 731 | Pass | Pass | — |
| B: Tarse + TS | 83 | 619 | 702 | Pass | Pass | 4% |
| C: Normal + Mote | 112 | 204 | 316 | Pass | Pass | 56.8% |
| D: Tarse + Mote | 83 | 204 | 287 | Pass | Pass | 60.7% |

Breakdown (separated — do NOT add these together):
```txt
Mote code saving        (C code vs A code): 67%
Tarse prose saving      (B prose vs A prose): 25.9%
Prose-only whole-output (B vs A): 4%
Code-only whole-output  (C vs A): 56.8%
Combined whole-output   (D vs A): 60.7%
Mote value given Tarse  (D vs B): 59.1%
Tarse value given Mote  (D vs C): 9.2%
System/skill overhead:  not measured in manual mode
Net saving after overhead: = combined (overhead unmeasured)
```

## Medians across 5 measured task(s)

```txt
Median Mote code saving (C vs A):        74.7%
Median Mote-vs-strict-TS source saving:  73.8%
Median combined whole-output (D vs A):   65.7%
```

### Per-tokenizer medians (reported per family, never blended)

| Tokenizer | Status | Median Mote code saving (C vs A) | Median combined (D vs A) |
| --- | --- | ---: | ---: |
| chars-3.8 (code-ish) | UNVERIFIED | 76.8% | 67.9% |
| chars-4.0 (prose-ish) | UNVERIFIED | 76.8% | 68.2% |
| whitespace-words | UNVERIFIED | 93.2% | 82.4% |
| openai/o200k_base | VERIFIED | 74.7% | 65.7% |
| meta/llama-3 | VERIFIED | 74.7% | 65.4% |
| deepseek/v3 | VERIFIED | 71.6% | 61.1% |

Mechanical gate: **MET** — 5/5 tasks, 3/3 VERIFIED tokenizer families, shared behavioral + mutation tests.

Public headline: **HELD** — every run here is **manual** (representative prose, not production-workflow sessions). Do NOT publish a sweeping "X% fewer tokens" claim until production-workflow runs on real production modules are collected and reported separately. These 5 small synthetic tasks are enough to *continue*, not to make a broad claim.

## Honesty safeguards

- This run was **manual**, not provider-verified.
- Tokenizer: **openai/o200k_base** gpt-tokenizer, status **VERIFIED**. Heuristic adapters are NOT tokenizer-accurate.
- Code behavior is verified by `tests/behavior.test.mjs` for Mote and the untyped reference; strict TS is compile-verified via `tsc`.
- Tarse/Prose *instruction overhead* (system-prompt cost) is NOT included here.
- Reasoning/thinking tokens were NOT available and NOT measured.
- Output-token reduction does **not** by itself prove better workflow performance.
- Mote and Tarse savings act on different token pools and must be reported separately.
- **Fairness — full source, not just the core:** the strict-TS baseline uses compact hand-written validation (NOT verbose Zod) and includes its complete parse/validate code. On a single tiny module Mote can LOSE once its ~1273-token shared runtime is counted (see cold-start); it wins only from the break-even module count onward.
- **Fairness assumption:** strict-TS generic helpers (isObject/kind/num/str, a few dozen tokens) are counted per-file, not amortized. Sharing them would slightly raise Mote's break-even — the amortized medians are therefore mildly optimistic for Mote and are labelled per-module, not whole-project.

