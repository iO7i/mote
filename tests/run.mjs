// Mote compiler test suite (no external deps).
// Categories: parser, checker(+), diagnostics(-), emitter, runtime, formatter,
// end-to-end, source-map. Run: `node tests/run.mjs` or `mote test`.

import { pathToFileURL } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "../src/parser.mjs";
import { check } from "../src/checker.mjs";
import { compile } from "../src/compile.mjs";
import { formatMote } from "../src/formatter.mjs";
import { validate, json, unwrap, MoteValidationError } from "../src/runtime/mote.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(HERE, "../src/runtime/mote.mjs");

let passed = 0, failed = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; fails.push(`FAIL ${name}${detail ? `\n     ${detail}` : ""}`); }
}
function group(title) { console.log(`\n# ${title}`); }

// ------------------------------------------------------------ helpers
const emit = (src, opts = {}) => compile(src, { file: "<t>", ...opts }).code;
const diags = (src) => compile(src, { file: "<t>" }).diagnostics;
const codes = (src) => diags(src).items.map((d) => d.code);
const clean = (src) => !diags(src).hasErrors;
const strip = (k, v) => (k === "line" || k === "col" ? undefined : v);
const astJson = (src) => JSON.stringify(parse(src, "<t>"), strip);

// ============================================================ PARSER
group("parser");
{
  ok("empty program", parse("", "<t>").body.length === 0);

  // primitives as types (generated)
  for (const p of ["str", "num", "bool", "nil", "unknown", "any"]) {
    const ast = parse(`type X=${p}`, "<t>");
    ok(`type alias primitive ${p}`, ast.body[0].type.name === p);
  }

  // operators parse with correct precedence (generated)
  const opCases = [
    ["a+b*c", "Binary", "+"],
    ["a*b+c", "Binary", "+"],
    ["a||b&&c", "Binary", "||"],
    ["a==b||c", "Binary", "||"],
    ["a??b??c", "Binary", "??"],
  ];
  for (const [expr, kind, top] of opCases) {
    const e = parse(`let x=${expr}`, "<t>").body[0].init;
    ok(`precedence root of ${expr}`, e.kind === kind && e.op === top, JSON.stringify(e));
  }

  ok("member+call chain", (() => {
    const e = parse(`let x=a.b(c).d`, "<t>").body[0].init;
    return e.kind === "Member" && e.prop === "d" && e.obj.kind === "Call";
  })());

  ok("optional type T?", parse("type X=str?", "<t>").body[0].type.kind === "TOptional");
  ok("union type A|B", parse("type X=str|num", "<t>").body[0].type.kind === "TUnion");
  ok("array type [T]", parse("type X=[num]", "<t>").body[0].type.kind === "TArray");
  ok("object type", parse("type X={a:num,b:str?}", "<t>").body[0].type.fields.length === 2);
  ok("nested object type", parse("type X={a:{b:num}}", "<t>").body[0].type.fields[0].type.kind === "TObject");

  ok("fn with generics", (() => {
    const f = parse("fn first<T>(items:[T])->T=items", "<t>").body[0];
    return f.typeParams[0] === "T" && f.params[0].type.kind === "TArray";
  })());

  ok("json<T>() generic call", (() => {
    const e = parse("let x=json<Event>(raw)", "<t>").body[0].init;
    return e.kind === "Call" && e.typeArgs[0].name === "Event";
  })());

  ok("try/unwrap postfix ?", parse("let x=json<E>(r)?", "<t>").body[0].init.kind === "Try");
  ok("ternary vs unwrap disambiguation", (() => {
    const t = parse("let x=a?b:c", "<t>").body[0].init;
    return t.kind === "Ternary";
  })());

  ok("keyword as member name (.type)", parse("let x=e.type", "<t>").body[0].init.prop === "type");
  ok("pub fn flagged", parse("pub fn f()=1", "<t>").body[0].pub === true);
  ok("multiline == single line", astJson("fn t(m)=m.a+m.b") === astJson("fn t(m)=m.a+\n  m.b"));

  // parse errors
  for (const bad of ["fn f(=1", "type =num", "let =1", "let x=", "fn f()->=1"]) {
    let threw = false;
    try { parse(bad, "<t>"); } catch (e) { threw = !!e.mote; }
    ok(`rejects malformed: ${bad}`, threw);
  }
}

