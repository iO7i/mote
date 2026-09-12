import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = join(root, "examples", "ledger-app");
const store = join(app, ".test-ledger.json");
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
  const record = '{"id":"e1","amount":100,"fee":3,"kind":"credit"}';
  const appended = run([join(app, "cli.js"), "append", store, record]);
  expect("ledger CLI persists a typed record", appended.status === 0 && appended.stdout.trim() === '{"count":1}', appended.stdout || appended.stderr);
  const listed = run([join(app, "cli.js"), "list", store]);
  expect("ledger CLI reads persisted records", listed.status === 0 && listed.stdout.includes('"currency":"SAR"'), listed.stdout || listed.stderr);
  const summarized = run([join(app, "cli.js"), "summarize", record]);
  expect("ledger API-shaped CLI response", summarized.status === 0 && summarized.stdout.includes('"status":200') && summarized.stdout.includes('"accepted":true'), summarized.stdout || summarized.stderr);
  const rejected = run([join(app, "cli.js"), "summarize", '{"id":"e2","amount":"bad","kind":"credit"}']);
  expect("ledger API returns boundary status", rejected.status === 0 && rejected.stdout.includes('"status":422') && rejected.stdout.includes("$.amount"), rejected.stdout || rejected.stderr);
  const metrics = JSON.parse(readFileSync(join(app, "adapter-metrics.json"), "utf8"));
  expect("adapter metrics are explicitly non-performance", metrics.performanceClaim === false && metrics.mote.declarations >= 10 && metrics.typescript.externalRuntimeDependencies === 0 && metrics.tests.assertions >= 8);
} finally { rmSync(join(app, "generated"), { recursive: true, force: true }); rmSync(join(app, "adapter.js"), { force: true }); rmSync(join(app, "cli.js"), { force: true }); rmSync(store, { force: true }); }
console.log(`${failed ? "FAIL" : "PASS"} ledger app`);
process.exit(failed ? 1 : 0);
