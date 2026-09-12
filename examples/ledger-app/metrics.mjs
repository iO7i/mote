// Derive application ownership/accounting numbers from checked-in sources.
// Generated output is evidence metadata, not a performance measurement.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "../../src/measure.mjs";

const app = resolve(fileURLToPath(new URL(".", import.meta.url)));
const root = resolve(app, "../..");
const moteFiles = readdirSync(join(app, "mote")).filter((file) => file.endsWith(".mt")).map((file) => join(app, "mote", file));
const typescriptFiles = ["adapter.ts", "cli.ts"].map((file) => join(app, file));

const result = {
  schemaVersion: 2,
  accounting: "non-empty, non-comment executable declarations and source metrics from checked-in app files",
  mote: summarize(moteFiles, /^(?:pub )?fn /),
  typescript: { ...summarize(typescriptFiles, /^export (?:function|type) /), cliEntrypoints: 1, externalRuntimeDependencies: 0 },
  tests: { file: "tests/ledger-app.mjs", assertions: readFileSync(join(root, "tests", "ledger-app.mjs"), "utf8").match(/expect\(/g)?.length ?? 0 },
  generated: summarizeExisting(join(app, "generated")),
  startup: { command: "node examples/ledger-app/build.mjs", status: "MEASURED_BY_BUILD_GATE", wallClockMs: null },
  performanceClaim: false,
};
result.adapterStatementShare = result.mote.nonCommentLines + result.typescript.nonCommentLines
  ? result.typescript.nonCommentLines / (result.mote.nonCommentLines + result.typescript.nonCommentLines) : null;

if (process.argv.includes("--write")) writeFileSync(join(app, "adapter-metrics.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));

function summarize(files, declarationPattern) {
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  const lines = source.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("//"));
  return { files: files.length, lines: lines.length, nonCommentLines: lines.length, declarations: source.split(/\r?\n/).filter((line) => declarationPattern.test(line.trim())).length, estimatedTokens: estimateTokens(source).tokens };
}

function summarizeExisting(dir) {
  if (!existsSync(dir)) return { status: "BUILD_DEPENDENT", files: 0, lines: 0, nonCommentLines: 0, declarations: 0, estimatedTokens: 0 };
  const files = readdirSync(dir).filter((file) => file.endsWith(".ts")).map((file) => join(dir, file));
  return { status: "PRESENT", ...summarize(files, /^export (?:function|type|declare)/) };
}
