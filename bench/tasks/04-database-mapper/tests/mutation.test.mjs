// Mutation tests for task 04: break the active-flag logic and pagination math.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const base = readFileSync(join(TASK, "mote/db.mt"), "utf8");
const active = readFileSync(join(TASK, "fixtures/user-active.json"), "utf8");
const invalid = readFileSync(join(TASK, "fixtures/user-invalid.json"), "utf8");

let pass = 0, fail = 0;
function ok(name, killed, detail) {
  if (killed) pass++; else { fail++; console.log(`  SURVIVED ${name}${detail ? ` — ${detail}` : ""}`); }
}
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

async function loadMutant(src, tag) {
  const { code, diagnostics } = compile(src, {
    file: "mutant.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) return { compileError: true };
  const tmp = join(HERE, `.mutant-${tag}.mjs`);
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}

// Mutant A: invert active logic (==nil -> !=nil).
{
  const m = await loadMutant(base.replace("deleted_at==nil", "deleted_at!=nil"), "active");
  ok("active mutant killed (active flag inverts)", m.compileError || m.load(active).active !== true);
}
// Mutant B: break pagination offset (n*size -> n+size).
{
  const m = await loadMutant(base.replace("offset:n*size", "offset:n+size"), "page");
  ok("pagination mutant killed (offset wrong)", m.compileError || m.page(95, 10, 3).offset !== 30);
}
// Mutant C: weaken validation (id:num -> id:unknown) so bad id no longer throws.
{
  const m = await loadMutant(base.replace("id:num", "id:unknown"), "valid");
  ok("validation mutant killed (invalid no longer throws)", m.compileError || !throws(() => m.load(invalid)));
}
// Control.
{
  const m = await loadMutant(base, "control");
  ok("control: active true", !m.compileError && m.load(active).active === true);
  ok("control: offset 20", !m.compileError && m.page(95, 10, 3).offset === 30);
}

console.log(`\nmutation: ${pass} killed/ok, ${fail} survived`);
process.exit(fail === 0 ? 0 : 1);
