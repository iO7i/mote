import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = dirname(fileURLToPath(import.meta.url));
const generated = join(APP, "generated");
rmSync(generated, { recursive: true, force: true });
mkdirSync(generated, { recursive: true });
const cli = join(ROOT, "bin", "mote.mjs");
const tsc = join(ROOT, "node_modules", "typescript", "bin", "tsc");
const compile = spawnSync(process.execPath, [cli, "compile", join(APP, "mote"), "--out", generated], { cwd: ROOT, encoding: "utf8", windowsHide: true });
if (compile.status !== 0) { process.stderr.write(compile.stderr || compile.stdout); process.exit(1); }
const core = spawnSync(process.execPath, [tsc, "-p", join(generated, "tsconfig.json")], { cwd: ROOT, encoding: "utf8", windowsHide: true });
if (core.status !== 0) { process.stderr.write(core.stderr || core.stdout); process.exit(1); }
const adapter = join(APP, "adapter.ts");
const typed = spawnSync(process.execPath, [tsc, "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--outDir", APP, "--rootDir", APP, adapter], { cwd: ROOT, encoding: "utf8", windowsHide: true });
if (typed.status !== 0) { process.stderr.write(typed.stderr || typed.stdout); process.exit(1); }
console.log(JSON.stringify({ status: "PASS", generated }));
