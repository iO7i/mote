const path = require("node:path");
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

function activate(context) {
  const server = { command: "mote-lsp", transport: TransportKind.stdio, options: { cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath } };
  const clientOptions = { documentSelector: [{ scheme: "file", language: "mote" }], synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/*.mt") } };
  client = new LanguageClient("mote", "Mote Language Server", server, clientOptions);
  context.subscriptions.push(client.start());
}

function deactivate() { return client?.stop(); }
module.exports = { activate, deactivate };
