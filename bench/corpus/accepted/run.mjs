// Local acceptance gate for the paired pilot references. It is not a model
// result: it proves task definitions, hidden oracles, and mutation controls.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { compile } from "../../../src/compile.mjs";
import { expected } from "../oracles.mjs";
import { FIXTURE_BY_ID } from "./registry.mjs";
import { loadAcceptedTasks } from "./validate.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const taskSet = JSON.parse(readFileSync(join(ROOT, "bench/corpus/manifest.json"), "utf8"));
const checked = loadAcceptedTasks(ROOT, taskSet);
const results = [];
let importSerial = 0;

for (const { task } of checked.tasks) {
  const fixture = FIXTURE_BY_ID.get(task.id);
  const arms = {};
  for (const language of ["mote", "typescript"]) arms[language] = await runArm(fixture, language, fixture.referenceSolutions[language]);
  const mutations = {};
  for (const language of ["mote", "typescript"]) {
    mutations[language] = [];
    for (const mutation of fixture.mutations) {
      const result = await runCases(fixture, language, mutation[language]);
      mutations[language].push({ name: mutation.name, killed: result.failedCases > 0, failedCases: result.failedCases, compileError: result.compileError ?? null });
    }
  }
  const accepted = Object.values(arms).every((arm) => arm.success) && Object.values(mutations).flat().every((mutation) => mutation.killed);
  results.push({ id: task.id, accepted, arms, mutations });
}

const output = { schemaVersion: 1, corpusVersion: taskSet.corpusVersion, taskSetHash: checked.manifestHash, accepted: results.filter((result) => result.accepted).length, total: results.length, results };
console.log(JSON.stringify(process.argv.includes("--summary") ? { schemaVersion: output.schemaVersion, corpusVersion: output.corpusVersion, taskSetHash: output.taskSetHash, accepted: output.accepted, total: output.total, mutationControls: output.results.reduce((sum, result) => sum + Object.values(result.mutations).flat().filter((mutation) => mutation.killed).length, 0) } : output, null, 2));
process.exit(checked.ok && output.accepted === output.total ? 0 : 1);

async function runArm(fixture, language, source) {
  const result = await runCases(fixture, language, source);
  if (result.compileError) return { success: false, phase: "typecheck", ...result };
  const phases = Object.fromEntries((fixture.phases[language] ?? []).map((phase) => [phase.name, { status: "passed" }]));
  return { success: result.failedCases === 0, phases, cases: fixture.inputs.length, ...result };
}

async function runCases(fixture, language, source) {
  const dir = mkdtempSync(join(tmpdir(), `mote-accepted-${fixture.id}-`));
  try {
    let moduleFile;
    if (language === "mote") {
      const compiled = compile(source, { file: join(dir, "solution.mt"), emitTypes: false, runtimeImport: pathToFileURL(resolve(ROOT, "src/runtime/mote.mjs")).href });
      if (compiled.diagnostics.hasErrors) return { failedCases: fixture.inputs.length, compileError: compiled.diagnostics.format() };
      moduleFile = join(dir, "solution.mjs");
      writeFileSync(moduleFile, compiled.code);
    } else {
      const transpiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } });
      moduleFile = join(dir, "solution.mjs");
      writeFileSync(moduleFile, transpiled.outputText);
    }
    return { failedCases: await executeCases(moduleFile, fixture) };
  } catch (error) {
    return { failedCases: fixture.inputs.length, compileError: error instanceof Error ? error.message : String(error) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function executeCases(moduleFile, fixture) {
  const url = pathToFileURL(moduleFile).href + `?fixture=${fixture.id}-${importSerial++}`;
  return import(url).then((module) => {
    if (typeof module.solve !== "function") return fixture.inputs.length;
    return Promise.all(fixture.inputs.map(async (input) => {
      try { return Object.is(expected(fixture.id, input), await module.solve(input)) ? 0 : 1; } catch { return 1; }
    })).then((values) => values.reduce((sum, value) => sum + value, 0));
  }).catch(() => fixture.inputs.length);
}
