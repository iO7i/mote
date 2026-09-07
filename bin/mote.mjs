#!/usr/bin/env node
// Mote v0.2 CLI — check / compile / run / fmt / measure / explain / test / emit.

import {
  readFileSync, writeFileSync, mkdirSync, unlinkSync, statSync, readdirSync, copyFileSync,
} from "node:fs";
import { basename, join, dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compile } from "../src/compile.mjs";
import { parse } from "../src/parser.mjs";
import { formatMote } from "../src/formatter.mjs";
import { explain } from "../src/diagnostics.mjs";
import { estimateTokens } from "../src/measure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME_MJS = resolve(HERE, "../src/runtime/mote.mjs");
const RUNTIME_TS = resolve(HERE, "../src/runtime/mote.ts");

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    strict: true,
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["*.ts"],
}, null, 2) + "\n";

const [, , cmd, ...rest] = process.argv;

function fail(msg) { console.error(msg); process.exit(1); }
function flag(name, fallback) { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : fallback; }
function has(name) { return rest.includes(name); }
function positionals() { return rest.filter((a) => !a.startsWith("--")); }

function motFiles(target) {
  const st = statSync(target);
  if (st.isDirectory()) {
    return readdirSync(target).filter((f) => f.endsWith(".mt")).map((f) => join(target, f));
  }
  return [target];
}

function compileFile(file, opts) {
  const src = readFileSync(file, "utf8");
  try {
    return compile(src, { file, strict: !has("--loose"), ...opts });
  } catch (e) {
    if (e.mote) fail(e.message);
    throw e;
  }
}

function main() {
  switch (cmd) {
    case undefined: case "help": case "--help": case "-h": return printHelp();
    case "emit": return cmdEmit();
    case "check": return cmdCheck();
    case "compile": return cmdCompile();
    case "run": return cmdRun();
    case "fmt": return cmdFmt();
    case "measure": return cmdMeasure();
    case "explain": return cmdExplain();
    case "test": return cmdTest();
    default: return fail(`unknown command: ${cmd}\nrun 'mote help' for usage`);
  }
}

function printHelp() {
  console.log(`mote v0.2 — typed, token-aware language that compiles to TypeScript

usage:
  mote check <file|dir> [--loose]    type-check, print diagnostics (--loose: allow untyped pub fns)
  mote compile <file|dir> [--out d]  emit .ts + .d.ts + runtime + source map
  mote run <file.mt>                 type-check then execute with node
  mote emit <file.mt> [--js]         print emitted TypeScript (or JS with --js)
  mote fmt <file.mt> [--compact|--readable]
  mote measure <file.mt> [--json]    estimate source tokens (heuristic, UNVERIFIED)
  mote explain <M-code>              describe a diagnostic code
  mote test                          run the compiler test suite`);
}

function cmdEmit() {
  const file = positionals()[0];
  if (!file) fail("usage: mote emit <file.mt> [--js]");
  const emitTypes = !has("--js");
  const r = compileFile(file, {
    emitTypes,
    runtimeImport: emitTypes ? flag("--runtime", "./mote-runtime") : pathToFileURL(RUNTIME_MJS).href,
  });
  if (r.diagnostics.hasErrors) { console.error(r.diagnostics.format()); process.exit(1); }
  process.stdout.write(r.code);
}

function cmdCheck() {
  const target = positionals()[0];
  if (!target) fail("usage: mote check <file|dir>");
  let errors = 0;
  for (const file of motFiles(target)) {
    const r = compileFile(file, { emitTypes: true });
    const text = r.diagnostics.format();
    if (text) console.log(text);
    errors += r.diagnostics.errors.length;
  }
  if (errors === 0) console.log("ok — no type errors");
  process.exit(errors === 0 ? 0 : 1);
}

