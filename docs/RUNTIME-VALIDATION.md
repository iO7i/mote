# Runtime Validation

Static types cannot make raw JSON safe. Mote generates a **runtime schema** from
your `type` declarations and validates untrusted input against it. The safe path
is shorter than the unsafe path — that is the whole point.

## Surface

```mote
let e = json<Event>(raw)?     # parse + validate + unwrap-or-throw
let cfg = env<Config>("APP")? # (scaffolded) validate an env var
```

- `json<T>(raw)` returns `Result<T>` — it **never** compiles to
  `JSON.parse(raw) as T`.
- The postfix `?` unwraps the `Result`: returns `T`, or throws a
  `MoteValidationError` (non-zero exit at top level). It never silently returns
  `nil`.

## What it compiles to

`let e = json<Event>(raw)?` becomes:

```ts
import * as $mote from "./mote-runtime.js";

const $schemas: $mote.Registry = {};
$schemas["Money"] = { k: "object", fields: [ /* ... */ ] };
$schemas["Order"] = { k: "object", fields: [ /* ...{ k:"ref", name:"Money" } */ ] };
$schemas["Event"] = { k: "object", fields: [ /* ... */ ] };

const e: Event = $mote.unwrap($mote.json<Event>(raw, $schemas, "Event"));
```

The validators live in a **shared runtime module** (`mote-runtime.ts`), not
inlined per call site — no giant validator blobs.

## Schema descriptors

```txt
{ k: "str" | "num" | "bool" | "nil" | "unknown" | "any" }
{ k: "opt", inner }
{ k: "ref", name }                       // resolved via the $schemas registry
{ k: "array", element }
{ k: "union", options: [...] }
{ k: "object", fields: [{ name, optional, schema }] }
```

## Error paths

Validation walks the value and reports the **first** failure with a JSON path:

```txt
$.data.order.money.subtotal expected num, got str
$.data.order.money.subtotal expected num (required), got nil   # missing field
$.tags[1] expected str, got num                                 # array member
```

- Optional fields (`str?`) may be absent. If present, they must match the inner
  type (matching TypeScript `?:` semantics; `null` is not silently accepted for
  an optional `str`).
- The runtime resolves `{k:"ref"}` through the emitted `$schemas` registry, so
  declaration order does not matter.
- `num` accepts finite JavaScript numbers only; `nil` accepts JSON `null` only.
  Unknown, malformed, or cyclic schema references become validation failures,
  never uncaught runtime-schema exceptions.

## Try it

```bash
mote run examples/typed-webhook.mt      # valid payload -> { ok: true, ... }
# malformed payload -> "M901 runtime validation error: $.…", exit 1
```

## Runtime strategy (three modes)

The validator runtime is a fixed ~1.3k-token module. How it's counted against a
project depends on how it's shipped:

1. **Vendored** (default, offline) — `mote compile` writes `mote-runtime.ts` into
   the output and imports `./mote-runtime.js`. Worst case for token accounting: the
   runtime source lives in your repo, so a single tiny module "pays" the whole
   runtime (see the cold-start / break-even numbers in `bench/REPORT.md`,
   break-even ≈ 5 validated modules).

2. **Installed package** — `mote compile --runtime mote/runtime` emits
   `import * as $mote from "mote/runtime"` and does NOT vendor the runtime. The
   runtime then lives in `node_modules` and does not count against per-module context —
   exactly like `zod`. Under this view Mote wins even at N=1.

3. **Trusted / no-validation** — `cast<T>(value)` asserts a type WITHOUT any
   runtime check (emits `(value as T)`), so a module that only uses `cast` pulls
   in **no runtime and no schema**. Use only for values already trusted (internal,
   not from an untrusted boundary). It is the explicit, greppable, unsafe escape
   hatch — the opposite of `json<T>(raw)?`.

Both accounting views (vendored and dependency) are reported per task so the
runtime cost is never hidden and never double-charged.

## Deferred

Richer error models (multiple errors, coercions), `input<T>(request)` HTTP
binding, and `env<T>` beyond string parsing are deferred. The current model is
deliberately simple, explicit, tested, and honest.
