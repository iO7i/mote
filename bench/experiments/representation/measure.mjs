// Measure representation fixtures as inputs to a future agent study.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "../../../src/measure.mjs";
import { compile } from "../../../src/compile.mjs";
import { hashTree } from "../../protocol.mjs";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const base = join(root, "bench", "experiments", "representation", "fixtures");
const rows = [];
for (const scale of ["small", "medium", "large", "very-large"]) {
  for (const language of ["mote", "typescript"]) {
    const dir = join(base, scale, language);
    if (!existsSync(dir)) continue;
    const relevance = JSON.parse(readFileSync(join(dir, "relevance.json"), "utf8"));
    const extension = language === "mote" ? ".mt" : ".ts";
    const files = readdirSync(join(dir, "src")).filter((file) => file.endsWith(extension));
    const source = Object.fromEntries(files.map((file) => [join("src", file).replaceAll("\\", "/"), readFileSync(join(dir, "src", file), "utf8")]));
    const totalTokens = Object.values(source).reduce((sum, text) => sum + estimateTokens(text).tokens, 0);
    const relevantTokens = relevance.relevantFiles.reduce((sum, file) => sum + (source[file] ? estimateTokens(source[file]).tokens : 0), 0);
    const generatedTokens = language === "mote" ? files.reduce((sum, file) => {
      const result = compile(source[join("src", file).replaceAll("\\", "/")], { file, emitTypes: true });
      return sum + (result.diagnostics.hasErrors ? 0 : estimateTokens(result.code).tokens);
    }, 0) : 0;
    rows.push({ scale, language, moduleCount: files.length, totalSourceTokens: totalTokens, relevantContextTokens: relevantTokens, relevantContextRatio: totalTokens ? relevantTokens / totalTokens : null, editSurfaceFiles: relevance.relevantFiles.length, semanticCaseCount: relevance.semanticCasesPerTask * tasksForScale(scale), compilerFeedbackDensity: (relevance.compilerFeedbackOpportunities / Math.max(1, totalTokens)), generatedTokens, adapterTokens: 0, repositoryHash: hashTree(dir, { exclude: [".git", "node_modules", "fixture-hash.txt"] }), status: "DESIGN_MEASUREMENT" });
  }
}
const report = { schemaVersion: 1, experiment: "representation-stress", status: "DESIGN_MEASUREMENT_NO_AGENT_RUN", generatedAt: "2026-09-12", rows, exclusions: ["No model, provider, or agent was run.", "Semantic cases are task-contract accounting, not success observations."] };
const outDir = join(root, "bench", "raw");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "representation-measurement-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

function tasksForScale(scale) { return { small: 2, medium: 3, large: 4, "very-large": 5 }[scale]; }
