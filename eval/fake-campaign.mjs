// End-to-end deterministic agent-harness campaign for every accepted pilot
// task. The scripted agent writes the private reference by design; results are
// SIMULATION_ONLY and never enter the efficacy analyzer.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { compile } from "../src/compile.mjs";
import { expected } from "../bench/corpus/oracles.mjs";
import { FIXTURE_BY_ID } from "../bench/corpus/accepted/registry.mjs";
import { loadAcceptedTasks } from "../bench/corpus/accepted/validate.mjs";
import { hashJson } from "../bench/protocol.mjs";
import { createScriptedAdapter, runScriptedConversation } from "./fake-provider.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const taskSet = JSON.parse(readFileSync(join(root, "bench/corpus/manifest.json"), "utf8"));
const loaded = loadAcceptedTasks(root, taskSet);
const results = [];
let serial = 0;

for (const { task } of loaded.tasks) {
  const fixture = FIXTURE_BY_ID.get(task.id);
  const order = Number(task.id.slice(1)) % 2 ? ["mote", "typescript"] : ["typescript", "mote"];
  for (const language of order) results.push(await runTrial(task, fixture, language, order));
}

const providerFailure = await runProviderFailureProbe();
const pathProbe = await runPathProbe();
const report = {
  schemaVersion: 1,
  campaign: "accepted-pilot-fake-agent",
  sourceRevision: gitSha(root),
  status: results.every((result) => result.success) && providerFailure.status === "PROVIDER_ERROR" && pathProbe.blocked === true ? "PASS" : "FAIL",
  executionClass: "SIMULATION_ONLY",
  liveModelRuns: "BLOCKED PENDING AUTHORIZATION",
  corpusVersion: taskSet.corpusVersion,
  taskSetHash: hashJson(taskSet),
  pairedTasks: [...new Set(results.map((result) => result.taskId))].length,
  armRuns: results.length,
  counterbalance: { oddTaskIds: "mote-first", evenTaskIds: "typescript-first" },
  results,
  providerFailures: [providerFailure],
  harnessProbes: { pathContainment: pathProbe },
  exclusions: ["Fake transcripts write the private reference and therefore cannot measure model capability.", "No record is eligible for the paired efficacy analyzer.", "Docker and paid provider requests are not used."],
};
mkdirSync(join(root, "bench", "raw"), { recursive: true });
writeFileSync(join(root, "bench", "raw", "fake-agent-campaign-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === "PASS" ? 0 : 1);

async function runTrial(task, fixture, language, order) {
  const workspace = mkdtempSync(join(tmpdir(), `mote-fake-${task.id}-${language}-`));
  const visible = task.visibleFiles[language];
  for (const [file, content] of Object.entries(visible)) writeFileSync(join(workspace, file), content);
  const target = Object.keys(visible)[0];
  const reference = fixture.referenceSolutions[language];
  const transcript = [
    { response: { text: "inspect", toolCalls: [{ id: "list", name: "list_files", input: {} }], usage: usage(8, 3) } },
    { response: { text: "implement", toolCalls: [{ id: "write", name: "write_file", input: { path: target, content: reference } }], usage: usage(10, 6) } },
    { response: { text: "verify", toolCalls: [{ id: "check", name: "run_check", input: {} }], usage: usage(12, 4) } },
    { response: { text: "done", toolCalls: [], usage: usage(8, 2) } },
  ];
  const adapter = createScriptedAdapter({ transcript, model: "scripted-reference-writer", provider: "local-scripted" });
  const conversation = await runScriptedConversation({
    adapter,
    messages: [{ role: "system", content: "SIMULATION_ONLY" }, { role: "user", content: task.prompt }],
    tools: ["list_files", "read_file", "write_file", "run_check"].map((name) => ({ name })),
    budgets: { maxRepairRounds: 6, maxToolCalls: 8, cumulativeInputTokens: 1000, cumulativeOutputTokens: 1000 },
    executeTool: (call) => executeTool(call, workspace, fixture, language),
  });
  const finalCheck = await checkCandidate(workspace, target, fixture, language);
  const traceHash = hashJson(conversation.trace);
  rmSync(workspace, { recursive: true, force: true });
  return {
    status: "SIMULATION_ONLY",
    taskId: task.id,
    language,
    pairedOrder: order,
    freshWorkspace: true,
    success: conversation.status === "COMPLETED" && finalCheck.success,
    conversationStatus: conversation.status,
    toolCalls: conversation.toolCalls,
    repairRounds: conversation.repairRounds,
    usage: conversation.usage,
    transcriptHash: conversation.transcriptHash,
    traceHash,
    oracle: finalCheck,
    providerFailure: false,
    resumableKey: `${task.id}:${language}:${conversation.transcriptHash}`,
  };
}

function executeTool(call, workspace, fixture, language) {
  try {
    if (call.name === "list_files") return { files: ["solution.mt", "solution.ts"].filter((name) => existsSync(join(workspace, name))) };
    if (call.name === "write_file") {
      const path = safePath(workspace, call.input?.path);
      writeFileSync(path, String(call.input?.content ?? ""));
      return { ok: true, bytes: Buffer.byteLength(String(call.input?.content ?? "")) };
    }
    if (call.name === "run_check") return { status: "deferred-to-independent-oracle", language, cases: fixture.inputs.length };
    return { error: `unknown tool ${call.name}` };
  } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

async function checkCandidate(workspace, target, fixture, language) {
  const source = readFileSync(join(workspace, target), "utf8");
  let moduleFile;
  if (language === "mote") {
    const result = compile(source, { file: target, emitTypes: false, runtimeImport: pathToFileURL(resolve(root, "src/runtime/mote.mjs")).href });
    if (result.diagnostics.hasErrors) return { success: false, phase: "typecheck", diagnostics: result.diagnostics.items.map((d) => d.code) };
    moduleFile = join(workspace, "solution.mjs");
    writeFileSync(moduleFile, result.code);
  } else {
    const result = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } });
    if (result.diagnostics?.some((d) => d.category === 1)) return { success: false, phase: "transpile" };
    moduleFile = join(workspace, "solution.mjs");
    writeFileSync(moduleFile, result.outputText);
  }
  try {
    const module = await import(`${pathToFileURL(moduleFile).href}?run=${serial++}`);
    if (typeof module.solve !== "function") return { success: false, phase: "api-existence" };
    const failures = [];
    for (const input of fixture.inputs) if (!Object.is(expected(fixture.id, input), await module.solve(input))) failures.push(input);
    return { success: failures.length === 0, phase: "independent-oracle", cases: fixture.inputs.length, failedCases: failures.length };
  } catch (error) { return { success: false, phase: "runtime", error: String(error?.message ?? error) }; }
}

