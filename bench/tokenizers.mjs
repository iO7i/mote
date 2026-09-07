// Tokenizer adapters for the Mote × Tarse benchmark.
//
// An adapter is: { name, version, status, count(text) -> integer }.
// `status` is "VERIFIED" only for real tokenizer libraries. The built-in
// adapters are HEURISTICS and are explicitly marked UNVERIFIED — do NOT quote
// their numbers as tokenizer-accurate. Plug real adapters below.

export function heuristicChars(divisor, label) {
  return {
    name: label,
    version: "heuristic-1",
    status: "UNVERIFIED",
    count: (text) => Math.max(0, Math.round(Buffer.byteLength(text, "utf8") / divisor)),
  };
}

export function whitespaceWords() {
  return {
    name: "whitespace-words",
    version: "heuristic-1",
    status: "UNVERIFIED",
    count: (text) => (text.trim() ? text.trim().split(/\s+/).length : 0),
  };
}

// Attempt to load real tokenizer packages if the user has installed them.
// None are bundled (kept dependency-free); each returns null when absent.
async function tryLoad(spec, build) {
  try { return build(await import(spec)); } catch { return null; }
}

export async function loadAdapters() {
  const adapters = [
    heuristicChars(3.8, "chars-3.8 (code-ish)"),
    heuristicChars(4.0, "chars-4.0 (prose-ish)"),
    whitespaceWords(),
  ];

  // Real adapters (optional). Install to upgrade status to VERIFIED, e.g.:
  //   npm i gpt-tokenizer @dqbd/tiktoken @xenova/transformers
  const gpt = await tryLoad("gpt-tokenizer", (m) => ({
    name: "openai/o200k_base",
    version: "gpt-tokenizer",
    status: "VERIFIED",
    count: (t) => m.encode(t).length,
  }));
  if (gpt) adapters.push(gpt);

  const lenml = async (spec, name) => tryLoad(spec, (m) => {
    const tok = m.fromPreTrained();
    return { name, version: spec, status: "VERIFIED", count: (t) => tok.encode(t).length };
  });
  const llama = await lenml("@lenml/tokenizer-llama3", "meta/llama-3");
  if (llama) adapters.push(llama);
  const deepseek = await lenml("@lenml/tokenizer-deepseek_v3", "deepseek/v3");
  if (deepseek) adapters.push(deepseek);

  return adapters;
}

// Default single adapter used for the headline REPORT.md table.
export function primary(adapters) {
  return adapters.find((a) => a.status === "VERIFIED") ?? adapters[0];
}
