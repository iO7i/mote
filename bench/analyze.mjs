// Analysis of raw paired AI-engineering run records. No result is synthesized
// when the input is absent or ineligible; reports are derived from raw records.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const ANALYSIS_VERSION = "1.0.0";

export function loadRecords(file) {
  const text = readFileSync(file, "utf8").trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : (value.runs ?? []);
  }
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function analyze(records, { bootstrapSamples = 2000, seed = 0x5eedc0de } = {}) {
  const usable = records.filter(isEligible);
  const pairs = pairRecords(usable);
  const groups = new Map();
  for (const pair of pairs) {
    const key = `${pair.taskId}|${pair.model}|${pair.regime}|${pair.checkpoint}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pair);
  }
  const summaries = [...groups.entries()].map(([key, values]) => summarize(key, values, bootstrapSamples, seed));
  const strata = summarizeDimension(pairs, (pair) => pair.stratum ?? "unclassified", bootstrapSamples, seed, "stratum");
  const budgetResponse = summarizeBudgetResponse(pairs);
  return {
    schemaVersion: 1,
    analysisVersion: ANALYSIS_VERSION,
    inputRuns: records.length,
    eligibleRuns: usable.length,
    excludedRuns: records.length - usable.length,
    pairedObservations: pairs.length,
    groups: summaries,
    strata,
    budgetResponse,
    limitations: pairs.length ? [] : ["No eligible paired live/locally-verified observations were supplied; no efficacy claim is estimable."],
  };
}

function isEligible(record) {
  if (!record || record.excluded === true || record.exclusionReason) return false;
  if (!["LIVE RUN", "LOCALLY VERIFIED"].includes(record.status)) return false;
  if (!record.taskId || !record.language || !record.model || !record.regime) return false;
  return record.infrastructureFailure !== true;
}

function pairRecords(records) {
  const byKey = new Map();
  for (const record of records) {
    const checkpoint = record.budgetCheckpoint ?? "terminal";
    const model = typeof record.model === "string" ? record.model : `${record.model.provider ?? ""}/${record.model.id ?? ""}`;
    const replicate = record.replicate ?? record.seed ?? "0";
    const key = `${record.taskId}|${model}|${record.regime}|${checkpoint}|${replicate}`;
    if (!byKey.has(key)) byKey.set(key, {});
    byKey.get(key)[record.language] = record;
  }
  return [...byKey.entries()]
    .filter(([, v]) => v.mote && v.typescript)
    .map(([key, v]) => ({ ...keyParts(key), stratum: v.mote?.stratum ?? v.typescript?.stratum ?? "unclassified", mote: v.mote, typescript: v.typescript }));
}

function keyParts(key) {
  const [taskId, model, regime, checkpoint, replicate] = key.split("|");
  return { taskId, model, regime, checkpoint, replicate };
}

function summarize(key, pairs, samples, seed) {
  const moteSuccess = pairs.map((p) => success(p.mote));
  const tsSuccess = pairs.map((p) => success(p.typescript));
  const differences = pairs.map((p) => Number(success(p.mote)) - Number(success(p.typescript)));
  const moteWins = differences.filter((x) => x > 0).length;
  const tsWins = differences.filter((x) => x < 0).length;
  const n = pairs.length;
  const moteRate = mean(moteSuccess);
  const tsRate = mean(tsSuccess);
  return {
    key,
    taskId: pairs[0].taskId,
    model: pairs[0].model,
    regime: pairs[0].regime,
    checkpoint: pairs[0].checkpoint,
    n,
    moteSuccessRate: moteRate,
    typescriptSuccessRate: tsRate,
    absoluteSuccessDifference: moteRate - tsRate,
    relativeSuccessDifference: tsRate === 0 ? null : (moteRate - tsRate) / tsRate,
    pairedEffect: mean(differences),
    moteWins,
    typescriptWins: tsWins,
    ties: n - moteWins - tsWins,
    mcnemarExactP: mcnemarExact(moteWins, tsWins),
    bootstrap95: bootstrap(differences, samples, seed ^ hash(key)),
    verifiedWorkUnits: numericSummary(pairs, "verifiedWorkUnits"),
    cumulativeInputTokens: numericSummary(pairs, "cumulativeInputTokens"),
    cumulativeOutputTokens: numericSummary(pairs, "cumulativeOutputTokens"),
    billedTokens: numericSummary(pairs, "billedTokens"),
    costUsd: numericSummary(pairs, "costUsd"),
    wallClockMs: numericSummary(pairs, "wallClockMs"),
    metricDifferences: Object.fromEntries(["verifiedWorkUnits", "cumulativeInputTokens", "cumulativeOutputTokens", "billedTokens", "costUsd", "wallClockMs"].map((field) => [field, differenceSummary(pairs, field, samples, seed ^ hash(`${key}:${field}`))])),
  };
}

function summarizeDimension(pairs, dimension, samples, seed, name) {
  const groups = new Map();
  for (const pair of pairs) {
    const value = dimension(pair);
    const key = `${value}|${pair.model}|${pair.regime}|${pair.checkpoint}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pair);
  }
  return [...groups.entries()].map(([key, values]) => ({ [name]: values[0][name] ?? dimension(values[0]), model: values[0].model, regime: values[0].regime, checkpoint: values[0].checkpoint, n: values.length, moteSuccessRate: mean(values.map((pair) => Number(success(pair.mote)))), typescriptSuccessRate: mean(values.map((pair) => Number(success(pair.typescript)))), absoluteSuccessDifference: mean(values.map((pair) => Number(success(pair.mote)) - Number(success(pair.typescript)))), bootstrap95: bootstrap(values.map((pair) => Number(success(pair.mote)) - Number(success(pair.typescript))), samples, seed ^ hash(key)) }));
}

