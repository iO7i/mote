import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPhases } from "./candidate-runner.mjs";

const specFile = option("--spec");
if (!specFile) { console.error("Usage: node eval/run-candidate.mjs --spec candidate-run.json [--local --allow-local]"); process.exit(2); }
const spec = JSON.parse(readFileSync(resolve(specFile), "utf8"));
const result = runPhases({ workspace: resolve(spec.workspace), phases: spec.phases, mode: option("--local") ? "local" : "docker", allowLocal: option("--allow-local") === "true" || option("--allow-local") === "", limits: spec.limits });
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "PASSED" ? 0 : 1);

function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] ?? "" : undefined; }
