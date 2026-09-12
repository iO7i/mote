import { readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) => spawnSync(npm, args, { cwd: root, encoding: "utf8", windowsHide: true, shell: process.platform === "win32" });
let failed = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };
const packed = run(["pack", "--dry-run", "--json", "--ignore-scripts"]);
expect("package dry-run succeeds", packed.status === 0, packed.stderr);
if (packed.status === 0) {
  const info = JSON.parse(packed.stdout)[0];
  const paths = info.files.map((file) => file.path);
  expect("package contains compiler and declarations", paths.includes("src/api.mjs") && paths.includes("src/api.d.ts") && paths.includes("src/runtime/mote.d.ts"));
  expect("package contains LSP entrypoint", paths.includes("bin/mote-lsp.mjs") && paths.includes("lsp/server.mjs"));
  expect("package excludes research raw data and tests", !paths.some((path) => /^(bench|eval|tests|interop)\//.test(path)));
}
const vscode = spawnSync(process.execPath, [join(root, "editors", "vscode", "check.mjs")], { cwd: root, encoding: "utf8", windowsHide: true });
expect("VS Code manifest smoke check", vscode.status === 0, vscode.stderr || vscode.stdout);
console.log(`${failed ? "FAIL" : "PASS"} release and extension gates`);
process.exit(failed ? 1 : 0);
