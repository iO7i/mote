// Seeded, deterministic property and differential tests. `--cases` is kept
// modest in normal CI; use `node tests/property.mjs --cases 12000` for soak.
import { compile } from "../src/compile.mjs";
import { validate } from "../src/runtime/mote.mjs";

const index = process.argv.indexOf("--cases");
const cases = index >= 0 ? Number(process.argv[index + 1]) : 512;
const seed = 0x5eedc0de;
let state = seed >>> 0;
let failed = 0;
const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const pick = (items) => items[Math.floor(next() * items.length)];
function expect(name, condition) { if (!condition) { failed++; console.error(`FAIL ${name}`); } }

for (let i = 0; i < cases; i++) {
  const a = Math.floor(next() * 1_000);
  const b = Math.floor(next() * 1_000);
  const op = pick(["+", "-", "*", "%"]);
  const source = `fn f(a:num,b:num)->num=a${op}b\nlet value=f(${a},${b || 1})`;
  expect(`compile property ${i}`, !compile(source, { file: `generated-${i}.mt` }).diagnostics.hasErrors);

  const value = pick([null, undefined, "text", true, false, a, Infinity, [a], { a }]);
  const schema = pick([{ k: "str" }, { k: "num" }, { k: "bool" }, { k: "nil" }, { k: "array", element: { k: "num" } }]);
  const actual = validate(value, schema, {}).ok;
  const expected = schema.k === "str" ? typeof value === "string"
    : schema.k === "num" ? typeof value === "number" && Number.isFinite(value)
    : schema.k === "bool" ? typeof value === "boolean"
    : schema.k === "nil" ? value === null
    : Array.isArray(value) && value.every((v) => typeof v === "number" && Number.isFinite(v));
  expect(`runtime differential ${i}`, actual === expected);
}

console.log(`${failed ? "FAIL" : "PASS"} property cases=${cases} seed=${seed}`);
process.exit(failed ? 1 : 0);
