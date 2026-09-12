# Mote VS Code extension

This extension registers `.mt` files, syntax highlighting, bracket/comment
configuration, formatting, and diagnostics/completion/hover through the
repository's `mote-lsp` stdio server. It is prepared for local packaging; it
has not been published to the Marketplace.

The extension expects `mote-lsp` to be on `PATH`, or a workspace-local npm
install of this repository. Install the extension dependency and package a
VSIX from this directory with:

```sh
npm install --ignore-scripts
npx @vscode/vsce package --no-dependencies
```

The repository's CI only validates the manifest and grammar unless the optional
VS Code packaging tool is installed. No Marketplace or external publication is
performed by this project.
