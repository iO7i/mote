import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdapter } from "../eval/adapters.mjs";
import { runPhases } from "../eval/candidate-runner.mjs";
import { analyze } from "../bench/analyze.mjs";
import { renderAnalysis } from "../bench/report.mjs";
import { createRunManifest, DEFAULT_BUDGETS, hashJson, validateTaskSet } from "../bench/protocol.mjs";

let failed = 0;
const expect = (name, value) => { if (!value) { failed++; console.error(`FAIL ${name}`); } };
const root = fileURLToPath(new URL("..", import.meta.url));
const taskSet = JSON.parse(await (await import("node:fs/promises")).readFile(join(root, "bench/corpus/manifest.json"), "utf8"));
expect("corpus validates", validateTaskSet(taskSet).ok);
expect("canonical hash is deterministic", hashJson(taskSet) === hashJson(JSON.parse(JSON.stringify(taskSet))));
const manifest = createRunManifest({ repoRoot: root, taskSet, taskIds: ["P01"], model: "test-model", provider: "test-provider", regime: "cold-start", language: "mote", budgets: DEFAULT_BUDGETS, status: "LOCALLY VERIFIED" });
expect("manifest records compiler SHA", typeof manifest.moteGitSha === "string" && manifest.moteGitSha.length > 10);
expect("manifest records lock hash", typeof manifest.dependencyLockfileHash === "string");

const workspace = join(root, "tests", ".research-runner");
mkdirSync(workspace, { recursive: true });
const runner = runPhases({ workspace, mode: "local", allowLocal: true, phases: [{ name: "echo", command: [process.execPath, "-e", "process.stdout.write('ok')"] }], limits: { timeoutMs: 5000 } });
expect("local runner returns machine result", runner.status === "PASSED" && runner.phases[0].stdout.text === "ok");
rmSync(workspace, { recursive: true, force: true });

const responses = {
  id: "req-1",
  output_text: "done",
  output: [{ type: "function_call", call_id: "call-1", name: "write_file", arguments: '{"path":"x.mt","content":"let x=1"}' }],
  usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
};
const adapter = createAdapter({ transport: "openai-responses", model: "runtime-model", apiKey: "test", fetchImpl: async () => new Response(JSON.stringify(responses), { status: 200 }) });
const completion = await adapter.complete({ messages: [{ role: "user", content: "hi" }], tools: [] });
expect("adapter normalizes text", completion.text === "done");
expect("adapter normalizes tool calls", completion.toolCalls[0].name === "write_file" && completion.usage.billedTokens === 14);

const result = analyze([
  { status: "LOCALLY VERIFIED", taskId: "P01", stratum: "typed-transformation", model: "m", regime: "cold-start", budgetCheckpoint: "8k", language: "mote", success: true, verifiedWorkUnits: 1, cumulativeInputTokens: 50, cumulativeOutputTokens: 10, costUsd: 0.02 },
  { status: "LOCALLY VERIFIED", taskId: "P01", stratum: "typed-transformation", model: "m", regime: "cold-start", budgetCheckpoint: "8k", language: "typescript", success: false, verifiedWorkUnits: 0, cumulativeInputTokens: 60, cumulativeOutputTokens: 12, costUsd: 0.03 },
]);
expect("paired analyzer compares language arms", result.pairedObservations === 1 && result.groups[0].absoluteSuccessDifference === 1);
expect("analyzer emits stratum summaries", result.strata.length === 1 && result.strata[0].stratum === "typed-transformation");
expect("analyzer emits budget response curves", result.budgetResponse.length === 1 && result.budgetResponse[0].mote.successRate === 1);
expect("analyzer emits paired token/cost differences", Math.abs(result.groups[0].metricDifferences.costUsd.mean + 0.01) < 1e-9);
expect("report is generated from analysis", renderAnalysis(result).includes("Mote success") && renderAnalysis(result).includes("100.0%"));
console.log(`${failed ? "FAIL" : "PASS"} research infrastructure tests`);
process.exit(failed ? 1 : 0);
