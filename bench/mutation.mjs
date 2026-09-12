// Aggregate the independent benchmark fixture mutation tests. The fixture
// tests identify meaningful mutants in comments and print survivors; controls
// are not included in the score.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const tasks = readdirSync(join(HERE, "tasks")).filter((name) => existsSync(join(HERE, "tasks", name, "tests", "mutation.test.mjs")) && statSync(join(HERE, "tasks", name)).isDirectory()).sort();
const results = tasks.map((task) => {
  const file = join(HERE, "tasks", task, "tests", "mutation.test.mjs");
  const source = readFileSync(file, "utf8");
  const total = (source.match(/Mutant [A-Z]:/g) ?? []).length;
  const run = spawnSync(process.execPath, [file], { encoding: "utf8", timeout: 120_000, windowsHide: true });
  const survivors = (run.stdout + run.stderr).split(/\r?\n/).filter((line) => line.includes("SURVIVED")).length;
  return { task, total, killed: Math.max(0, total - survivors), survived: survivors, status: run.status === 0 ? "PASS" : "FAIL" };
});
const total = results.reduce((n, result) => n + result.total, 0);
const killed = results.reduce((n, result) => n + result.killed, 0);
console.log(JSON.stringify({ schemaVersion: 1, suite: "historical-benchmark", tasks: results, killed, total, survived: total - killed, mutationScore: total ? killed / total : null }, null, 2));
process.exit(results.every((result) => result.status === "PASS") ? 0 : 1);
