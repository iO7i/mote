# Mote compiler reference

Use this reference for supported source constructs only. The compiler does not execute `use` imports while checking or compiling.

- Types: `str`, `num`, `bool`, `nil`, arrays (`[T]`), records, unions, and optional record fields (`field:T?`).
- Functions: `fn name(arg:T)->U=expression`; public functions use `pub fn` and require annotations in strict mode.
- Boundaries: `json<NamedType>(raw)`, `check<NamedType>(value)`, and `env<NamedType>(name)` return `Result<T>`; postfix `?` unwraps or throws `MoteValidationError`.
- Imports: `use "module" as alias`. Directory compilation rewrites local `./module.mt` imports to JavaScript specifiers.
- Compiler API: `import { checkSource, compileSource } from "mote/api"`. Both provide a versioned diagnostic envelope.

Validation boundaries require a concrete named type. `any`, `unknown`, generic aliases, unresolved aliases, and cycles are rejected rather than being erased into an unchecked runtime schema.

Known scope: expression-oriented modules and Node-oriented output. The implementation intentionally does not claim support for recursive types, generic type aliases, class syntax, or executing imported modules during compilation.
