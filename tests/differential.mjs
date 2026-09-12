// Bounded semantic differential checks. Expected values are computed by the
// test oracle, then compared with the compiled JavaScript in a fresh module.
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "../src/compile.mjs";

const index = process.argv.indexOf("--cases");
const cases = Number(index >= 0 ? process.argv[index + 1] : 128);
const runtime = pathToFileURL(fileURLToPath(new URL("../src/runtime/mote.mjs", import.meta.url))).href;
const testDir = fileURLToPath(new URL(".", import.meta.url));
let failed = 0, checked = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };

for (let i = 0; i < cases; i++) {
  const a = (i * 17) % 997;
  const b = (i * 31) % 991 + 1;
  const op = ["+", "-", "*", "%"][i % 4];
  await check(`arithmetic-${i}`, `fn f(a:num,b:num)->num=a${op}b\nconsole.log(f(${a},${b}))`, String(oracleArithmetic(a, b, op)));
}
for (let i = 0; i < 16; i++) {
  const source = `type M={name:str?,score:num}\nfn f(m:M)->str=m.name??"none"\nconsole.log(f({score:${i}}))`;
  await check(`nullable-record-${i}`, source, "none");
}
for (let i = 0; i < 16; i++) {
  const source = `type E={meta:{id:str},tags:[str]}\nlet e=json<E>('{"meta":{"id":"e${i}"},"tags":["ok"]}')?\nconsole.log(e.meta.id)`;
  await check(`json-boundary-${i}`, source, `e${i}`, { runtimeImport: runtime });
}

console.log(`${failed ? "FAIL" : "PASS"} semantic differential cases=${cases + 32} checked=${checked}`);
process.exit(failed ? 1 : 0);

async function check(name, source, expected, options = {}) {
  const result = compile(source, { file: `${name}.mt`, emitTypes: false, ...options });
  expect(`${name} compiles`, !result.diagnostics.hasErrors, result.diagnostics.format());
  if (result.diagnostics.hasErrors) return;
  const file = join(testDir, `.differential-${process.pid}-${checked}.mjs`);
  checked++;
  writeFileSync(file, result.code);
  const output = [];
  const original = console.log;
  console.log = (...args) => output.push(args.map((value) => typeof value === "object" ? JSON.stringify(value) : String(value)).join(" "));
  try { await import(`${pathToFileURL(file).href}?case=${checked}`); }
  catch (error) { expect(`${name} executes`, false, error.message); }
  finally { console.log = original; try { unlinkSync(file); } catch { /* best effort */ } }
  expect(`${name} matches independent oracle`, output.join("\n") === expected, `got=${JSON.stringify(output.join("\n"))} expected=${expected}`);
}

function oracleArithmetic(a, b, op) { if (op === "+") return a + b; if (op === "-") return a - b; if (op === "*") return a * b; return a % b; }
