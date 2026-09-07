// Mutation tests: intentionally break the Mote source and confirm the behavior
// contract changes. A "survived" mutant (behavior unchanged) means the tests
// have a gap. Each mutant here must be KILLED.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const base = readFileSync(join(TASK, "mote/webhook.mt"), "utf8");
const valid = readFileSync(join(TASK, "fixtures/valid.json"), "utf8");
const invalid = readFileSync(join(TASK, "fixtures/invalid.json"), "utf8");

let pass = 0, fail = 0;
function ok(name, killed, detail) {
  if (killed) pass++;
  else { fail++; console.log(`  SURVIVED ${name}${detail ? ` — ${detail}` : ""}`); }
}
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

async function loadMutant(src, tag) {
  const { code, diagnostics } = compile(src, {
    file: "mutant.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) return { compileError: true };
  const tmp = join(HERE, `.mutant-${tag}.mjs`);
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); }
  finally { try { unlinkSync(tmp); } catch { /* */ } }
}

// Mutant A: break the amount calculation (first '+' in total -> '-').
{
  const src = base.replace("e.data.order.money.subtotal+", "e.data.order.money.subtotal-");
  const m = await loadMutant(src, "amount");
  ok("amount mutant killed (154 assertion breaks)", m.compileError || m.handle(valid).amount !== 154);
}

// Mutant B: weaken validation (subtotal:num -> subtotal:unknown) so bad input passes.
{
  const src = base.replace("subtotal:num", "subtotal:unknown");
  const m = await loadMutant(src, "validation");
  // original contract: invalid payload THROWS. Mutant should now NOT throw -> killed.
  ok("validation mutant killed (invalid no longer throws)", m.compileError || !throws(() => m.handle(invalid)));
}

// Control: unmutated source must satisfy the contract (sanity — not a mutant).
{
  const m = await loadMutant(base, "control");
  ok("control: amount is 154", !m.compileError && m.handle(valid).amount === 154);
  ok("control: invalid throws", !m.compileError && throws(() => m.handle(invalid)));
}

console.log(`\nmutation: ${pass} killed/ok, ${fail} survived`);
process.exit(fail === 0 ? 0 : 1);
