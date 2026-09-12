import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
if (!packageJson.contributes?.languages?.some((language) => language.extensions?.includes(".mt"))) throw new Error("VS Code manifest has no .mt association");
JSON.parse(readFileSync(new URL("./language-configuration.json", import.meta.url)));
JSON.parse(readFileSync(new URL("./syntaxes/mote.tmLanguage.json", import.meta.url)));
const syntaxCheck = spawnSync(process.execPath, ["--check", fileURLToPath(new URL("./extension.js", import.meta.url))], { encoding: "utf8" });
if (syntaxCheck.status !== 0) throw new Error(syntaxCheck.stderr || "extension.js syntax check failed");
console.log("VS Code manifest, language configuration, grammar, and extension syntax: PASS");
if (spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--no-install", "@vscode/vsce", "--version"], { encoding: "utf8" }).status !== 0) {
  console.error("VSIX packaging: BLOCKED (install @vscode/vsce in editors/vscode first)");
  process.exit(2);
}
console.log("VS Code manifest: PASS; run npx @vscode/vsce package --no-dependencies to create the local .vsix");
