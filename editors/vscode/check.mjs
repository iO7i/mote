// Dependency-free VS Code package smoke check. It validates the extension's
// shipped contract even when the optional vsce packager is not installed.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("./", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("./package.json", root), "utf8"));
const grammar = JSON.parse(readFileSync(new URL("./syntaxes/mote.tmLanguage.json", root), "utf8"));
const language = JSON.parse(readFileSync(new URL("./language-configuration.json", root), "utf8"));
const extension = readFileSync(new URL("./extension.js", root), "utf8");
const errors = [];
if (manifest.name !== "mote-language" || manifest.main !== "./extension.js") errors.push("extension identity/main is invalid");
if (!manifest.engines?.vscode || !manifest.activationEvents?.includes("onLanguage:mote")) errors.push("activation contract is incomplete");
if (!manifest.contributes?.languages?.some((item) => item.id === "mote" && item.extensions?.includes(".mt"))) errors.push(".mt language association is missing");
if (!manifest.contributes?.grammars?.some((item) => item.scopeName === grammar.scopeName && item.path === "./syntaxes/mote.tmLanguage.json")) errors.push("grammar contribution is inconsistent");
if (!Array.isArray(grammar.patterns) || !language.comments?.lineComment) errors.push("grammar or language configuration is incomplete");
if (!extension.includes('command: "mote-lsp"') || !extension.includes("LanguageClient")) errors.push("extension does not start mote-lsp through LanguageClient");
const syntax = spawnSync(process.execPath, ["--check", fileURLToPath(new URL("./extension.js", root))], { encoding: "utf8" });
if (syntax.status !== 0) errors.push(syntax.stderr || "extension syntax check failed");
const result = { schemaVersion: 1, ok: errors.length === 0, package: manifest.name, languageId: "mote", grammarScope: grammar.scopeName, errors };
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
