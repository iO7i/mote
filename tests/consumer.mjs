// Pack and install Mote exactly as an external Node consumer would.
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const run = (command, args, cwd) => spawnSync(command, args, {
  cwd, encoding: "utf8", shell: process.platform === "win32" && command.endsWith(".cmd"),
});
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
let failed = 0;
const expect = (name, value, detail = "") => { if (!value) { failed++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`); } };
let tarball;
const consumer = mkdtempSync(join(tmpdir(), "mote-consumer-"));
try {
  const packed = run(NPM, ["pack", "--json"], ROOT);
  if (packed.status !== 0) throw new Error(`npm pack failed: ${packed.stderr || packed.error?.message || "unknown failure"}`);
  const info = JSON.parse(packed.stdout)[0];
  tarball = join(ROOT, info.filename);
  expect("package includes public compiler API", packed.status === 0 && info.files.some((f) => f.path === "src/api.mjs"));
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer-check", private: true, type: "module" }));
  const installed = run(NPM, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);
  expect("packed module installs", installed.status === 0, installed.stderr);
  writeFileSync(join(consumer, "index.mjs"), "import { checkSource } from 'mote/api'; const r=checkSource('type Event={id:str}'); if(!r.ok) process.exit(1); console.log(r.envelope.compiler.name)");
  const imported = run(process.execPath, ["index.mjs"], consumer);
  expect("external consumer imports API", imported.status === 0 && imported.stdout.trim() === "mote");
} finally {
  if (tarball) try { unlinkSync(tarball); } catch { /* cleanup test artifact */ }
  rmSync(consumer, { recursive: true, force: true });
}
console.log(`${failed ? "FAIL" : "PASS"} external consumer package`);
process.exit(failed ? 1 : 0);
