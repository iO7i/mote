// Small LSP server built on the compiler's parser/checker/formatter APIs.
// It intentionally exposes only features with deterministic, source-backed
// answers; it is not a second language implementation.
import { check } from "../src/checker.mjs";
import { parse as parseSource } from "../src/parser.mjs";
import { compileSource } from "../src/api.mjs";
import { formatMote } from "../src/formatter.mjs";
import { show } from "../src/types.mjs";

const KEYWORDS = ["use", "as", "pub", "fn", "let", "mut", "type", "match", "case", "true", "false", "nil", "async", "await"];

export function createLspServer() {
  const docs = new Map();
  let initialized = false;

  return Object.freeze({
    handle(message) {
      const method = message.method;
      if (method === "initialize") {
        initialized = true;
        return response(message.id, { capabilities: {
          textDocumentSync: 1,
          hoverProvider: true,
          definitionProvider: true,
          documentSymbolProvider: true,
          completionProvider: { triggerCharacters: [".", ":"] },
          signatureHelpProvider: { triggerCharacters: ["(", ","] },
          documentFormattingProvider: true,
          referencesProvider: true,
          renameProvider: true,
        }, serverInfo: { name: "mote-lsp", version: "0.1.0" } });
      }
      if (method === "initialized" || method === "$/cancelRequest") return null;
      if (method === "shutdown") return response(message.id, null);
      if (method === "exit") return null;
      if (!initialized && message.id !== undefined) return error(message.id, -32002, "server is not initialized");

      if (method === "textDocument/didOpen") {
        const textDocument = message.params.textDocument;
        docs.set(textDocument.uri, { text: textDocument.text, version: textDocument.version ?? 0, languageId: textDocument.languageId ?? "mote" });
        return notification("textDocument/publishDiagnostics", diagnostics(textDocument.uri, docs.get(textDocument.uri).text));
      }
      if (method === "textDocument/didChange") {
        const uri = message.params.textDocument.uri;
        const old = docs.get(uri) ?? { text: "", version: 0 };
        const text = applyChanges(old.text, message.params.contentChanges ?? []);
        docs.set(uri, { ...old, text, version: message.params.textDocument.version ?? old.version + 1 });
        return notification("textDocument/publishDiagnostics", diagnostics(uri, text));
      }
      if (method === "textDocument/didClose") {
        const uri = message.params.textDocument.uri;
        docs.delete(uri);
        return notification("textDocument/publishDiagnostics", { uri, diagnostics: [] });
      }

      const uri = message.params?.textDocument?.uri;
      const doc = uri ? docs.get(uri) : null;
      if (!doc) return message.id === undefined ? null : error(message.id, -32602, "document is not open");
      const parsed = safeParse(doc.text, uri);
      if (method === "textDocument/hover") return response(message.id, hover(doc.text, parsed, message.params.position));
      if (method === "textDocument/definition") return response(message.id, definition(doc.text, parsed, uri, message.params.position));
      if (method === "textDocument/documentSymbol") return response(message.id, documentSymbols(doc.text, parsed));
      if (method === "textDocument/completion") return response(message.id, completion(doc.text, parsed));
      if (method === "textDocument/signatureHelp") return response(message.id, signatureHelp(doc.text, parsed, message.params.position));
      if (method === "textDocument/formatting") return response(message.id, formatting(doc.text, uri, message.params.options));
      if (method === "textDocument/references") return response(message.id, references(doc.text, parsed, uri, message.params.position));
      if (method === "textDocument/rename") return response(message.id, rename(doc.text, parsed, uri, message.params.position, message.params.newName));
      return message.id === undefined ? null : error(message.id, -32601, `method not found: ${method}`);
    },
  });
}

export function startStdio(input = process.stdin, output = process.stdout) {
  const server = createLspServer();
  let buffer = Buffer.alloc(0);
  input.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { buffer = buffer.subarray(headerEnd + 4); continue; }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const message = JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
      buffer = buffer.subarray(start + length);
      const result = server.handle(message);
      if (result) writeMessage(output, result);
    }
  });
  return server;
}

function diagnostics(uri, text) {
  const result = compileSource(text, { file: uri });
  return { uri, diagnostics: result.envelope.diagnostics.map((d) => ({
    range: { start: { line: Math.max(0, d.span.line - 1), character: Math.max(0, d.span.column - 1) }, end: { line: Math.max(0, d.span.line - 1), character: Math.max(1, d.span.column) } },
    severity: d.severity === "error" ? 1 : 2,
    code: d.code,
    source: "mote",
    message: d.message,
  })) };
}

function safeParse(text, file) {
  try { const ast = parseSource(text, file); return { ast, checked: check(ast, { file }), error: null }; }
  catch (error) { return { ast: { kind: "Program", body: [] }, checked: null, error }; }
}

function symbols(parsed) {
  const out = [];
  for (const node of parsed.ast.body) {
    if (node.kind === "TypeDecl") out.push({ name: node.name, kind: 5, detail: `type ${node.name}`, node, type: node.typeR });
    else if (node.kind === "Fn") out.push({ name: node.name, kind: 12, detail: signature(node), node, type: node.retTypeR });
    else if (node.kind === "Let") out.push({ name: node.name, kind: 13, detail: `let ${node.name}`, node, type: node.typeR });
    else if (node.kind === "Use") out.push({ name: node.alias, kind: 9, detail: `import ${node.module}`, node });
  }
  return out;
}

