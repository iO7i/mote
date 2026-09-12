const raw = process.argv[2];
if (!raw) { console.error("usage: node examples/ledger-app/run.mjs '<json>'"); process.exit(2); }
try {
  const { summarize } = await import("./adapter.js");
  console.log(JSON.stringify(summarize(raw)));
} catch (error) {
  console.error(error?.message ?? String(error));
  process.exit(1);
}
