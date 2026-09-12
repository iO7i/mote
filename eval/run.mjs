// Deterministic evaluator for compiler-authoring replay fixtures. This never
// executes generated candidate code and never calls a model by default.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.mjs";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/replay.json", import.meta.url)), "utf8"));
let failed = 0;
for (const item of fixture.cases) {
  const actual = [...new Set(compile(item.source, { file: `${item.id}.mt` }).diagnostics.items.map((d) => d.code))].sort();
  const expected = [...item.expectedCodes].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++;
    console.error(`FAIL replay ${item.id}: expected ${expected.join(",")}, got ${actual.join(",")}`);
  }
}

const liveRequested = process.argv.includes("--live");
const model = process.env.MOTE_EVAL_MODEL;
const isolated = process.env.MOTE_EVAL_ISOLATION === "docker";
const live = liveRequested && model && isolated
  ? { status: "NOT RUN", reason: "replay command never invokes providers; use an authorized eval/live.mjs runner and retain its raw manifest" }
  : { status: "NOT RUN", reason: "requires a separate --live runner, MOTE_EVAL_MODEL, and MOTE_EVAL_ISOLATION=docker" };
const report = { schemaVersion: 1, replay: { status: failed ? "FAILED" : "PASSED", seed: fixture.seed, cases: fixture.cases.length }, live };
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
