// Shared behavioral + negative-path tests for task 02.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const fx = (n) => readFileSync(join(TASK, "fixtures", n), "utf8");

const SECRET = "s3cret";
const reqValid = fx("req-valid.json");
const reqNoNote = fx("req-no-note.json");
const reqInvalid = fx("req-invalid.json");
const reqMissing = fx("req-missing.json");
const okOut = JSON.parse(readFileSync(join(TASK, "expected-output/ok.json"), "utf8"));

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };

async function loadMote() {
  const src = readFileSync(join(TASK, "mote/api.mt"), "utf8");
  const { code, diagnostics } = compile(src, {
    file: "api.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) throw new Error(diagnostics.format());
  const tmp = join(HERE, ".mote-api.mjs");
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}
const loadUntyped = () => import(pathToFileURL(join(TASK, "typescript-untyped/api.js")).href);

function testImpl(name, m, { validates }) {
  ok(`${name}: authed valid -> 200 body`, eq(m.handle(SECRET, SECRET, reqValid), okOut));
  ok(`${name}: absent note -> ""`, m.handle(SECRET, SECRET, reqNoNote).note === "");
  ok(`${name}: wrong token -> 401`, m.handle("nope", SECRET, reqValid).status === 401);
  // auth precedes validation: bad body with wrong token must NOT throw, returns 401
  ok(`${name}: wrong token + bad body -> 401 (no parse)`, m.handle("nope", SECRET, reqInvalid).status === 401);
  if (validates) {
    ok(`${name}: authed bad type throws path`,
      String(throws(() => m.handle(SECRET, SECRET, reqInvalid))?.message).includes("$.amount expected num"));
    ok(`${name}: authed missing field throws path`,
      String(throws(() => m.handle(SECRET, SECRET, reqMissing))?.message).includes("$.amount"));
  } else {
    ok(`${name}: unvalidated bad body -> junk passes through`, m.handle(SECRET, SECRET, reqInvalid).charged === "fifty");
  }
}

testImpl("mote", await loadMote(), { validates: true });
testImpl("untyped", await loadUntyped(), { validates: false });

console.log(`\nbehavior: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