function hover(text, parsed, position) {
  const name = wordAt(text, position);
  const symbol = symbols(parsed).find((s) => s.name === name);
  if (!symbol) return null;
  return { contents: { kind: "markdown", value: `\`mote\`\n\n**${symbol.detail}**${symbol.type ? `\n\nType: \`${safeShow(symbol.type)}\`` : ""}` } };
}

function definition(text, parsed, uri, position) {
  const name = wordAt(text, position);
  const symbol = symbols(parsed).find((s) => s.name === name);
  if (!symbol) return null;
  return [{ uri, range: nodeRange(text, symbol.node, symbol.name) }];
}

function documentSymbols(text, parsed) { return symbols(parsed).map((s) => ({ name: s.name, kind: s.kind, detail: s.detail, range: nodeRange(text, s.node, s.name), selectionRange: nodeRange(text, s.node, s.name) })); }

function completion(text, parsed) {
  const items = [...KEYWORDS.map((label) => ({ label, kind: 14 })), ...symbols(parsed).map((s) => ({ label: s.name, kind: s.kind, detail: s.detail }))];
  return { isIncomplete: false, items: dedupe(items) };
}

function signatureHelp(text, parsed, position) {
  const prefix = text.slice(0, offsetAt(text, position));
  const match = prefix.match(/([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^()]*$/);
  const fn = match && symbols(parsed).find((s) => s.node.kind === "Fn" && s.name === match[1]);
  if (!fn) return null;
  const parameters = fn.node.params.map((p, i) => ({ label: `${p.name}: ${p.type ? typeText(p.type) : "unknown"}`, documentation: "Mote parameter" }));
  return { signatures: [{ label: `${fn.node.name}(${parameters.map((p) => p.label).join(", ")})`, parameters }], activeParameter: Math.max(0, (prefix.match(/,/g) ?? []).length), activeSignature: 0 };
}

function formatting(text, uri) {
  try { return [{ range: wholeDocumentRange(text), newText: formatMote(parseSource(text, uri), "readable") }]; }
  catch { return []; }
}

function references(text, parsed, uri, position) {
  const name = wordAt(text, position);
  if (!symbols(parsed).some((s) => s.name === name)) return [];
  return wordRanges(text, name).map((range) => ({ uri, range }));
}

function rename(text, parsed, uri, position, newName) {
  const name = wordAt(text, position);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(newName ?? "") || !symbols(parsed).some((s) => s.name === name)) return null;
  return { changes: { [uri]: wordRanges(text, name).map((range) => ({ range, newText: newName })) } };
}

function signature(node) { return `${node.isAsync ? "async " : ""}fn ${node.name}(${node.params.map((p) => `${p.name}${p.type ? `:${typeText(p.type)}` : ""}`).join(",")})${node.retType ? `->${typeText(node.retType)}` : ""}`; }
function typeText(type) { if (!type) return "unknown"; if (type.kind === "TObject") return "object"; if (type.kind === "TArray") return `[${typeText(type.element)}]`; if (type.kind === "TOptional") return `${typeText(type.inner)}?`; if (type.kind === "TUnion") return type.options.map(typeText).join("|"); return type.name ?? type.kind; }
function safeShow(type) { try { return show(type); } catch { return typeText(type); } }
function nodeRange(text, node, name) { const line = Math.max(0, (node.line ?? 1) - 1); const sourceLine = text.split(/\r?\n/)[line] ?? ""; const start = Math.max(0, sourceLine.indexOf(name)); return { start: { line, character: start }, end: { line, character: start + name.length } }; }
function wholeDocumentRange(text) { const lines = text.split(/\r?\n/); return { start: { line: 0, character: 0 }, end: { line: lines.length - 1, character: lines.at(-1).length } }; }
function wordAt(text, position) { const lines = text.split(/\r?\n/); const line = lines[position?.line ?? 0] ?? ""; const col = position?.character ?? 0; const left = line.slice(0, col).match(/[A-Za-z_$][A-Za-z0-9_$]*$/)?.[0] ?? ""; const right = line.slice(col).match(/^[A-Za-z0-9_$]*/)?.[0] ?? ""; return left + right; }
function offsetAt(text, position) { const lines = text.split(/\r?\n/); return lines.slice(0, position?.line ?? 0).reduce((n, line) => n + line.length + 1, 0) + (position?.character ?? 0); }
function wordRanges(text, name) { const out = []; const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"); const lines = text.split(/\r?\n/); lines.forEach((line, lineNo) => { for (let match; (match = re.exec(line));) out.push({ start: { line: lineNo, character: match.index }, end: { line: lineNo, character: match.index + name.length } }); }); return out; }
function applyChanges(text, changes) { let value = text; for (const change of changes) { if (!change.range) value = change.text; else { const start = offsetAt(value, change.range.start), end = offsetAt(value, change.range.end); value = value.slice(0, start) + change.text + value.slice(end); } } return value; }
function dedupe(items) { return [...new Map(items.map((item) => [item.label, item])).values()]; }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function response(id, result) { return { jsonrpc: "2.0", id, result }; }
function error(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }
function notification(method, params) { return { jsonrpc: "2.0", method, params }; }
function writeMessage(output, message) { const body = JSON.stringify(message); output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`); }
