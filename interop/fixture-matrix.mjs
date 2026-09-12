// Offline npm/Node interoperability matrix. Fixtures are generated in a
// temporary node_modules tree; no registry or network access is required.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export async function runFixtureMatrix({ node = process.execPath } = {}) {
  const root = mkdtempSync(join(tmpdir(), "mote-interop-fixtures-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    packageFixture(root, "fixtures-esm", { type: "module", main: "index.mjs" }, "export const named = 7; export default { value: 8 };\n");
    packageFixture(root, "fixtures-cjs", { main: "index.cjs" }, "module.exports = { named: 9 };\n");
    packageFixture(root, "fixtures-async", { type: "module", main: "index.mjs" }, "export async function value() { return 10; }\n");
    packageFixture(root, "fixtures-json", { type: "module", exports: { "./data.json": "./data.json" } }, "", { "data.json": JSON.stringify({ value: 11 }) });
    packageFixture(root, "@fixtures/typed", { type: "module", main: "index.mjs", types: "index.d.ts" }, "export const value = 12;\n", { "index.d.ts": "export declare const value: number;\n" });
    packageFixture(root, "fixtures-nested", { type: "module", main: "index.mjs" }, "export { value } from \"fixtures-child\";\n", { "node_modules/fixtures-child/package.json": JSON.stringify({ type: "module", main: "index.mjs" }), "node_modules/fixtures-child/index.mjs": "export const value = 13;\n" });

    const runtime = runRuntimeMatrix(root, node);
    const cases = runtime.status === 0 ? JSON.parse(runtime.stdout) : [{ id: "runtime-driver", status: "FAIL", detail: runtime.stderr || runtime.error?.message }];
    const typedCheck = runTypeCheck(root, node);
    cases.push({ id: "declarations", status: typedCheck.status === 0 ? "PASS" : "FAIL", detail: typedCheck.stderr || typedCheck.stdout });
    return { schemaVersion: 1, fixtureVersion: "offline-node-0.1.0", cases, passed: cases.filter((item) => item.status === "PASS").length, total: cases.length };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function runRuntimeMatrix(root, node) {
  const driver = join(root, "driver.mjs");
  writeFileSync(driver, [
    'import { named as esmNamed } from "fixtures-esm";',
    'import esmDefault from "fixtures-esm";',
    'import cjs from "fixtures-cjs";',
    'import { value as asyncValue } from "fixtures-async";',
    'import json from "fixtures-json/data.json" with { type: "json" };',
    'import { value as typedValue } from "@fixtures/typed";',
    'import { value as nestedValue } from "fixtures-nested";',
    `console.log(JSON.stringify([{id:"esm-named",status:esmNamed===7?"PASS":"FAIL"},{id:"esm-default-like",status:esmDefault?.value===8?"PASS":"FAIL"},{id:"commonjs",status:cjs?.named===9?"PASS":"FAIL"},{id:"async-export",status:(await asyncValue())===10?"PASS":"FAIL"},{id:"json-boundary",status:json.value===11?"PASS":"FAIL"},{id:"scoped-package",status:typedValue===12?"PASS":"FAIL"},{id:"nested-package",status:nestedValue===13?"PASS":"FAIL"}]))`,
  ].join("\n"));
  return spawnSync(node, [driver], { cwd: root, encoding: "utf8", windowsHide: true });
}

function packageFixture(root, name, manifest, index = "", extra = {}) {
  const dir = join(root, "node_modules", ...name.split("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
  if (index) writeFileSync(join(dir, manifest.main ?? "index.mjs"), index);
  for (const [path, content] of Object.entries(extra)) { const target = join(dir, path); mkdirSync(join(target, ".."), { recursive: true }); writeFileSync(target, content); }
}

function runTypeCheck(root, node) {
  const tsc = join(process.cwd(), "node_modules", "typescript", "bin", "tsc");
  writeFileSync(join(root, "consumer.ts"), "import { value } from '@fixtures/typed'; const n: number = value; void n;\n");
  return spawnSync(node, [tsc, "--strict", "--noEmit", "--module", "NodeNext", "--moduleResolution", "NodeNext", "consumer.ts"], { cwd: root, encoding: "utf8", windowsHide: true });
}

if (process.argv[1]?.endsWith("fixture-matrix.mjs")) {
  const result = await runFixtureMatrix();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed === result.total ? 0 : 1);
}