function cmdCompile() {
  const target = positionals()[0];
  if (!target) fail("usage: mote compile <file|dir> [--out dir]");
  const outDir = flag("--out", "dist");
  mkdirSync(outDir, { recursive: true });
  let errors = 0;
  let wroteRuntime = false;
  const runtimeSpec = flag("--runtime", "./mote-runtime"); // e.g. --runtime @mote/runtime
  for (const file of motFiles(target)) {
    const r = compileFile(file, { emitTypes: true, runtimeImport: runtimeSpec });
    if (r.diagnostics.hasErrors) { console.error(r.diagnostics.format()); errors++; continue; }
    const stem = basename(file).replace(/\.mt$/, "");
    const tsName = `${stem}.ts`;
    writeFileSync(join(outDir, tsName), r.code + `//# sourceMappingURL=${tsName}.map\n`);
    writeFileSync(join(outDir, `${tsName}.map`), r.sourceMap(tsName));
    writeFileSync(join(outDir, `${stem}.d.ts`), r.declarations());
    // Vendor the runtime only for a relative import; an installed package
    // (e.g. --runtime @mote/runtime) lives in node_modules, not the output.
    if (r.needsRuntime && !wroteRuntime && runtimeSpec.startsWith(".")) {
      copyFileSync(RUNTIME_TS, join(outDir, "mote-runtime.ts"));
      wroteRuntime = true;
    }
    console.error(`wrote ${join(outDir, tsName)}`);
  }
  writeFileSync(join(outDir, "tsconfig.json"), TSCONFIG);
  process.exit(errors === 0 ? 0 : 1);
}

function cmdRun() {
  const file = positionals()[0];
  if (!file) fail("usage: mote run <file.mt>");
  const r = compileFile(file, {
    emitTypes: false,
    runtimeImport: pathToFileURL(RUNTIME_MJS).href,
  });
  if (r.diagnostics.hasErrors) { console.error(r.diagnostics.format()); process.exit(1); }
  const tmp = join(process.cwd(), `.mote-run-${process.pid}.mjs`);
  writeFileSync(tmp, r.code);
  const cleanup = () => { try { unlinkSync(tmp); } catch { /* ignore */ } };
  import(pathToFileURL(tmp).href)
    .then(cleanup)
    .catch((e) => {
      cleanup(); // process.exit() below would skip a .finally, so unlink first
      if (e && e.moteValidation) fail(`M901 runtime validation error: ${e.message}`);
      fail(e.stack ?? String(e));
    });
}

function cmdFmt() {
  const file = positionals()[0];
  if (!file) fail("usage: mote fmt <file.mt> [--compact|--readable]");
  const mode = has("--readable") ? "readable" : "compact";
  const src = readFileSync(file, "utf8");
  let program;
  try { program = parse(src, file); } catch (e) { if (e.mote) fail(e.message); throw e; }
  process.stdout.write(formatMote(program, mode));
}

function cmdMeasure() {
  const file = positionals()[0];
  if (!file) fail("usage: mote measure <file.mt> [--json]");
  const src = readFileSync(file, "utf8");
  const est = estimateTokens(src);
  if (has("--json")) { process.stdout.write(JSON.stringify(est, null, 2) + "\n"); return; }
  console.log(`file: ${file}`);
  console.log(`bytes:      ${est.bytes}`);
  console.log(`lines:      ${est.lines}`);
  console.log(`est tokens: ${est.tokens}  [${est.status}: ${est.method}]`);
  console.log(`note: this is a heuristic. For real per-tokenizer counts use the`);
  console.log(`      benchmark harness in bench/ with a configured adapter.`);
}

function cmdExplain() {
  const code = positionals()[0];
  if (!code) fail("usage: mote explain <M-code>");
  console.log(explain(code.toUpperCase()));
}

function cmdTest() {
  const testFile = resolve(HERE, "../tests/run.mjs");
  const res = spawnSync(process.execPath, [testFile], { stdio: "inherit" });
  process.exit(res.status ?? 1);
}

main();
