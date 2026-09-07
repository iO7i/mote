// Untyped reference (secondary). No static types, NO runtime validation.

function retryable(code) {
  return code === "timeout" || code === "503";
}
function classify(j, code) {
  return { status: retryable(code) ? "retry" : "failed", jobId: j.id, detail: code };
}
function settle(j, r) {
  return r.ok ? { status: "ok", jobId: j.id, detail: "charged" } : classify(j, r.error);
}
async function attempt(j, write) {
  return settle(j, await write(j));
}
async function run(j, store, write) {
  return store.seen(j.key)
    ? { status: "duplicate", jobId: j.id, detail: "idempotent skip" }
    : attempt(j, write);
}
export async function process(raw, store, write) {
  return run(JSON.parse(raw), store, write);
}
