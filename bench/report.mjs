// Regenerate a compact Markdown report from raw records through the analyzer.
// There are no manually transcribed headline numbers in this renderer.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze, loadRecords } from "./analyze.mjs";

export function renderAnalysis(result) {
  const lines = ["# AI-engineering benchmark analysis", "", `Analysis version: ${result.analysisVersion}`, `Eligible runs: ${result.eligibleRuns}`, `Paired observations: ${result.pairedObservations}`, ""];
  if (!result.groups.length) lines.push("**No eligible paired observations. No efficacy claim is estimable.**", "");
  else {
    lines.push("| Group | n | Mote success | TypeScript success | Difference | 95% bootstrap CI | McNemar p |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const group of result.groups) lines.push(`| ${group.key} | ${group.n} | ${pct(group.moteSuccessRate)} | ${pct(group.typescriptSuccessRate)} | ${pct(group.absoluteSuccessDifference)} | ${pct(group.bootstrap95.low)} to ${pct(group.bootstrap95.high)} | ${fmt(group.mcnemarExactP)} |`);
    lines.push("");
  }
  if (result.strata?.length) {
    lines.push("## Stratum summaries", "", "| Stratum | Model | Regime | Checkpoint | n | Mote success | TypeScript success | Difference |", "| --- | --- | --- | --- | ---: | ---: | ---: | ---: |");
    for (const group of result.strata) lines.push(`| ${group.stratum} | ${group.model} | ${group.regime} | ${group.checkpoint} | ${group.n} | ${pct(group.moteSuccessRate)} | ${pct(group.typescriptSuccessRate)} | ${pct(group.absoluteSuccessDifference)} |`);
    lines.push("");
  }
  if (result.budgetResponse?.length) {
    lines.push("## Budget response", "", "Budget curves are grouped by checkpoint and never combined across checkpoints.", "", "| Stratum | Model | Regime | Checkpoint | n | Mote success | TypeScript success |", "| --- | --- | --- | --- | ---: | ---: | ---: |");
    for (const point of result.budgetResponse) lines.push(`| ${point.stratum} | ${point.model} | ${point.regime} | ${point.checkpoint} | ${point.n} | ${pct(point.mote.successRate)} | ${pct(point.typescript.successRate)} |`);
    lines.push("");
  }
  lines.push("## Evidence boundary", "", "This report is generated from raw locally-verified/live records. Replay fixtures, unpaired runs, excluded infrastructure failures, and missing language arms are not treated as efficacy observations. Cost and token columns remain independent metrics.", "");
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("report.mjs")) {
  const input = option("--input");
  if (!input) { console.error("Usage: node bench/report.mjs --input raw-runs.json[l] [--out report.md] [--analysis analysis.json]"); process.exit(2); }
  const result = analyze(loadRecords(resolve(input)));
  const out = option("--out");
  const analysis = option("--analysis");
  if (out) writeFileSync(resolve(out), renderAnalysis(result) + "\n");
  if (analysis) writeFileSync(resolve(analysis), JSON.stringify(result, null, 2) + "\n");
  console.log(renderAnalysis(result));
}

function pct(value) { return value == null ? "—" : `${(value * 100).toFixed(1)}%`; }
function fmt(value) { return value == null ? "—" : Number(value).toFixed(4); }
function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
