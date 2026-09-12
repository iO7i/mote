// Research-grade compiler mutation campaign.
//
// Mutants are generated from explicit, reviewable source rules. Each mutant
// is run in a fresh source copy and classified from the behavioral oracle:
// KILLED, SURVIVED, EQUIVALENT, or INVALID_MUTANT. The catalog deliberately
// reports invalid and surviving mutants instead of hiding them in a score.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gitSha } from "../bench/protocol.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "bench", "raw");

// These are deliberately small local edits, not random text corruption. The
// rules cover the lexer/parser/checker/emitter/schema/runtime/diagnostic and
// source-map surfaces. A rule may select one occurrence per file; selection is
// recorded in the result so a source drift becomes an explicit INVALID case.
const RULES = [
  ["lexer", "src/lexer.mjs", /if \(src\.length > MAX_SOURCE_CHARS\)/, "if (src.length >= MAX_SOURCE_CHARS)"],
  ["lexer", "src/lexer.mjs", /if \(tokens\.length >= MAX_TOKENS\)/, "if (tokens.length > MAX_TOKENS)"],
  ["lexer", "src/lexer.mjs", /if \(c === \" \" \|\| c === \"\\t\" \|\| c === \"\\r\"\)/, "if (c === \" \" || c === \"\\t\")"],
  ["lexer", "src/lexer.mjs", /if \(c === \"\\n\"\)/, "if (c === \"\\r\")"],
  ["lexer", "src/lexer.mjs", /KEYWORDS\.has\(word\) \? word : \"ident\"/, "false ? word : \"ident\""],
  ["lexer", "src/lexer.mjs", /if \(SINGLE_CHAR_OPS\.includes\(c\)\)/, "if (false && SINGLE_CHAR_OPS.includes(c))"],
  ["lexer", "src/lexer.mjs", /if \(c === \"\/\" && src\[i \+ 1\] === \"\/\"\)/, "if (false && c === \"\/\" && src[i + 1] === \"\/\")"],
  ["lexer", "src/lexer.mjs", /if \(src\[j\] === \"\\\\\"\)/, "if (false && src[j] === \"\\\\\")"],
  ["parser", "src/parser.mjs", /if \(at\("use"\)\) return parseUse\(\);/, "if (false && at(\"use\")) return parseUse();"],
  ["parser", "src/parser.mjs", /if \(at\("type"\)\) return parseTypeDecl\(\);/, "if (false && at(\"type\")) return parseTypeDecl();"],
  ["parser", "src/parser.mjs", /if \(at\("let"\)\) return parseLet\(\);/, "if (false && at(\"let\")) return parseLet();"],
  ["parser", "src/parser.mjs", /if \(at\("pub"\)\) \{ next\(\); pub = true; \}/, "if (false && at(\"pub\")) { next(); pub = true; }"],
  ["parser", "src/parser.mjs", /parseBinary\(prec \+ 1\)/, "parseBinary(prec)"],
  ["parser", "src/parser.mjs", /if \(!atOp\("\?"\)\) return cond;/, "if (true) return cond;"],
  ["parser", "src/parser.mjs", /while \(atOp\("\?"\)\) \{ next\(\); t = \{ kind: "TOptional", inner: t \}; \}/, "if (false && atOp(\"?\")) { next(); t = { kind: \"TOptional\", inner: t }; }"],
  ["parser", "src/parser.mjs", /const element = parseType\(\);/, "const element = parsePrimaryType();"],
  ["parser", "src/parser.mjs", /const fields = \[\];/, "const fields = null;"],
  ["parser", "src/parser.mjs", /if \(t\.type === "ident" \|\| t\.type === "nil"\)/, "if (t.type === \"ident\")"],
  ["parser", "src/parser.mjs", /if \(kt\.type === "str"\)/, "if (false && kt.type === \"str\")"],
  ["parser", "src/parser.mjs", /while \(eat\("op", "\|"\)\) options\.push\(parseOptionalType\(\)\);/, "if (false && eat(\"op\", \"|\")) options.push(parseOptionalType());"],
  ["parser", "src/parser.mjs", /if \(atOp\("\["\)\) return parseArray\(\);/, "if (false && atOp(\"[\")) return parseArray();"],
  ["checker", "src/checker.mjs", /if \(rot\.t === "opt"\) \{/, "if (false && rot.t === \"opt\") {"],
  ["checker", "src/checker.mjs", /if \(rot\.t === "any" \|\| rot\.t === "unknown"\) return ANY;/, "if (rot.t === \"any\") return ANY;"],
  ["checker", "src/checker.mjs", /return f\.optional \? T\.opt\(f\.type\) : f\.type;/, "return f.type;"],
  ["checker", "src/checker.mjs", /if \(node\.op === "!"\) return BOOL;/, "if (false && node.op === \"!\") return BOOL;"],
  ["checker", "src/checker.mjs", /if \("\+-\*\/%"\.includes\(op\) && op\.length === 1\) \{/, "if (false && \"+-*/%\".includes(op) && op.length === 1) {"],
  ["checker", "src/checker.mjs", /if \(\["==", "!=", "<", ">", "<=", ">="\]\.includes\(op\)\) return BOOL;/, "if ([\"==\", \"!=\", \"<\", \">\", \"<=\", \">=\"].includes(op)) return NUM;"],
  ["checker", "src/checker.mjs", /if \(op === "&&" \|\| op === "\|\|"\) return BOOL;/, "if (false && (op === \"&&\" || op === \"||\")) return BOOL;"],
  ["checker", "src/checker.mjs", /if \(op === "\?\?"\) \{/, "if (false && op === \"??\") {"],
  ["types", "src/types.mjs", /if \(sup\.t === "any" \|\| sub\.t === "any"\) return true;/, "if (sup.t === \"any\" || sub.t === \"any\") return false;"],
  ["types", "src/types.mjs", /if \(sup\.t === "unknown"\) return true;/, "if (sup.t === \"unknown\") return false;"],
  ["types", "src/types.mjs", /if \(sub\.t === "never"\) return true;/, "if (sub.t === \"never\") return false;"],
  ["types", "src/types.mjs", /if \(sup\.t === "opt"\) \{/, "if (false && sup.t === \"opt\") {"],
  ["types", "src/types.mjs", /if \(sub\.t === "union"\) return sub\.options\.every\(\(o\) => assignable\(o, sup, env\)\);/, "if (false && sub.t === \"union\") return sub.options.every((o) => assignable(o, sup, env));"],
  ["types", "src/types.mjs", /if \(sup\.t === "union"\) return sup\.options\.some\(\(o\) => assignable\(sub, o, env\)\);/, "if (false && sup.t === \"union\") return sup.options.some((o) => assignable(sub, o, env));"],
  ["emitter", "src/emitter.mjs", /const OPMAP = \{ "==": "===", "!=": "!==" \};/, "const OPMAP = { \"==\": \"!==\", \"!=\": \"!==\" };"],
  ["emitter", "src/emitter.mjs", /case "Ternary": return 1;/, "case \"Ternary\": return 2;"],
  ["emitter", "src/emitter.mjs", /case "Try": return 10;/, "case \"Try\": return 9;"],
  ["emitter", "src/emitter.mjs", /if \(i > 0\) lines\.push\(""\);/, "if (false && i > 0) lines.push(\"\");"],
  ["emitter", "src/emitter.mjs", /const genCol = ln\.length - ln\.trimStart\(\)\.length;/, "const genCol = 0;"],
  ["emitter", "src/emitter.mjs", /if \(emitTypes\) \{/, "if (false && emitTypes) {"],
  ["emitter", "src/emitter.mjs", /if \(ctx\.needsRuntime && ctx\.typeDecls\?\.length\) push\(/, "if (false && ctx.needsRuntime && ctx.typeDecls?.length) push("],
  ["emitter", "src/emitter.mjs", /case "Bool": return node\.value \? "true" : "false";/, "case \"Bool\": return \"true\";"],
  ["emitter", "src/emitter.mjs", /case "Nil": return "null";/, "case \"Nil\": return \"undefined\";"],
  ["emitter", "src/emitter.mjs", /const p = PREC\[node\.op\];/, "const p = 0;"],
  ["emitter", "src/emitter.mjs", /let need = cp < parentPrec \|\| \(cp === parentPrec && side === "right"\);/, "let need = false;"],
  ["emitter", "src/emitter.mjs", /const pad = "  "\.repeat\(indent \+ 1\);/, "const pad = \"\";"],
  ["emitter", "src/emitter.mjs", /return \{ code, lineMap \};/, "return { code: lines.join(\"\\n\"), lineMap };"],
  ["diagnostics", "src/diagnostics.mjs", /mote\?\.code \?\? "M001"/, "\"M902\""],
  ["diagnostics", "src/diagnostics.mjs", /this\.items\.filter\(\(d\) => d\.severity === "error"\)/, "this.items.filter(() => false)"],
  ["diagnostics", "src/diagnostics.mjs", /const sev = d\.severity === "error" \? "error" : "warning";/, "const sev = d.severity === \"error\" ? \"warning\" : \"error\";"],
  ["schema", "src/schema.mjs", /\$\{wrapUnionMember\(type\.inner\)\} \| undefined/, "${wrapUnionMember(type.inner)} | null"],
  ["schema", "src/schema.mjs", /if \(type\.t === "union" \|\| type\.t === "fn"\)/, "if (false && (type.t === \"union\" || type.t === \"fn\"))"],
  ["schema", "src/schema.mjs", /f\.optional \? "\?" : ""/, "f.optional ? \"\" : \"\""],
  ["runtime", "src/runtime/mote.mjs", /if \(depth > 128\) return err\(/, "if (depth > 0) return err("],
  ["runtime", "src/runtime/mote.mjs", /return value === null \? ok\(value\) : err\(path, "nil", typeName\(value\)\);/, "return value === undefined ? ok(value) : err(path, \"nil\", typeName(value));"],
  ["runtime", "src/runtime/mote.mjs", /throw new MoteValidationError\(result\.error\);/, "return result.value;"],
  ["runtime", "src/runtime/mote.mjs", /case "unknown":/, "case \"never\":"],
  ["runtime", "src/runtime/mote.mjs", /if \(Array\.isArray\(v\)\) return "array";/, "if (false && Array.isArray(v)) return \"array\";"],
  ["source-map", "src/emitter.mjs", /prevSrcCol = m\.srcCol \?\? 0;/, "prevSrcCol = 0;"],
];

function makeCatalog() {
  return RULES.map(([category, file, pattern, replacement], index) => ({
    id: `M${String(index + 1).padStart(3, "0")}`,
    category, file, pattern: String(pattern), replacement,
  }));
}

function applyMutation(dir, mutant) {
  const path = join(dir, mutant.file);
  if (!existsSync(path)) return { ok: false, reason: "target file missing" };
  const source = readFileSync(path, "utf8");
  const body = mutant.pattern.slice(1, mutant.pattern.lastIndexOf("/"));
  const flags = mutant.pattern.slice(mutant.pattern.lastIndexOf("/") + 1).replace("g", "");
  const pattern = new RegExp(body, `${flags}g`);
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) return { ok: false, reason: `expected one site, found ${matches.length}` };
  writeFileSync(path, source.replace(pattern, mutant.replacement));
  return { ok: true };
}

function runOracle(dir) {
  return spawnSync(process.execPath, ["mutation-oracle.mjs"], {
    cwd: dir, encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
}

function classify(run, baselineDigest) {
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  if (run.error?.code === "ETIMEDOUT" || run.signal) return { outcome: "INVALID_MUTANT", valid: false, reason: "oracle timeout" };
  if (run.status !== 0) {
    const invalid = /SyntaxError|Unexpected token|Cannot find module|does not provide an export/i.test(output);
    return { outcome: invalid ? "INVALID_MUTANT" : "KILLED", valid: !invalid, reason: output.slice(-500) };
  }
  const digest = output.match(/ORACLE_DIGEST:([0-9a-f]+)/)?.[1] ?? null;
  return digest === baselineDigest
    ? { outcome: "EQUIVALENT", valid: true, digest }
    : { outcome: "SURVIVED", valid: true, digest, reason: "oracle digest changed without an assertion failure" };
}

const baselineDir = mkdtempSync(join(tmpdir(), "mote-mutation-baseline-"));
cpSync(join(ROOT, "src"), join(baselineDir, "src"), { recursive: true });
cpSync(join(ROOT, "tests", "mutation-oracle.mjs"), join(baselineDir, "mutation-oracle.mjs"));
const baselineRun = runOracle(baselineDir);
const baselineDigest = `${baselineRun.stdout ?? ""}`.match(/ORACLE_DIGEST:([0-9a-f]+)/)?.[1];
if (baselineRun.status !== 0 || !baselineDigest) {
  console.error(`${baselineRun.stdout ?? ""}${baselineRun.stderr ?? ""}`);
  rmSync(baselineDir, { recursive: true, force: true });
  process.exit(2);
}
rmSync(baselineDir, { recursive: true, force: true });

const results = [];
for (const mutant of makeCatalog()) {
  const dir = mkdtempSync(join(tmpdir(), `mote-mutant-${mutant.id}-`));
  try {
    cpSync(join(ROOT, "src"), join(dir, "src"), { recursive: true });
    cpSync(join(ROOT, "tests", "mutation-oracle.mjs"), join(dir, "mutation-oracle.mjs"));
    const applied = applyMutation(dir, mutant);
    if (!applied.ok) {
      results.push({ ...mutant, generated: true, valid: false, outcome: "INVALID_MUTANT", reason: applied.reason });
      continue;
    }
    results.push({ ...mutant, generated: true, ...classify(runOracle(dir), baselineDigest) });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const counts = Object.fromEntries(["KILLED", "SURVIVED", "EQUIVALENT", "INVALID_MUTANT"].map((status) => [status, results.filter((r) => r.outcome === status).length]));
const valid = results.filter((r) => r.valid);
const report = {
  schemaVersion: 2,
  campaign: "compiler-mutation",
  sourceRevision: gitSha(ROOT),
  generated: results.length,
  valid: valid.length,
  counts,
  mutationScore: valid.length ? counts.KILLED / valid.length : 0,
  byCategory: Object.fromEntries([...new Set(results.map((r) => r.category))].sort().map((category) => [category, {
    generated: results.filter((r) => r.category === category).length,
    killed: results.filter((r) => r.category === category && r.outcome === "KILLED").length,
    survived: results.filter((r) => r.category === category && r.outcome === "SURVIVED").length,
    equivalent: results.filter((r) => r.category === category && r.outcome === "EQUIVALENT").length,
    invalid: results.filter((r) => r.category === category && r.outcome === "INVALID_MUTANT").length,
  }])),
  survivors: results.filter((r) => r.outcome === "SURVIVED").map(({ id, category, file, reason }) => ({ id, category, file, reason })),
  mutants: results,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "compiler-mutation-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, mutants: undefined }, null, 2));
process.exit(counts.SURVIVED || counts.INVALID_MUTANT ? 1 : 0);
