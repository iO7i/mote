This async queue worker processes a typed job payload with idempotency, retry
classification, and a structured outcome. `process` validates the raw job against
`Job` (untrusted input), then — if the idempotency key has not been seen —
performs the async write. A successful write yields an `ok` outcome; a failure is
classified as `retry` for transient errors (`timeout`, `503`) or `failed`
otherwise. A duplicate key skips the write entirely. Invalid payloads reject with
the exact JSON path.

```ts
export type Job = { id: string; userId: string; amount: number; key: string };
export type Outcome = { status: string; jobId: string; detail: string };
export type WriteResult = { ok: true } | { ok: false; error: string };
export interface Store { seen(key: string): boolean }
export type Writer = (j: Job) => Promise<WriteResult>;

class ValidationError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function kind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : "num";
  if (typeof v === "boolean") return "bool";
  return "object";
}
function num(v: unknown, path: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new ValidationError(`${path} expected num, got ${kind(v)}`);
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== "string") throw new ValidationError(`${path} expected str, got ${kind(v)}`);
  return v;
}
function parseJob(raw: string): Job {
  const root: unknown = JSON.parse(raw);
  if (!isObject(root)) throw new ValidationError("$ expected object, got " + kind(root));
  return {
    id: str(root["id"], "$.id"),
    userId: str(root["userId"], "$.userId"),
    amount: num(root["amount"], "$.amount"),
    key: str(root["key"], "$.key"),
  };
}
function retryable(code: string): boolean {
  return code === "timeout" || code === "503";
}
function classify(j: Job, code: string): Outcome {
  return { status: retryable(code) ? "retry" : "failed", jobId: j.id, detail: code };
}
function settle(j: Job, r: WriteResult): Outcome {
  return r.ok ? { status: "ok", jobId: j.id, detail: "charged" } : classify(j, r.error);
}
async function attempt(j: Job, write: Writer): Promise<Outcome> {
  return settle(j, await write(j));
}
async function run(j: Job, store: Store, write: Writer): Promise<Outcome> {
  return store.seen(j.key)
    ? { status: "duplicate", jobId: j.id, detail: "idempotent skip" }
    : attempt(j, write);
}
export async function process(raw: string, store: Store, write: Writer): Promise<Outcome> {
  return run(parseJob(raw), store, write);
}
```
