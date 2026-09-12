import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FIXTURE_BY_ID } from "./registry.mjs";
import { hashJson } from "../../protocol.mjs";

export function loadAcceptedTasks(root, taskSet) {
  const errors = [];
  const tasks = [];
  const manifestHash = hashJson(taskSet);
  for (const entry of taskSet.tasks ?? []) {
    if (entry.acceptanceStatus !== "ACCEPTED") continue;
    if (!entry.taskPath) { errors.push(`${entry.id}: accepted taskPath is missing`); continue; }
    const file = resolve(root, entry.taskPath);
    if (!existsSync(file)) { errors.push(`${entry.id}: missing ${entry.taskPath}`); continue; }
    let task;
    try { task = JSON.parse(readFileSync(file, "utf8")); } catch (error) { errors.push(`${entry.id}: invalid task JSON: ${error.message}`); continue; }
    const fixture = FIXTURE_BY_ID.get(task.privateFixture?.fixtureId);
    if (!fixture) { errors.push(`${entry.id}: private fixture is missing`); continue; }
    if (task.id !== entry.id || task.taskSetHash !== manifestHash) errors.push(`${entry.id}: task identity/hash mismatch`);
    for (const key of ["prompt", "visibleFiles", "phases", "repository", "oracle", "mutations", "review"]) if (!task[key]) errors.push(`${entry.id}: missing ${key}`);
    if (!task.phases?.mote || !task.phases?.typescript || task.phases.mote.length !== task.phases.typescript.length) errors.push(`${entry.id}: language phases are not paired`);
    const moteNames = (task.phases?.mote ?? []).map((phase) => phase.name).join("|");
    const tsNames = (task.phases?.typescript ?? []).map((phase) => phase.name).join("|");
    if (moteNames !== tsNames) errors.push(`${entry.id}: phase names differ by language`);
    if (task.oracle.independent !== true) errors.push(`${entry.id}: oracle is not marked independent`);
    if (task.review.decision !== "accepted") errors.push(`${entry.id}: review decision is not accepted`);
    for (const language of ["mote", "typescript"]) {
      for (const phase of task.phases?.[language] ?? []) {
        if (!Array.isArray(phase.command) || !phase.command.length || phase.command.some((arg) => typeof arg !== "string")) errors.push(`${entry.id}: ${language}/${phase.name} command is not argv`);
      }
    }
    tasks.push({ task, fixture });
  }
  if (tasks.length !== taskSet.acceptedTaskCount) errors.push(`acceptedTaskCount=${taskSet.acceptedTaskCount} but found ${tasks.length}`);
  return { ok: errors.length === 0, errors, tasks, manifestHash };
}
