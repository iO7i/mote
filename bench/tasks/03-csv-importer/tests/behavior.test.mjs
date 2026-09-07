// Shared behavioral + negative-path tests for task 03 (CSV importer).
// The mechanical CSV split + iteration is the shared harness here (identical for
// every impl); each impl supplies the typed, validated `parseRow`.
// mote validates; the untyped baseline does not (validates: false).

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../../../../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const RUNTIME = resolve(HERE, "../../../../src/runtime/mote.mjs");
const fx = (n) => readFileSync(join(TASK, "fixtures", n), "utf8");
const mixed = fx("people.csv");      // 2 valid, 1 bad id
const allValid = fx("all-valid.csv"); // 2 valid
const allBad = fx("all-invalid.csv"); // 2 bad ids

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) pass++; else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

// Shared harness: split CSV, run parseRow per data row, aggregate an import report.
function importCsv(mod, text) {
  const lines = text.trim().split("\n");
  const report = { imported: 0, errors: [] };
  for (let i = 1; i < lines.length; i++) {
    const r = mod.parseRow(lines[i].split(","));
    if (r.ok) report.imported++;
    else report.errors.push({ row: i + 1, path: r.error.path });
  }
  return report;
}

async function loadMote() {
  const src = readFileSync(join(TASK, "mote/csv.mt"), "utf8");
  const { code, diagnostics } = compile(src, {
    file: "csv.mt", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  if (diagnostics.hasErrors) throw new Error(diagnostics.format());
  const tmp = join(HERE, ".mote-csv.mjs");
  writeFileSync(tmp, code);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch { /* */ } }
}
const loadUntyped = () => import(pathToFileURL(join(TASK, "typescript-untyped/csv.js")).href);

function testImpl(name, mod, { validates }) {
  const clean = importCsv(mod, allValid);
  ok(`${name}: all-valid -> 2 imported`, clean.imported === 2 && clean.errors.length === 0, JSON.stringify(clean));

  const mix = importCsv(mod, mixed);
  const bad = importCsv(mod, allBad);
  if (validates) {
    ok(`${name}: mixed -> 2 imported, 1 error`, mix.imported === 2 && mix.errors.length === 1, JSON.stringify(mix));
    ok(`${name}: mixed error on row 4 / $.id`, mix.errors[0]?.row === 4 && mix.errors[0]?.path === "$.id");
    ok(`${name}: all-invalid -> 0 imported`, bad.imported === 0, JSON.stringify(bad));
  } else {
    ok(`${name}: unvalidated mixed -> imports ALL (3)`, mix.imported === 3 && mix.errors.length === 0, JSON.stringify(mix));
    ok(`${name}: unvalidated all-invalid -> imports ALL (2)`, bad.imported === 2 && bad.errors.length === 0, JSON.stringify(bad));
  }
}

testImpl("mote", await loadMote(), { validates: true });
testImpl("untyped", await loadUntyped(), { validates: false });

console.log(`\nbehavior: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
