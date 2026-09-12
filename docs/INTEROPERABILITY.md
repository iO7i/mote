# Node/npm interoperability corpus

The versioned matrix is [interop/corpus.json](../interop/corpus.json). It
records representative package shapes and uses `PASS`, `PARTIAL`,
`UNSUPPORTED`, `NOT APPLICABLE`, and `NOT RUN` rather than a universal support
claim. Run the structural audit with:

```sh
node interop/audit.mjs
```

The offline fixture matrix is the stronger local gate:

```sh
node interop/fixture-matrix.mjs
```

It creates temporary packages for ESM named/default-like exports, CommonJS,
scoped and nested resolution, async exports, JSON import, and declarations.
The matrix passed 8/8 locally without registry access. This does not imply
universal compatibility with arbitrary third-party packages.

The compiler currently emits namespace imports (`import * as alias from ...`)
and treats imported members as external/unchecked values. Node namespace imports
and `async`/`await` are covered by local tests. CommonJS-specific typing and
arbitrary third-party packages remain capability boundaries even though the
offline package-resolution probes pass.
