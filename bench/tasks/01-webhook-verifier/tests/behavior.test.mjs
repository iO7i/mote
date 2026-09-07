// Shared behavioral + negative-path tests for task 01. Same assertions run
// against every implementation. `mote` and `typescript` validate untrusted
// input; the `untyped` reference does not (that is the point of including it).

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const fx = (n) => readFileSync(join(TASK, "fixtures", n), "utf8");

const valid = fx("valid.json");
const invalid = fx("invalid.json");
const missingTax = fx("missing-tax.json");
const extraField = fx("extra-field.json");
const noCurrency = fx("no-currency.json");
const nullCurrency = fx("null-currency.json");
const expected = JSON.parse(readFileSync(join(TASK, "expected-output/valid.json"), "utf8"));

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond, detail) {
  if (cond) pass++;
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };

async function loadMote() {
  const src = readFileSync(join(TASK, "mote/webhook.mt"), "utf8");
  const { code, diagnostics } = compile(src, {
    file: "webhook.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) throw new Error(diagnostics.format());
  const tmp = join(HERE, ".mote-webhook.mjs");
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); }
  finally { try { unlinkSync(tmp); } catch { /* */ } }
}
const loadUntyped = () => import(pathToFileURL(join(TASK, "typescript-untyped/webhook.js")).href);

function testImpl(name, m, { validates }) {
  // happy path
  ok(`${name}: valid -> expected`, eq(m.handle(valid), expected));
  ok(`${name}: total is 154`, m.total(JSON.parse(valid)) === 154);

  // optional currency: absent defaults to SAR; present is used
  ok(`${name}: absent currency -> SAR`, m.handle(noCurrency).currency === "SAR");

  // signatures (all impls implement sign/valid)
  const sig = m.sign(valid, "s3cret");
  ok(`${name}: valid signature accepted`, m.valid(valid, "s3cret", sig) === true);
  ok(`${name}: wrong signature rejected`, m.valid(valid, "s3cret", m.sign(valid, "other")) === false);

  if (validates) {
    // negative paths must throw with a precise JSON path
    ok(`${name}: wrong nested type throws path`,
      String(throws(() => m.handle(invalid))?.message).includes("$.data.order.money.subtotal expected num"));
    ok(`${name}: missing field throws path`,
      String(throws(() => m.handle(missingTax))?.message).includes("$.data.order.money.tax"));
    ok(`${name}: null currency rejected`, throws(() => m.handle(nullCurrency)) !== null);
    // extra fields are allowed (structural width)
    ok(`${name}: extra field allowed`, eq(m.handle(extraField), expected));
  } else {
    // unvalidated baseline: bad input silently yields NaN, no throw
    ok(`${name}: unvalidated -> NaN amount`, Number.isNaN(m.handle(invalid).amount));
  }
}

testImpl("mote", await loadMote(), { validates: true });
testImpl("untyped", await loadUntyped(), { validates: false });

console.log(`\nbehavior: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
