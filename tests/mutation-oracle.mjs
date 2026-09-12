// Behavioral oracle for the generated compiler mutation campaign.
import { createHash } from "node:crypto";
import { lex } from "./src/lexer.mjs";
import { parse } from "./src/parser.mjs";
import { check } from "./src/checker.mjs";
import { compile } from "./src/compile.mjs";
import { formatMote } from "./src/formatter.mjs";
import { explain, controlledDiagnostic } from "./src/diagnostics.mjs";
import { schemaLiteral, tsType } from "./src/schema.mjs";
import { assignable, T, UNKNOWN, NEVER, NUM, NIL } from "./src/types.mjs";
import { validate, unwrap } from "./src/runtime/mote.mjs";

const observations = [];
const equal = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: oracle mismatch`);
  observations.push([label, actual]);
};

equal("lexer-keywords", lex("pub fn f(a:num)->num=a+1").map((t) => t.type), ["pub", "fn", "ident", "op", "ident", "op", "ident", "op", "op", "ident", "op", "ident", "op", "num", "eof"]);
equal("lexer-operators", lex("a==b!=c<=d>=e&&f||g??h").filter((t) => t.type === "op").map((t) => t.value), ["==", "!=", "<=", ">=", "&&", "||", "??"]);
equal("lexer-comment", lex("let x=1 // ignored\nlet y=2").filter((t) => t.type === "ident").map((t) => t.value), ["x", "y"]);
equal("lexer-string", lex("let x=\"a\\\"b\"")[3].value, "\"a\\\"b\"");
equal("lexer-crlf-location", lex("let x=1\r\nlet y=2").find((t) => t.value === "y").line, 2);
equal("lexer-source-limit", (() => { try { lex("a".repeat(1_000_000)); return true; } catch { return false; } })(), true);
equal("lexer-token-limit", (() => { try { lex(Array.from({ length: 99_999 }, () => "a").join(" ")); return true; } catch { return false; } })(), true);

const source = `type Entry={amount:num,fee:num?}\nfn net(e:Entry)->num=e.amount+(e.fee??0)\nfn choose(x:bool)->num=x?1:2`;
const ast = parse(source, "oracle.mt");
equal("parser-kinds", ast.body.map((s) => s.kind), ["TypeDecl", "Fn", "Fn"]);
equal("parser-associativity", compile("fn f()->num=10-3-2").code.includes("10 - (3 - 2)"), false);
equal("parser-use", compile("use \"node:fs\" as fs").program.body[0].kind, "Use");
equal("parser-let", compile("let x=1").program.body[0].kind, "Let");
equal("parser-pub", compile("pub fn f()->num=1").code.includes("export function f"), true);
equal("parser-optional-type", compile("type E={x:num?}").diagnostics.hasErrors, false);
equal("parser-nested-optional-array", compile("fn f(xs:[num?])->num=0").diagnostics.hasErrors, false);
equal("parser-object-type", compile("type E={x:num}").diagnostics.hasErrors, false);
equal("parser-nil-type", compile("type E=nil").diagnostics.hasErrors, false);
equal("parser-string-key", compile("fn f()->{a:num}={\"a\":1}").diagnostics.hasErrors, false);
equal("parser-union-type", compile("type E=num|str").diagnostics.hasErrors, false);
equal("parser-array-expression", compile("fn f()->[num]=[1]").diagnostics.hasErrors, false);
const checked = check(ast, { file: "oracle.mt" });
equal("checker-clean", checked.diagnostics.hasErrors, false);
equal("checker-negative", check(parse("fn f()->num=\"bad\""), { file: "bad.mt" }).diagnostics.errors[0].code, "M401");
equal("checker-optional-access", check(parse("type E={x:num}\nfn f(e:E?)->num=e.x"), { file: "optional.mt" }).diagnostics.errors[0].code, "M201");
equal("checker-arithmetic", check(parse("fn f(s:str)->num=s+1"), { file: "arith.mt" }).diagnostics.errors[0].code, "M410");
equal("checker-comparison-return", check(parse("fn f()->num=1==1"), { file: "comparison.mt" }).diagnostics.errors[0].code, "M401");
equal("checker-logical-return", check(parse("fn f()->num=true&&false"), { file: "logical.mt" }).diagnostics.errors[0].code, "M401");
equal("checker-any-assignable", check(parse("fn f(x:any)->num=x"), { file: "any.mt" }).diagnostics.hasErrors, false);
equal("formatter-roundtrip", parse(formatMote(ast, "compact")).body.map((s) => s.kind), ast.body.map((s) => s.kind));

const compiled = compile(source, { file: "oracle.mt" });
equal("compile-clean", compiled.diagnostics.hasErrors, false);
equal("emitter-types", compiled.code.includes("type Entry") && compiled.code.includes("function net"), true);
equal("emitter-strict-equality", compile("fn f(x:num)->bool=x==1").code.includes("x === 1"), true);
equal("emitter-optional", compile("type E={x:num?}\nfn f(e:E)->num=e.x??0").code.includes("e.x ?? 0"), true);
equal("emitter-ternary", compile("fn f(x:bool)->num=x?1:2").code.includes("x ? 1 : 2"), true);
equal("emitter-object", compile("fn f()->{a:num}={a:1}").code.includes("a: 1"), true);

const map = compiled.positionMap();
equal("source-map-anchors", map.length >= 3 && map[0].source.line === 1, true);
equal("source-map-v3", JSON.parse(compiled.sourceMap("oracle.js")).version, 3);

const schema = { k: "object", fields: [{ name: "amount", optional: false, schema: { k: "num" } }, { name: "fee", optional: true, schema: { k: "num" } }] };
equal("schema-object", schemaLiteral({ t: "object", fields: [{ name: "amount", optional: false, type: { t: "num" } }] }), '{ k: "object", fields: [{ name: "amount", optional: false, schema: { k: "num" } }] }');
equal("runtime-good", validate({ amount: 5 }, schema, {}, "$").ok, true);
equal("runtime-missing", validate({}, schema, {}, "$").error.path, "$.amount");
equal("runtime-wrong", validate({ amount: "5" }, schema, {}, "$").error.expected, "num");
equal("runtime-array", validate({ amount: 1 }, { k: "array", element: { k: "num" } }, {}, "$").ok, false);
equal("runtime-unknown", validate({ arbitrary: true }, { k: "unknown" }, {}, "$").ok, true);
equal("runtime-array-type-name", validate([], { k: "object", fields: [] }, {}, "$").error.got, "array");
let unwrapFailed = false;
try { unwrap({ ok: false, error: { path: "$.x", expected: "num", got: "str" } }); } catch { unwrapFailed = true; }
equal("runtime-unwrap", unwrapFailed, true);

equal("diagnostic-explain", explain("M401").startsWith("M401:"), true);
equal("diagnostic-controlled", controlledDiagnostic({ mote: { phase: "parse", code: "M001", line: 2, col: 3 }, message: "x" }).code, "M001");
equal("types-optional", tsType({ t: "opt", inner: { t: "num" } }), "number | undefined");
equal("types-unknown-target", assignable(UNKNOWN, UNKNOWN, new Map()), true);
equal("types-unknown-to-num", assignable(UNKNOWN, NUM, new Map()), false);
equal("types-never", assignable(NEVER, NUM, new Map()), true);
equal("types-nil-optional", assignable(NIL, T.opt(NUM), new Map()), true);
equal("types-union-target", assignable(NUM, T.union([NUM, { t: "str" }]), new Map()), true);

function strip(key, value) { return key === "line" || key === "col" ? undefined : value; }
const digest = createHash("sha256").update(JSON.stringify(observations)).digest("hex");
console.log(`ORACLE_DIGEST:${digest}`);