async function runProviderFailureProbe() {
  const adapter = createScriptedAdapter({ transcript: [{ error: "synthetic provider unavailable" }] });
  return { status: (await runScriptedConversation({ adapter, messages: [], tools: [], executeTool: () => ({}) })).status, separatedFromTaskResults: true };
}

async function runPathProbe() {
  const workspace = mkdtempSync(join(tmpdir(), "mote-fake-path-"));
  const adapter = createScriptedAdapter({ transcript: [{ response: { toolCalls: [{ name: "write_file", input: { path: "../escape", content: "x" } }] } }, { response: {} }] });
  const result = await runScriptedConversation({ adapter, tools: [{ name: "write_file" }], executeTool: (call) => { const target = safePath(workspace, call.input.path); writeFileSync(target, call.input.content); return { ok: true }; } });
  const blocked = result.trace.some((event) => event.event === "tool" && String(event.output?.error ?? "").includes("escapes"));
  rmSync(workspace, { recursive: true, force: true });
  return { blocked, conversationStatus: result.status };
}

function safePath(base, name) {
  if (typeof name !== "string" || !name) throw new Error("path is required");
  const target = resolve(base, name);
  if (target !== resolve(base) && !target.startsWith(resolve(base) + sep)) throw new Error(`path escapes candidate workspace: ${name}`);
  return target;
}

function usage(inputTokens, outputTokens) { return { inputTokens, outputTokens, billedTokens: inputTokens + outputTokens }; }
