// Correctness oracle envelope for paired candidates. Task definitions provide
// phase commands; this module never treats compilation alone as success.
import { runPhases } from "../eval/candidate-runner.mjs";

export const ORACLE_PHASES = Object.freeze(["parse", "typecheck", "generated-typescript", "public-tests", "hidden-tests", "boundary-validation", "mutation-tests", "api-existence", "property-invariants", "regression-tests"]);

export function evaluateCandidate({ task, language, workspace, mode = "docker", allowLocal = false, limits = {} }) {
  const phases = task.phases?.[language] ?? [];
  const execution = runPhases({ workspace, phases, mode, allowLocal, limits });
  const byName = new Map(execution.phases.map((phase) => [phase.name, phase]));
  const checks = Object.fromEntries(ORACLE_PHASES.map((name) => [name, phaseStatus(byName.get(name))]));
  const taskSuccess = execution.status === "PASSED" && phases.length > 0 && Object.values(checks).filter((value) => value !== "not-run").every((value) => value === "passed");
  return { schemaVersion: 1, taskId: task.id ?? null, language, taskSuccess, verifiedWorkUnits: taskSuccess ? task.verifiedWorkUnits ?? 1 : 0, checks, execution, failureClass: execution.failureClass ?? firstFailure(checks) };
}

function phaseStatus(phase) { return !phase ? "not-run" : phase.status === "passed" ? "passed" : "failed"; }
function firstFailure(checks) { return Object.entries(checks).find(([, status]) => status === "failed")?.[0] ?? null; }
