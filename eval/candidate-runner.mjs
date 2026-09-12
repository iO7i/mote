// Bounded candidate execution. Docker is the admissible research mode.
// The local mode exists only for development and is explicitly labeled unsafe.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 30_000,
  maxOutputBytes: 256 * 1024,
  cpus: "1",
  memory: "512m",
  pidsLimit: "64",
  image: "node:22-bookworm-slim",
});

export function dockerAvailable() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8", timeout: 5000 });
  return result.status === 0 && !!result.stdout.trim();
}

export function createCandidateWorkspace(prefix = "mote-candidate-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function runPhases({ workspace, phases, mode = "docker", allowLocal = false, limits = {} }) {
  const config = { ...DEFAULT_LIMITS, ...limits };
  if (mode === "docker" && !dockerAvailable()) {
    return { status: "BLOCKED", isolation: "docker-unavailable", phases: [], failureClass: "infrastructure-failure" };
  }
  if (mode === "local" && !allowLocal) {
    return { status: "BLOCKED", isolation: "local-disabled", phases: [], failureClass: "unsafe-execution-disabled" };
  }
  const results = [];
  for (const phase of phases ?? []) {
    const result = mode === "docker"
      ? runDocker({ workspace, phase, limits: config })
      : runLocal({ workspace, phase, limits: config });
    results.push({ name: phase.name, ...result });
    if (result.status !== "passed") break;
  }
  const failed = results.find((r) => r.status !== "passed");
  return {
    status: failed ? "FAILED" : "PASSED",
    isolation: mode === "docker" ? "docker-bounded" : "local-unsafe",
    limits: config,
    phases: results,
    failureClass: failed?.failureClass ?? null,
  };
}

export function runInTemporaryWorkspace({ files = {}, phases, ...options }) {
  const workspace = createCandidateWorkspace();
  try {
    for (const [name, content] of Object.entries(files)) {
      const target = safePath(workspace, name);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
    return runPhases({ workspace, phases, ...options });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function runDocker({ workspace, phase, limits }) {
  const command = normalizeCommand(phase.command);
  const args = ["run", "--rm", "--network=none", `--cpus=${limits.cpus}`, `--memory=${limits.memory}`, `--pids-limit=${limits.pidsLimit}`,
    "--cap-drop=ALL", "--security-opt=no-new-privileges", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid", "-v", `${resolve(workspace)}:/workspace:rw`, "-w", "/workspace", limits.image, ...command];
  return processResult(spawnSync("docker", args, { encoding: "utf8", timeout: limits.timeoutMs, windowsHide: true }), limits, "docker");
}

function runLocal({ workspace, phase, limits }) {
  const command = normalizeCommand(phase.command);
  const pathValue = process.env.PATH ?? "";
  const env = process.platform === "win32" ? { PATH: pathValue, SystemRoot: process.env.SystemRoot ?? "" } : { PATH: pathValue, HOME: workspace, TMPDIR: join(workspace, "tmp") };
  return processResult(spawnSync(command[0], command.slice(1), { cwd: workspace, env, encoding: "utf8", timeout: limits.timeoutMs, windowsHide: true }), limits, "local");
}

function processResult(result, limits, transport) {
  const stdout = bound(result.stdout ?? "", limits.maxOutputBytes);
  const stderr = bound(result.stderr ?? "", limits.maxOutputBytes);
  let failureClass = null;
  if (result.error?.code === "ETIMEDOUT" || result.signal) failureClass = "timeout";
  else if (result.status !== 0) failureClass = "command-failure";
  return { transport, status: failureClass ? "failed" : "passed", exitCode: result.status, signal: result.signal ?? null, failureClass, stdout, stderr, outputTruncated: stdout.truncated || stderr.truncated };
}

function normalizeCommand(command) {
  if (!Array.isArray(command) || !command.length || command.some((x) => typeof x !== "string")) throw new Error("phase.command must be a non-empty argv array");
  return command;
}

function bound(text, max) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= max) return { text, bytes, truncated: false };
  return { text: Buffer.from(text, "utf8").subarray(0, max).toString("utf8"), bytes: max, truncated: true };
}

function safePath(root, name) {
  const base = resolve(root);
  const target = resolve(base, name);
  if (target !== base && !target.startsWith(base + "\\")) throw new Error(`path escapes candidate workspace: ${name}`);
  return target;
}
