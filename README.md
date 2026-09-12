# Mote

A typed, token-efficient programming language that compiles to readable TypeScript.

Created by **Hosam Talbi**.

Mote explores how compact syntax can reduce source-code token counts while preserving type checking, runtime validation, and interoperability with Node.js. Its compiler emits inspectable TypeScript or JavaScript, declaration files, and source maps.

**Status: experimental research platform.** Mote includes a compiler, command-line interface, formatter, examples, a tested LSP server, and a reproducible benchmark/research harness. The local pilot has 20 accepted paired task definitions; provider-backed model runs are intentionally blocked pending explicit authorization, credentials, and Docker isolation.

## Language features

- Typed declarations, functions, structural records, and optional fields.
- Static checking with stable diagnostic codes and explanations.
- Runtime schemas derived from types for validating external JSON.
- TypeScript and JavaScript output, declarations, and statement/column source-map anchors.
- Node/npm imports, stable JSON diagnostics, and compact or readable formatting.

```mote
type Payment={amount:num,currency:str?}

fn describe(p:Payment)={
  amount:p.amount,
  currency:p.currency??"SAR"
}

let raw='{"amount":154,"currency":"SAR"}'
let payment=json<Payment>(raw)?
console.log(describe(payment))
```

`json<Payment>(raw)?` parses and validates input against a generated runtime schema, then unwraps the result or throws a validation error.

## Getting started

Install a current Node.js LTS release and npm, then:

```sh
git clone https://github.com/iO7i/mote.git
cd mote
npm ci
node bin/mote.mjs check examples/typed-webhook.mt
node bin/mote.mjs check examples/typed-boundary.mt --json
node bin/mote.mjs run examples/typed-webhook.mt
npm test
```

To inspect and check the generated TypeScript:

```sh
node bin/mote.mjs compile examples/typed-webhook.mt --out dist
npx tsc -p dist/tsconfig.json
```

## Command-line interface

Run commands with `node bin/mote.mjs`.

```text
check <file|dir>                 Type-check source
compile <file|dir> --out <dir>    Emit TypeScript, declarations, and runtime
run <file.mt>                    Check and execute a program
emit <file.mt> [--js]            Print generated TypeScript or JavaScript
fmt <file.mt> --compact          Format source; --readable is also supported
measure <file.mt> --json         Produce a heuristic token estimate
explain <M-code>                 Explain a compiler diagnostic
```

`check` and `compile` accept `--json` for a versioned diagnostic envelope. The programmatic API is available through `mote/api`:

```js
import { checkSource, compileSource } from "mote/api";

const result = checkSource("type Event={id:str}", { file: "event.mt" });
console.log(result.envelope);
```

Compilation and checking parse source only; they do not execute `use` imports. A failed directory compilation validates all inputs before writing output, so it does not leave a partial generated project behind.

## Benchmarks

![Median code-token reduction across three tokenizers, measured on five synthetic tasks.](docs/images/tokenizer-savings.svg)

![Full-source token counts by task, with and without the shared validation runtime.](docs/images/source-runtime.svg)

The included report records five synthetic tasks with behavior and mutation tests. Across OpenAI o200k_base, Llama 3, and DeepSeek V3 tokenizers, the reported median extracted code-token reduction is **71.6–74.7%**. The separate full-source comparison against strict TypeScript records a **73.8%** median reduction using o200k_base, before shared runtime overhead.

These are fixture measurements from manual runs, not evidence of lower end-to-end cost or improved output quality. Results depend on workload and tokenizer. The roughly 1,300-token validation runtime can outweigh the savings of one small module before its cost is amortized. Code and explanatory text are measured separately; their percentage savings must not be added together.

```sh
node bench/audit.mjs
node bench/run.mjs
npm run audit:extended
```

See [methodology](docs/BENCHMARKS.md) and the [detailed report](bench/REPORT.md) for baselines and limitations.