// ============================================================ CHECKER (+)
group("checker positive");
{
  ok("acceptance example type-checks", (() => {
    const src = `use "node:crypto" as crypto
type Money={subtotal:num,currency:str?}
type Event={type:str,data:{money:Money}}
fn total(e:Event)->num=e.data.money.subtotal
fn reply(e:Event)={ok:e.type=="x",amount:total(e),currency:e.data.money.currency??"SAR"}
let e=json<Event>('{}')?
console.log(reply(e))`;
    return clean(src);
  })());

  ok("infers local return type", clean("fn add(a:num,b:num)->num=a+b"));
  ok("inferred fn (no annotations) ok", clean("fn f(a,b)=a+b"));
  ok("nullish fallback narrows optional", clean("type M={c:str?}\nfn f(m:M)->str=m.c??\"d\""));
  ok("ternary result type", clean("fn f(x:bool)->num=x?1:2"));
  ok("optional field access via ??", clean("type M={c:str?}\nfn f(m:M)->str=m.c??\"z\""));
  ok("array element access", clean("fn f(xs:[num])->num=xs[0]+1"));
  ok("nested named types resolve", clean("type A={b:B}\ntype B={c:num}\nfn f(a:A)->num=a.b.c"));
  ok("union assignment ok", clean("type Id=str|num\nfn f()->Id=1"));
  ok("import member access is external/any", clean(`use "x" as x\nfn f()->num=x.anything(1)`));
}

// ============================================================ DIAGNOSTICS (-)
group("diagnostics negative");
{
  const neg = [
    ["M101", "fn f()->num=ghost"],
    ["M102", "fn f()=1\nfn f()=2"],
    ["M102", "type A=num\ntype A=str"],
    ["M110", "fn f(x:Nope)->num=1"],
    ["M201", "type M={c:str?}\nfn f(m:M)->num=m.c.length"],
    ["M202", "type M={a:num}\nfn f(m:M)->num=m.b"],
    ["M202", "fn f(x:num)->num=x.y"],
    ["M301", "fn g(a:num)=a\nfn f()=g(1,2)"],
    ["M302", "fn g(a:num)=a\nfn f()=g(\"s\")"],
    ["M310", "let x=json<num>(\"1\")"],
    ["M401", "fn f()->num=\"s\""],
    ["M410", "fn f(s:str)->num=s+1"],
    ["M420", "pub fn f(a)=a"],
    ["M501", "fn f(x:num)->num=x?"],
  ];
  for (const [code, src] of neg) {
    const cs = codes(src);
    ok(`${code} fires`, cs.includes(code), `got [${cs.join(",")}] for: ${src.replace(/\n/g, " ; ")}`);
  }
  // clean programs must NOT emit that error
  ok("no false M201 on required field", !codes("type M={a:num}\nfn f(m:M)->num=m.a").includes("M201"));
  ok("no false M410 on num add", !codes("fn f(a:num,b:num)->num=a+b").includes("M410"));
}

// ============================================================ EMITTER
group("emitter");
{
  ok("use -> import", emit(`use "node:crypto" as crypto`).includes(`import * as crypto from "node:crypto";`));
  ok("pub fn -> export + annotations", emit("pub fn add(a:num,b:num)->num=a+b")
    .includes("export function add(a: number, b: number): number"));
  ok("== -> ===", emit("fn f(x:str)->bool=x==\"y\"").includes('x === "y"'));
  ok("type decl -> ts type", emit("type M={a:num,b:str?}").includes("type M = { a: number; b?: string };"));
  ok("optional field ?", emit("type M={c:str?}").includes("c?: string"));
  ok("schema emitted for runtime", emit("type E={a:num}\nlet x=json<E>(\"1\")?").includes('$schemas["E"]'));
  ok("json -> $mote.json with generic", emit("type E={a:num}\nlet x=json<E>(\"1\")?").includes('$mote.json<E>('));
  ok("try -> $mote.unwrap", emit("type E={a:num}\nlet x=json<E>(\"1\")?").includes("$mote.unwrap("));
  ok("cast<T> -> (v as T), no runtime", (() => {
    const c = emit("type U={id:num}\nfn f(x:any)->U=cast<U>(x)");
    return c.includes("(x as U)") && !c.includes("$mote") && !c.includes("$schemas");
  })());
  ok("?? preserved", emit("type M={c:str?}\nfn f(m:M)->str=m.c??\"d\"").includes('?? "d"'));
  ok("JS mode drops annotations", (() => {
    const js = emit("pub fn add(a:num,b:num)->num=a+b", { emitTypes: false });
    return js.includes("function add(a, b)") && !js.includes(": number");
  })());
  ok("JS mode drops type decls", !emit("type M={a:num}\nlet x=1", { emitTypes: false }).includes("type M"));
  ok("nested object indentation", emit("fn r()={a:1,inner:{b:2}}").includes(
    "  return {\n    a: 1,\n    inner: {\n      b: 2,\n    },\n  };"));
}

