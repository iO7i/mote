// Meaningful compiler mutations. A mutant is killed when the existing suite
// observes a non-zero exit. Surviving mutants are reported, never hidden.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANTS = [
  { id: "checker-optional-access", file: "src/checker.mjs", find: 'if (rot.t === "opt") {', replace: 'if (false && rot.t === "opt") {' },
  { id: "runtime-finite-number", file: "src/runtime/mote.mjs", find: 'typeof value === "number" && Number.isFinite(value)', replace: 'typeof value === "number"' },
  { id: "emitter-strict-equality", file: "src/emitter.mjs", find: 'const OPMAP = { "==": "===", "!=": "!==" };', replace: 'const OPMAP = { "==": "!==", "!=": "!==" };' },
  { id: "schema-optional-marker", file: "src/schema.mjs", find: 'f.optional ? "?" : ""', replace: 'f.optional ? "" : ""' },
];

const results = [];
for (const mutant of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), `mote-mutant-${mutant.id}-`));
  try {
    cpSync(join(ROOT, "src"), join(dir, "src"), { recursive: true });
    cpSync(join(ROOT, "tests"), join(dir, "tests"), { recursive: true });
    const file = join(dir, mutant.file);
    const source = readFileSync(file, "utf8");
    const occurrences = source.split(mutant.find).length - 1;
    if (occurrences !== 1) throw new Error(`${mutant.file}: expected one mutation site, found ${occurrences}`);
    writeFileSync(file, source.replace(mutant.find, mutant.replace));
    const runs = ["tests/run.mjs", "tests/trust.mjs"].map((suite) => spawnSync(process.execPath, [suite], { cwd: dir, encoding: "utf8", timeout: 60_000, windowsHide: true }));
    const run = runs.find((candidate) => candidate.status !== 0) ?? runs.at(-1);
    results.push({ id: mutant.id, status: runs.every((candidate) => candidate.status === 0) ? "SURVIVED" : "KILLED", exitCode: run.status, output: runs.map((candidate) => `${candidate.stdout ?? ""}${candidate.stderr ?? ""}`).join("\n").slice(-2000) });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const killed = results.filter((r) => r.status === "KILLED").length;
const score = results.length ? killed / results.length : 0;
console.log(JSON.stringify({ schemaVersion: 1, suite: "compiler", mutants: results, killed, total: results.length, mutationScore: score }, null, 2));
process.exit(killed === results.length ? 0 : 1);
