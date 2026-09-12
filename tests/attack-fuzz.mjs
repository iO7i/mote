// Deterministic compiler attack campaign. This is intentionally broader than
// the smoke fuzz suite: inputs are grammar-shaped, stress bounded resources,
// and exercise malformed, unicode, deep, runtime-boundary, and import cases.
// A compiler throw is minimized and archived; diagnostics are expected input
// containment, not failures.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.mjs";
import { parse } from "../src/parser.mjs";
import { formatMote } from "../src/formatter.mjs";
import { minimizeCompilerFailure } from "./minimize.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const corpus = fileURLToPath(new URL("./crash-corpus/", import.meta.url));
const casesArg = process.argv.indexOf("--cases");
const cases = Math.max(1, Number(casesArg >= 0 ? process.argv[casesArg + 1] : 1024));
const seedArg = process.argv.indexOf("--seed");
const seed = Number(seedArg >= 0 ? process.argv[seedArg + 1] : 0xA771F00D) >>> 0;
let state = seed;
const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const pick = (items) => items[Math.floor(next() * items.length)];
const stats = { total: cases, contained: 0, clean: 0, malformed: 0, crashes: 0, metamorphicChecks: 0, metamorphicFailures: 0, byShape: {}, nodeKinds: {}, diagnostics: {}, maxSourceChars: 0, maxDepth: 0 };
const failures = [];

for (let i = 0; i < cases; i++) {
  const shape = shapeFor(i);
  stats.byShape[shape] = (stats.byShape[shape] ?? 0) + 1;
  const source = makeSource(shape, i);
  stats.maxSourceChars = Math.max(stats.maxSourceChars, source.length);
  stats.maxDepth = Math.max(stats.maxDepth, nesting(source));
  let result;
  try {
    result = compile(source, { file: `attack-${seed}-${i}.mt` });
    stats.contained++;
  } catch (error) {
    stats.crashes++;
    const minimized = minimizeCompilerFailure(source, {
      seed, phase: "attack-fuzz", failureClass: error?.mote?.phase ?? "unexpected-throw",
      predicate: (candidate) => { try { compile(candidate, { file: "minimized.mt" }); return false; } catch { return true; } },
      maxIterations: 180,
    });
    mkdirSync(corpus, { recursive: true });
    const id = `attack-${seed}-${i}-${minimized.sha256.slice(0, 12)}`;
    writeFileSync(join(corpus, `${id}.mt`), minimized.source);
    writeFileSync(join(corpus, `${id}.json`), JSON.stringify({ ...minimized, case: i, shape, originalSource: source }, null, 2) + "\n");
    failures.push({ case: i, shape, sourceHash: hash(source), crash: String(error?.message ?? error), minimized: minimized.sha256 });
    continue;
  }
  if (result.diagnostics.hasErrors) {
    stats.malformed++;
    for (const diagnostic of result.diagnostics.errors) stats.diagnostics[diagnostic.code] = (stats.diagnostics[diagnostic.code] ?? 0) + 1;
    continue;
  }
  stats.clean++;
  try {
    const ast = parse(source, `attack-${i}.mt`);
    walk(ast);
    // Metamorphic property: whitespace/readability projections reparse to the
    // same structural program, and their compilation remains diagnostic-free.
    for (const mode of ["compact", "readable"]) {
      const projection = formatMote(ast, mode);
      const reparsed = parse(projection, `${mode}-${i}.mt`);
      stats.metamorphicChecks++;
      if (reparsed.body.map((s) => s.kind).join(",") !== ast.body.map((s) => s.kind).join(",") || compile(projection).diagnostics.hasErrors) {
        stats.metamorphicFailures++;
        failures.push({ case: i, shape, sourceHash: hash(source), metamorphic: mode });
      }
    }
  } catch (error) {
    stats.crashes++;
    failures.push({ case: i, shape, sourceHash: hash(source), pipelineError: String(error?.message ?? error) });
  }
}

const report = {
  schemaVersion: 1,
  campaign: "compiler-attack-fuzz",
  status: stats.crashes || stats.metamorphicFailures ? "FAIL" : "PASS",
  seed, cases,
  bounds: { maxSourceChars: 1_000_000, maxTokens: 100_000, generatorMaxStringChars: 4096, generatorMaxDepth: 48 },
  stats,
  failures,
  reproducibility: { command: `node tests/attack-fuzz.mjs --cases ${cases} --seed ${seed}`, sourceRevision: process.env.MOTE_SOURCE_REVISION ?? "working-tree" },
};
mkdirSync(join(root, "bench", "raw"), { recursive: true });
writeFileSync(join(root, "bench", "raw", "attack-fuzz-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === "PASS" ? 0 : 1);

function shapeFor(i) {
  return ["grammar", "records", "optional-null", "deep", "unicode-long", "invalid", "imports-runtime"][i % 7];
}

function makeSource(shape, i) {
  switch (shape) {
    case "grammar": return `fn calc(a:num,b:num)->num=${expr(Math.min(4, i % 6))}`;
    case "records": return `type R={id:num,name:str,meta:{active:bool,score:num?}}\nfn read(r:R)->num=r.meta.score??0`;
    case "optional-null": return `type R={value:num?}\nfn read(r:R)->num=r.value??${i % 3}`;
    case "deep": return `fn deep()->num=${"(".repeat(12 + (i % 30))}1${")".repeat(12 + (i % 30))}`;
    case "unicode-long": return `fn text()->str="${i % 2 ? "مرحبا" : "λ"}${"x".repeat(128 + (i % 7) * 257)}"`;
    case "invalid": return pick(["fn =", "type R={x:num", "let =", "@", "fn f()->num=ghost.", "use \"x\"", "fn f()->num=1?", "type =str"]);
    case "imports-runtime": return i % 2
      ? `use "node:fs" as fs\nfn probe()->num=fs.read(1)`
      : `type R={value:num}\nfn decode(raw:str)->num=json<R>(raw)?.value??0`;
    default: return "fn f()->num=0";
  }
}

function expr(depth) {
  if (depth <= 0) return pick(["0", "1", String(Math.floor(next() * 99)), "-2"]);
  const choices = [
    () => `${expr(depth - 1)}+${expr(depth - 1)}`,
    () => `${expr(depth - 1)}*${expr(depth - 1)}`,
    () => `${expr(depth - 1)}>${expr(depth - 1)}`,
    () => `true?${expr(depth - 1)}:${expr(depth - 1)}`,
    () => `[${expr(depth - 1)},${expr(depth - 1)}][0]`,
    () => `{value:${expr(depth - 1)}}.value`,
  ];
  return pick(choices)();
}

function walk(node) {
  if (!node || typeof node !== "object") return;
  if (typeof node.kind === "string") stats.nodeKinds[node.kind] = (stats.nodeKinds[node.kind] ?? 0) + 1;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) walk(item);
    else if (value && typeof value === "object") walk(value);
  }
}

function nesting(source) {
  let depth = 0, max = 0;
  for (const c of source) {
    if (c === "(" || c === "[" || c === "{") max = Math.max(max, ++depth);
    if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
  }
  return max;
}

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
