// Live paired-run entry point. It is intentionally opt-in and never runs a
// provider request from CI. The adapter and runner are usable by an authorized
// research job once a task contains an oracle definition.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdapter, TRANSPORTS } from "./adapters.mjs";
import { runPhases } from "./candidate-runner.mjs";
import { createRunManifest, DEFAULT_BUDGETS, hashJson } from "../bench/protocol.mjs";

export const LIVE_TOOL_DEFINITIONS = Object.freeze([
  { name: "list_files", description: "List visible candidate files.", input_schema: { type: "object", properties: {} } },
  { name: "read_file", description: "Read a visible candidate file.", input_schema: { type: "object", required: ["path"], properties: { path: { type: "string" } } } },
  { name: "write_file", description: "Write a candidate file.", input_schema: { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } } },
  { name: "run_check", description: "Run the task's bounded check command.", input_schema: { type: "object", properties: {} } },
]);

export function livePrerequisites({ live = false, model, isolation, transport }) {
  const errors = [];
  if (!live) errors.push("pass --live to authorize provider requests");
  if (!model) errors.push("MOTE_EVAL_MODEL or --model is required");
  if (isolation !== "docker") errors.push("MOTE_EVAL_ISOLATION=docker is required");
  if (!TRANSPORTS.includes(transport)) errors.push(`transport must be one of ${TRANSPORTS.join(", ")}`);
  return { ok: errors.length === 0, errors };
}

export async function runLive({ repoRoot, taskDir, language, regime, provider, model, transport, apiKey, settings = {}, budgets = DEFAULT_BUDGETS, live = false, isolation = "docker", seed = 0x5eedc0de }) {
  const prereq = livePrerequisites({ live, model, isolation, transport });
  if (!prereq.ok) return { status: "BLOCKED", reason: prereq.errors.join("; ") };
  const taskFile = join(taskDir, "task.json");
  if (!existsSync(taskFile)) return { status: "BLOCKED", reason: "task.json with an oracle is required" };
  const task = JSON.parse(readFileSync(taskFile, "utf8"));
  const workspace = mkdtempSync(join(tmpdir(), `mote-live-${language}-`));
  const startedAt = new Date().toISOString();
  try {
    materializeVisibleFiles(workspace, task.visibleFiles?.[language] ?? task.visibleFiles ?? {});
    const adapter = createAdapter({ transport, provider, model, apiKey, settings });
    const system = systemPrompt(language, regime);
    const messages = [{ role: "system", content: system }, { role: "user", content: task.prompt ?? readFileSync(join(taskDir, "task.md"), "utf8") }];
    const usage = { inputTokens: 0, outputTokens: 0, billedTokens: 0, cachedTokens: 0, reasoningTokens: 0 };
    let finalText = "";
    for (let round = 0; round <= budgets.maxRepairRounds; round++) {
      const response = await adapter.complete({ messages, tools: LIVE_TOOL_DEFINITIONS });
      addUsage(usage, response.usage);
      finalText += response.text;
      if (!response.toolCalls.length) break;
      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls });
      for (const call of response.toolCalls) {
        const output = performTool(call, workspace, task, budgets, language);
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify(output) });
      }
      if (usage.inputTokens + usage.outputTokens >= budgets.cumulativeInputTokens + budgets.cumulativeOutputTokens) break;
    }
    const oracle = runPhases({ workspace, phases: task.phases?.[language] ?? task.phases ?? [], mode: "docker", limits: task.limits });
    const result = { status: oracle.status === "PASSED" ? "LIVE RUN" : "LIVE RUN", language, regime, taskId: task.id ?? null, oracle, usage, repairRounds: messages.filter((m) => m.role === "assistant").length, finalTextHash: hashJson(finalText) };
    const manifest = createRunManifest({ repoRoot, taskSet: task.taskSet ?? null, taskIds: [task.id], model, provider, settings, regime, language, seed, budgets, promptHash: hashJson(system), toolsHash: hashJson(LIVE_TOOL_DEFINITIONS), usage, resultHash: hashJson(result), status: "LIVE RUN", timestamps: { startedAt, endedAt: new Date().toISOString() } });
    return { ...result, manifest };
  } finally { rmSync(workspace, { recursive: true, force: true }); }
}

function systemPrompt(language, regime) { return `You are completing one paired benchmark task. Implementation language: ${language}. Regime: ${regime}. Work only in the isolated candidate workspace. Hidden tests, reference solutions, and the paired arm are unavailable. Do not invent APIs; use visible files and tools. Make changes, run the bounded check, and stop when verified.`; }
function addUsage(total, value = {}) { for (const key of Object.keys(total)) total[key] += Number(value[key] ?? 0); }
function performTool(call, workspace, task, budgets, language) {
  try {
    if (call.name === "list_files") return { files: listFiles(workspace) };
    if (call.name === "read_file") {
      const file = safePath(workspace, call.input?.path);
      const content = readFileSync(file, "utf8");
      return { path: call.input.path, content: content.slice(0, 64 * 1024), truncated: content.length > 64 * 1024 };
    }
    if (call.name === "write_file") {
      const file = safePath(workspace, call.input?.path);
      mkdirSync(resolve(file, ".."), { recursive: true });
      writeFileSync(file, String(call.input?.content ?? ""), "utf8");
      return { ok: true, path: call.input.path, bytes: Buffer.byteLength(String(call.input?.content ?? "")) };
    }
    if (call.name === "run_check") return runPhases({ workspace, phases: task.phases?.[language] ?? task.phases ?? [], mode: "docker", limits: budgets });
  } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  return { error: `unknown tool ${call.name}` };
}

function materializeVisibleFiles(workspace, files) { for (const [name, content] of Object.entries(files)) { const target = safePath(workspace, name); mkdirSync(resolve(target, ".."), { recursive: true }); writeFileSync(target, content, "utf8"); } }
function listFiles(root) { const out = []; walk(root); return out.sort(); function walk(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const target = join(dir, entry.name); if (entry.isDirectory()) walk(target); else if (entry.isFile()) out.push(relative(root, target).replaceAll("\\", "/")); } } }
function safePath(root, name) { if (typeof name !== "string" || !name) throw new Error("path is required"); const base = resolve(root); const target = resolve(base, name); if (target !== base && !target.startsWith(base + sep)) throw new Error(`path escapes candidate workspace: ${name}`); return target; }

if (process.argv[1]?.endsWith("live.mjs")) {
  const result = await runLive({
    repoRoot: resolve(fileURLToPath(new URL("../", import.meta.url))),
    taskDir: resolve(option("--task") ?? "."),
    language: option("--language") ?? "mote",
    regime: option("--regime") ?? "cold-start",
    provider: option("--provider") ?? process.env.MOTE_EVAL_PROVIDER,
    model: option("--model") ?? process.env.MOTE_EVAL_MODEL,
    transport: option("--transport") ?? process.env.MOTE_EVAL_TRANSPORT ?? "openai-responses",
    apiKey: process.env.MOTE_EVAL_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    live: process.argv.includes("--live"),
    isolation: option("--isolation") ?? process.env.MOTE_EVAL_ISOLATION ?? "docker",
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "BLOCKED" ? 2 : 0);
}

function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
