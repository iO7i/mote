// Structural entry point for the versioned AI-engineering benchmark.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRunManifest, DEFAULT_BUDGETS, hashJson, validateTaskSet } from "./protocol.mjs";
import { loadAcceptedTasks } from "./corpus/accepted/validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const corpusFile = resolve(HERE, "corpus/manifest.json");
const args = process.argv.slice(2);
const command = args[0] ?? "help";

if (command === "audit-corpus") {
  const taskSet = JSON.parse(readFileSync(corpusFile, "utf8"));
  const result = validateTaskSet(taskSet);
  const accepted = result.ok ? loadAcceptedTasks(ROOT, taskSet) : { ok: false, errors: ["task-set validation failed"], tasks: [], manifestHash: null };
  console.log(JSON.stringify({ ...result, acceptedTaskCount: accepted.tasks.length, acceptedTasksOk: accepted.ok, acceptedTaskErrors: accepted.errors, file: "bench/corpus/manifest.json", status: taskSet.status, frozen: taskSet.frozen }, null, 2));
  process.exit(result.ok && accepted.ok ? 0 : 1);
}

if (command === "manifest") {
  const taskSet = JSON.parse(readFileSync(option("--task-set") ?? corpusFile, "utf8"));
  const checked = validateTaskSet(taskSet);
  if (!checked.ok) throw new Error(checked.errors.join("; "));
  const manifest = createRunManifest({
    repoRoot: ROOT,
    taskSet,
    taskIds: option("--task-ids")?.split(",").filter(Boolean) ?? taskSet.tasks.map((task) => task.id),
    model: option("--model"),
    provider: option("--provider"),
    regime: option("--regime"),
    language: option("--language"),
    seed: Number(option("--seed") ?? 0x5eedc0de),
    budgets: { ...DEFAULT_BUDGETS, contextTokens: Number(option("--context") ?? DEFAULT_BUDGETS.contextTokens) },
    promptHash: option("--prompt-hash"),
    toolsHash: option("--tools-hash"),
  });
  const out = option("--out");
  if (out) writeFileSync(resolve(out), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ manifest, taskSetHash: hashJson(taskSet) }, null, 2));
  process.exit(0);
}

console.log(`Usage:
  node bench/research.mjs audit-corpus
  node bench/research.mjs manifest [--out file] [--model id --provider name]
      [--regime cold-start|warm-tooling] [--language mote|typescript]
      [--task-ids P01,P02] [--context tokens]`);

function option(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
