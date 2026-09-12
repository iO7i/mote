// Shared evidence and manifest helpers for the AI-engineering benchmark.
// This module is deliberately dependency-free so manifests remain reproducible.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const PROTOCOL_VERSION = "1.0.0";
export const RUN_STATUSES = Object.freeze(["IMPLEMENTED", "LOCALLY VERIFIED", "LIVE RUN", "NOT RUN", "BLOCKED"]);
export const DEFAULT_BUDGETS = Object.freeze({
  contextTokens: 32768,
  cumulativeTokenCheckpoints: [8000, 32000, 100000],
  cumulativeInputTokens: 100000,
  cumulativeOutputTokens: 100000,
  wallClockMs: 30 * 60 * 1000,
  maxToolCalls: 200,
  maxRepairRounds: 12,
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashJson(value) { return sha256(canonicalJson(value)); }

export function hashTree(root, { exclude = [".git", "node_modules"] } = {}) {
  const base = resolve(root);
  const files = [];
  walk(base);
  files.sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(base, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (exclude.includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
}

export function gitSha(repoRoot) {
  const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function packageMetadata(repoRoot) {
  const file = join(repoRoot, "package.json");
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; }
}

export function createRunManifest({ repoRoot, taskSet, taskIds, model, provider, settings = {}, regime, language, seed, budgets = DEFAULT_BUDGETS, pricing = null, promptHash = null, toolsHash = null, usage = null, resultHash = null, status = "NOT RUN", timestamps = {} }) {
  if (!RUN_STATUSES.includes(status)) throw new Error(`unknown run status: ${status}`);
  const pkg = packageMetadata(repoRoot);
  return {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    status,
    moteGitSha: gitSha(repoRoot),
    benchmarkVersion: taskSet?.corpusVersion ?? null,
    taskSetHash: taskSet ? hashJson(taskSet) : null,
    taskIds: [...(taskIds ?? [])].sort(),
    model: { provider: provider ?? null, id: model ?? null, settings },
    systemPromptHash: promptHash,
    toolDefinitionsHash: toolsHash,
    regime: regime ?? null,
    language: language ?? null,
    os: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    compiler: { name: pkg.name ?? "mote", version: pkg.version ?? null },
    dependencyLockfileHash: existsSync(join(repoRoot, "package-lock.json")) ? sha256(readFileSync(join(repoRoot, "package-lock.json"))) : null,
    seed: seed ?? null,
    limits: structuredClone(budgets),
    pricingSnapshot: pricing,
    usage,
    timestamps: { startedAt: timestamps.startedAt ?? null, endedAt: timestamps.endedAt ?? null },
    resultHash,
  };
}

export function validateTaskSet(taskSet) {
  const errors = [];
  if (!taskSet || taskSet.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (taskSet?.protocolVersion !== PROTOCOL_VERSION) errors.push(`protocolVersion must be ${PROTOCOL_VERSION}`);
  if (!Array.isArray(taskSet?.strata) || !taskSet.strata.length) errors.push("strata must be non-empty");
  if (!Array.isArray(taskSet?.tasks) || !taskSet.tasks.length) errors.push("tasks must be non-empty");
  const ids = new Set();
  for (const task of taskSet?.tasks ?? []) {
    for (const key of ["id", "title", "stratum", "kind", "repoScale"]) if (typeof task[key] !== "string" || !task[key]) errors.push(`${task.id ?? "<task>"}: missing ${key}`);
    if (ids.has(task.id)) errors.push(`duplicate task id ${task.id}`);
    ids.add(task.id);
    if (!taskSet.strata?.includes(task.stratum)) errors.push(`${task.id}: unknown stratum ${task.stratum}`);
    if (typeof task.hardNegative !== "boolean") errors.push(`${task.id}: hardNegative must be boolean`);
  }
  return { ok: errors.length === 0, errors, taskCount: taskSet?.tasks?.length ?? 0, hash: hashJson(taskSet) };
}