// ============================================================ RUNTIME
group("runtime validation");
{
  const reg = {
    Money: { k: "object", fields: [
      { name: "subtotal", optional: false, schema: { k: "num" } },
      { name: "currency", optional: true, schema: { k: "str" } },
    ] },
    Order: { k: "object", fields: [
      { name: "id", optional: false, schema: { k: "str" } },
      { name: "money", optional: false, schema: { k: "ref", name: "Money" } },
      { name: "tags", optional: false, schema: { k: "array", element: { k: "str" } } },
    ] },
  };
  const V = (v, name) => validate(v, { k: "ref", name }, reg, "$");

  ok("valid money", V({ subtotal: 1, currency: "SAR" }, "Money").ok);
  ok("optional field absent ok", V({ subtotal: 1 }, "Money").ok);
  ok("wrong primitive fails", !V({ subtotal: "x" }, "Money").ok);
  ok("path on wrong primitive", V({ subtotal: "x" }, "Money").error.path === "$.subtotal");
  ok("expected on wrong primitive", V({ subtotal: "x" }, "Money").error.expected === "num");
  ok("got on wrong primitive", V({ subtotal: "x" }, "Money").error.got === "str");
  ok("missing required field fails", !V({}, "Money").ok);
  ok("missing required path", V({}, "Money").error.path === "$.subtotal");
  ok("nested ref valid", V({ id: "a", money: { subtotal: 1 }, tags: [] }, "Order").ok);
  ok("nested ref failure path", V({ id: "a", money: { subtotal: "x" }, tags: [] }, "Order").error.path === "$.money.subtotal");
  ok("array valid", V({ id: "a", money: { subtotal: 1 }, tags: ["x", "y"] }, "Order").ok);
  ok("array member failure path", V({ id: "a", money: { subtotal: 1 }, tags: ["x", 2] }, "Order").error.path === "$.tags[1]");
  ok("array non-array fails", !V({ id: "a", money: { subtotal: 1 }, tags: "no" }, "Order").ok);

  // primitive matrix
  const prims = [
    ["str", "hi", 1], ["num", 1, "x"], ["bool", true, 1], ["nil", null, 1],
  ];
  for (const [k, good, bad] of prims) {
    ok(`prim ${k} accepts`, validate(good, { k }, {}, "$").ok);
    ok(`prim ${k} rejects`, !validate(bad, { k }, {}, "$").ok);
  }

  // union
  const uni = { k: "union", options: [{ k: "str" }, { k: "num" }] };
  ok("union accepts str", validate("a", uni, {}, "$").ok);
  ok("union accepts num", validate(1, uni, {}, "$").ok);
  ok("union rejects bool", !validate(true, uni, {}, "$").ok);

  // json() parse error
  ok("json parse error is Result", json("{bad", {}, "X").ok === false);
  ok("json parse error path $", json("{bad", {}, "X").error.path === "$");

  // unwrap
  ok("unwrap returns value", unwrap({ ok: true, value: 42 }) === 42);
  let threw = null;
  try { unwrap({ ok: false, error: { path: "$.a", expected: "num", got: "str" } }); }
  catch (e) { threw = e; }
  ok("unwrap throws MoteValidationError", threw instanceof MoteValidationError);
  ok("unwrap error message format", threw && threw.message === "$.a expected num, got str");
}

