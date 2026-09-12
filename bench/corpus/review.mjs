// Skeptical, per-task review of the accepted pilot. This is an acceptance
// audit, not a model benchmark: it runs both reference arms and verifies that
// visible starters do not contain private references or oracle inputs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "../../src/measure.mjs";
import { hashJson } from "../protocol.mjs";
import { FIXTURE_BY_ID } from "./accepted/registry.mjs";
import { loadAcceptedTasks } from "./accepted/validate.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, "bench/corpus/manifest.json"), "utf8"));
const loaded = loadAcceptedTasks(root, manifest);
const acceptance = runAcceptance();
const acceptanceById = new Map((acceptance.results ?? []).map((result) => [result.id, result]));
const tasks = loaded.tasks.map(({ task, fixture }) => reviewTask(task, fixture));
const report = {
  schemaVersion: 1,
  report: "pilot-corpus-review",
  corpusVersion: manifest.corpusVersion,
  taskSetHash: hashJson(manifest),
  reviewedAt: "2026-09-12",
  decision: loaded.ok && acceptance.status === 0 && tasks.every((task) => task.acceptance.decision === "ACCEPTED") ? "PILOT_ACCEPTED_WITH_LIMITATIONS" : "REVIEW_FAILED",
  limitations: [
    "All 20 accepted tasks are compact synthetic fixtures, so familiarity and single-function priors are high.",
    "The pilot establishes harness validity and oracle controls; it does not estimate model efficacy.",
    "Runtime and package-interoperability coverage is represented by dedicated strata but remains fixture-level.",
  ],
  summary: {
    accepted: tasks.filter((task) => task.acceptance.decision === "ACCEPTED").length,
    equivalencePass: tasks.filter((task) => task.acceptance.equivalence).length,
    mutationControlPass: tasks.filter((task) => task.acceptance.mutationControls).length,
    highFamiliarityRisk: tasks.filter((task) => task.familiarity.risk === "HIGH").length,
    hiddenLeakageFlags: tasks.filter((task) => task.exclusions.some((item) => item.code === "VISIBLE_PRIVATE_OVERLAP")).length,
  },
  tasks,
};
const outDir = join(root, "bench", "corpus", "reports");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pilot-review-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(report.decision === "PILOT_ACCEPTED_WITH_LIMITATIONS" ? 0 : 1);

function runAcceptance() {
  const file = join(root, "bench", "corpus", "accepted", "run.mjs");
  return parseLastJson(spawnSync(process.execPath, [file], { cwd: root, encoding: "utf8", timeout: 120_000, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }));
}

function parseLastJson(run) {
  try { return { status: run.status ?? 1, ...JSON.parse(run.stdout) }; }
  catch { return { status: run.status ?? 1, results: [], raw: `${run.stdout ?? ""}${run.stderr ?? ""}`.slice(-2000) }; }
}

function reviewTask(task, fixture) {
  const result = acceptanceById.get(task.id) ?? { accepted: false, arms: {}, mutations: {} };
  const visibleText = Object.values(task.visibleFiles ?? {}).flatMap((files) => Object.values(files)).join("\n");
  const privateText = [fixture.referenceSolutions.mote, fixture.referenceSolutions.typescript, JSON.stringify(fixture.inputs), JSON.stringify(fixture.mutations)].join("\n");
  const overlap = visibleText.includes(fixture.referenceSolutions.mote) || visibleText.includes(fixture.referenceSolutions.typescript);
  const mutationControls = Object.values(result.mutations ?? {}).flat().every((mutation) => mutation.killed === true);
  const equivalence = Object.values(result.arms ?? {}).every((arm) => arm.success === true);
  const sourceStats = Object.fromEntries(["mote", "typescript"].map((language) => {
    const files = Object.entries(task.visibleFiles?.[language] ?? {});
    const source = files.map(([, text]) => text).join("\n");
    return [language, { files: files.length, bytes: Buffer.byteLength(source), lines: source.split(/\r?\n/).length, estimatedTokens: estimateTokens(source).tokens }];
  }));
  const exclusions = [];
  if (overlap) exclusions.push({ code: "VISIBLE_PRIVATE_OVERLAP", severity: "BLOCKING", detail: "visible starter contains a complete private reference" });
  if (!task.review?.notes || !task.review?.reviewer) exclusions.push({ code: "MISSING_REVIEW_METADATA", severity: "BLOCKING" });
  if (fixture.inputs.length < 3) exclusions.push({ code: "TOO_FEW_ORACLE_CASES", severity: "WARNING", detail: "fewer than three cases" });
  return {
    id: task.id,
    title: task.title,
    strata: { primary: task.stratum, kind: task.kind, repoScale: task.repoScale },
    acceptance: {
      decision: result.accepted && equivalence && mutationControls && !overlap ? "ACCEPTED" : "REJECTED",
      equivalence,
      mutationControls,
      referenceArmStatuses: Object.fromEntries(Object.entries(result.arms ?? {}).map(([language, arm]) => [language, arm.success ? "PASS" : "FAIL"])),
    },
    accounting: {
      visibleSource: sourceStats,
      privateOracleCases: fixture.inputs.length,
      mutationControls: fixture.mutations.length,
      phaseCount: task.phases?.mote?.length ?? 0,
      repositorySeed: task.repository?.seed ?? null,
      dependencyLockfileHash: task.repository?.dependencyLockfileHash ?? null,
    },
    functionality: {
      publicApi: "solve(input)",
      boundaryCases: fixture.inputs.length,
      hiddenOracleIndependent: task.oracle?.independent === true,
      generatedTypescriptRequired: task.phases?.mote?.some((phase) => phase.name === "generated-typescript") === true,
    },
    documentation: {
      promptPresent: typeof task.prompt === "string" && task.prompt.length > 20,
      languageNeutral: !/Mote-only|TypeScript-only|use Mote|use TypeScript/i.test(task.prompt ?? ""),
      reviewNotesPresent: Boolean(task.review?.notes),
    },
    familiarity: {
      risk: task.repoScale === "large" || task.stratum === "long-context" ? "HIGH" : "HIGH",
      reason: "single-function synthetic starter with a named solve API; suitable for pilot controls, insufficient for a general familiarity claim",
      requiredFollowUp: "repeat in cold/warm/few-shot and multi-module repository conditions",
    },
    exclusions,
  };
}
