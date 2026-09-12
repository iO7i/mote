# Language Server and VS Code support

`lsp/server.mjs` reuses the parser, checker, formatter, and diagnostic
envelope. The stdio entry point is `bin/mote-lsp.mjs`. Implemented protocol
features are diagnostics, hover, definition, document symbols, completion,
signature help, formatting, references, and conservative same-document rename.
The protocol tests exercise these capabilities in memory:

```sh
node tests/lsp.mjs
```

The prepared VS Code extension is under `editors/vscode/`. It registers `.mt`
files, highlighting, language configuration, formatter integration, and the
LSP client. Install its optional `vscode-languageclient` dependency and run
`npx @vscode/vsce package --no-dependencies` to create a local VSIX. No VSIX or
Marketplace publication is represented as complete here.
