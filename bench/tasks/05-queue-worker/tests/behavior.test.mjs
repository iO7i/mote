// Shared async behavioral tests for task 05 (queue worker).
// Exercises: idempotency, retry classification, structured outcome, async write,
// validation failure, and TESTABLE SIDE EFFECTS (write-call tracking).

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const valid = readFileSync(join(TASK, "fixtures/job-valid.json"), "utf8");
const invalid = readFileSync(join(TASK, "fixtures/job-invalid.json"), "utf8");
const okOut = JSON.parse(readFileSync(join(TASK, "expected-output/ok.json"), "utf8"));

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function rejects(fn) { try { await fn(); return null; } catch (e) { return e; } }

// Mock side-effect boundaries.
function makeStore(seenKeys = []) {
  const s = new Set(seenKeys);
  return { seen: (k) => s.has(k) };
}
function makeWriter(result = { ok: true }) {
  const calls = [];
  const write = async (j) => { calls.push(j); return result; };
  return { write, calls };
}

async function loadMote() {
  const src = readFileSync(join(TASK, "mote/worker.mt"), "utf8");
  const { code, diagnostics } = compile(src, {
    file: "worker.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) throw new Error(diagnostics.format());
  const tmp = join(HERE, ".mote-worker.mjs");
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}
const loadUntyped = () => import(pathToFileURL(join(TASK, "typescript-untyped/worker.js")).href);

async function testImpl(name, m, { validates }) {
  // happy path + side effect: write called exactly once
  {
    const w = makeWriter({ ok: true });
    const out = await m.process(valid, makeStore(), w.write);
    ok(`${name}: valid -> ok outcome`, eq(out, okOut), JSON.stringify(out));
    ok(`${name}: write called once (side effect)`, w.calls.length === 1);
  }
  // idempotency: already-seen key -> duplicate, NO write
  {
    const w = makeWriter({ ok: true });
    const out = await m.process(valid, makeStore(["k_1"]), w.write);
    ok(`${name}: duplicate key -> duplicate`, out.status === "duplicate");
    ok(`${name}: duplicate -> write NOT called (side effect)`, w.calls.length === 0);
  }
  // retry classification: transient error
  {
    const w = makeWriter({ ok: false, error: "timeout" });
    const out = await m.process(valid, makeStore(), w.write);
    ok(`${name}: transient error -> retry`, out.status === "retry" && out.detail === "timeout");
  }
  // permanent error
  {
    const w = makeWriter({ ok: false, error: "card_declined" });
    const out = await m.process(valid, makeStore(), w.write);
    ok(`${name}: permanent error -> failed`, out.status === "failed");
  }
  // validation boundary
  if (validates) {
    const w = makeWriter({ ok: true });
    const e = await rejects(() => m.process(invalid, makeStore(), w.write));
    ok(`${name}: invalid payload rejects with path`, String(e?.message).includes("$.amount expected num"), e?.message);
    ok(`${name}: invalid payload -> NO write (side effect)`, w.calls.length === 0);
  } else {
    const w = makeWriter({ ok: true });
    const out = await m.process(invalid, makeStore(), w.write);
    ok(`${name}: unvalidated -> processes junk (write called)`, w.calls.length === 1 && out.status === "ok");
  }
}

await testImpl("mote", await loadMote(), { validates: true });
await testImpl("untyped", await loadUntyped(), { validates: false });

console.log(`\nbehavior: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
