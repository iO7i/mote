// Mutation tests for task 03: break validation and coercion; confirm both killed.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const base = readFileSync(join(TASK, "mote/csv.mt"), "utf8");
const csv = readFileSync(join(TASK, "fixtures/people.csv"), "utf8");

let pass = 0, fail = 0;
function ok(name, killed, detail) {
  if (killed) pass++; else { fail++; console.log(`  SURVIVED ${name}${detail ? ` — ${detail}` : ""}`); }
}

function importCsv(mod) {
  const lines = csv.trim().split("\n");
  let imported = 0;
  for (let i = 1; i < lines.length; i++) if (mod.parseRow(lines[i].split(",")).ok) imported++;
  return imported;
}

async function loadMutant(src, tag) {
  const { code, diagnostics } = compile(src, {
    file: "mutant.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) return { compileError: true };
  const tmp = join(HERE, `.mutant-${tag}.mjs`);
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}

// Mutant A: weaken validation (id:num -> id:unknown) -> bad row imported (3).
{
  const m = await loadMutant(base.replace("id:num", "id:unknown"), "valid");
  ok("validation mutant killed (imports != 2)", m.compileError || importCsv(m) !== 2);
}
// Mutant B: break coercion (Number(c[0]) -> c[0]) -> all ids are strings -> 0 valid.
{
  const m = await loadMutant(base.replace("Number(c[0])", "c[0]"), "coerce");
  ok("coercion mutant killed (imports != 2)", m.compileError || importCsv(m) !== 2);
}
// Control.
{
  const m = await loadMutant(base, "control");
  ok("control: imports 2", !m.compileError && importCsv(m) === 2);
}

console.log(`\nmutation: ${pass} killed/ok, ${fail} survived`);
process.exit(fail === 0 ? 0 : 1);
