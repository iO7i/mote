// Shared behavioral + negative-path tests for task 04 (DB mapper + pagination).

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const fx = (n) => readFileSync(join(TASK, "fixtures", n), "utf8");

const active = fx("user-active.json");
const deleted = fx("user-deleted.json");
const invalid = fx("user-invalid.json");
const nullName = fx("user-null-name.json");
const activeOut = JSON.parse(readFileSync(join(TASK, "expected-output/active.json"), "utf8"));

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };

async function loadMote() {
  const src = readFileSync(join(TASK, "mote/db.mt"), "utf8");
  const { code, diagnostics } = compile(src, {
    file: "db.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) throw new Error(diagnostics.format());
  const tmp = join(HERE, ".mote-db.mjs");
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}
const loadUntyped = () => import(pathToFileURL(join(TASK, "typescript-untyped/db.js")).href);

function testImpl(name, m, { validates }) {
  ok(`${name}: active row -> active:true`, eq(m.load(active), activeOut));
  ok(`${name}: soft-deleted row -> active:false`, m.load(deleted).active === false);
  // pagination math
  ok(`${name}: page(95,10,3) -> offset 30, pages 10`, eq(m.page(95, 10, 3), { page: 3, pages: 10, offset: 30 }));
  ok(`${name}: page(100,10,0) -> offset 0`, m.page(100, 10, 0).offset === 0);
  if (validates) {
    ok(`${name}: invalid id throws path`,
      String(throws(() => m.load(invalid))?.message).includes("$.id expected num"));
    ok(`${name}: null name throws path`,
      String(throws(() => m.load(nullName))?.message).includes("$.name"));
  } else {
    ok(`${name}: unvalidated bad id passes through`, m.load(invalid).id === "x");
  }
}

testImpl("mote", await loadMote(), { validates: true });
testImpl("untyped", await loadUntyped(), { validates: false });

console.log(`\nbehavior: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
