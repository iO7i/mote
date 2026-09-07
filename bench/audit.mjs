#!/usr/bin/env node
// Independent fixture audit — verifies each live benchmark task is FAIR and
// COMPLETE before its numbers are trusted. Structural + behavioral checks that
// are independent of run.mjs. Exit non-zero if any task fails an audit gate.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compile } from "../src/compile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, "tasks");
const TSC = resolve(HERE, "../node_modules/typescript/bin/tsc");

const oneFile = (dir, ext) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((x) => x.endsWith(ext));
  return f ? join(dir, f) : null;
};
const readIf = (p) => (p && existsSync(p) ? readFileSync(p, "utf8") : "");

// Each check: { id, ok, note }. A task passes only if every REQUIRED check is ok.
function auditTask(name) {
  const dir = join(TASKS, name);
  const moteF = oneFile(join(dir, "mote"), ".mt");
  const tsF = oneFile(join(dir, "typescript"), ".ts");
  const untypedF = oneFile(join(dir, "typescript-untyped"), ".js");
  const behF = join(dir, "tests", "behavior.test.mjs");
  const mutF = join(dir, "tests", "mutation.test.mjs");
  const beh = readIf(behF);
  const checks = [];
  const add = (id, ok, note = "") => checks.push({ id, ok: !!ok, note });

  // 1. all three implementations present (primary + secondary reference)
  add("impls-present", moteF && tsF && untypedF, "mote + typescript + typescript-untyped");

  // 2. Mote type-checks; strict TS compiles
  let moteOk = false;
  if (moteF) { try { moteOk = !compile(readFileSync(moteF, "utf8"), { file: moteF, emitTypes: true }).diagnostics.hasErrors; } catch { moteOk = false; } }
  add("mote-typechecks", moteOk);
  if (tsF && existsSync(TSC)) {
    const r = spawnSync(process.execPath, [TSC, "--strict", "--noEmit", "--skipLibCheck",
      "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--types", "node", tsF],
      { encoding: "utf8" });
    add("strict-ts-compiles", r.status === 0, r.status === 0 ? "" : r.stdout.split("\n")[0]);
  } else add("strict-ts-compiles", false, "tsc not available");

  // 3. behavior + mutation tests present and passing
  add("has-behavior-tests", !!beh);
  add("has-mutation-tests", existsSync(mutF));
  for (const [id, f] of [["behavior-passes", behF], ["mutation-passes", mutF]]) {
    if (!existsSync(f)) { add(id, false, "missing"); continue; }
    const r = spawnSync(process.execPath, [f], { encoding: "utf8" });
    add(id, r.status === 0, r.status === 0 ? "" : (r.stdout + r.stderr).split("\n").find((l) => /FAIL|SURVIVED|Error/.test(l)) || "");
  }

  // 4. error-PATH coverage: behavior test asserts a precise "$.<path>"
  add("tests-error-paths", /\$\.[a-zA-Z]/.test(beh), "asserts a JSON validation path");

  // 5. security/parity guard: mote + strict-TS validate untrusted input;
  //    untyped reference is explicitly the UNSAFE baseline (tested as such).
  add("validated-vs-unsafe-parity", /validates:\s*true/.test(beh) && /validates:\s*false/.test(beh),
    "same tests assert validated impls throw AND unsafe baseline does not");

  // 6. at least one negative/edge fixture beyond the happy path
  const fxDir = join(dir, "fixtures");
  const fxCount = existsSync(fxDir) ? readdirSync(fxDir).length : 0;
  add("has-negative-fixtures", fxCount >= 2, `${fxCount} fixture file(s)`);

  const required = checks.filter((c) => c.id !== "strict-ts-compiles" || existsSync(TSC));
  const passed = required.every((c) => c.ok);
  return { task: name, passed, checks };
}

const tasks = existsSync(TASKS)
  ? readdirSync(TASKS).filter((d) => statSync(join(TASKS, d)).isDirectory() &&
      existsSync(join(TASKS, d, "mote")))
  : [];

let allPass = true;
console.log("Fixture audit\n=============");
for (const t of tasks.sort()) {
  const r = auditTask(t);
  allPass = allPass && r.passed;
  console.log(`\n${r.passed ? "PASS" : "FAIL"}  ${r.task}`);
  for (const c of r.checks) console.log(`  ${c.ok ? "ok  " : "XX  "} ${c.id}${c.note ? ` — ${c.note}` : ""}`);
}
console.log(`\n${allPass ? "AUDIT PASSED" : "AUDIT FAILED"} — ${tasks.length} task(s)`);
process.exit(allPass ? 0 : 1);
