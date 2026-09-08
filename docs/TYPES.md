# Mote Types

## Representation

Types are small tagged objects (`src/types.mjs`):

| Mote | Type object | TypeScript |
| --- | --- | --- |
| `str` | `{t:"str"}` | `string` |
| `num` | `{t:"num"}` | `number` |
| `bool` | `{t:"bool"}` | `boolean` |
| `nil` | `{t:"nil"}` | `null` |
| `unknown` | `{t:"unknown"}` | `unknown` |
| `any` | `{t:"any"}` | `any` |
| `T?` | `{t:"opt",inner}` | `T \| undefined` (field: `k?: T`) |
| `A\|B` | `{t:"union",options}` | `A \| B` |
| `[T]` | `{t:"array",element}` | `T[]` |
| `{k:T}` | `{t:"object",fields}` | `{ k: T }` |
| `Name` | `{t:"named",name}` | `Name` (kept lazy, not inlined) |
| `Result<T>` | `{t:"result",inner}` | `$mote.Result<T>` |

Named references are **not** eagerly expanded, so the emitter prints `Money`
rather than an inlined object literal. Resolution happens on demand during
assignability checks.

## Inference (pragmatic, not full HM)

The checker is a structural checker with light generic unification, not a
complete Hindley–Milner engine. What it does:

- Infers literals, member access along declared object/named types, call
  results, arithmetic (`num`), comparisons/logical (`bool`), `??` (drops the
  optional/nil from the left), ternary (join of branches), object/array
  literals, and `Result` unwrap.
- Instantiates function generics by unifying parameter types with argument
  types (`fn first<T>(items:[T])->T?` binds `T` from the call).

### Known pragmatic simplifications (deferred, documented on purpose)

- **Un-annotated parameters** are treated as `any`. Real bidirectional inference
  of parameter types from bodies/call-sites is deferred. Annotate parameters (or
  rely on `pub`-strict enforcement) for full checking.
- **Untyped npm imports** (`use "x" as x`) currently expose members as `any`.
  The intended end state is: load `.d.ts` when present, and treat genuinely
  untyped imports as `unknown` in strict mode. Loading declaration files is
  deferred; the honest current behavior is "import members are external/`any`".
- `+` is numeric only in v0.2 (string concatenation via `+` is not modeled).
- Generic **functions** are supported by light unification. Generic type aliases
  are parsed for forward compatibility but rejected with `M310` because the
  current resolver cannot instantiate them soundly.

## Assignability

`assignable(sub, sup)` is structural:

- `any` is assignable to/from anything; everything is assignable to `unknown`.
- `T` and `nil` are assignable to `U?`; `T?` is not assignable to a non-optional
  `U` (this is what makes `M201` fire on unguarded optional access).
- Objects are width/depth structural: every required field of the target must be
  present and assignable; extra fields are allowed.
- A value is assignable to a union if it matches some member; a union is
  assignable to a target if every member is.

## Diagnostics (type layer)

`M101` unknown identifier · `M102` duplicate declaration · `M110` unknown named
type · `M111` cyclic type alias · `M201` nullable access without handling · `M202` invalid member access ·
`M301` wrong argument count · `M302` wrong argument type · `M401` invalid return
type · `M410` arithmetic on non-number · `M420` missing annotation on public API ·
`M310` invalid generic use · `M311` non-reifiable runtime validation type · `M501` invalid unwrap.
