// Token estimation for `mote measure`.
// This is a deliberately honest heuristic — NOT a real tokenizer. Real,
// per-tokenizer counts come from the benchmark harness adapters (bench/).

export function estimateTokens(src) {
  const bytes = Buffer.byteLength(src, "utf8");
  const lines = src.split("\n").length;
  // GPT-style English/code averages ~4 chars/token; code trends a little denser.
  const tokens = Math.round(bytes / 3.8);
  return {
    bytes,
    lines,
    tokens,
    status: "UNVERIFIED",
    method: "chars/3.8 heuristic (no tokenizer loaded)",
  };
}