function summarizeBudgetResponse(pairs) {
  const groups = new Map();
  for (const pair of pairs) {
    const key = `${pair.stratum ?? "unclassified"}|${pair.model}|${pair.regime}|${pair.checkpoint}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pair);
  }
  return [...groups.entries()].map(([key, values]) => ({ key, stratum: values[0].stratum ?? "unclassified", model: values[0].model, regime: values[0].regime, checkpoint: values[0].checkpoint, n: values.length, mote: armBudgetSummary(values.map((pair) => pair.mote)), typescript: armBudgetSummary(values.map((pair) => pair.typescript)) }));
}

function armBudgetSummary(records) {
  return { successRate: mean(records.map((record) => Number(success(record)))), verifiedWorkUnits: singleSummary(records, "verifiedWorkUnits"), cumulativeInputTokens: singleSummary(records, "cumulativeInputTokens"), cumulativeOutputTokens: singleSummary(records, "cumulativeOutputTokens"), costUsd: singleSummary(records, "costUsd"), wallClockMs: singleSummary(records, "wallClockMs") };
}

function singleSummary(records, field) {
  const values = records.map((record) => record[field]).filter((value) => Number.isFinite(value));
  return values.length ? { n: values.length, median: quantile(values, 0.5), p25: quantile(values, 0.25), p75: quantile(values, 0.75) } : null;
}

function success(record) {
  if (typeof record.success === "boolean") return record.success;
  return Number(record.verifiedWorkUnits ?? 0) > 0 && record.oracle?.taskSuccess === true;
}

function numericSummary(pairs, field) {
  const values = pairs.flatMap((p) => [p.mote[field], p.typescript[field]]).filter((x) => Number.isFinite(x));
  if (!values.length) return null;
  return { n: values.length, median: quantile(values, 0.5), p25: quantile(values, 0.25), p75: quantile(values, 0.75) };
}

function differenceSummary(pairs, field, samples, seed) {
  const differences = pairs.map((pair) => pair.mote[field] - pair.typescript[field]).filter(Number.isFinite);
  if (!differences.length) return null;
  return { n: differences.length, mean: mean(differences), median: quantile(differences, 0.5), p25: quantile(differences, 0.25), p75: quantile(differences, 0.75), bootstrap95: bootstrap(differences, samples, seed) };
}

function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }

function quantile(values, q) {
  const xs = [...values].sort((a, b) => a - b);
  if (!xs.length) return null;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? xs[lo] : xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

function bootstrap(values, samples, seed) {
  if (!values.length) return { low: null, high: null, samples: 0 };
  let state = seed >>> 0;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const means = [];
  for (let i = 0; i < samples; i++) {
    let total = 0;
    for (let j = 0; j < values.length; j++) total += values[Math.floor(next() * values.length)];
    means.push(total / values.length);
  }
  return { low: quantile(means, 0.025), high: quantile(means, 0.975), samples };
}

function mcnemarExact(b, c) {
  const n = b + c;
  if (!n) return 1;
  const k = Math.min(b, c);
  let p = 0;
  for (let i = 0; i <= k; i++) p += binomialProbability(n, i);
  return Math.min(1, 2 * p);
}

function binomialProbability(n, k) {
  let log = 0;
  for (let i = 1; i <= k; i++) log += Math.log(n - k + i) - Math.log(i);
  return Math.exp(log - n * Math.log(2));
}

function hash(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

if (process.argv[1]?.endsWith("analyze.mjs")) {
  const input = option("--input");
  if (!input) {
    console.error("Usage: node bench/analyze.mjs --input raw-runs.json[l] [--out analysis.json]");
    process.exit(2);
  }
  const result = analyze(loadRecords(resolve(input)));
  const out = option("--out");
  if (out) writeFileSync(resolve(out), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}

function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
