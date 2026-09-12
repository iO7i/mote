// Deterministic delta-debugging helpers for compiler and harness failures.
import { createHash } from "node:crypto";

export function minimizeSource(source, predicate, { maxIterations = 400 } = {}) {
  let current = String(source);
  let iterations = 0;
  let changed = true;
  while (changed && iterations < maxIterations) {
    changed = false;
    const candidates = [
      ...removeLines(current),
      ...removeChunks(current, Math.max(1, Math.floor(current.length / 2))),
      ...removeChunks(current, Math.max(1, Math.floor(current.length / 4))),
      ...current.split(/\s+/).filter(Boolean).map((token) => current.replace(token, "")),
    ];
    for (const candidate of candidates) {
      iterations++;
      if (candidate !== current && predicate(candidate)) { current = candidate; changed = true; break; }
      if (iterations >= maxIterations) break;
    }
  }
  return { source: current, iterations, sha256: createHash("sha256").update(current).digest("hex") };
}

export function minimizeCompilerFailure(source, { seed, phase = "compiler", failureClass = "unexpected-throw", predicate, maxIterations } = {}) {
  if (typeof predicate !== "function") throw new Error("predicate is required");
  const minimized = minimizeSource(source, predicate, { maxIterations });
  return { schemaVersion: 1, seed: seed ?? null, phase, failureClass, originalSha256: createHash("sha256").update(String(source)).digest("hex"), ...minimized };
}

function removeLines(source) {
  const lines = source.split(/\r?\n/);
  return lines.map((_, index) => lines.filter((__, line) => line !== index).join("\n"));
}

function removeChunks(source, size) {
  const out = [];
  for (let start = 0; start < source.length; start += size) out.push(source.slice(0, start) + source.slice(start + size));
  return out;
}
