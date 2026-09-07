import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI = join(ROOT, "bin", "mote.mjs");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");
const dir = mkdtempSync(join(tmpdir(), "mote-cli-"));
let failed = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8" });

try {
  writeFileSync(join(dir, "bad.mt"), "let =");
  const bad = run(["check", "bad.mt", "--json"]);
  const envelope = JSON.parse(bad.stdout);
  expect("check --json has stable schema", bad.status === 1 && envelope.files[0].diagnostics[0].code === "M001");

  const rejected = run(["compile", "bad.mt", "--out", "rejected"]);
  expect("failed compile writes no artifacts", rejected.status === 1 && !existsSync(join(dir, "rejected")));

  writeFileSync(join(dir, "webhook.mt"), readFileSync(join(ROOT, "examples", "typed-boundary.mt")));
  const compiled = run(["compile", "webhook.mt", "--out", "dist", "--json"]);
  expect("compile --json succeeds", compiled.status === 0 && JSON.parse(compiled.stdout).ok);
  expect("compile produces runtime and config", existsSync(join(dir, "dist", "mote-runtime.ts")) && existsSync(join(dir, "dist", "tsconfig.json")));
  const tsc = spawnSync(process.execPath, [TSC, "-p", join(dir, "dist", "tsconfig.json")], { cwd: dir, encoding: "utf8" });
  expect("generated consumer project type-checks", tsc.status === 0, tsc.stdout || tsc.stderr || `status=${tsc.status} error=${tsc.error?.message ?? ""}`);
  const execute = spawnSync(process.execPath, ["--input-type=module", "-e", "import('./dist/js/webhook.js').then(m=>console.log(m.normalize('{\\\"eventId\\\":\\\"ok\\\",\\\"amountMinor\\\":1}').eventId))"], { cwd: dir, encoding: "utf8" });
  expect("generated JavaScript executes", execute.status === 0 && execute.stdout.trim() === "ok");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${failed ? "FAIL" : "PASS"} CLI integration`);
process.exit(failed ? 1 : 0);
