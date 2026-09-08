// Regression tests for compiler trust boundaries and runtime semantics.
import { compile } from "../src/compile.mjs";
import { checkSource } from "../src/api.mjs";
import { validate } from "../src/runtime/mote.mjs";

let failed = 0;
function expect(name, value) { if (!value) { failed++; console.error(`FAIL ${name}`); } }
const codes = (src) => compile(src, { file: "trust.mt" }).diagnostics.items.map((d) => d.code);

expect("parser failures are structured", checkSource("let =", { file: "bad.mt" }).envelope.diagnostics[0]?.code === "M001");
expect("cyclic aliases are rejected", codes("type A=B\ntype B=A").includes("M111"));
expect("generic aliases fail closed", codes("type Box<T>={value:T}").includes("M310"));
expect("validation aliases cannot contain any", codes("type Unsafe={value:any}\nlet x=json<Unsafe>(raw)").includes("M311"));
expect("quoted object key is emitted safely", compile('fn f()={"x-y":1}', { file: "keys.mt" }).code.includes('"x-y": 1'));

const optional = { k: "object", fields: [{ name: "note", optional: true, schema: { k: "str" } }] };
expect("optional property may be absent", validate({}, optional, {}).ok);
expect("explicit null is not silently optional", !validate({ note: null }, optional, {}).ok);
expect("explicit undefined is not silently optional", !validate({ note: undefined }, optional, {}).ok);
expect("nil accepts only null", validate(null, { k: "nil" }, {}).ok && !validate(undefined, { k: "nil" }, {}).ok);
expect("num rejects infinity", !validate(Infinity, { k: "num" }, {}).ok && !validate(-Infinity, { k: "num" }, {}).ok);
expect("unknown references are data failures", !validate(1, { k: "ref", name: "Missing" }, {}).ok);
expect("schema cycles are data failures", !validate(1, { k: "ref", name: "A" }, { A: { k: "ref", name: "A" } }).ok);
expect("malformed schemas are data failures", !validate([], { k: "array" }, {}).ok && !validate({}, { k: "object" }, {}).ok);

console.log(`${failed ? "FAIL" : "PASS"} trust regressions`);
process.exit(failed ? 1 : 0);
