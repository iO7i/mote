# Mote

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

Mote compiles this source to readable TypeScript or JavaScript. The compiler
also emits declarations, runtime schemas for external JSON, and source maps.
`json<Payment>(raw)?` parses and validates the input against the generated
schema, then unwraps the value or throws a validation error.

The repository contains the compiler, CLI, formatter, examples, a compiler-
backed LSP server, and the benchmark harness used to measure the language.
Mote is experimental: the local paired pilot has 20 accepted task definitions,
and no provider-backed model run has been made.

## Install and run

Install a current Node.js LTS release and npm:

```sh
git clone https://github.com/iO7i/mote.git
cd mote
npm ci
node bin/mote.mjs check examples/typed-webhook.mt
node bin/mote.mjs check examples/typed-boundary.mt --json
node bin/mote.mjs run examples/typed-webhook.mt
npm test
```

To inspect and type-check the generated TypeScript:

```sh
node bin/mote.mjs compile examples/typed-webhook.mt --out dist
npx tsc -p dist/tsconfig.json
```

## CLI and API

Run commands with `node bin/mote.mjs`:

```text
check <file|dir>                  Type-check source
compile <file|dir> --out <dir>   Emit TypeScript, declarations, and runtime
run <file.mt>                    Check and execute a program
emit <file.mt> [--js]            Print generated TypeScript or JavaScript
fmt <file.mt> --compact          Format source; --readable is also supported
measure <file.mt> --json         Produce a heuristic token estimate
explain <M-code>                 Explain a compiler diagnostic
```

`check` and `compile` accept `--json` for a versioned diagnostic envelope. The
programmatic API is available through `mote/api`:

```js
import { checkSource, compileSource } from "mote/api";

const result = checkSource("type Event={id:str}", { file: "event.mt" });
console.log(result.envelope);
```

## Language and compiler behavior

The language currently supports:

- typed declarations, functions, structural records, and optional fields;
- static checking with stable diagnostic codes and explanations;
- runtime schemas derived from types for validating external JSON;
- TypeScript and JavaScript output, declarations, and statement/column source-map anchors;
- Node/npm imports, stable JSON diagnostics, and compact or readable formatting.

The compiler pipeline is:

```text
source → lexer → parser → type checker → emitter → TypeScript/JavaScript
```

Checking and compilation parse source only; they do not execute `use` imports.
Directory compilation validates every input before writing output, so a failed
compile does not leave a partially generated project behind.

Runtime validation treats `num` as a finite number and `nil` as JSON `null`.
Optional record fields may be absent; when present, they must match their
declared type, including rejecting an untyped `null`. Extra object properties
are accepted for structural interoperability. `mote run` executes code with
Node and is intended only for code you trust.

## Tests and benchmarks

Run the normal suite with:

```sh
npm test
```

The historical benchmark contains five synthetic tasks with behavior and
mutation tests. Across OpenAI o200k_base, Llama 3, and DeepSeek V3 tokenizers,
the reported median extracted code-token reduction is **71.6–74.7%**. A
separate full-source comparison with strict TypeScript reports a **73.8%**
median reduction using o200k_base, before shared runtime overhead.

These are fixture measurements from manual runs. They do not show lower
end-to-end cost or better generated code. Results depend on the workload and
tokenizer; the roughly 1,300-token validation runtime can outweigh the savings
of one small module before its cost is amortized. Code and explanatory text are
measured separately.

```sh
node bench/audit.mjs
node bench/run.mjs
npm run audit:extended
```

The charts are generated from `bench/results.json` with Python Matplotlib:

```sh
python bench/charts.py
```

![Median code-token reduction across three tokenizers, measured on five synthetic tasks.](docs/images/tokenizer-savings.svg)

![Full-source token counts by task, with and without the shared validation runtime.](docs/images/source-runtime.svg)

## Paired AI-engineering benchmark

The historical suite is a representation/compiler microbenchmark. The separate
paired protocol is versioned in
[docs/AI-ENGINEERING-BENCHMARK.md](docs/AI-ENGINEERING-BENCHMARK.md). Its pilot
registry has 24 entries: 20 accepted tasks and four explicit hard-negative
specifications.

The protocol compares Mote and TypeScript under fixed context, cumulative token,
time, and cost budgets. It does not infer end-to-end efficiency from source
token counts. No live model matrix has been run, so an improvement in AI
engineering efficiency has not been established.

The [research console](bench/dashboard/index.html) reads the checked-in raw
reports. When no provider-backed records exist it shows `NO LIVE MODEL DATA`.
The corpus roadmap remains `NOT_READY_FOR_FREEZE` until the planned 200-task
corpus is accepted.

### Current checks

| Check | Result |
| --- | --- |
| Compiler parsing and type checking | `npm test`; deterministic suite passes locally |
| Seeded compiler properties | `tests/property.mjs` and `tests/fuzz.mjs`; 12,000 + 256 cases locally verified |
| Compiler mutation catalog | `tests/mutation.mjs`; 60 valid mutants, 39 killed, 21 oracle-equivalent, 0 survivors |
| Historical benchmark mutations | `bench/mutation.mjs`; 12/12 killed, 100% measured score |
| Accepted paired pilot | `bench/corpus/accepted/run.mjs`; 20/20 references pass and 40/40 mutation controls pass |
| Generated TypeScript | `tests/cli.mjs` and fixture audit; locally verified when TypeScript is installed |
| LSP | `tests/lsp.mjs`; compiler-backed features locally verified |
| Node/npm boundary | `interop/corpus.json` and `interop/fixture-matrix.mjs`; 8/8 offline fixtures pass; third-party probes are separate |
| Mote efficiency versus TypeScript | No live result; live runs are blocked pending authorization |

See [compiler evidence](docs/COMPILER-EVIDENCE.md), [LSP support](docs/LSP.md),
the [candidate sandbox](docs/CANDIDATE-SANDBOX.md), [research-platform notes](docs/RESEARCH-PLATFORM.md),
and [release preparation](docs/RELEASE.md) for the detailed test boundaries.

## Repository layout

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

## Current limitations

Classes, inheritance, decorators, macros, native compilation, a browser
runtime, advanced type-level programming, and rich semantic analysis across
imported modules are outside the current implementation. The shipped LSP is
limited to the single-document compiler capabilities listed in [LSP.md](docs/LSP.md).

The paired pilot is synthetic and familiarity-risk-heavy. It is useful for
checking the harness and its oracles, not for estimating general model
performance. Provider-backed runs require a separate authorized environment;
the repository does not claim a live result until a raw run manifest exists.

## Documentation

- [Language specification](docs/SPEC-v0.2.md)
- [Type system](docs/TYPES.md)
- [Runtime validation](docs/RUNTIME-VALIDATION.md)
- [Compiler/API reference](docs/AGENT-REFERENCE.md)
- [Evaluation protocol](docs/EVALUATION-PROTOCOL.md)
- [Verification evidence](docs/COMPILER-EVIDENCE.md)

License: MIT.