The historical five-task suite is a representation/compiler microbenchmark. The
separate paired AI-engineering protocol is versioned in
[docs/AI-ENGINEERING-BENCHMARK.md](docs/AI-ENGINEERING-BENCHMARK.md), with a
24-entry pilot registry in `bench/corpus/`, of which 20 tasks are accepted by
the local paired-oracle gate and four remain explicit hard-negative
specifications. It measures verified work under fixed context, cumulative
token, time, and cost budgets; it does not turn source-token savings into an
end-to-end efficiency claim. No live model matrix has been run in this
checkout.

## Evidence at a glance

| Claim | Evidence | Current status |
| --- | --- | --- |
| Compiler parses/type-checks Mote | `npm test`, deterministic suite | verified locally |
| Seeded compiler properties hold | `tests/property.mjs`, `tests/fuzz.mjs` | 12,000 + 256 cases locally verified |
| Compiler mutation catalog is exercised | `tests/mutation.mjs` | 60 valid mutants; 39 killed, 21 oracle-equivalent, 0 survivors |
| Historical benchmark mutations are detected | `bench/mutation.mjs` | 12/12 killed, 100% measured score |
| Accepted paired pilot tasks | `bench/corpus/accepted/run.mjs` | 20/20 references pass; 40/40 mutation controls killed |
| Generated TypeScript compiles | `tests/cli.mjs` and fixture audit | locally verified when TypeScript is installed |
| LSP features work against compiler APIs | `tests/lsp.mjs` | locally verified |
| Node/npm boundary is characterized | `interop/corpus.json`, `interop/fixture-matrix.mjs` | 8/8 offline fixtures pass; third-party probes remain separate |
| Mote improves AI engineering efficiency | paired live run artifacts | **not established; live runs blocked** |

See [compiler evidence](docs/COMPILER-EVIDENCE.md), [LSP support](docs/LSP.md),
the [candidate sandbox](docs/CANDIDATE-SANDBOX.md), and [release preparation](docs/RELEASE.md) for exact boundaries.

The generated [research console](bench/dashboard/index.html) is evidence-bound: it reports local compiler and harness results, and displays an explicit `NO LIVE MODEL DATA` state when no provider-backed records exist. The research roadmap remains `NOT_READY_FOR_FREEZE` until the planned 200-task corpus is accepted.

Charts are generated from `bench/results.json`. To regenerate them, install Python with Matplotlib and run `python bench/charts.py`.

## Repository structure

| Directory | Contents |
| --- | --- |
| `src` | Lexer, parser, checker, emitter, formatter, and runtime |
| `bin` | Command-line entry point |
| `tests` | Compiler, runtime, formatter, and end-to-end tests |
| `examples` | Runnable language examples |
| `bench` | Reference implementations, fixtures, measurements, and audit harness |
| `lsp` / `editors/vscode` | Compiler-backed language server and prepared VS Code client |
| `interop` / `eval` | Versioned compatibility matrix, provider adapters, and bounded candidate runner |
| `docs` | Specification and technical documentation |

Pipeline: source → lexer → parser → type checker → emitter → TypeScript/JavaScript.

## Documentation and boundaries

- [Language specification](docs/SPEC-v0.2.md)
- [Type system](docs/TYPES.md)
- [Runtime validation](docs/RUNTIME-VALIDATION.md)
- [Compiler/API reference](docs/AGENT-REFERENCE.md)
- [Evaluation protocol](docs/EVALUATION-PROTOCOL.md)
- [Verification evidence](docs/COMPILER-EVIDENCE.md)

Runtime validation treats `num` as a finite number and `nil` as JSON `null`. Optional record fields may be absent; when present, they must match their declared type (including rejecting an untyped `null`). Extra object properties are accepted to preserve structural interoperability. `mote run` executes code with Node and is intended only for code you trust.

Classes, inheritance, decorators, macros, native compilation, a browser runtime, advanced type-level programming, and rich semantic analysis across imported modules are outside the current implementation. The shipped LSP is intentionally limited to the compiler-backed single-document capabilities listed in [LSP.md](docs/LSP.md).

License: MIT.
