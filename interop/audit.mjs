import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "corpus.json");
const corpus = JSON.parse(readFileSync(file, "utf8"));
const allowed = new Set(["PASS", "PARTIAL", "UNSUPPORTED", "NOT APPLICABLE", "NOT RUN"]);
const errors = [];
if (corpus.schemaVersion !== 1 || !corpus.corpusVersion) errors.push("invalid corpus metadata");
const ids = new Set();
for (const item of corpus.cases ?? []) {
  if (ids.has(item.id)) errors.push(`duplicate case ${item.id}`);
  ids.add(item.id);
  for (const field of ["id", "shape", "specifier", "version", "status", "evidence"]) if (!item[field]) errors.push(`${item.id ?? "<case>"} missing ${field}`);
  if (!allowed.has(item.status)) errors.push(`${item.id}: unknown status`);
}
console.log(JSON.stringify({ ok: errors.length === 0, corpusVersion: corpus.corpusVersion, cases: corpus.cases?.length ?? 0, statuses: Object.fromEntries([...allowed].map((status) => [status, corpus.cases?.filter((item) => item.status === status).length ?? 0])), errors }, null, 2));
process.exit(errors.length ? 1 : 0);
