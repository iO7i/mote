// Deterministic bounded compiler fuzz/property suite. Failures print a small
// reproducible source and seed; a discovered crash should be minimized into
// tests/crash-corpus/ by the maintainer.
import ts from "typescript";
import { compile } from "../src/compile.mjs";
import { parse } from "../src/parser.mjs";
import { formatMote } from "../src/formatter.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { minimizeCompilerFailure } from "./minimize.mjs";

const index = process.argv.indexOf("--cases");
const cases = Number(index >= 0 ? process.argv[index + 1] : 256);
const seedIndex = process.argv.indexOf("--seed");
const seed = Number(seedIndex >= 0 ? process.argv[seedIndex + 1] : 0xF00DBAAD) >>> 0;
let state = seed;
let failed = 0, malformed = 0, valid = 0, emitted = 0;
const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const pick = (items) => items[Math.floor(next() * items.length)];
const fail = (label, source, error) => { failed++; console.error(`FAIL ${label} seed=${seed} source=${JSON.stringify(source)}${error ? ` error=${error.message}` : ""}`); };

for (let i = 0; i < cases; i++) {
  const source = i % 2 ? validProgram(i) : arbitrarySource(i);
  let result;
  try { result = compile(source, { file: `fuzz-${seed}-${i}.mt` }); }
  catch (error) {
    fail(`compiler did not contain input ${i}`, source, error);
    const minimized = minimizeCompilerFailure(source, { seed, phase: "compile", failureClass: error?.mote?.phase ?? "unexpected-throw", predicate: (candidate) => { try { compile(candidate, { file: "minimized.mt" }); return false; } catch { return true; } } });
    const corpus = fileURLToPath(new URL("./crash-corpus/", import.meta.url));
    mkdirSync(corpus, { recursive: true });
    const base = `fuzz-${seed}-${i}-${minimized.sha256.slice(0, 12)}`;
    writeFileSync(join(corpus, `${base}.mt`), minimized.source);
    writeFileSync(join(corpus, `${base}.json`), JSON.stringify({ ...minimized, case: i, originalSource: source }, null, 2) + "\n");
    continue;
  }
  if (result.diagnostics.hasErrors) { malformed++; continue; }
  valid++;
  try {
    const ast = parse(source, "fuzz.mt");
    const compact = formatMote(ast, "compact");
    const readable = formatMote(ast, "readable");
    if (JSON.stringify(parse(compact, "compact.mt"), strip) !== JSON.stringify(ast, strip)) fail(`compact formatter changed semantics ${i}`, source);
    if (JSON.stringify(parse(readable, "readable.mt"), strip) !== JSON.stringify(ast, strip)) fail(`readable formatter changed semantics ${i}`, source);
    const tsResult = ts.transpileModule(result.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    if (tsResult.diagnostics?.some((d) => d.category === ts.DiagnosticCategory.Error)) fail(`emitted TypeScript is not syntactically valid ${i}`, source);
    else emitted++;
  } catch (error) { fail(`valid program pipeline crashed ${i}`, source, error); }
}

console.log(`${failed ? "FAIL" : "PASS"} fuzz cases=${cases} seed=${seed} malformed=${malformed} valid=${valid} emitted=${emitted}`);
process.exit(failed ? 1 : 0);

function arbitrarySource(i) {
  const fragments = ["", "let =", "fn f(=1", "type X={a:num", "@", "use", "[]", "{}", "let x=", "fn f()->=1", "// comment\nlet x=1", "'unterminated", `${pick(["let", "type", "fn", "???"])} ${i}`];
  return pick(fragments);
}

function validProgram(i) {
  const a = Math.floor(next() * 1000), b = Math.floor(next() * 1000) + 1;
  const op = pick(["+", "-", "*", "%"]);
  const suffix = pick([`let n=${a}${op}${b}`, `let xs=[${a},${b}]`, `let o={value:${a}}`, `let x=${a}?"ok":"no"`, `fn id(x:num)->num=x`]);
  return `fn calc(a:num,b:num)->num=a${op}b\n${suffix}`;
}

function strip(key, value) { return key === "line" || key === "col" ? undefined : value; }
