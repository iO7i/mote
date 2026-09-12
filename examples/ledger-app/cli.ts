import { api, appendRecord, readRecords } from "./adapter.js";

const [command, ...args] = process.argv.slice(2);
const file = args[0] ?? "ledger.json";

if (command === "summarize") {
  const raw = args[0];
  if (!raw) fail("usage: mote-ledger summarize <json>");
  console.log(JSON.stringify(api(raw)));
} else if (command === "append") {
  const raw = args[1];
  if (!raw) fail("usage: mote-ledger append <file> <json>");
  try { console.log(JSON.stringify({ count: appendRecord(file, raw) })); }
  catch (error) { fail(error instanceof Error ? error.message : String(error)); }
} else if (command === "list") {
  try { console.log(JSON.stringify(readRecords(file))); }
  catch (error) { fail(error instanceof Error ? error.message : String(error)); }
} else fail("usage: mote-ledger <summarize|append|list> ...");

function fail(message: string): never { console.error(message); process.exit(2); }
