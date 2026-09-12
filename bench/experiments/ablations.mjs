// Materialize pre-registered, sound representation ablations for the pilot.
// This only emits condition metadata; no agent is run and no outcome is made.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatMote } from "../../src/formatter.mjs";
import { parse } from "../../src/parser.mjs";
import { estimateTokens } from "../../src/measure.mjs";
import { gitSha, hashJson, sha256 } from "../protocol.mjs";
import { FIXTURE_BY_ID } from "../corpus/accepted/registry.mjs";
import { loadAcceptedTasks } from "../corpus/accepted/validate.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const taskSet = JSON.parse(readFileSync(join(root, "bench/corpus/manifest.json"), "utf8"));
const loaded = loadAcceptedTasks(root, taskSet);
const tasks = [];
for (const { task } of loaded.tasks) {
  const fixture = FIXTURE_BY_ID.get(task.id);
  const mote = task.visibleFiles.mote["solution.mt"];
  let verbose = mote;
  try { verbose = formatMote(parse(mote, `${task.id}.mt`), "readable"); } catch { /* review will flag a source drift */ }
  const documentation = `${task.prompt}\n\nRepository conventions:\n- preserve the public solve API\n- run the visible and hidden boundary checks\n- report validation errors with their source path\n`;
  tasks.push({
    id: task.id,
    variants: {
      "compact-mote": variant("mote", mote, "same source contract"),
      "verbose-mote": variant("mote", verbose, "formatter-readable projection; AST round-trip required"),
      "type-light": { status: "NOT_APPLICABLE", reason: "Removing the visible type boundary is unsound for this task's contract; no invalid ablation is materialized." },
      "documentation-heavy": { language: "mote", promptHash: sha256(documentation), promptBytes: Buffer.byteLength(documentation), source: "compact-mote" },
      "typescript-control": variant("typescript", fixture.visibleFiles.typescript["solution.ts"], "paired language control"),
    },
  });
}
const report = { schemaVersion: 1, experiment: "representation-ablations", sourceRevision: gitSha(root), status: "DESIGN_ONLY_NO_AGENT_RUN", taskSetHash: hashJson(taskSet), soundnessRule: "Only syntax-preserving formatter projections and prompt additions are materialized; type-light is explicitly not applicable.", tasks, exclusions: ["No ablation result is a model observation.", "Documentation-heavy changes prompt tokens and must be cost-accounted."] };
mkdirSync(join(root, "bench", "raw"), { recursive: true });
writeFileSync(join(root, "bench", "raw", "ablation-design-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, tasks: tasks.length, variants: Object.keys(tasks[0]?.variants ?? {}) }, null, 2));

function variant(language, source, note) { return { status: "MATERIALIZED", language, sourceHash: sha256(source), sourceBytes: Buffer.byteLength(source), sourceTokens: estimateTokens(source).tokens, note }; }