// ============================================================ FORMATTER
group("formatter round-trip");
{
  const samples = [
    `type Money={subtotal:num,currency:str?}`,
    `fn add(a:num,b:num)->num=a+b`,
    `pub fn valid(b:str,s:str)->bool=eq(sign(b,s),s)`,
    `fn reply(e:Event)={ok:e.type=="x",amount:total(e),currency:e.money.currency??"SAR"}`,
    `let e=json<Event>(raw)?`,
    `type Id=str|num`,
    `fn f(x:bool)->num=x?1:2`,
  ];
  for (const s of samples) {
    const prog = parse(s, "<t>");
    const compact = formatMote(prog, "compact");
    const readable = formatMote(prog, "readable");
    const a = JSON.stringify(parse(compact, "<t>"), strip);
    const b = JSON.stringify(parse(readable, "<t>"), strip);
    const orig = JSON.stringify(prog, strip);
    ok(`round-trip compact==orig: ${s.slice(0, 24)}`, a === orig, compact);
    ok(`round-trip readable==compact: ${s.slice(0, 24)}`, a === b, `${compact}\n---\n${readable}`);
  }
}

// ============================================================ END-TO-END
group("end-to-end run");
async function runProgram(src) {
  const { code } = compile(src, {
    file: "<t>", emitTypes: false, runtimeImport: pathToFileURL(RUNTIME).href,
  });
  const tmp = join(HERE, `.e2e-${Math.abs(hash(src))}.mjs`);
  writeFileSync(tmp, code);
  const out = [];
  const orig = console.log;
  console.log = (...a) => out.push(a.map(fmt).join(" "));
  try { await import(pathToFileURL(tmp).href); }
  finally { console.log = orig; try { unlinkSync(tmp); } catch { /* */ } }
  return out.join("\n");
}
function fmt(v) { return typeof v === "object" ? JSON.stringify(v) : String(v); }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

const e2e = [
  [`fn add(a:num,b:num)->num=a+b\nconsole.log(add(2,3))`, "5"],
  [`let x=1?"a":"b"\nconsole.log(x)`, "a"],
  [`type M={c:str?}\nfn f(m:M)->str=m.c??"d"\nconsole.log(f({}))`, "d"],
  [`type E={type:str}\nlet e=json<E>('{"type":"ok"}')?\nconsole.log(e.type)`, "ok"],
  [`console.log([1,2,3])`, "[1,2,3]"],
];
for (const [src, want] of e2e) {
  try {
    const got = await runProgram(src);
    ok(`e2e: ${src.split("\n").pop().slice(0, 30)}`, got.trim() === want, `got ${JSON.stringify(got)} want ${want}`);
  } catch (e) { ok(`e2e: ${src.slice(0, 24)}`, false, String(e.message)); }
}
// e2e validation failure throws with path
try {
  await runProgram(`type M={a:num}\ntype E={m:M}\nlet e=json<E>('{"m":{"a":"x"}}')?\nconsole.log(e.m.a)`);
  ok("e2e invalid payload throws", false, "did not throw");
} catch (e) {
  ok("e2e invalid payload throws with path", e instanceof MoteValidationError && e.message === "$.m.a expected num, got str", e.message);
}

// ============================================================ SOURCE MAP
group("source map");
{
  const r = compile(`fn f()->num=1\nlet x=f()`, { file: "a.mt", emitTypes: true });
  const map = JSON.parse(r.sourceMap("a.ts"));
  ok("sourcemap v3", map.version === 3);
  ok("sourcemap sources", map.sources[0] === "a.mt");
  ok("sourcemap has content", typeof map.sourcesContent[0] === "string");
  ok("sourcemap mappings non-empty", map.mappings.length > 0);
  const positions = r.positionMap();
  ok("position map preserves source columns", positions.length >= 2 && positions.every((p) => p.source.column >= 0));
  ok("generated position maps back to Mote", positions[0].source.line === 1 && positions[0].generated.line === 1);
}

// ============================================================ REPORT
console.log(`\n${"=".repeat(48)}`);
if (fails.length) console.log(fails.join("\n") + "\n");
console.log(`${passed} passed, ${failed} failed  (total ${passed + failed})`);
process.exit(failed === 0 ? 0 : 1);
