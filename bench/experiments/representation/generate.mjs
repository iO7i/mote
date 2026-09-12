// Generate paired, semantically aligned repository fixtures for context-stress
// experiments. The fixtures are intentionally labeled design inputs: no agent
// is run and no generated number is treated as an efficacy observation.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashTree } from "../../protocol.mjs";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const base = join(root, "bench", "experiments", "representation", "fixtures");
const scales = [
  ["small", 4], ["medium", 12], ["large", 30], ["very-large", 60],
];
const roles = ["identity", "pricing", "risk", "settlement", "reconciliation", "webhook", "reporting", "retention", "routing", "limits"];
const tasksByScale = {
  small: ["change-fee-policy", "trace-invalid-entry"],
  medium: ["change-fee-policy", "trace-invalid-entry", "add-reconciliation-field"],
  large: ["change-fee-policy", "trace-invalid-entry", "add-reconciliation-field", "repair-cross-module-import"],
  "very-large": ["change-fee-policy", "trace-invalid-entry", "add-reconciliation-field", "repair-cross-module-import", "migrate-ledger-status"],
};

for (const [scale, moduleCount] of scales) {
  for (const language of ["mote", "typescript"]) generateRepo(scale, moduleCount, language);
}
console.log(JSON.stringify({ status: "GENERATED_DESIGN_FIXTURES", scales: scales.map(([id, moduleCount]) => ({ id, moduleCount })), languages: ["mote", "typescript"] }, null, 2));

function generateRepo(scale, moduleCount, language) {
  const dir = join(base, scale, language);
  const src = join(dir, "src");
  mkdirSync(src, { recursive: true });
  for (let i = 0; i < moduleCount; i++) {
    const role = roles[i % roles.length];
    const id = String(i).padStart(2, "0");
    const source = language === "mote"
      ? `type ${pascal(role)}${id}={value:num,enabled:bool}\npub fn normalize${id}(r:${pascal(role)}${id})->num=r.enabled?r.value:0\npub fn classify${id}(r:${pascal(role)}${id})->str=r.enabled?"active":"held"\n`
      : `export type ${pascal(role)}${id} = { value: number; enabled: boolean };\nexport function normalize${id}(r: ${pascal(role)}${id}): number { return r.enabled ? r.value : 0; }\nexport function classify${id}(r: ${pascal(role)}${id}): string { return r.enabled ? "active" : "held"; }\n`;
    writeFileSync(join(src, `module-${id}.${language === "mote" ? "mt" : "ts"}`), source);
  }
  const target = `src/module-${String(Math.floor(moduleCount / 2)).padStart(2, "0")}.${language === "mote" ? "mt" : "ts"}`;
  const relevant = [target, `src/module-${String(Math.max(0, Math.floor(moduleCount / 2) - 1)).padStart(2, "0")}.${language === "mote" ? "mt" : "ts"}`];
  writeFileSync(join(dir, "task.md"), `Maintain the ${scale} ledger repository. Change the target business rule while preserving the public API and all hidden boundary behavior. Target module: ${target}.\n`);
  writeFileSync(join(dir, "relevance.json"), JSON.stringify({ target, relevantFiles: relevant, distractorFiles: moduleCount - relevant.length, semanticCasesPerTask: 8, compilerFeedbackOpportunities: moduleCount + tasksByScale[scale].length }, null, 2) + "\n");
  writeFileSync(join(dir, "task-contract.json"), JSON.stringify({ scale, language, moduleCount, tasks: tasksByScale[scale], sameBehaviorKey: "normalize(enabled,value)=enabled?value:0", target, oracle: "private paired oracle outside visible repository" }, null, 2) + "\n");
  writeFileSync(join(dir, "README.md"), `# ${scale} ${language} representation fixture\n\nThis repository is a paired design input for representation-stress experiments. It has ${moduleCount} source modules, ${relevant.length} relevant files for the declared task, and ${moduleCount - relevant.length} distractors.\n`);
  writeFileSync(join(dir, "fixture-hash.txt"), `${hashTree(dir, { exclude: [".git", "node_modules", "fixture-hash.txt"] })}\n`);
}

function pascal(value) { return value[0].toUpperCase() + value.slice(1); }
