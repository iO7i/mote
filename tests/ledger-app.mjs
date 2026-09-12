import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = join(root, "examples", "ledger-app");
const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", windowsHide: true });
let failed = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };
try {
  const build = run([join(app, "build.mjs")]);
  expect("ledger app builds", build.status === 0, build.stderr || build.stdout);
  const good = run([join(app, "run.mjs"), '{"amount":100,"fee":3,"kind":"credit"}']);
  expect("ledger app returns adapter summary", good.status === 0 && good.stdout.trim() === '{"direction":"in","net":97}', good.stdout || good.stderr);
  const bad = run([join(app, "run.mjs"), '{"amount":"bad","kind":"credit"}']);
  expect("ledger app keeps runtime boundary", bad.status === 1 && bad.stderr.includes("$.amount"), bad.stderr);
  const metrics = JSON.parse(readFileSync(join(app, "adapter-metrics.json"), "utf8"));
  expect("adapter metrics are explicitly non-performance", metrics.performanceClaim === false && metrics.typescriptStatementShare === 0.25);
} finally { rmSync(join(app, "generated"), { recursive: true, force: true }); rmSync(join(app, "adapter.js"), { force: true }); }
console.log(`${failed ? "FAIL" : "PASS"} ledger app`);
process.exit(failed ? 1 : 0);
