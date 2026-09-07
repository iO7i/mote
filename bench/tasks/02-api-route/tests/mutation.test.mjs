// Mutation tests for task 02: break auth and validation; confirm both are killed.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const base = readFileSync(join(TASK, "mote/api.mt"), "utf8");
const reqValid = readFileSync(join(TASK, "fixtures/req-valid.json"), "utf8");
const reqInvalid = readFileSync(join(TASK, "fixtures/req-invalid.json"), "utf8");
const SECRET = "s3cret";

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

// Mutant A: auth always passes (token==secret -> true).
{
  const m = await loadMutant(base.replace("token==secret", "true"), "auth");
  ok("auth mutant killed (wrong token no longer 401)",
    m.compileError || m.handle("nope", SECRET, reqValid).status !== 401);
}
// Mutant B: weaken validation (amount:num -> amount:unknown).
{
  const m = await loadMutant(base.replace("amount:num", "amount:unknown"), "valid");
  ok("validation mutant killed (bad body no longer throws)",
    m.compileError || !throws(() => m.handle(SECRET, SECRET, reqInvalid)));
}
// Control.
{
  const m = await loadMutant(base, "control");
  ok("control: wrong token 401", !m.compileError && m.handle("nope", SECRET, reqValid).status === 401);
  ok("control: bad body throws", !m.compileError && throws(() => m.handle(SECRET, SECRET, reqInvalid)));
}

console.log(`\nmutation: ${pass} killed/ok, ${fail} survived`);
process.exit(fail === 0 ? 0 : 1);
