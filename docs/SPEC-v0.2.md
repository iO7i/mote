# Mote v0.2 — Language Specification

Status: implemented MVP. This document is the contract the compiler in `src/`
follows. Where behavior and this doc disagree, that is a bug in one of them.

## 1. Lexical structure

- **Whitespace & newlines are insignificant.** Statement boundaries are
  resolved structurally by the parser. This lets compact single-line code and
  multiline-continuation code lex identically.
- **Comments:** `// ...` to end of line.
- **Identifiers:** `[A-Za-z_$][A-Za-z0-9_$]*`.
- **Keywords:** `use as pub fn let mut type match case true false nil`.
  Keywords are still accepted as *member names* and *object/type keys*
  (`e.type`, `{ type: ... }`).
- **Strings:** single- or double-quoted; content preserved verbatim on emit.
- **Numbers:** decimal, optional fraction and exponent.
- **Operators/punctuation:** `( ) { } [ ] , : ; . ? = < > + - * / % !`
  and the multi-character `== != <= >= && || ?? ->`.

## 2. Blocks: braces, chosen deliberately

v0.2 uses **braces / expression bodies**, not indentation blocks. Rationale
(per the plan's Phase 0 guidance): a language should not support both, and
indentation-owned layout only pays off once a formatter fully owns formatting.
Mote function bodies are single expressions (`fn f(x)=<expr>`), and `{ ... }` in
expression position is always an **object literal** — there is no statement-block
ambiguity. Layout is owned by `mote fmt` (`--compact` / `--readable`).

## 3. Grammar (top level)

```txt
program   := item*
item      := use | typeDecl | fn | let | exprStmt
use       := 'use' STRING 'as' IDENT
typeDecl  := 'type' IDENT typeParams? '=' type
fn        := 'pub'? 'fn' IDENT typeParams? '(' params? ')' ret? '=' expr
let       := 'let' IDENT (':' type)? '=' expr
exprStmt  := expr
params    := param (',' param)*
param     := IDENT (':' type)?
ret       := '->' type
typeParams:= '<' IDENT (',' IDENT)* '>'
```

## 4. Types

```txt
type      := union
union     := optional ('|' optional)*
optional  := primary '?'*
primary   := '[' type ']'            // array
           | '{' field (',' field)* '}'  // object
           | IDENT ('<' type (',' type)* '>')?  // primitive or named (generic)
field     := NAME ':' type
```

Primitives: `str num bool nil unknown any`. `T?` is optional (a field/value that
may be absent). `A|B` is a union. `[T]` is an array. `{k:T}` is an object.
Named references (`Money`, `Event`, `Result<T>`) resolve against `type` decls.
Generic functions are supported; generic type aliases are parsed but currently
diagnosed as unsupported (`M310`) rather than being unsafely erased.

## 5. Expressions & precedence

Lowest → highest binding:

```txt
1  ternary   cond ? yes : no        (right associative)
   unwrap    expr ?                 (postfix Result unwrap; see §7)
2  ??        nullish fallback       (left)
3  ||
4  &&
5  == !=
6  < > <= >=
7  + -
8  * / %
9  unary     - !
10 postfix   . (member)  () (call)  [] (index)  <T>() (generic call)
11 primary   literal | ident | ( expr ) | { object } | [ array ]
```

`==`/`!=` emit as strict `===`/`!==`. Object literals emit multiline with
trailing commas.

### The three uses of `?` are disjoint

```mote
str?          # optional TYPE (type position only)
a ?? b        # nullish fallback (distinct token '??')
cond ? y : n  # ternary (has a ':')
expr?         # Result unwrap (postfix, no ':')
```

Ternary vs. unwrap is disambiguated by lookahead: a `?` that is followed by a
value and a `:` is a ternary; otherwise it is the unwrap operator.

## 6. Functions & inference

- Local bindings and un-annotated return types are inferred.
- Any function may be annotated.
- In **strict mode** (default), exported `pub` functions must annotate every
  parameter and the return type (`M420` otherwise), so a stable `.d.ts` emits.
- Un-annotated parameters are currently treated as `any` (a pragmatic
  placeholder; fuller inference is deferred — see `docs/TYPES.md`).

## 7. Runtime validation & `?`

`json<T>(raw)` / `env<T>(name)` return a `Result<T>` — they never `as`-cast.
The postfix `?` unwraps a `Result`:

- **Top-level / value position:** unwrap or throw a `MoteValidationError`
  (non-zero process exit). Never silently `nil`.
- **Non-Result operand:** `M501`.

See `docs/RUNTIME-VALIDATION.md` for the schema and error-path format.

## 8. Diagnostics

Every diagnostic has a stable code and a source location. Codes:
`M001 M101 M102 M110 M111 M201 M202 M203 M301 M302 M310 M311 M401 M410 M420 M501 M901 M902`.
Run `mote explain <code>` for details.

## 9. Emit contract

- `use "m" as x` → `import * as x from "m";` (checking/compiling never executes it).
- `type` → a TypeScript `type` alias + a runtime schema entry in `$schemas`.
- Functions emit readable signatures with resolved annotations.
- Output passes `tsc --strict` (see `bench` / `dist/tsconfig.json`).
- A coarse line-level source map (`.ts.map`) is emitted; full chained
  Mote→TS→JS maps are deferred.

## 10. Deferred (not in v0.2)

classes, inheritance, decorators, macros, metaprogramming, reflection,
ownership/borrowing, native compilation, custom package registry, browser
runtime, LSP beyond diagnostics scaffolding, generic type aliases, advanced
type-level programming.
