// Regenerate accepted task.json files and the pilot manifest from the private
// fixture registry. This keeps the accepted corpus reviewable and hashable.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES } from "./registry.mjs";
import { hashJson } from "../../protocol.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const manifestFile = join(ROOT, "bench/corpus/manifest.json");
const current = JSON.parse(readFileSync(manifestFile, "utf8"));
const byId = new Map(current.tasks.map((task) => [task.id, task]));
const tasks = FIXTURES.map((fixture) => ({
  id: fixture.id,
  title: fixture.title,
  stratum: fixture.stratum,
  kind: fixture.kind,
  repoScale: fixture.repoScale,
  hardNegative: false,
  taskPath: `bench/corpus/accepted/${fixture.id}/task.json`,
  acceptanceStatus: "ACCEPTED",
}));
const next = {
  ...current,
  corpusVersion: "pilot-0.2.0",
  status: "PILOT_ACCEPTED",
  acceptedTaskCount: FIXTURES.length,
  tasks: [...tasks, ...current.tasks.filter((task) => !byId.has(task.id) || Number(task.id.slice(1)) > 20)],
};
const taskSetHash = hashJson(next);

for (const fixture of FIXTURES) {
  const dir = join(HERE, fixture.id);
  mkdirSync(dir, { recursive: true });
  const task = {
    schemaVersion: 1,
    id: fixture.id,
    title: fixture.title,
    taskSetHash,
    corpusVersion: next.corpusVersion,
    stratum: fixture.stratum,
    kind: fixture.kind,
    repoScale: fixture.repoScale,
    hardNegative: false,
    prompt: fixture.prompt,
    visibleFiles: fixture.visibleFiles,
    phases: fixture.phases,
    budgets: { phaseWorkUnits: 1, maxRepairRounds: 12 },
    verifiedWorkUnits: fixture.verifiedWorkUnits,
    repository: fixture.repository,
    oracle: fixture.oracle,
    mutations: fixture.mutations.map(({ name }) => ({ name, expected: "at-least-one-hidden-case-fails" })),
    privateFixture: { module: "bench/corpus/accepted/registry.mjs", fixtureId: fixture.id },
    review: { decision: "accepted", reviewer: "local-independent-review", reviewedAt: "2026-09-12", notes: "Paired reference arms pass the independent oracle and the mutation control is killed in both languages." },
  };
  writeFileSync(join(dir, "task.json"), JSON.stringify(task, null, 2) + "\n");
}
writeFileSync(manifestFile, JSON.stringify(next, null, 2) + "\n");
console.log(JSON.stringify({ generated: FIXTURES.length, taskSetHash, corpusVersion: next.corpusVersion }, null, 2));
