// Descriptive semantic-density accounting for accepted references. Density is
// a representation metric, not a model score: semantic cases and mutation
// controls are counted from the frozen fixture and never inferred from output.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { estimateTokens } from "../src/measure.mjs";
import { compile } from "../src/compile.mjs";
import { hashJson, sha256 } from "./protocol.mjs";
import { FIXTURE_BY_ID } from "./corpus/accepted/registry.mjs";
import { loadAcceptedTasks } from "./corpus/accepted/validate.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const taskSet = JSON.parse(readFileSync(join(root, "bench/corpus/manifest.json"), "utf8"));
const loaded = loadAcceptedTasks(root, taskSet);
const rows = [];
for (const { task } of loaded.tasks) {
  const fixture = FIXTURE_BY_ID.get(task.id);
  for (const language of ["mote", "typescript"]) {
    const source = fixture.referenceSolutions[language];
    const sourceTokens = estimateTokens(source).tokens;
    const semanticCases = fixture.inputs.length;
    const mutationCases = fixture.mutations.length;
    const compiled = language === "mote" ? compile(source, { file: `${task.id}.mt`, emitTypes: true }) : null;
    const generatedTokens = compiled && !compiled.diagnostics.hasErrors ? estimateTokens(compiled.code).tokens : 0;
    rows.push({ id: task.id, language, sourceHash: sha256(source), sourceTokens, semanticCases, mutationCases, totalEvidenceCases: semanticCases + mutationCases, effectiveSemanticDensity: sourceTokens ? semanticCases / sourceTokens : null, controlledBehavioralDensity: sourceTokens ? (semanticCases + mutationCases) / sourceTokens : null, compilerFeedbackDensity: sourceTokens ? (task.phases[language].length / sourceTokens) : null, generatedTokens, generatedExpansion: sourceTokens ? generatedTokens / sourceTokens : null, adapterTokens: 0, status: "DESCRIPTIVE_ACCOUNTING_ONLY" });
  }
}
const report = { schemaVersion: 1, experiment: "effective-semantic-density", status: "DESCRIPTIVE_ACCOUNTING_ONLY", taskSetHash: hashJson(taskSet), definition: { effectiveSemanticDensity: "independent oracle cases / source tokens", controlledBehavioralDensity: "(oracle cases + mutation controls) / source tokens", compilerFeedbackDensity: "declared verification phases / source tokens" }, rows, exclusions: ["Density is not success, speed, cost, or generalization.", "Token counts use the repository's explicitly heuristic estimator unless a tokenizer is configured."] };
mkdirSync(join(root, "bench", "raw"), { recursive: true });
writeFileSync(join(root, "bench", "raw", "semantic-density-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, rows: rows.length, taskSetHash: report.taskSetHash }, null, 2));
