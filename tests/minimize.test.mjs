import { minimizeCompilerFailure, minimizeSource } from "./minimize.mjs";

let failed = 0;
const expect = (name, value) => { if (!value) { failed++; console.error(`FAIL ${name}`); } };
const original = "alpha beta gamma\nkeep this\nremove this";
const minimized = minimizeSource(original, (source) => source.includes("keep this") && !source.includes("remove this"));
expect("minimizer preserves predicate", minimized.source.includes("keep this") && !minimized.source.includes("remove this"));
expect("minimizer is deterministic", minimized.sha256 === minimizeSource(original, (source) => source.includes("keep this") && !source.includes("remove this")).sha256);
const metadata = minimizeCompilerFailure("fn broken(=1", { seed: 42, phase: "parse", failureClass: "parse", predicate: (source) => source.includes("broken") });
expect("failure metadata records seed and original hash", metadata.seed === 42 && metadata.originalSha256.length === 64 && metadata.phase === "parse");
console.log(`${failed ? "FAIL" : "PASS"} crash minimizer`);
process.exit(failed ? 1 : 0);
