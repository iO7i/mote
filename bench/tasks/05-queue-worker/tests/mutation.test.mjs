// Mutation tests for task 05: break retry classification, idempotency, and
// validation; confirm each is killed.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const base = readFileSync(join(TASK, "mote/worker.mt"), "utf8");
const valid = readFileSync(join(TASK, "fixtures/job-valid.json"), "utf8");
const invalid = readFileSync(join(TASK, "fixtures/job-invalid.json"), "utf8");

let pass = 0, fail = 0;
function ok(name, killed, detail) {
  if (killed) pass++; else { fail++; console.log(`  SURVIVED ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function rejects(fn) { try { await fn(); return false; } catch { return true; } }
const store = (seen = []) => { const s = new Set(seen); return { seen: (k) => s.has(k) }; };
const writer = (r) => { const calls = []; return { write: async (j) => { calls.push(j); return r; }, calls }; };

async function loadMutant(src, tag) {
  const { code, diagnostics } = compile(src, {
    file: "mutant.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) return { compileError: true };
  const tmp = join(HERE, `.mutant-${tag}.mjs`);
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}

// Mutant A: break retry classification (timeout no longer retryable).
{
  const m = await loadMutant(base.replace('code=="timeout"||code=="503"', 'false'), "retry");
  const out = m.compileError ? null : await m.process(valid, store(), writer({ ok: false, error: "timeout" }).write);
  ok("retry mutant killed (timeout no longer 'retry')", m.compileError || out.status !== "retry");
}
// Mutant B: break idempotency (always treat as not seen -> writes duplicate).
{
  const m = await loadMutant(base.replace("store.seen(j.key)?", "false?"), "idem");
  const w = writer({ ok: true });
  if (!m.compileError) await m.process(valid, store(["k_1"]), w.write);
  ok("idempotency mutant killed (write happens on duplicate)", m.compileError || w.calls.length === 1);
}
// Mutant C: weaken validation (amount:num -> amount:unknown).
{
  const m = await loadMutant(base.replace("amount:num", "amount:unknown"), "valid");
  ok("validation mutant killed (invalid no longer rejects)",
    m.compileError || !(await rejects(() => m.process(invalid, store(), writer({ ok: true }).write))));
}
// Control.
{
  const m = await loadMutant(base, "control");
  const w = writer({ ok: true });
  const out = m.compileError ? null : await m.process(valid, store(), w.write);
  ok("control: ok + write once", !m.compileError && out.status === "ok" && w.calls.length === 1);
}

console.log(`\nmutation: ${pass} killed/ok, ${fail} survived`);
process.exit(fail === 0 ? 0 : 1);
