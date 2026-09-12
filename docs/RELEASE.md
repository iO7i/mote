# Consumer release preparation

The manual `release-artifact` workflow runs the full local verification suite,
creates the package, and uploads the tarball with a SHA-256 checksum. The
package production surface contains the compiler, runtime, declarations, LSP,
docs, and examples; tokenizer packages stay dev-only and are not installed by
consumers. `npm pack --dry-run --json` is the local package-content audit.

`npm run release:check` verifies those package-content assertions and the VS
Code manifest, grammar, activation, and extension syntax without requiring the
optional `@vscode/vsce` packager. `npm run vscode:check` reports the remaining
VSIX gate explicitly when `vsce` is unavailable.

This repository does not run `npm publish`, publish a VS Code extension, or
claim registry provenance. Those actions remain explicit external release
gates.
